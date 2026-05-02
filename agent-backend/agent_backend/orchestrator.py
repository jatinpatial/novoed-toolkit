"""BuildOrchestrator — sprint-2-1 skeleton.

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

Sprint-2-1 ships the skeleton + event plumbing + state struct only.
The actual sequential lesson loop lands in sprint-2-3; retry+backoff
in sprint-2-6; KC + CS phases in sprint-2-8 / 2-9.

State machine (phase):

    idle             never run, or cleared after completion
    building         sequential lesson loop in progress
    paused           lesson_failed after retry; awaiting resume
    completed        course built, Word doc emitted
    cancelled        client sent build_cancel; pipeline halted at
                     last phase boundary
    failed           non-recoverable error (e.g. SDK crash); manual
                     intervention required

LessonState / KcState / CsState (per-target):

    idle             not yet started
    building         in flight
    done             completed successfully
    error            failed after retry (sprint-2-6); resumable
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Literal

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


class BuildOrchestrator:
    """Per-session orchestrator — one instance per WS connection.

    Owns its own asyncio.Lock so the orchestrator's coroutines don't
    contend with the chat session's _lock (per locked fork #3 — chat
    stays responsive during a build). Methods are awaitable; session.py
    schedules `build_full_course` / `resume` as background tasks.
    """

    def __init__(self, send: SendFn) -> None:
        self._send = send
        self._state = OrchestratorState()
        self._lock = asyncio.Lock()  # serialize orchestrator method calls
        self._cancelled = False
        self._task: asyncio.Task[None] | None = None  # the active build coroutine, if any

    # ─── public API (called from session.py message router) ────────

    async def get_state(self) -> dict[str, Any]:
        """Return the current state for the FE to rehydrate after refresh."""
        return self._state.to_dict()

    async def build_full_course(self, course: dict[str, Any], shape: dict[str, Any] | None) -> None:
        """Start a full-course build. No-op if a build is already running.

        Sprint-2-1: stub — sets phase to building, emits
        `not_implemented` event, resets to idle. Sprint-2-3 replaces
        this with the real sequential lesson loop.
        """
        async with self._lock:
            if self._state.phase == "building":
                await self._send({
                    "type": "error",
                    "message": "A build is already running — cancel it first or wait for completion.",
                })
                return

            modules = course.get("modules", []) if isinstance(course, dict) else []
            total_lessons = sum(len(m.get("lessons", [])) for m in modules if isinstance(m, dict))
            case_studies = course.get("caseStudies", []) if isinstance(course, dict) else []

            self._cancelled = False
            self._state = OrchestratorState(
                phase="building",
                total_lessons=total_lessons,
                total_kcs=0,  # Quiz Builder phase wires this in sprint-2-8
                total_css=len([cs for cs in case_studies if isinstance(cs, dict)]),
            )
            for idx in range(total_lessons):
                self._state.lesson_states[idx] = "idle"

            await self._emit_state()
            log.info(
                "build_full_course called — modules=%d lessons=%d shape=%s",
                len(modules), total_lessons, shape,
            )

            # Sprint-2-1 stub: emit not_implemented progress event so the
            # FE confirms the wire works. Sprint-2-3 replaces this with
            # the sequential lesson loop.
            await self._emit_progress("not_implemented", {
                "message": "Sprint-2-1 wire confirmed. Lesson loop lands in sprint-2-3.",
                "totalLessons": total_lessons,
            })

            # Reset to idle so subsequent test-fires can re-trigger.
            self._state.phase = "idle"
            self._state.lesson_states.clear()
            await self._emit_state()

    async def resume(self, start_from: int) -> None:
        """Resume a paused build from the given lesson index (sprint-2-7)."""
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
          not_implemented (sprint-2-1 stub only)
        """
        await self._send({
            "type": "build_progress",
            "kind": kind,
            **payload,
        })
