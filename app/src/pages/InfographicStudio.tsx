import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BarChart3, Download } from "lucide-react";
import html2canvas from "html2canvas";
import { AppShell } from "../shell/AppShell";
import { AgentChat, AgentInflightIndicator } from "../agent/AgentChat";
import { useAgent, useRegisterAgentActions, type AgentActions } from "../agent/AgentContext";
import {
  getInfographic,
  saveInfographic,
  subscribeInfographics,
  type Infographic,
  type InfographicPoint,
} from "../store/infographics";
import { InfographicRenderer } from "../infographic/InfographicRenderer";

/**
 * Track-G / G3: Infographic Studio result view.
 *
 * Loads the Infographic by :id route param. Watches infographicBuilds
 * for status transitions:
 *   "building"      → centered loading state with AgentInflightIndicator
 *   "failed"        → friendly error with retry hint
 *   "done" + points → render via InfographicRenderer (style-switched)
 *   "done" + 0 pts  → "no points yet" empty state (defensive)
 *
 * AgentActions wired here:
 *   getCourse() → null (Infographic Builder doesn't need a course)
 *   getPendingMaterials() → returns AgentContext.pendingMaterials so
 *                           the agent's read_materials grounds in
 *                           whatever was uploaded on /infographics/new
 *   writeInfographic() → updates Infographic.title + subtitle + points
 *                        in localStorage. Validates infographicId match
 *                        (silent-success protection per polish-16b).
 *   Other actions throw with helpful errors.
 */
export default function InfographicStudio() {
  const { id } = useParams<{ id: string }>();
  const {
    infographicBuilds,
    pendingMaterials,
    clearPendingMaterials,
    status: agentStatus,
  } = useAgent();

  const [infographic, setInfographic] = useState<Infographic | null>(null);
  const [triedLoad, setTriedLoad] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const renderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!id) return;
    setInfographic(getInfographic(id));
    setTriedLoad(true);
    return subscribeInfographics(() => setInfographic(getInfographic(id)));
  }, [id]);

  const buildState = id ? infographicBuilds[id] : undefined;

  // Clear pending materials once the build completes — same pattern as
  // KcStudio so a subsequent build doesn't inherit stale uploads.
  useEffect(() => {
    if (buildState?.status === "done") {
      clearPendingMaterials();
    }
  }, [buildState?.status, clearPendingMaterials]);

  const actions: AgentActions = useMemo(
    () => ({
      getCourse: () => null,
      getPendingMaterials: () => pendingMaterials,
      navigate: () => {},
      setBrand: () => {},
      addModule: () => {
        throw new Error("Infographic Studio: add_module isn't supported here.");
      },
      addLesson: () => {
        throw new Error("Infographic Studio: add_lesson isn't supported here.");
      },
      addBlock: () => {
        throw new Error("Infographic Studio: add_block isn't supported here.");
      },
      updateBlock: () => {
        throw new Error("Infographic Studio: updateBlock isn't supported here.");
      },
      deleteBlock: () => {
        throw new Error("Infographic Studio: deleteBlock isn't supported here.");
      },
      reorder: () => {},
      exportLesson: () => {},
      writeLesson: () => {
        throw new Error("Infographic Studio: write_lesson isn't supported — call write_infographic.");
      },
      writeScript: () => {
        throw new Error("Infographic Studio: write_script isn't supported here.");
      },
      writeKnowledgeCheck: () => {
        throw new Error("Infographic Studio: write_knowledge_check isn't supported here.");
      },
      regenerateQuestion: () => ({ ok: false }),
      designCaseStudy: () => {
        throw new Error("Infographic Studio: design_case_study isn't supported here.");
      },
      writeInfographic: (infographicId, payload) => {
        if (!infographic) return { ok: false };
        if (infographicId !== infographic.id) {
          console.warn(
            "[infographic-studio] writeInfographic: id mismatch (got %s, expected %s)",
            infographicId,
            infographic.id,
          );
          return { ok: false };
        }
        const next: Infographic = {
          ...infographic,
          title: payload.title || infographic.title,
          subtitle: payload.subtitle || "",
          points: payload.points,
          updatedAt: Date.now(),
        };
        saveInfographic(next);
        setInfographic(next);
        return { ok: true };
      },
    }),
    [infographic, pendingMaterials],
  );
  useRegisterAgentActions(actions);

  function updateTitle(newTitle: string) {
    if (!infographic) return;
    const next = { ...infographic, title: newTitle, updatedAt: Date.now() };
    saveInfographic(next);
    setInfographic(next);
  }

  async function downloadPng() {
    if (!renderRef.current || !infographic) return;
    setDownloadError(null);
    setDownloading(true);
    try {
      const canvas = await html2canvas(renderRef.current, {
        backgroundColor: "#ffffff",
        scale: 2, // retina output
        useCORS: true,
        logging: false,
      });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      const stem = (infographic.title || infographic.topic || "infographic").replace(/[^\w\-_.]/g, "_");
      a.download = `${stem}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      setDownloadError((e as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  if (!infographic && triedLoad) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto py-12 px-6 text-center">
          <BarChart3 size={32} className="mx-auto text-ink-400 mb-3" />
          <h2 className="text-h2 text-ink-900 mb-2">Infographic not found</h2>
          <p className="text-sm text-ink-500 mb-6">
            This infographic may have been deleted or never finished saving.
          </p>
          <Link to="/" className="btn-secondary btn-sm">
            <ArrowLeft size={14} /> Back to dashboard
          </Link>
        </div>
      </AppShell>
    );
  }
  if (!infographic) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto py-12 px-6 text-center text-sm text-ink-500">
          Loading…
        </div>
      </AppShell>
    );
  }

  const isBuilding = buildState?.status === "building";
  const isFailed = buildState?.status === "failed";
  const hasPoints = infographic.points.length > 0;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto py-8 px-6">
        <div className="flex items-center gap-3 mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-brand-700 transition-colors"
          >
            <ArrowLeft size={14} /> Dashboard
          </Link>
          <span className="text-ink-300">·</span>
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-brand-700 uppercase tracking-wider">
            <BarChart3 size={11} /> Infographic Studio
          </div>
        </div>

        <input
          value={infographic.title}
          onChange={(e) => updateTitle(e.target.value)}
          className="w-full text-h1 text-ink-900 bg-transparent border-none outline-none mb-3 placeholder:text-ink-300 -ml-1 px-1 rounded hover:bg-ink-50 focus:bg-white focus:shadow-focus transition-all duration-base ease-sana tracking-[-0.01em]"
        />

        <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
          <span>
            <strong className="text-ink-700">Topic:</strong> {infographic.topic}
          </span>
          <span className="text-ink-300">·</span>
          <span>
            <strong className="text-ink-700">Style:</strong> {infographic.style.replace("_", " ")}
          </span>
          <span className="text-ink-300">·</span>
          <span>
            <strong className="text-ink-700">{infographic.pointCount} points</strong>
          </span>
          {buildState?.status === "done" && buildState.costUsd !== null && (
            <>
              <span className="text-ink-300">·</span>
              <span title={`${buildState.tokensIn ?? "?"} tokens in / ${buildState.tokensOut ?? "?"} tokens out`}>
                <strong className="text-ink-700">Cost:</strong> ${buildState.costUsd.toFixed(3)}
              </span>
            </>
          )}
        </div>

        {isBuilding && (
          <div className="card p-10 text-center">
            <BarChart3 className="mx-auto text-brand-500 mb-3" size={32} />
            <h3 className="text-h3 text-ink-900 mb-2">Studio Copilot is composing your infographic…</h3>
            <p className="text-sm text-ink-500 max-w-md mx-auto mb-4">
              Reading source materials, picking icons, tightening the wording. Usually about a minute.
            </p>
            <div className="agent-inflight-card-wrap">
              <AgentInflightIndicator centered />
            </div>
          </div>
        )}

        {isFailed && (
          <div className="card p-8 border-red-200 bg-red-50">
            <h3 className="text-h3 text-ink-900 mb-2">Build failed</h3>
            <p className="text-sm text-ink-700 mb-2">
              {buildState?.status === "failed" ? buildState.error : "Unknown error"}
            </p>
            <p className="text-xs text-ink-500">
              Retry by going back to{" "}
              <Link to="/infographics/new" className="text-brand-700 underline">
                Infographic Studio
              </Link>{" "}
              and submitting again.
            </p>
          </div>
        )}

        {!isBuilding && !isFailed && hasPoints && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-h3 text-ink-900">Generated infographic</h3>
              <button
                onClick={downloadPng}
                disabled={downloading}
                className="btn-secondary btn-sm"
              >
                <Download size={14} /> {downloading ? "Rendering…" : "Download PNG"}
              </button>
            </div>
            {downloadError && (
              <div className="mb-4 text-xs text-red-600">
                Download failed: {downloadError}
              </div>
            )}
            <div ref={renderRef} className="infographic-render-host">
              <InfographicRenderer
                title={infographic.title}
                subtitle={infographic.subtitle}
                style={infographic.style}
                points={infographic.points}
              />
            </div>
          </>
        )}

        {!isBuilding && !isFailed && !hasPoints && (
          <div className="card p-8 text-center">
            <BarChart3 size={32} className="mx-auto text-ink-400 mb-3" />
            <h3 className="text-h3 text-ink-900 mb-2">No points yet</h3>
            <p className="text-sm text-ink-500 mb-4">
              The build hasn't finished or never started. Try{" "}
              <Link to="/infographics/new" className="text-brand-700 underline">
                creating a fresh infographic
              </Link>
              .
            </p>
          </div>
        )}
      </div>

      {agentStatus && <AgentChat />}
    </AppShell>
  );
}

// Type-import bypass — InfographicPoint already used via Infographic.
void ({} as InfographicPoint);
