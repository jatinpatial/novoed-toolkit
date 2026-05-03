import asyncio
import json
import logging
import time
from typing import Any

from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect
from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    ResultMessage,
    TextBlock,
)

from .bridge import ToolBridge
from .config import (
    MODEL_ARCHITECT,
    MODEL_FALLBACK,
    MODEL_WORKER,
    SYSTEM_PROMPT_FILE,
    TOOL_CALL_TIMEOUT_SECONDS,
)
from .orchestrator import BuildOrchestrator, _extract_usage
from .ui_tools import ALLOWED_TOOL_NAMES, build_ui_mcp_server

log = logging.getLogger(__name__)


# polish-13a: module-level singletons. Bridge + orchestrator persist
# across WebSocket reconnects so a build started in one WS keeps
# running and reattaches to the next WS without a halt.
#
# Trigger that motivated this: an FE refresh mid-build (Vite HMR,
# manual reload, network blip) tore down the WS while the orchestrator
# was actively writing lessons. Pre-fix:
#   - The orchestrator's _send pointed at the dead WS.
#   - Starlette raised RuntimeError("Unexpected ASGI message...")
#     on the next state-event send.
#   - The asyncio task carrying the build crashed silently.
#   - The new WS connected to a fresh per-session orchestrator with
#     empty state, so the FE saw idle while the OLD orchestrator was
#     either crashed or trying to talk to a dead pipe.
#
# Per-LD localhost = single user per backend instance, so a
# module-level singleton is the right abstraction. If we ever go
# multi-user (Phase 3 / Electron), this becomes a registry keyed
# by session token.
_shared_bridge: ToolBridge | None = None
_shared_orchestrator: BuildOrchestrator | None = None


class Session:
    """One WebSocket connection ↔ one ClaudeSDKClient. Multi-turn
    conversation state lives in the SDK.

    polish-13a: the bridge + orchestrator are SHARED across Session
    instances (module-level singletons). Each new Session:
      1. Binds the bridge's sender to its own WS-write
      2. Swaps the orchestrator's sender to its own WS-write
      3. Creates a fresh chat-side ClaudeSDKClient (chat IS per-WS)

    Builds-in-flight survive reconnects via the singletons. Pending
    tool_call futures on the bridge are NOT cancelled on Session
    close — stalled calls (sent to the now-dead WS, FE never replied)
    time out and trigger the orchestrator's retry path, which sends
    them through the NEW WS via the updated bind_sender target.
    """

    def __init__(self, websocket: WebSocket):
        global _shared_bridge, _shared_orchestrator
        self.ws = websocket

        # Reuse the bridge across reconnects so pending tool-call
        # futures survive. Timeout-based recovery handles stalled
        # calls (the orchestrator's retry path takes care of them).
        if _shared_bridge is None:
            _shared_bridge = ToolBridge(timeout_seconds=TOOL_CALL_TIMEOUT_SECONDS)
        self.bridge = _shared_bridge
        # ALWAYS re-bind the sender to THIS session's WS. Every reconnect
        # gets a fresh send target — old WS references go stale.
        self.bridge.bind_sender(self._send)

        # sprint-2-1: orchestrator gets the SAME bridge as the main
        # session. ToolBridge call_ids are global UUIDs so tool_result
        # routing-by-id Just Works.
        # sprint-2-3: locked fork #2 — same bridge means write_lesson /
        # list_structure / etc. from mini-sessions hit the same FE-side
        # AgentActions as the manual chat path.
        # polish-13a: orchestrator is also a singleton — reuse if a
        # build is already in flight, just swap its sender to the new
        # WS. New WS = same build, new pipe.
        if _shared_orchestrator is None:
            _shared_orchestrator = BuildOrchestrator(send=self._send, bridge=self.bridge)
        else:
            _shared_orchestrator.update_sender(self._send)
        self.orchestrator = _shared_orchestrator

        self._client: ClaudeSDKClient | None = None
        self._lock = asyncio.Lock()  # one chat turn at a time

    async def _send(self, payload: dict[str, Any]) -> None:
        """polish-13a: defensive — WS may have closed mid-build (HMR
        reload, manual refresh, network blip). Log & continue silently
        instead of crashing the asyncio task. The FE rehydrates via
        get_orchestrator_state on reconnect (sprint-2-1 wired this),
        so missed state events are recoverable.
        """
        try:
            await self.ws.send_text(json.dumps(payload))
        except (RuntimeError, WebSocketDisconnect) as exc:
            # RuntimeError covers Starlette's "Unexpected ASGI message
            # 'websocket.send', after sending 'websocket.close'…"
            # WebSocketDisconnect can land on send paths in some
            # transport states.
            log.warning("ws send dropped (closed): %s", type(exc).__name__)
        except Exception as exc:
            # Catch-all so a transient transport issue can't crash the
            # build's asyncio task. Includes connection errors that
            # don't subclass the two above on different ASGI servers.
            log.warning("ws send unexpected error: %s", exc, exc_info=True)

    async def start(self) -> None:
        ui_server = build_ui_mcp_server(self.bridge)
        # urgent-fix-prompt-size: pass the system prompt as a FILE rather
        # than a string. Pre-fix the SDK was stuffing the full 34 KB
        # prompt onto the CLI subprocess command line, which exceeded
        # the Windows CreateProcess 32,767-char limit and the agent
        # couldn't spawn. The {"type": "file", "path": ...} dict form
        # tells the SDK to use --system-prompt-file <path> instead;
        # subprocess args drop to a few hundred bytes regardless of
        # prompt size. See config.py for the file-write logic.
        # polish-17a: chat session runs Course Architect (MODE 1) most
        # often — outline quality matters, so default to MODEL_ARCHITECT
        # (Opus-tier when configured). Falls through to SDK default
        # (currently Opus on BCG U subscription) when env var unset.
        options = ClaudeAgentOptions(
            system_prompt={"type": "file", "path": SYSTEM_PROMPT_FILE},
            mcp_servers={"ui": ui_server},
            allowed_tools=ALLOWED_TOOL_NAMES,
            model=MODEL_ARCHITECT,
            fallback_model=MODEL_FALLBACK,
        )
        self._client = ClaudeSDKClient(options=options)
        await self._client.connect()

    async def handle_client_message(self, raw: str) -> None:
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            await self._send({"type": "error", "message": "malformed json"})
            return

        mtype = msg.get("type")
        if mtype == "tool_result":
            self.bridge.resolve(
                call_id=msg.get("id", ""),
                ok=bool(msg.get("ok", True)),
                result=msg.get("result"),
                error=msg.get("error"),
            )
        elif mtype == "user_message":
            text = msg.get("text", "")
            asyncio.create_task(self._run_turn(text))
        elif mtype == "cancel":
            # best-effort: not a hard interrupt of the SDK, but frees pending tool calls
            self.bridge.cancel_all(reason="user canceled")
        # ─── sprint-2-1: orchestrator routes ───────────────────────────
        # Each orchestrator method is dispatched on its own task so the
        # chat router doesn't block on a long-running build. The
        # orchestrator owns an internal lock that serializes its own
        # methods (per locked fork #3 — chat and orchestrator queues
        # stay independent).
        elif mtype == "build_full_course":
            course = msg.get("course") or {}
            shape = msg.get("shape")
            asyncio.create_task(self.orchestrator.build_full_course(course, shape))
        elif mtype == "build_full_course_resume":
            try:
                start_from = int(msg.get("startFrom", 0))
            except (TypeError, ValueError):
                start_from = 0
            asyncio.create_task(self.orchestrator.resume(start_from))
        elif mtype == "build_cancel":
            asyncio.create_task(self.orchestrator.cancel())
        # ─── Track-B (KC Studio): standalone-KC build route ────────
        elif mtype == "build_kc":
            asyncio.create_task(self._run_kc_build(msg))
        # ─── Track-G (Infographic Studio): standalone build route ──
        elif mtype == "build_infographic":
            asyncio.create_task(self._run_infographic_build(msg))
        elif mtype == "get_orchestrator_state":
            # Not async-heavy — but we still await rather than create_task
            # so the response lands in send-order with any other state
            # changes that might be in flight. Used by the FE for
            # rehydration after a refresh (single source of truth lives
            # backend-side per locked fork #3).
            state = await self.orchestrator.get_state()
            await self._send({"type": "build_state", "state": state})
        else:
            await self._send({"type": "error", "message": f"unknown type: {mtype}"})

    async def _run_turn(self, user_text: str) -> None:
        if self._client is None:
            await self._send({"type": "error", "message": "session not started"})
            return

        async with self._lock:
            try:
                await self._client.query(user_text)
                async for event in self._client.receive_response():
                    if isinstance(event, AssistantMessage):
                        for block in event.content:
                            if isinstance(block, TextBlock) and block.text:
                                await self._send({
                                    "type": "assistant_text",
                                    "text": block.text,
                                })
                    elif isinstance(event, ResultMessage):
                        await self._send({
                            "type": "done",
                            "usage": event.usage,
                        })
                        break
            except Exception as exc:
                log.exception("turn failed")
                await self._send({"type": "error", "message": str(exc)})

    async def _run_kc_build(self, msg: dict[str, Any]) -> None:
        """Track-B (KC Studio): standalone Quiz Builder mini-session.

        Differs from the orchestrator's _run_kc_session in two ways:
          1. No course context — the KC isn't anchored to a lesson or
             module. The agent gets a synthetic course on list_structure
             (FE registers actions.getCourse to return a 1-module 1-
             lesson stand-in keyed by the kc_id).
          2. Result lives in its own Kc record (FE-side) instead of
             being attached to a course's knowledgeCheck field. Same
             write_knowledge_check tool path — the FE-side actions
             dispatch updates the Kc.questions slice.

        Wire format
          incoming: {
            type: "build_kc",
            kcId: str,                 # UUID generated by FE
            topic: str,                # what the KC tests
            syntheticLessonId: str,    # FE-generated for the wrapper
            questionCount: int,        # 3 / 5 / 10
            difficultyMix: list[str],  # subset of recall/apply/analyze
            questionTypes: list[str],  # subset of mcq/short/scenario
            notes: str,                # optional free-form
          }
          outgoing (success): {
            type: "kc_built",
            kcId: str,
            durationMs: int,
            costUsd: float | None,
            tokensIn / tokensOut / model: …,
          }
          outgoing (failure): {
            type: "kc_build_failed",
            kcId: str,
            error: str,
          }

        The questions themselves arrive on the FE via the existing
        write_knowledge_check tool path — by the time kc_built fires
        on the WS, FE state already has them.
        """
        kc_id = msg.get("kcId") or ""
        topic = msg.get("topic") or "Untitled knowledge check"
        synthetic_lesson_id = msg.get("syntheticLessonId") or ""
        question_count = int(msg.get("questionCount") or 5)
        difficulty_mix = msg.get("difficultyMix") or ["recall", "apply", "analyze"]
        question_types = msg.get("questionTypes") or ["mcq"]
        notes = (msg.get("notes") or "").strip()

        if not kc_id or not synthetic_lesson_id:
            await self._send({
                "type": "kc_build_failed",
                "kcId": kc_id,
                "error": "Missing kcId or syntheticLessonId in build_kc payload.",
            })
            return

        log.info(
            "build_kc start — kcId=%s topic='%s' count=%d difficulty=%s types=%s",
            kc_id, topic, question_count, difficulty_mix, question_types,
        )

        prompt = self._build_kc_studio_prompt(
            topic=topic,
            synthetic_lesson_id=synthetic_lesson_id,
            question_count=question_count,
            difficulty_mix=difficulty_mix,
            question_types=question_types,
            notes=notes,
        )

        init_start = time.monotonic()
        # polish-17a: KC build runs Quiz Builder (MODE 4) — worker tier.
        # Sonnet-grade quality is sufficient for question generation;
        # cost amplification matters most here for KC-Studio volume.
        options = ClaudeAgentOptions(
            system_prompt={"type": "file", "path": SYSTEM_PROMPT_FILE},
            mcp_servers={"ui": build_ui_mcp_server(self.bridge)},
            allowed_tools=ALLOWED_TOOL_NAMES,
            model=MODEL_WORKER,
            fallback_model=MODEL_FALLBACK,
        )
        client = ClaudeSDKClient(options=options)
        try:
            await client.connect()
            init_ms = int((time.monotonic() - init_start) * 1000)
            start_ts = time.monotonic()
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
            duration_ms = int((time.monotonic() - start_ts) * 1000)
            metrics = _extract_usage(usage)
            await self._send({
                "type": "kc_built",
                "kcId": kc_id,
                "durationMs": duration_ms,
                "initMs": init_ms,
                "tokensIn": metrics["tokens_in_total"],
                "tokensOut": metrics["tokens_out"],
                "model": metrics["model"],
                "costUsd": metrics["cost_usd"],
            })
            log.info(
                "kc %s done — %dms (init %dms) tokens in=%s out=%s cost=$%s",
                kc_id, duration_ms, init_ms,
                metrics["tokens_in_total"],
                metrics["tokens_out"],
                f"{metrics['cost_usd']:.4f}" if metrics["cost_usd"] is not None else "?",
            )
        except Exception as exc:
            log.exception("build_kc failed for kcId=%s", kc_id)
            await self._send({
                "type": "kc_build_failed",
                "kcId": kc_id,
                "error": str(exc),
            })
        finally:
            try:
                await client.disconnect()
            except Exception:
                log.warning("kc %s disconnect failed (non-fatal)", kc_id, exc_info=True)

    @staticmethod
    def _build_kc_studio_prompt(
        topic: str,
        synthetic_lesson_id: str,
        question_count: int,
        difficulty_mix: list[str],
        question_types: list[str],
        notes: str,
    ) -> str:
        """Compose the Quiz Builder mini-session prompt for a
        standalone KC. The agent's MODE 4 (Quiz Builder) handles the
        actual writing; this prompt provides the inputs MODE 4 expects.

        Maps the FE form's inputs onto MODE 4 vocabulary:
          difficultyMix        → Bloom's mix instructions
          questionTypes        → MCQ + short_answer + scenario directives
          questionCount        → "Generate N questions"
          notes                → appended verbatim
          synthetic lesson id  → write_knowledge_check target_id
        """
        difficulty_label = ", ".join(difficulty_mix) if difficulty_mix else "recall, apply, analyze"
        types_label = ", ".join(question_types) if question_types else "mcq"
        lines = [
            f"Build a standalone knowledge check on this topic: \"{topic}\".",
            "",
            f"Target lesson id (synthetic — this KC isn't anchored to a real lesson): {synthetic_lesson_id}",
            "",
            "Steps:",
            "1. If source materials are attached (the brief flow may have included a deck or doc), call read_materials FIRST and ground the questions in that source. Use the source's frameworks and language silently — no citations, no filenames in question text.",
            "2. Call list_structure if you need to see the synthetic lesson's title for context, otherwise skip.",
            f"3. Call write_knowledge_check(target_kind=\"lesson\", target_id=\"{synthetic_lesson_id}\", questions=[...]) with EXACTLY {question_count} questions following the MODE 4 spec:",
            f"   - Difficulty mix across the set: {difficulty_label}. Distribute roughly evenly across the requested levels.",
            f"   - Question types: {types_label}. If multiple types are listed, mix them across the set (some MCQ, some scenario, some short-answer if requested).",
            "   - For MCQ: scenario-style stems for apply/analyze (1-2 sentence setup, then the question), 4 options each, plausible distractors, rationale per question.",
            "   - For short-answer: 2-4 expectedAnswerHints per question (the LD's grading rubric, not learner-facing).",
            "4. Stop after the write_knowledge_check call.",
        ]
        if notes:
            lines.extend([
                "",
                "Additional notes from the LD:",
                notes,
            ])
        return "\n".join(lines)

    async def _run_infographic_build(self, msg: dict[str, Any]) -> None:
        """Track-G (Infographic Studio): standalone Infographic Builder
        mini-session. Same shape as _run_kc_build — fresh
        ClaudeSDKClient with the file SYSTEM_PROMPT (MODE 6 active),
        shared bridge for the write_infographic round-trip, cost
        telemetry on the infographic_built event.

        Wire format
          incoming: {
            type: "build_infographic",
            infographicId: str,
            topic: str,
            style: "process" | "quadrant" | "comparison"
                 | "numbered_list" | "timeline"
                 | "stat_spotlight" | "pyramid" | "cycle" | "five_forces",
            pointCount: int (3-7),
            notes: str (optional),
          }
          outgoing (success): {
            type: "infographic_built",
            infographicId: str,
            durationMs, initMs, tokensIn, tokensOut, model, costUsd
          }
          outgoing (failure): {
            type: "infographic_build_failed",
            infographicId: str,
            error: str,
          }

        Points themselves arrive on the FE via write_infographic tool
        path — by the time infographic_built fires, FE state already
        has them.
        """
        infographic_id = msg.get("infographicId") or ""
        topic = msg.get("topic") or "Untitled infographic"
        style = msg.get("style") or "numbered_list"
        try:
            point_count = int(msg.get("pointCount") or 5)
        except (TypeError, ValueError):
            point_count = 5
        notes = (msg.get("notes") or "").strip()

        if not infographic_id:
            await self._send({
                "type": "infographic_build_failed",
                "infographicId": infographic_id,
                "error": "Missing infographicId in build_infographic payload.",
            })
            return

        log.info(
            "build_infographic start — id=%s topic='%s' style=%s points=%d",
            infographic_id, topic, style, point_count,
        )

        prompt = self._build_infographic_prompt(
            infographic_id=infographic_id,
            topic=topic,
            style=style,
            point_count=point_count,
            notes=notes,
        )

        init_start = time.monotonic()
        # polish-17a: worker-tier model — Infographic Builder is high-
        # volume, low-stakes-per-call work; Sonnet-grade is enough.
        options = ClaudeAgentOptions(
            system_prompt={"type": "file", "path": SYSTEM_PROMPT_FILE},
            mcp_servers={"ui": build_ui_mcp_server(self.bridge)},
            allowed_tools=ALLOWED_TOOL_NAMES,
            model=MODEL_WORKER,
            fallback_model=MODEL_FALLBACK,
        )
        client = ClaudeSDKClient(options=options)
        try:
            await client.connect()
            init_ms = int((time.monotonic() - init_start) * 1000)
            start_ts = time.monotonic()
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
            duration_ms = int((time.monotonic() - start_ts) * 1000)
            metrics = _extract_usage(usage)
            await self._send({
                "type": "infographic_built",
                "infographicId": infographic_id,
                "durationMs": duration_ms,
                "initMs": init_ms,
                "tokensIn": metrics["tokens_in_total"],
                "tokensOut": metrics["tokens_out"],
                "model": metrics["model"],
                "costUsd": metrics["cost_usd"],
            })
            log.info(
                "infographic %s done — %dms (init %dms) tokens in=%s out=%s cost=$%s",
                infographic_id, duration_ms, init_ms,
                metrics["tokens_in_total"],
                metrics["tokens_out"],
                f"{metrics['cost_usd']:.4f}" if metrics["cost_usd"] is not None else "?",
            )
        except Exception as exc:
            log.exception("build_infographic failed for id=%s", infographic_id)
            await self._send({
                "type": "infographic_build_failed",
                "infographicId": infographic_id,
                "error": str(exc),
            })
        finally:
            try:
                await client.disconnect()
            except Exception:
                log.warning(
                    "infographic %s disconnect failed (non-fatal)",
                    infographic_id, exc_info=True,
                )

    @staticmethod
    def _build_infographic_prompt(
        infographic_id: str,
        topic: str,
        style: str,
        point_count: int,
        notes: str,
    ) -> str:
        """Compose the MODE 6 prompt for an infographic build."""
        lines = [
            f"Build a standalone infographic on this topic: \"{topic}\".",
            "",
            f"Infographic id: {infographic_id}",
            f"Style: {style}",
            f"Point count: {point_count}  (must match exactly — split or merge ideas to hit this number)",
            "",
            "Steps:",
            "1. If source materials are attached, call read_materials FIRST and ground the infographic in their frameworks and language. Source-grounding rules from the universal CONTENT RULES section apply: invisible attribution, no citations.",
            f"2. Call write_infographic(infographic_id=\"{infographic_id}\", title, subtitle?, points=[…]) with EXACTLY {point_count} structured points.",
            "3. Stop after the write_infographic call.",
        ]
        if notes:
            lines.extend(["", "Additional notes from the LD:", notes])
        return "\n".join(lines)

    async def close(self) -> None:
        # polish-13a: do NOT tear down the shared bridge or orchestrator
        # on session close. They survive reconnects so a build started
        # in one WS keeps running and reattaches to the next WS.
        #
        # Pre-fix this called self.bridge.cancel_all("session closed")
        # which cancelled every pending tool_call future, including
        # those owned by an in-flight build. With the singleton bridge,
        # cancelling on per-session close would break recovery —
        # so it's removed. Stalled futures (sent to the now-dead WS,
        # never resolved) time out via TOOL_CALL_TIMEOUT_SECONDS and
        # trip the orchestrator's retry path; the retry sends through
        # the new WS via bind_sender's updated target.
        if self._client is not None:
            try:
                await self._client.disconnect()
            except Exception:
                pass
