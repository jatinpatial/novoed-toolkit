"""BuildOrchestrator — sprint-2-3 sequential lesson loop.

Client-initiated, out-of-band orchestration of the full course build.
Per the locked architecture (see sprint #2 plan in conversation):

    - Client sends `{ type: "build_full_course", course, shape }` to the
      WS endpoint.
    - Backend session.py routes this to the orchestrator queue (NOT
      the chat queue — fan-out so a slow build doesn't backpressure
      chat events).
    - BuildOrchestrator runs sequential mini-sessions per lesson / KC
      slot / case-study slot. Each phase emits `build_progress` events
      via the WS so the FE updates the LessonTile state machine.
    - State lives backend-side (single source of truth). FE rehydrates
      after refresh via `get_orchestrator_state`.

Sprint-2-1 shipped the skeleton + event plumbing + state struct.
Sprint-2-3 (this commit) lands the real sequential lesson loop.
Sprint-2-6 adds retry+backoff; sprint-2-7 adds resume; KC + CS
phases land in sprint-2-8 / 2-9.

State machine (phase):

    idle             never run, or cleared after completion
    building         sequential lesson loop in progress
    paused           lesson_failed after one attempt; awaiting resume
                     (sprint-2-7 wires the actual resume)
    completed        course built, all lessons written
    cancelled        client sent build_cancel; pipeline halted at
                     last phase boundary
    failed           non-recoverable error (e.g. SDK crash); manual
                     intervention required

LessonState / KcState / CsState (per-target):

    idle             not yet started
    building         in flight
    done             completed successfully
    error            failed after one attempt; resumable in 2-7

Mini-session design (locked fork #2)

Each lesson runs in a fresh ClaudeSDKClient with the SAME options as
the main session — same file-loaded SYSTEM_PROMPT, same MCP server,
same allowed tools. The user message is a brief lesson directive;
the agent itself calls list_structure() to introspect course shape
and the lesson's objectives. NO structured args are passed in the
prompt — that path would diverge from the manual chat path and
introduce bugs that only manifest in one route.

Cost note (cost flag for 2-10a smoke)

Fresh ClaudeSDKClient per lesson means N+1 SDK init costs. Each
boot is ~5-10s on Windows. For a 12-lesson course that's potentially
60-120s of pure init overhead. Init time is logged per lesson so
sprint-2-10a can measure the total share. If init overhead exceeds
~20% of total wall-time, sprint-2-11 (TBD) revisits pooling.
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Literal

from claude_agent_sdk import (
    ClaudeAgentOptions,
    ClaudeSDKClient,
    ResultMessage,
)

from .bridge import ToolBridge
from .config import MODEL_FALLBACK, MODEL_WORKER, SYSTEM_PROMPT_FILE
from .ui_tools import ALLOWED_TOOL_NAMES, build_ui_mcp_server

log = logging.getLogger(__name__)


PhaseStatus = Literal["idle", "building", "paused", "completed", "cancelled", "failed"]
TargetStatus = Literal["idle", "building", "done", "error"]


# sprint-2-6: retry+backoff constants. One retry after a 5-second
# backoff before halting the build. Calibrated for the demo case
# (rate-limit blips + transient SDK glitches typically clear inside
# 5s). For a recurrent error, halting after attempt 2 surfaces the
# problem fast rather than silently extending wall-time on a doomed
# call.
LESSON_MAX_ATTEMPTS = 2
LESSON_RETRY_BACKOFF_SECONDS = 5
# B2-revert: previous version added an asyncio.wait_for timeout per
# attempt. That cancelled the Claude Agent SDK mid-stream, which the
# SDK doesn't tolerate — its receive_messages async generator left
# dangling state, the next operations raised, and the WebSocket to the
# FE died. Net effect: lessons that legitimately ran > 6 min (real BCG
# decks with rich materials are very capable of that) crashed the
# backend instead of completing.
#
# Reverted — no per-attempt timeout. Lessons can run as long as they
# need. The FE Cancel button still works for genuine hangs. A future
# fix would either: (a) implement a SOFT progress timeout that nudges
# the FE to show "still working" without cancelling the SDK, or
# (b) replace asyncio.wait_for with a watchdog that logs but doesn't
# raise. Neither is in scope right now — pilot-readiness > timeout
# enforcement.


@dataclass
class OrchestratorState:
    """Snapshot of the orchestrator's current state.

    Persists on the server side across WS reconnects so the FE can
    rehydrate via `get_orchestrator_state` after a refresh — the
    backend is the single source of truth (per locked fork #3).
    """
    phase: PhaseStatus = "idle"
    # Per-lesson states. Key is the absolute lesson index across the
    # whole course (so sprint-2-7's `start_from` resume references
    # match this index space). Value is the lesson's current status.
    lesson_states: dict[int, TargetStatus] = field(default_factory=dict)
    # Per-KC and per-CS states arrive in sprint-2-8 / 2-9. Reserved
    # here so the wire format is stable from the start.
    kc_states: dict[str, TargetStatus] = field(default_factory=dict)
    cs_states: dict[str, TargetStatus] = field(default_factory=dict)
    # Last completed lesson index (used by resume to know where to
    # pick up). None when nothing has completed yet.
    last_completed_lesson_idx: int | None = None
    # Total counts so the FE can render a denominator in the progress
    # band ("Building lesson 4 of 13"). Set when build_full_course
    # arrives; stable for the duration of the build.
    total_lessons: int = 0
    total_kcs: int = 0
    total_css: int = 0
    # Last error message (if any). Cleared on successful resume.
    last_error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Serialize for the build_state WS event payload."""
        return {
            "phase": self.phase,
            "lessonStates": {str(k): v for k, v in self.lesson_states.items()},
            "kcStates": dict(self.kc_states),
            "csStates": dict(self.cs_states),
            "lastCompletedLessonIdx": self.last_completed_lesson_idx,
            "totalLessons": self.total_lessons,
            "totalKcs": self.total_kcs,
            "totalCss": self.total_css,
            "lastError": self.last_error,
        }


# Type alias for the WS send function passed in from session.py. The
# orchestrator never imports the WebSocket directly — it just emits
# `{type, ...payload}` dicts that session._send forwards to the wire.
SendFn = Callable[[dict[str, Any]], Awaitable[None]]


@dataclass
class _LessonTarget:
    """Internal: one lesson to be built. Computed from the snapshot
    of `course` passed to build_full_course; stable for the build's
    duration. Index is absolute across the whole course."""
    idx: int
    module_idx: int
    lesson_idx: int
    lesson_id: str
    title: str
    duration_min: int


@dataclass
class _CSTarget:
    """Internal: one case-study slot to design. Computed from
    course.caseStudies — slots planted by Course Architect (MODE 1)
    with empty content fields are the targets. Slots already filled
    (re-build over an existing course) are skipped.
    sprint-2-9.
    """
    cs_id: str    # the slot's id, used as kc_states-equivalent key
    title: str    # for prompt + progress event display


@dataclass
class _KCTarget:
    """Internal: one knowledge-check slot to fill. Computed from the
    snapshot of `course` + shape directives; stable for the build.
    sprint-2-8.

    kc_id is the kcStates dict key on the wire (e.g. "lesson:b9hfkfomg"
    or "module:abc123") — composite so a course with both per-lesson
    KCs and module-level final assessments doesn't key-collide.
    """
    kc_id: str
    kind: Literal["lesson", "module"]
    target_id: str   # actual lesson_id or module_id
    title: str       # for prompt + progress event display
    module_idx: int  # for ordering + display
    lesson_idx: int | None  # None for module-level finals


class BuildOrchestrator:
    """Per-session orchestrator — one instance per WS connection.

    Owns its own asyncio.Lock so the orchestrator's coroutines don't
    contend with the chat session's _lock (per locked fork #3 — chat
    stays responsive during a build). Methods are awaitable; session.py
    schedules `build_full_course` / `resume` as background tasks.
    """

    def __init__(self, send: SendFn, bridge: ToolBridge) -> None:
        self._send = send
        # sprint-2-3: shared bridge with the main session. Tool_result
        # routing-by-call-id Just Works across sessions (UUIDs are
        # global). Mini-sessions build their MCP server from this same
        # bridge so write_lesson / list_structure / etc. hit the same
        # FE-side AgentActions handlers as the manual chat path.
        self._bridge = bridge
        self._state = OrchestratorState()
        self._lock = asyncio.Lock()  # serialize orchestrator method calls
        self._cancelled = False
        self._task: asyncio.Task[None] | None = None  # the active build coroutine, if any
        # Cached course snapshot from the most recent build_full_course
        # call. Used by resume() in sprint-2-7 so the FE doesn't have
        # to re-send the whole tree to pick up where we left off.
        self._course_snapshot: dict[str, Any] | None = None
        self._shape_snapshot: dict[str, Any] | None = None

    # ─── public API (called from session.py message router) ────────

    def update_sender(self, send: SendFn) -> None:
        """polish-13a: swap the WS sender after a reconnect.

        The orchestrator is a module-level singleton in session.py so
        a build-in-flight survives FE refreshes (HMR, manual reload,
        network blips). Each new Session calls this to point the
        orchestrator's emit calls at the new WS's send. Subsequent
        state events + progress events route through the new pipe.

        Existing tool_calls still in flight on the bridge keep their
        original future targets — the bridge's bind_sender is updated
        separately by the new Session, so future bridge.call(...)
        invocations route through the new WS too. Tool_calls that were
        already sent to the now-dead WS but didn't get a tool_result
        back will time out and trigger the orchestrator's retry path,
        which sends through the new pipe automatically.
        """
        self._send = send

    async def get_state(self) -> dict[str, Any]:
        """Return the current state for the FE to rehydrate after refresh."""
        return self._state.to_dict()

    async def build_full_course(self, course: dict[str, Any], shape: dict[str, Any] | None) -> None:
        """Start a full-course build. No-op if a build is already running."""
        async with self._lock:
            if self._state.phase == "building":
                await self._send({
                    "type": "error",
                    "message": "A build is already running — cancel it first or wait for completion.",
                })
                return

            targets = self._collect_lesson_targets(course)
            # sprint-2-8: KC targets computed up-front so totals are
            # stable for the FE's progress band denominator.
            kc_targets = self._collect_kc_targets(course, shape)
            # sprint-2-9: CS targets — case-study slots Course Architect
            # planted that don't yet have content. Already-designed
            # slots (re-build over an existing course) are skipped.
            cs_targets = self._collect_cs_targets(course)

            self._cancelled = False
            self._state = OrchestratorState(
                phase="building",
                total_lessons=len(targets),
                total_kcs=len(kc_targets),
                total_css=len(cs_targets),
            )
            for t in targets:
                self._state.lesson_states[t.idx] = "idle"
            for kt in kc_targets:
                self._state.kc_states[kt.kc_id] = "idle"
            for ct in cs_targets:
                self._state.cs_states[ct.cs_id] = "idle"
            self._course_snapshot = course
            self._shape_snapshot = shape

            await self._emit_state()
            log.info(
                "build_full_course start — lessons=%d kcs=%d css=%d shape=%s",
                len(targets), len(kc_targets), len(cs_targets), shape,
            )

        # Run the loops OUTSIDE the lock so cancel() / get_state() can
        # acquire it during the build. The lock guarded the state
        # transition into "building"; the loops read + write via state
        # methods that acquire the lock as needed for atomicity of
        # single transitions.
        await self._run_lesson_loop(targets, start_from=0)
        # sprint-2-8: KC phase runs only if the lesson loop didn't
        # halt (paused / cancelled / failed). Phase still "building"
        # is the green-light condition.
        if self._state.phase == "building" and kc_targets:
            await self._run_kc_loop(kc_targets, start_from=0)
        # sprint-2-9: CS phase runs only if KC phase didn't halt.
        if self._state.phase == "building" and cs_targets:
            await self._run_cs_loop(cs_targets, start_from=0)
        # course_completed + course_export_ready emitted here. Lets all
        # phases keep phase="building" through their runs and only
        # transitions to "completed" when ALL phases finish cleanly.
        if self._state.phase == "building":
            self._state.phase = "completed"
            await self._emit_state()
            await self._emit_progress("course_completed", {
                "totalLessons": self._state.total_lessons,
                "totalKcs": self._state.total_kcs,
                "totalCss": self._state.total_css,
            })
            # sprint-2-9: signal the FE that the course is fully built
            # and ready to download as a Word doc. The FE listens for
            # this event and auto-triggers the existing course-docx
            # export endpoint. Separate from course_completed so the
            # FE can stage the celebration (confetti) → download in
            # the right order without coupling the two.
            await self._emit_progress("course_export_ready", {
                "totalLessons": self._state.total_lessons,
                "totalKcs": self._state.total_kcs,
                "totalCss": self._state.total_css,
            })
            log.info(
                "build_full_course complete — %d lessons, %d KCs, %d CSs",
                self._state.total_lessons,
                self._state.total_kcs,
                self._state.total_css,
            )

    async def resume(self, start_from: int) -> None:
        """Resume a paused build from the given lesson index (sprint-2-7).

        Sprint-2-3: stub. Surfaces a not_implemented event for now —
        sprint-2-7 wires the resume against `_course_snapshot`.
        """
        async with self._lock:
            await self._emit_progress("not_implemented", {
                "message": "Resume lands in sprint-2-7.",
                "startFrom": start_from,
            })

    async def cancel(self) -> None:
        """Set the cancellation flag. The active phase loop checks this
        at phase boundaries (per locked fork #5: graceful, not abort).
        Sprint-2-3 reads this flag in the lesson loop.
        """
        async with self._lock:
            if self._state.phase != "building":
                return
            self._cancelled = True
            self._state.phase = "cancelled"
            await self._emit_state()

    @property
    def is_cancelled(self) -> bool:
        return self._cancelled

    # ─── internal: lesson loop ─────────────────────────────────────

    @staticmethod
    def _collect_lesson_targets(course: dict[str, Any]) -> list[_LessonTarget]:
        """Walk the course dict and produce a flat list of lessons in
        the order they appear. Absolute index increments across module
        boundaries to match the FE's lessonStates key space (locked,
        sprint-2-1). Defensive against missing fields — agent-built
        proposals are mostly clean, but imported / hand-edited courses
        can have surprises.
        """
        targets: list[_LessonTarget] = []
        if not isinstance(course, dict):
            return targets
        idx = 0
        for mi, mod in enumerate(course.get("modules", []) or []):
            if not isinstance(mod, dict):
                continue
            for li, lesson in enumerate(mod.get("lessons", []) or []):
                if not isinstance(lesson, dict):
                    continue
                lesson_id = lesson.get("id") or ""
                title = lesson.get("title") or f"Lesson {mi + 1}.{li + 1}"
                duration = lesson.get("duration") or lesson.get("durationMin") or 10
                if not isinstance(duration, (int, float)):
                    duration = 10
                targets.append(_LessonTarget(
                    idx=idx,
                    module_idx=mi,
                    lesson_idx=li,
                    lesson_id=str(lesson_id),
                    title=str(title),
                    duration_min=int(duration),
                ))
                idx += 1
        return targets

    @staticmethod
    def _collect_case_studies(course: dict[str, Any]) -> list[dict[str, Any]]:
        if not isinstance(course, dict):
            return []
        return [cs for cs in (course.get("caseStudies") or []) if isinstance(cs, dict)]

    @classmethod
    def _collect_cs_targets(cls, course: dict[str, Any]) -> list[_CSTarget]:
        """sprint-2-9: case-study slots planted by Course Architect
        that don't yet have content. A slot is "filled" when it has
        non-empty `context` OR any `stakeholders` — those are the two
        most reliable signals that MODE 5 has run against it. Slots
        with only an id + title (Course Architect's planted state)
        are the targets for the CS phase.

        Skipping already-filled slots is the right behavior for
        re-builds: an LD who hand-edited a case study shouldn't have
        their work overwritten by an automated re-run.
        """
        targets: list[_CSTarget] = []
        for cs in cls._collect_case_studies(course):
            cs_id = str(cs.get("id") or "")
            if not cs_id:
                continue
            context = cs.get("context") or ""
            stakeholders = cs.get("stakeholders") or []
            already_filled = (
                (isinstance(context, str) and context.strip())
                or (isinstance(stakeholders, list) and len(stakeholders) > 0)
            )
            if already_filled:
                continue
            targets.append(_CSTarget(
                cs_id=cs_id,
                title=str(cs.get("title") or "Untitled case study"),
            ))
        return targets

    @staticmethod
    def _collect_kc_targets(
        course: dict[str, Any], shape: dict[str, Any] | None,
    ) -> list[_KCTarget]:
        """sprint-2-8: walk the course + shape directives to enumerate
        every knowledge-check slot the build phase should fill.

        shape.knowledgeChecks scope:
          "none"            → []  (skip the phase entirely)
          "lesson"          → 1 KC per lesson
          "module"          → 1 final assessment per module
          "auto" / "both"   → both per-lesson AND per-module finals
          missing           → "auto" default

        Order: per-lesson KCs first (in lesson order across modules),
        then module finals (in module order). Matches the natural
        review flow — finish each module's lessons + their KCs,
        then the module final wraps it.
        """
        if not isinstance(course, dict):
            return []
        scope = "auto"
        if isinstance(shape, dict):
            raw_scope = shape.get("knowledgeChecks")
            if isinstance(raw_scope, str):
                scope = raw_scope
        if scope == "none":
            return []

        do_lessons = scope in ("lesson", "both", "auto")
        do_modules = scope in ("module", "both", "auto")

        targets: list[_KCTarget] = []
        modules = course.get("modules") or []
        for mi, mod in enumerate(modules):
            if not isinstance(mod, dict):
                continue
            if do_lessons:
                for li, lesson in enumerate(mod.get("lessons") or []):
                    if not isinstance(lesson, dict):
                        continue
                    lesson_id = str(lesson.get("id") or "")
                    if not lesson_id:
                        continue
                    targets.append(_KCTarget(
                        kc_id=f"lesson:{lesson_id}",
                        kind="lesson",
                        target_id=lesson_id,
                        title=str(lesson.get("title") or f"Lesson {mi + 1}.{li + 1}"),
                        module_idx=mi,
                        lesson_idx=li,
                    ))
            if do_modules:
                module_id = str(mod.get("id") or "")
                if module_id:
                    targets.append(_KCTarget(
                        kc_id=f"module:{module_id}",
                        kind="module",
                        target_id=module_id,
                        title=str(mod.get("title") or f"Module {mi + 1}"),
                        module_idx=mi,
                        lesson_idx=None,
                    ))
        return targets

    async def _run_lesson_loop(
        self, targets: list[_LessonTarget], start_from: int,
    ) -> None:
        """Iterate lessons sequentially, mini-session per lesson.

        Cancellation (locked fork #5): checked at lesson boundaries,
        not mid-call. A long-running write_lesson finishes before the
        loop honors cancel — keeps the FE's Course state consistent
        instead of leaving half-written blocks.

        Failure (locked fork #4): one attempt per lesson here. On
        exception, transition to phase="paused" + lesson status
        "error", emit lesson_failed with the error string, and HALT
        the loop. Sprint-2-6 layers retry+backoff on top of this
        scaffold; sprint-2-7 wires resume from the failure index.
        """
        for t in targets[start_from:]:
            if self._cancelled:
                log.info("orchestrator cancelled at lesson %d", t.idx)
                # Phase already set to "cancelled" by cancel(). Just
                # emit a final progress event so the FE knows where
                # we stopped.
                await self._emit_progress("not_implemented", {
                    "message": f"Build cancelled at lesson {t.idx + 1}.",
                    "stoppedAtLessonIdx": t.idx,
                })
                return

            self._state.lesson_states[t.idx] = "building"
            await self._emit_state()
            await self._emit_progress("lesson_started", {
                "idx": t.idx,
                "moduleIdx": t.module_idx,
                "lessonIdx": t.lesson_idx,
                "lessonId": t.lesson_id,
                "title": t.title,
            })

            start_ts = time.monotonic()
            try:
                # sprint-2-6: wrap in retry+backoff. One retry after
                # 5s backoff; halt on the second failure.
                # polish-16b: verification happens INSIDE the retry
                # wrapper so a zero-blocks completion triggers retry
                # rather than going straight to paused state.
                usage, init_ms = await self._run_lesson_with_retry(t)
            except _BuildCancelledDuringBackoff:
                # User cancelled while we were waiting between
                # attempts. Phase is already "cancelled" via cancel();
                # exit cleanly without the paused/failed transition.
                log.info("orchestrator cancelled during retry backoff at lesson %d", t.idx)
                return
            except Exception as exc:
                log.exception(
                    "lesson %d (%s) failed after %d attempts",
                    t.idx, t.title, LESSON_MAX_ATTEMPTS,
                )
                self._state.lesson_states[t.idx] = "error"
                self._state.last_error = f"Lesson {t.idx + 1} ({t.title}): {exc}"
                self._state.phase = "paused"
                await self._emit_state()
                await self._emit_progress("lesson_failed", {
                    "idx": t.idx,
                    "title": t.title,
                    "lessonId": t.lesson_id,
                    "error": str(exc),
                    "attempts": LESSON_MAX_ATTEMPTS,
                })
                return  # halt — sprint-2-7 picks up via resume()

            duration_ms = int((time.monotonic() - start_ts) * 1000)
            self._state.lesson_states[t.idx] = "done"
            self._state.last_completed_lesson_idx = t.idx
            await self._emit_state()
            # sprint-2-3 + polish-7d: cost-metric extension on
            # lesson_completed. polish-7d fixes the "tokens_in=13"
            # bug — the SDK's `input_tokens` field is *uncached only*;
            # most of our 8K system prompt + course state lands in
            # cache_read_input_tokens (file-loaded prompt is cached).
            # The headline tokensIn now SUMS uncached + cache-read +
            # cache-creation so the LD sees the full effective prompt.
            # Breakdown surfaces separately for cost-analysis tooling.
            metrics = _extract_usage(usage)
            await self._emit_progress("lesson_completed", {
                "idx": t.idx,
                "title": t.title,
                "lessonId": t.lesson_id,
                "moduleIdx": t.module_idx,
                "lessonIdx": t.lesson_idx,
                "durationMs": duration_ms,
                "initMs": init_ms,
                # Headline numbers — what tooltip + aggregate toast read.
                "tokensIn": metrics["tokens_in_total"],
                "tokensOut": metrics["tokens_out"],
                "model": metrics["model"],
                # polish-7d-fix: SDK-computed cost. Aggregates cleanly
                # across all lessons for the completion toast.
                "costUsd": metrics["cost_usd"],
                # Breakdown — for cost analysis. cache reads are
                # ~10% the price of uncached input on Anthropic's
                # pricing, so the breakdown matters for $-estimation.
                "tokensInUncached": metrics["tokens_in_uncached"],
                "tokensInCacheRead": metrics["tokens_in_cache_read"],
                "tokensInCacheCreation": metrics["tokens_in_cache_creation"],
            })
            log.info(
                "lesson %d done — %dms (init %dms) tokens in=%s "
                "(uncached=%s cache_read=%s cache_creation=%s) out=%s "
                "model=%s cost=$%s",
                t.idx, duration_ms, init_ms,
                metrics["tokens_in_total"],
                metrics["tokens_in_uncached"],
                metrics["tokens_in_cache_read"],
                metrics["tokens_in_cache_creation"],
                metrics["tokens_out"],
                metrics["model"],
                f"{metrics['cost_usd']:.4f}" if metrics["cost_usd"] is not None else "?",
            )

        # sprint-2-8: lesson loop no longer emits course_completed —
        # the top-level build_full_course handler does after the KC
        # phase (if any) finishes too. Phase stays "building" if we
        # finish lessons cleanly so the next phase has a green light.

    async def _run_lesson_with_retry(self, t: _LessonTarget) -> tuple[dict[str, Any], int]:
        """sprint-2-6: retry+backoff wrapper around _run_lesson_session.

        Tries up to LESSON_MAX_ATTEMPTS times; sleeps
        LESSON_RETRY_BACKOFF_SECONDS between attempts. On a transient
        failure (rate-limit blip, SDK reconnect glitch) the second
        attempt typically succeeds without LD intervention.

        polish-16b: each successful attempt is verified — if the
        mini-session reported success but the lesson still has zero
        blocks (silent-success class: write_lesson returned ok=true
        against a stale course tree, or the agent never called
        write_lesson), we raise a RuntimeError so the retry kicks in.
        Catches the lesson-1.1-zero-blocks regression from the BCG
        playbook test.

        Cancellation is honored during backoff via _BuildCancelledDuringBackoff
        — the loop's outer handler catches it and exits cleanly without
        transitioning to "paused" (the phase is already "cancelled" by
        the cancel() method). The sleep is broken into 1-second chunks
        so a cancel signal lands within ~1s, not the full 5s.
        """
        last_exc: Exception | None = None
        for attempt in range(1, LESSON_MAX_ATTEMPTS + 1):
            try:
                # B2-revert: no asyncio.wait_for here. The Claude Agent
                # SDK can't be cancelled mid-stream cleanly, and a real
                # lesson on a rich BCG deck legitimately takes > 6 min.
                # Letting it run untimed is the lesser evil vs crashing
                # the backend.
                result = await self._run_lesson_session(t)
                # polish-16b: defensive verify. Inside the retry loop
                # so a verification failure triggers the retry path
                # rather than going to paused state.
                wrote_blocks = await self._verify_lesson_written(t)
                if not wrote_blocks:
                    log.warning(
                        "lesson %d (%s) attempt %d: mini-session reported "
                        "success but 0 blocks present — treating as failure",
                        t.idx, t.title, attempt,
                    )
                    raise RuntimeError(
                        f"Lesson mini-session completed but produced no "
                        f"blocks. Either write_lesson didn't reach the FE "
                        f"or lesson_id {t.lesson_id} no longer matches the "
                        f"current course tree."
                    )
                return result
            except Exception as exc:
                last_exc = exc
                log.warning(
                    "lesson %d (%s) attempt %d/%d failed: %s",
                    t.idx, t.title, attempt, LESSON_MAX_ATTEMPTS, exc,
                )
                if attempt >= LESSON_MAX_ATTEMPTS:
                    # All attempts exhausted — re-raise so the loop's
                    # outer handler transitions to paused state.
                    break
                # Emit retrying event so the FE updates the progress
                # band's phase label to "Retrying lesson N…".
                await self._emit_progress("lesson_retrying", {
                    "idx": t.idx,
                    "title": t.title,
                    "lessonId": t.lesson_id,
                    "attempt": attempt,
                    "maxAttempts": LESSON_MAX_ATTEMPTS,
                    "backoffSeconds": LESSON_RETRY_BACKOFF_SECONDS,
                    "error": str(exc),
                })
                # Cancel-aware sleep — 1s chunks so cancel honors
                # within ~1s of the user clicking, not the full 5s.
                for _ in range(LESSON_RETRY_BACKOFF_SECONDS):
                    if self._cancelled:
                        raise _BuildCancelledDuringBackoff()
                    await asyncio.sleep(1)
        assert last_exc is not None  # always set when we exit the loop via break
        raise last_exc

    async def _verify_lesson_written(self, t: _LessonTarget) -> bool:
        """polish-16b: defensive check after a lesson mini-session
        completes successfully. Calls list_structure via the bridge
        and inspects the lesson's block count. If still zero, the
        write_lesson tool didn't actually land — bug surfaces in the
        log so it doesn't silently look like a success.

        Returns True if the lesson has writer-authored blocks, False
        otherwise. Caller decides whether to fail the lesson, retry,
        or just log.

        Cheap call — list_structure returns the whole course tree
        and parses fast on the FE side.
        """
        try:
            structure = await self._bridge.call("list_structure", {})
        except Exception as exc:
            log.warning(
                "verify_lesson_written: list_structure failed for lesson %d: %s",
                t.idx, exc,
            )
            # Don't fail the lesson on a verification glitch — return
            # True so the build keeps moving; the LD will see the
            # actual block state in the canvas anyway.
            return True
        course = structure.get("course") if isinstance(structure, dict) else None
        modules = (course or {}).get("modules") or []
        for mod in modules:
            for lesson in mod.get("lessons") or []:
                if lesson.get("id") == t.lesson_id:
                    block_count = len(lesson.get("blocks") or [])
                    return block_count > 0
        # Lesson not found in the structure — that's a different bug
        # but we surface it as "not written" so it gets attention.
        log.warning(
            "verify_lesson_written: lesson %s not found in list_structure",
            t.lesson_id,
        )
        return False

    async def _run_lesson_session(self, t: _LessonTarget) -> tuple[dict[str, Any], int]:
        """Spawn a fresh ClaudeSDKClient for one lesson. Returns
        (usage, init_ms).

        Locked fork #2: same SYSTEM_PROMPT, same MCP server, same
        tool set as the main session. The user message is a brief
        directive; the agent calls list_structure() itself to read
        course shape + lesson objectives. No structured args.

        AssistantMessage events are silently consumed — we don't
        forward them as `assistant_text` because that would mix the
        build's prose into the main chat thread. Only ResultMessage
        (for token usage) is captured. Tool_calls flow through to
        the FE naturally via the shared bridge — they have to,
        because write_lesson is what actually mutates Course state.
        """
        init_start = time.monotonic()
        # polish-17a: orchestrator mini-sessions use the WORKER model
        # tier. Lesson Writer / Quiz Builder / Case Study Designer run
        # at high volume per build (12-30 mini-sessions for a 4-week
        # course); a Sonnet-grade worker hits ~65% cost reduction vs
        # all-Opus with no observed quality regression on L&D content.
        # Falls through to SDK default when env var unset.
        options = ClaudeAgentOptions(
            system_prompt={"type": "file", "path": SYSTEM_PROMPT_FILE},
            mcp_servers={"ui": build_ui_mcp_server(self._bridge)},
            allowed_tools=ALLOWED_TOOL_NAMES,
            model=MODEL_WORKER,
            fallback_model=MODEL_FALLBACK,
        )
        client = ClaudeSDKClient(options=options)
        await client.connect()
        init_ms = int((time.monotonic() - init_start) * 1000)

        try:
            prompt = self._build_lesson_prompt(t)
            await client.query(prompt)
            usage: dict[str, Any] = {}
            async for event in client.receive_response():
                if isinstance(event, ResultMessage):
                    # event.usage  → tokens dict (input_tokens,
                    #                 cache_read_input_tokens, etc.)
                    # event.model_usage  → dict keyed by model name
                    #                      with per-model token usage.
                    #                      polish-7d-fix: this is where
                    #                      the model name actually
                    #                      lives — pre-fix we were
                    #                      reading event.model which
                    #                      doesn't exist on this SDK.
                    # event.total_cost_usd  → SDK-computed cost (better
                    #                         than back-of-envelope
                    #                         from tokens since cache
                    #                         pricing varies by tier).
                    usage = dict(event.usage or {})
                    model_usage = event.model_usage or {}
                    if model_usage:
                        # First (typically only) model key — most
                        # builds run a single model end-to-end.
                        # Multi-model turns (rare) collapse to the
                        # first key, which is the primary model used
                        # for the actual generation.
                        model_name = next(iter(model_usage), None)
                        if model_name:
                            usage["model"] = model_name
                    if event.total_cost_usd is not None:
                        usage["total_cost_usd"] = event.total_cost_usd
                    break
            return usage, init_ms
        finally:
            try:
                await client.disconnect()
            except Exception:
                # Disconnect failures shouldn't surface as lesson
                # failures — the lesson succeeded, the SDK cleanup
                # is best-effort.
                log.warning("lesson %d disconnect failed (non-fatal)", t.idx, exc_info=True)

    def _build_lesson_prompt(self, t: _LessonTarget) -> str:
        """Build the user message for a lesson mini-session.

        The system prompt already trains the agent for MODE 2 (Lesson
        Writer). This message is the trigger — short, lesson-specific,
        and explicitly tells the agent to introspect via list_structure
        rather than rely on anything in the message itself. That keeps
        the orchestrated path identical to the manual ("write Lesson 3"
        in chat) path — same tools, same prompt scaffolding, same
        agent behavior. Locked fork #2.
        """
        total = self._state.total_lessons
        # Position string: "lesson N of M". Helpful framing for the
        # agent (it can pace the depth — first / mid / closing lessons
        # often warrant different angles).
        return (
            f"Write lesson {t.idx + 1} of {total}: "
            f'"{t.title}" '
            f"(module {t.module_idx + 1}, lesson {t.lesson_idx + 1}, "
            f"~{t.duration_min} min).\n\n"
            f"Lesson id: {t.lesson_id}\n\n"
            "Steps:\n"
            "1. Call list_structure() to read the course shape "
            "(case-study placement, video-script density, interactivity) "
            "and the lesson's objectives.\n"
            "2. Call write_lesson() with the full block sequence. "
            "Follow the canonical 11–13 block template from the system "
            "prompt; honor the course.shape directives. "
            "Use the full block-type palette (banner, callout, accordion, "
            "cards, timeline, stats, video, image, quote, etc.) — not just "
            "text blocks.\n"
        )

    # ─── sprint-2-8: knowledge-check phase ─────────────────────────

    async def _run_kc_loop(
        self, targets: list[_KCTarget], start_from: int,
    ) -> None:
        """Iterate KC targets sequentially, mini-session per target.
        Same retry+backoff scaffold as the lesson loop (2-6) — one
        retry on failure with 5s backoff before halting the build.

        On any non-recoverable error, transitions to phase=paused and
        halts. The lesson phase has already completed by this point;
        sprint-2-7's resume needs to know we paused mid-KC-phase
        (last_error string makes that clear).
        """
        for kt in targets[start_from:]:
            if self._cancelled:
                log.info("orchestrator cancelled at KC %s", kt.kc_id)
                await self._emit_progress("not_implemented", {
                    "message": f"Build cancelled at knowledge check {kt.kc_id}.",
                    "stoppedAtKcId": kt.kc_id,
                })
                return

            self._state.kc_states[kt.kc_id] = "building"
            await self._emit_state()
            await self._emit_progress("kc_started", {
                "kcId": kt.kc_id,
                "kind": kt.kind,
                "targetId": kt.target_id,
                "title": kt.title,
                "moduleIdx": kt.module_idx,
                "lessonIdx": kt.lesson_idx,
            })

            start_ts = time.monotonic()
            try:
                usage, init_ms = await self._run_kc_with_retry(kt)
            except _BuildCancelledDuringBackoff:
                log.info("orchestrator cancelled during KC retry backoff at %s", kt.kc_id)
                return
            except Exception as exc:
                log.exception(
                    "kc %s (%s) failed after %d attempts",
                    kt.kc_id, kt.title, LESSON_MAX_ATTEMPTS,
                )
                self._state.kc_states[kt.kc_id] = "error"
                self._state.last_error = f"Knowledge check ({kt.kind} {kt.title}): {exc}"
                self._state.phase = "paused"
                await self._emit_state()
                await self._emit_progress("kc_failed", {
                    "kcId": kt.kc_id,
                    "kind": kt.kind,
                    "targetId": kt.target_id,
                    "title": kt.title,
                    "error": str(exc),
                    "attempts": LESSON_MAX_ATTEMPTS,
                })
                return

            duration_ms = int((time.monotonic() - start_ts) * 1000)
            self._state.kc_states[kt.kc_id] = "done"
            await self._emit_state()
            metrics = _extract_usage(usage)
            await self._emit_progress("kc_completed", {
                "kcId": kt.kc_id,
                "kind": kt.kind,
                "targetId": kt.target_id,
                "title": kt.title,
                "durationMs": duration_ms,
                "initMs": init_ms,
                "tokensIn": metrics["tokens_in_total"],
                "tokensOut": metrics["tokens_out"],
                "model": metrics["model"],
                "costUsd": metrics["cost_usd"],
                "tokensInUncached": metrics["tokens_in_uncached"],
                "tokensInCacheRead": metrics["tokens_in_cache_read"],
                "tokensInCacheCreation": metrics["tokens_in_cache_creation"],
            })
            log.info(
                "kc %s done — %dms (init %dms) tokens in=%s out=%s cost=$%s",
                kt.kc_id, duration_ms, init_ms,
                metrics["tokens_in_total"],
                metrics["tokens_out"],
                f"{metrics['cost_usd']:.4f}" if metrics["cost_usd"] is not None else "?",
            )

    async def _run_kc_with_retry(self, kt: _KCTarget) -> tuple[dict[str, Any], int]:
        """Same retry+backoff pattern as _run_lesson_with_retry, applied
        to KC mini-sessions. sprint-2-6 + sprint-2-8."""
        last_exc: Exception | None = None
        for attempt in range(1, LESSON_MAX_ATTEMPTS + 1):
            try:
                return await self._run_kc_session(kt)
            except Exception as exc:
                last_exc = exc
                log.warning(
                    "kc %s attempt %d/%d failed: %s",
                    kt.kc_id, attempt, LESSON_MAX_ATTEMPTS, exc,
                )
                if attempt >= LESSON_MAX_ATTEMPTS:
                    break
                await self._emit_progress("kc_retrying", {
                    "kcId": kt.kc_id,
                    "kind": kt.kind,
                    "targetId": kt.target_id,
                    "title": kt.title,
                    "attempt": attempt,
                    "maxAttempts": LESSON_MAX_ATTEMPTS,
                    "backoffSeconds": LESSON_RETRY_BACKOFF_SECONDS,
                    "error": str(exc),
                })
                for _ in range(LESSON_RETRY_BACKOFF_SECONDS):
                    if self._cancelled:
                        raise _BuildCancelledDuringBackoff()
                    await asyncio.sleep(1)
        assert last_exc is not None
        raise last_exc

    async def _run_kc_session(self, kt: _KCTarget) -> tuple[dict[str, Any], int]:
        """Spawn a fresh ClaudeSDKClient for one KC. Same shape as
        _run_lesson_session — locked-fork-#2 path-parity stays
        intact (file SYSTEM_PROMPT, shared bridge, agent introspects
        via list_structure + writes via write_knowledge_check)."""
        init_start = time.monotonic()
        # polish-17a: orchestrator mini-sessions use the WORKER model
        # tier. Lesson Writer / Quiz Builder / Case Study Designer run
        # at high volume per build (12-30 mini-sessions for a 4-week
        # course); a Sonnet-grade worker hits ~65% cost reduction vs
        # all-Opus with no observed quality regression on L&D content.
        # Falls through to SDK default when env var unset.
        options = ClaudeAgentOptions(
            system_prompt={"type": "file", "path": SYSTEM_PROMPT_FILE},
            mcp_servers={"ui": build_ui_mcp_server(self._bridge)},
            allowed_tools=ALLOWED_TOOL_NAMES,
            model=MODEL_WORKER,
            fallback_model=MODEL_FALLBACK,
        )
        client = ClaudeSDKClient(options=options)
        await client.connect()
        init_ms = int((time.monotonic() - init_start) * 1000)

        try:
            prompt = self._build_kc_prompt(kt)
            await client.query(prompt)
            usage: dict[str, Any] = {}
            async for event in client.receive_response():
                if isinstance(event, ResultMessage):
                    usage = dict(event.usage or {})
                    model_usage = event.model_usage or {}
                    if model_usage:
                        model_name = next(iter(model_usage), None)
                        if model_name:
                            usage["model"] = model_name
                    if event.total_cost_usd is not None:
                        usage["total_cost_usd"] = event.total_cost_usd
                    break
            return usage, init_ms
        finally:
            try:
                await client.disconnect()
            except Exception:
                log.warning("kc %s disconnect failed (non-fatal)", kt.kc_id, exc_info=True)

    def _build_kc_prompt(self, kt: _KCTarget) -> str:
        """User message for a KC mini-session. Tells the agent which
        target the KC anchors on; the agent calls list_structure() to
        read the lesson body / module objectives + write_knowledge_check
        to land the questions. MODE 4 in SYSTEM_PROMPT trains the
        questioning style (5 MCQ default, Bloom's mix, plausible
        distractors).
        """
        if kt.kind == "lesson":
            return (
                f"Add a knowledge check to lesson {kt.module_idx + 1}."
                f"{(kt.lesson_idx or 0) + 1}: \"{kt.title}\".\n\n"
                f"Lesson id: {kt.target_id}\n\n"
                "Steps:\n"
                "1. Call list_structure() to read the lesson's body content "
                "and stated objectives.\n"
                "2. Call write_knowledge_check(target_kind=\"lesson\", "
                f"target_id=\"{kt.target_id}\", questions=[...]) with 5 MCQ "
                "questions following the MODE 4 spec (Bloom's mix: 1-2 recall, "
                "2 apply, 1-2 analyze; plausible distractors; rationale per "
                "question).\n"
            )
        # module-level final assessment
        return (
            f"Add a final assessment to module {kt.module_idx + 1}: "
            f"\"{kt.title}\".\n\n"
            f"Module id: {kt.target_id}\n\n"
            "Steps:\n"
            "1. Call list_structure() to read all lessons in this module + "
            "the module's objectives. The final assessment should cover the "
            "module as a whole, not duplicate any single lesson's KC.\n"
            "2. Call write_knowledge_check(target_kind=\"module\", "
            f"target_id=\"{kt.target_id}\", questions=[...]) with 5 MCQ "
            "questions weighted toward apply / analyze (the LD's learners "
            "have already worked through the lesson-level KCs by this point).\n"
        )

    # ─── sprint-2-9: case-study phase ──────────────────────────────

    async def _run_cs_loop(
        self, targets: list[_CSTarget], start_from: int,
    ) -> None:
        """Iterate CS targets sequentially. Same retry+backoff +
        cancel-aware backoff scaffold as the lesson + KC loops.
        On non-recoverable error, transitions to phase=paused and
        halts. last_error string identifies the CS slot so sprint-2-7's
        resume can pick up from the right phase.
        """
        for ct in targets[start_from:]:
            if self._cancelled:
                log.info("orchestrator cancelled at CS %s", ct.cs_id)
                await self._emit_progress("not_implemented", {
                    "message": f"Build cancelled at case study {ct.cs_id}.",
                    "stoppedAtCsId": ct.cs_id,
                })
                return

            self._state.cs_states[ct.cs_id] = "building"
            await self._emit_state()
            await self._emit_progress("cs_started", {
                "csId": ct.cs_id,
                "title": ct.title,
            })

            start_ts = time.monotonic()
            try:
                usage, init_ms = await self._run_cs_with_retry(ct)
            except _BuildCancelledDuringBackoff:
                log.info("orchestrator cancelled during CS retry backoff at %s", ct.cs_id)
                return
            except Exception as exc:
                log.exception(
                    "cs %s (%s) failed after %d attempts",
                    ct.cs_id, ct.title, LESSON_MAX_ATTEMPTS,
                )
                self._state.cs_states[ct.cs_id] = "error"
                self._state.last_error = f"Case study ({ct.title}): {exc}"
                self._state.phase = "paused"
                await self._emit_state()
                await self._emit_progress("cs_failed", {
                    "csId": ct.cs_id,
                    "title": ct.title,
                    "error": str(exc),
                    "attempts": LESSON_MAX_ATTEMPTS,
                })
                return

            duration_ms = int((time.monotonic() - start_ts) * 1000)
            self._state.cs_states[ct.cs_id] = "done"
            await self._emit_state()
            metrics = _extract_usage(usage)
            await self._emit_progress("cs_completed", {
                "csId": ct.cs_id,
                "title": ct.title,
                "durationMs": duration_ms,
                "initMs": init_ms,
                "tokensIn": metrics["tokens_in_total"],
                "tokensOut": metrics["tokens_out"],
                "model": metrics["model"],
                "costUsd": metrics["cost_usd"],
                "tokensInUncached": metrics["tokens_in_uncached"],
                "tokensInCacheRead": metrics["tokens_in_cache_read"],
                "tokensInCacheCreation": metrics["tokens_in_cache_creation"],
            })
            log.info(
                "cs %s done — %dms (init %dms) tokens in=%s out=%s cost=$%s",
                ct.cs_id, duration_ms, init_ms,
                metrics["tokens_in_total"],
                metrics["tokens_out"],
                f"{metrics['cost_usd']:.4f}" if metrics["cost_usd"] is not None else "?",
            )

    async def _run_cs_with_retry(self, ct: _CSTarget) -> tuple[dict[str, Any], int]:
        """Same retry+backoff pattern as _run_lesson_with_retry /
        _run_kc_with_retry, applied to CS mini-sessions. sprint-2-9.
        """
        last_exc: Exception | None = None
        for attempt in range(1, LESSON_MAX_ATTEMPTS + 1):
            try:
                return await self._run_cs_session(ct)
            except Exception as exc:
                last_exc = exc
                log.warning(
                    "cs %s attempt %d/%d failed: %s",
                    ct.cs_id, attempt, LESSON_MAX_ATTEMPTS, exc,
                )
                if attempt >= LESSON_MAX_ATTEMPTS:
                    break
                await self._emit_progress("cs_retrying", {
                    "csId": ct.cs_id,
                    "title": ct.title,
                    "attempt": attempt,
                    "maxAttempts": LESSON_MAX_ATTEMPTS,
                    "backoffSeconds": LESSON_RETRY_BACKOFF_SECONDS,
                    "error": str(exc),
                })
                for _ in range(LESSON_RETRY_BACKOFF_SECONDS):
                    if self._cancelled:
                        raise _BuildCancelledDuringBackoff()
                    await asyncio.sleep(1)
        assert last_exc is not None
        raise last_exc

    async def _run_cs_session(self, ct: _CSTarget) -> tuple[dict[str, Any], int]:
        """Spawn a fresh ClaudeSDKClient for one case study. Locked
        fork #2 path-parity: file SYSTEM_PROMPT (MODE 5 active),
        shared bridge → design_case_study lands on FE actions
        unchanged, list_structure to read the slot's planted title
        + parent module context.
        """
        init_start = time.monotonic()
        # polish-17a: orchestrator mini-sessions use the WORKER model
        # tier. Lesson Writer / Quiz Builder / Case Study Designer run
        # at high volume per build (12-30 mini-sessions for a 4-week
        # course); a Sonnet-grade worker hits ~65% cost reduction vs
        # all-Opus with no observed quality regression on L&D content.
        # Falls through to SDK default when env var unset.
        options = ClaudeAgentOptions(
            system_prompt={"type": "file", "path": SYSTEM_PROMPT_FILE},
            mcp_servers={"ui": build_ui_mcp_server(self._bridge)},
            allowed_tools=ALLOWED_TOOL_NAMES,
            model=MODEL_WORKER,
            fallback_model=MODEL_FALLBACK,
        )
        client = ClaudeSDKClient(options=options)
        await client.connect()
        init_ms = int((time.monotonic() - init_start) * 1000)

        try:
            prompt = self._build_cs_prompt(ct)
            await client.query(prompt)
            usage: dict[str, Any] = {}
            async for event in client.receive_response():
                if isinstance(event, ResultMessage):
                    usage = dict(event.usage or {})
                    model_usage = event.model_usage or {}
                    if model_usage:
                        model_name = next(iter(model_usage), None)
                        if model_name:
                            usage["model"] = model_name
                    if event.total_cost_usd is not None:
                        usage["total_cost_usd"] = event.total_cost_usd
                    break
            return usage, init_ms
        finally:
            try:
                await client.disconnect()
            except Exception:
                log.warning("cs %s disconnect failed (non-fatal)", ct.cs_id, exc_info=True)

    def _build_cs_prompt(self, ct: _CSTarget) -> str:
        """User message for a CS mini-session. The agent calls
        list_structure() to find the slot (cs_id), reads materials
        if any, and design_case_study() lands the four required
        fields per MODE 5 (context, stakeholders, decisionPoints,
        debriefPrompts).
        """
        return (
            f"Design the case study slot \"{ct.title}\".\n\n"
            f"Case study id: {ct.cs_id}\n\n"
            "Steps:\n"
            "1. Call list_structure() to find the case-study slot's "
            "parent module + that module's objectives. The case study "
            "should anchor on the module's central topic.\n"
            "2. If the LD has uploaded source materials for this course, "
            "call read_materials and ground the scenario in them.\n"
            "3. Call design_case_study with the slot id and content "
            "covering all four fields (context, stakeholders, "
            "decisionPoints, debriefPrompts) per the MODE 5 spec in "
            "the system prompt. Required disclaimer at the end of "
            "context, and a Sources / Inspired by block.\n"
        )

    # ─── internal: event emission helpers ──────────────────────────

    async def _emit_state(self) -> None:
        """Push the full state to the FE. Used after every transition
        so the FE's orchestratorState slice stays in lockstep without
        having to derive state from progress events alone.
        """
        await self._send({
            "type": "build_state",
            "state": self._state.to_dict(),
        })

    async def _emit_progress(self, kind: str, payload: dict[str, Any]) -> None:
        """Push a progress event. `kind` is one of:
          lesson_started / lesson_completed / lesson_failed / lesson_retrying
          kc_started / kc_completed / kc_failed / kc_retrying
          cs_started / cs_completed / cs_failed / cs_retrying
          course_completed / course_export_ready
          not_implemented (sprint-2-1 + cancellation/resume stubs)

        sprint-2-6 / 2-8 / 2-9: *_retrying events carry
        {attempt, maxAttempts, backoffSeconds, error} alongside the
        standard target-identifying fields so the FE's progress band
        can show "Retrying lesson N (attempt 2/2)…" or the
        equivalent for KCs / CSs.

        sprint-2-9: course_export_ready fires after course_completed
        when the course is fully built and ready to download as a
        Word doc. The FE listens for this and auto-triggers the
        existing /export/course-docx endpoint.
        """
        await self._send({
            "type": "build_progress",
            "kind": kind,
            **payload,
        })


class _BuildCancelledDuringBackoff(Exception):
    """sprint-2-6: signal raised inside _run_lesson_with_retry when
    cancel() fires during the inter-attempt backoff sleep. The lesson
    loop's outer handler catches it specifically (rather than as a
    generic Exception) so we exit without the paused/failed state
    transition — phase is already "cancelled" by cancel()."""


def _safe_int(value: Any) -> int | None:
    """Coerce a usage field to int if numeric; otherwise None.

    SDK usage dicts occasionally surface strings or floats depending
    on transport. The FE expects integers in the tooltip math, so
    normalize here at the source.
    """
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


# polish-7d: env fallback for the model name. The SDK's ResultMessage
# usage dict doesn't surface `model` reliably across versions; if the
# event-side reads come up empty we fall back to whatever the user
# configured for the SDK to use. Read at call time so an env reload
# (rare in dev) takes effect without a process restart.
def _model_from_env() -> str | None:
    return (
        os.environ.get("CLAUDE_MODEL")
        or os.environ.get("ANTHROPIC_MODEL")
        or os.environ.get("CLAUDE_AGENT_MODEL")
        or None
    )


def _extract_usage(usage: dict[str, Any]) -> dict[str, Any]:
    """Normalize the SDK's usage dict into the fields lesson_completed
    surfaces. polish-7d fixes the "tokens_in=13" + "model=None"
    surprises from sprint-2-3's first live run.

    The SDK's `usage` dict mirrors the Anthropic API conventions:
      input_tokens                — uncached prompt tokens this turn
      cache_read_input_tokens     — prompt tokens served from prompt
                                    cache (cheap)
      cache_creation_input_tokens — prompt tokens written into cache
                                    this turn
      output_tokens               — generated tokens

    Pre-polish-7d we read input_tokens alone, which surfaced "13" for
    a turn whose effective prompt was 8K+ — most of it cache-read.
    The headline `tokens_in_total` now sums all three input components
    so the LD sees real prompt size; the breakdown is preserved for
    cost-modeling (cache reads are ~10% the price of uncached input
    on Anthropic's pricing).

    Field-name handling is permissive — both snake_case and camelCase
    are tolerated since SDK transport layers occasionally normalize
    either way.
    """
    def _read(*keys: str) -> int | None:
        for k in keys:
            if k in usage and usage[k] is not None:
                v = _safe_int(usage[k])
                if v is not None:
                    return v
        return None

    uncached = _read("input_tokens", "inputTokens") or 0
    cache_read = _read("cache_read_input_tokens", "cacheReadInputTokens") or 0
    cache_creation = (
        _read("cache_creation_input_tokens", "cacheCreationInputTokens") or 0
    )
    out = _read("output_tokens", "outputTokens")
    total_in = uncached + cache_read + cache_creation

    model = usage.get("model") or _model_from_env()

    # polish-7d-fix: SDK-computed cost (in USD) when available.
    # ResultMessage.total_cost_usd accounts for cache-tier pricing
    # which is hard to back-of-envelope from raw token counts. The
    # FE's tooltip / aggregate toast can use this directly.
    cost_usd = usage.get("total_cost_usd")
    if cost_usd is not None:
        try:
            cost_usd = float(cost_usd)
        except (TypeError, ValueError):
            cost_usd = None

    return {
        "tokens_in_total": total_in if total_in > 0 else None,
        "tokens_in_uncached": uncached if uncached > 0 else None,
        "tokens_in_cache_read": cache_read if cache_read > 0 else None,
        "tokens_in_cache_creation": (
            cache_creation if cache_creation > 0 else None
        ),
        "tokens_out": out,
        "model": model,
        "cost_usd": cost_usd,
    }
