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
import time
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Literal

from claude_agent_sdk import (
    ClaudeAgentOptions,
    ClaudeSDKClient,
    ResultMessage,
)

from .bridge import ToolBridge
from .config import SYSTEM_PROMPT_FILE
from .ui_tools import ALLOWED_TOOL_NAMES, build_ui_mcp_server

log = logging.getLogger(__name__)


PhaseStatus = Literal["idle", "building", "paused", "completed", "cancelled", "failed"]
TargetStatus = Literal["idle", "building", "done", "error"]


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

            self._cancelled = False
            self._state = OrchestratorState(
                phase="building",
                total_lessons=len(targets),
                total_kcs=0,  # Quiz Builder phase wires this in sprint-2-8
                total_css=len(self._collect_case_studies(course)),
            )
            for t in targets:
                self._state.lesson_states[t.idx] = "idle"
            self._course_snapshot = course
            self._shape_snapshot = shape

            await self._emit_state()
            log.info(
                "build_full_course start — lessons=%d shape=%s",
                len(targets), shape,
            )

        # Run the loop OUTSIDE the lock so cancel() / get_state() can
        # acquire it during the build. The lock guarded the state
        # transition into "building"; the loop reads + writes via
        # state methods that acquire the lock as needed for atomicity
        # of single transitions.
        await self._run_lesson_loop(targets, start_from=0)

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
                usage, init_ms = await self._run_lesson_session(t)
            except Exception as exc:
                log.exception("lesson %d (%s) failed", t.idx, t.title)
                self._state.lesson_states[t.idx] = "error"
                self._state.last_error = f"Lesson {t.idx + 1} ({t.title}): {exc}"
                self._state.phase = "paused"
                await self._emit_state()
                await self._emit_progress("lesson_failed", {
                    "idx": t.idx,
                    "title": t.title,
                    "lessonId": t.lesson_id,
                    "error": str(exc),
                })
                return  # halt — sprint-2-7 picks up via resume()

            duration_ms = int((time.monotonic() - start_ts) * 1000)
            self._state.lesson_states[t.idx] = "done"
            self._state.last_completed_lesson_idx = t.idx
            await self._emit_state()
            # sprint-2-3: cost-metric extension on lesson_completed
            # payload (locked, in-conversation). LessonTile tooltip in
            # 2-10b will surface "Lesson 4: 2,341 tokens, ~$0.05" from
            # these fields; the completion toast will aggregate
            # across all lessons. Free data — capturing it here costs
            # nothing extra over the stdout log we'd write anyway.
            await self._emit_progress("lesson_completed", {
                "idx": t.idx,
                "title": t.title,
                "lessonId": t.lesson_id,
                "moduleIdx": t.module_idx,
                "lessonIdx": t.lesson_idx,
                "durationMs": duration_ms,
                "initMs": init_ms,
                "tokensIn": _safe_int(usage.get("input_tokens") or usage.get("inputTokens")),
                "tokensOut": _safe_int(usage.get("output_tokens") or usage.get("outputTokens")),
                "model": usage.get("model"),
            })
            log.info(
                "lesson %d done — %dms (init %dms) tokens in=%s out=%s model=%s",
                t.idx, duration_ms, init_ms,
                usage.get("input_tokens") or usage.get("inputTokens"),
                usage.get("output_tokens") or usage.get("outputTokens"),
                usage.get("model"),
            )

        # Loop ended without cancel/error → completed.
        if not self._cancelled:
            self._state.phase = "completed"
            await self._emit_state()
            await self._emit_progress("course_completed", {
                "totalLessons": self._state.total_lessons,
            })
            log.info("build_full_course complete — %d lessons", self._state.total_lessons)

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
        options = ClaudeAgentOptions(
            system_prompt={"type": "file", "path": SYSTEM_PROMPT_FILE},
            mcp_servers={"ui": build_ui_mcp_server(self._bridge)},
            allowed_tools=ALLOWED_TOOL_NAMES,
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
                    # event.usage is the SDK's normalized usage dict.
                    # Field names vary across SDK versions; we read
                    # both snake_case and camelCase below.
                    usage = dict(event.usage or {})
                    # Some SDKs surface model on the ResultMessage; if
                    # absent, leave it None and tooltip falls back to
                    # the env-default.
                    if hasattr(event, "model") and event.model:
                        usage.setdefault("model", event.model)
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
          lesson_started / lesson_completed / lesson_failed
          kc_started / kc_completed / kc_failed
          cs_started / cs_completed / cs_failed
          course_completed / course_export_ready
          not_implemented (sprint-2-1 + cancellation/resume stubs)
        """
        await self._send({
            "type": "build_progress",
            "kind": kind,
            **payload,
        })


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
