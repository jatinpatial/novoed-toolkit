import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BarChart3, Code, Copy, Download, Pencil, Check, Sparkles } from "lucide-react";
import html2canvas from "html2canvas";
// Track-X3: dom-to-image-more handles gradient text-fill (used in
// stat_spotlight headlines), inline SVG via dangerouslySetInnerHTML
// (BCG icons), and font embedding more reliably than html2canvas. We
// import without types — the package exports a default with .toPng,
// .toBlob, etc. and the @types/dom-to-image package's shape matches.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — no bundled types; runtime API is documented + used here.
import domtoimage from "dom-to-image-more";
import { AppShell } from "../shell/AppShell";
import { AgentChat } from "../agent/AgentChat";
import { useAgent, useRegisterAgentActions, type AgentActions } from "../agent/AgentContext";
import { StudioBuildLoader } from "../shell/StudioBuildLoader";
import {
  getInfographic,
  saveInfographic,
  subscribeInfographics,
  type Infographic,
  type InfographicPoint,
} from "../store/infographics";
import { InfographicRenderer } from "../infographic/InfographicRenderer";
import { searchImagesCached } from "../lib/images";
// Track-SS (Deckster v2 → v3 fix): exports honor the NovoEd toolkit
// split — HTML must be STATIC (Froala embed only; NovoEd's native
// HTML embed doesn't support interactive HTML), SCORM is the
// INTERACTIVE one and must be a packaged .zip with imsmanifest.xml,
// not a single .html file. v2 conflated the two; v3 fixes:
//   - "Copy HTML" still calls genHTML → static Froala embed (correct)
//   - "Download SCORM" now calls downloadSCORM → real .zip
import { genHTML } from "../generators/html/genHTML";
import { downloadSCORM } from "../scorm/zipBuilder";
import { infographicToComponent } from "../lib/infographicToComponent";
import { useActiveBrand } from "../shell/TopBar";

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
  // Track-SS (Deckster v2): copy-to-clipboard feedback for the HTML
  // embed export. Flips back after 2s. Don't conflate with the PNG
  // download spinner — these are separate flows.
  const [htmlCopied, setHtmlCopied] = useState(false);
  // Active brand reads from the same global as the rest of the app
  // (TopBar pill + cover band cascade). genHTML / genSCORMhtml
  // expect a BrandKey to apply the right gradient + colors.
  const [brand] = useActiveBrand();
  // BB1: edit-mode toggle. Off by default so the renderer is read-
  // only on first view and PNG export sees no edit chrome. LDs flip
  // it on to revise heading / body / title text in place.
  const [editMode, setEditMode] = useState(false);
  // BB2: which color-picker popover, if any, is open. Lifted up from
  // EditableText so PNG export can clear it before capture and so
  // only one picker is open at a time. null = all closed.
  const [openPickerKey, setOpenPickerKey] = useState<string | null>(null);
  // v3: dark-mode toggle for the rendered infographic. Applies a
  // .ig-dark class to the render host, which inverts the palette
  // (white-on-deep-green) without disturbing brand cascade vars.
  // PNG capture honors this — flip dark, click PNG, get dark export.
  const [darkMode, setDarkMode] = useState(false);
  // v3: hide-title toggle. When on, the title + subtitle area on the
  // rendered infographic is hidden — useful for embeds where the LD
  // wants the visual standalone (e.g. dropping the design into a
  // slide that already has its own header).
  const [hideTitle, setHideTitle] = useState(false);
  const renderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!id) return;
    setInfographic(getInfographic(id));
    setTriedLoad(true);
    return subscribeInfographics(() => setInfographic(getInfographic(id)));
  }, [id]);

  // GG4: when includePeopleImages is on, fetch one Pexels professional-
  // people photo per point that doesn't have one cached yet. Persists
  // to infographic.pointPhotoUrls so reloads don't re-fetch. Runs
  // sequentially so we hit the (cached) Pexels proxy at most N times
  // — the lib's frontend cache + the backend's 30-min cache make
  // common queries (e.g. "leadership person professional") return
  // instantly across infographics.
  useEffect(() => {
    if (!infographic) return;
    if (!infographic.includePeopleImages) return;
    if (infographic.points.length === 0) return;
    const existing = infographic.pointPhotoUrls ?? [];
    // Find the first point without a fetched URL. We process one at
    // a time so concurrent infographic.updates don't trample each
    // other; subsequent iterations re-run as the dependency array
    // changes after each persist.
    const missingIndex = infographic.points.findIndex(
      (_, i) => existing[i] === undefined,
    );
    if (missingIndex === -1) return;
    let cancelled = false;
    (async () => {
      const point = infographic.points[missingIndex];
      // Prefer an explicit "photo:<query>" iconHint from the agent
      // (Track-S prompt instructs the agent to emit these when the
      // toggle is on); fall back to the point heading + bias terms.
      let q = "";
      if (point.iconHint?.toLowerCase().startsWith("photo:")) {
        q = point.iconHint.slice("photo:".length).trim();
      }
      if (!q) {
        q = `${point.heading || infographic.topic} person professional`;
      }
      const results = await searchImagesCached(q, "banner");
      if (cancelled) return;
      // Reload the latest record before persisting — concurrent edits
      // (text changes, etc.) shouldn't be lost.
      const latest = getInfographic(infographic.id);
      if (!latest) return;
      const next = [...(latest.pointPhotoUrls ?? [])];
      next[missingIndex] = results[0]?.url ?? null;
      saveInfographic({ ...latest, pointPhotoUrls: next });
    })();
    return () => { cancelled = true; };
  }, [
    infographic?.id,
    infographic?.includePeopleImages,
    infographic?.points.length,
    // Track the point-photo-url length so subsequent missing entries
    // trigger another run after each persist.
    (infographic?.pointPhotoUrls ?? []).filter((u) => u !== undefined).length,
  ]);

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

  // BB1: persist a single per-point text change. Mutates only the
  // targeted field on the targeted point; everything else stays in
  // place, so concurrent agent rewrites + manual edits don't trample
  // each other.
  function updatePointField(index: number, field: "heading" | "body", value: string) {
    if (!infographic) return;
    const nextPoints = infographic.points.map((p, i) =>
      i === index ? { ...p, [field]: value } : p,
    );
    const next = { ...infographic, points: nextPoints, updatedAt: Date.now() };
    saveInfographic(next);
    setInfographic(next);
  }
  function updateSubtitle(value: string) {
    if (!infographic) return;
    const next = { ...infographic, subtitle: value, updatedAt: Date.now() };
    saveInfographic(next);
    setInfographic(next);
  }

  // BB2: per-element color override. Null clears the override and the
  // element falls back to the brand cascade. Stored on the Infographic
  // record so it persists across reloads + survives PNG export.
  function updateStyleOverride(key: string, color: string | null) {
    if (!infographic) return;
    const overrides = { ...(infographic.styleOverrides ?? {}) };
    if (color === null) {
      delete overrides[key];
    } else {
      overrides[key] = color;
    }
    const next: Infographic = {
      ...infographic,
      styleOverrides: overrides,
      updatedAt: Date.now(),
    };
    saveInfographic(next);
    setInfographic(next);
  }

  /**
   * Track-X3: PNG export via dom-to-image-more, with html2canvas as
   * fallback. dom-to-image-more handles three things html2canvas
   * tends to mangle:
   *   1. Gradient text-fill — the stat_spotlight `.ig-stat-headline`
   *      uses -webkit-background-clip:text + linear-gradient. html2canvas
   *      flattens that to a solid color; dom-to-image-more renders the
   *      gradient correctly.
   *   2. Inline SVG via dangerouslySetInnerHTML — BCG icons use that
   *      pattern. dom-to-image-more walks the live DOM via SVG
   *      foreignObject so the rendered paths come through, where
   *      html2canvas occasionally drops them.
   *   3. CSS variables — both libs handle them, but dom-to-image-more
   *      resolves them by reading computed style at capture time, so
   *      brand-cascade swaps render as the user sees them.
   *
   * Resolution: 3× device pixels (~retina+). Output is a base64 data
   * URL → triggers anchor download. ~2-3 MB PNG for a typical layout.
   *
   * Fallback: if dom-to-image throws (rare — usually CORS image issue
   * with Pexels people-photos), we re-try via html2canvas. The output
   * is slightly less faithful but the download still succeeds.
   */
  async function downloadPng() {
    if (!renderRef.current || !infographic) return;
    // BB1 + BB2: clean the renderer DOM before capture so no edit
    // chrome bakes into the PNG.
    //   1. Turn off edit mode (hides hover affordances + edit-mode
    //      tinting on EditableText elements).
    //   2. Close any open color-picker popover (the popover sits
    //      absolute-positioned above the canvas; if it's open at
    //      capture time it shows up in the PNG).
    // Then wait 50ms so React has time to commit the state updates
    // and unmount the popover node before dom-to-image walks the
    // tree. requestAnimationFrame alone occasionally races on slower
    // machines — 50ms is a safer floor.
    if (editMode || openPickerKey !== null) {
      setEditMode(false);
      setOpenPickerKey(null);
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
    }
    setDownloadError(null);
    setDownloading(true);
    const node = renderRef.current;
    const stem = (infographic.title || infographic.topic || "infographic").replace(/[^\w\-_.]/g, "_");

    function trigger(dataUrl: string) {
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${stem}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    try {
      // Primary path: dom-to-image-more with 3× scale for crisp output.
      // The `style` override applies a CSS scale so the rasterized
      // canvas captures at higher resolution; width/height stay in DOM
      // pixels but the output PNG has 3× the linear pixel density.
      const rect = node.getBoundingClientRect();
      const scale = 3;
      const dataUrl = await domtoimage.toPng(node, {
        bgcolor: "#ffffff",
        width: rect.width * scale,
        height: rect.height * scale,
        style: {
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: `${rect.width}px`,
          height: `${rect.height}px`,
        },
        // Cache-busting on external images — Pexels URLs serve with
        // CORS headers but the response cache can intermittently miss
        // them. Adding a no-op query param forces a fresh fetch with
        // the corsAnonymous credential.
        cacheBust: true,
      });
      trigger(dataUrl);
    } catch (primaryErr) {
      // Fallback: classic html2canvas path. Less faithful for gradient
      // text-fills but reliable for the core layouts.
      try {
        const canvas = await html2canvas(node, {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
          logging: false,
        });
        trigger(canvas.toDataURL("image/png"));
      } catch (fallbackErr) {
        // Both paths failed — surface the dom-to-image error since
        // it's usually the more informative one.
        setDownloadError((primaryErr as Error).message || (fallbackErr as Error).message);
      }
    } finally {
      setDownloading(false);
    }
  }

  /**
   * Track-SS (Deckster v2): export the infographic as a static HTML
   * embed string suitable for paste-into-NovoEd's Froala editor. Maps
   * the current style + points to one of the 20 components from the
   * existing component library (e.g. five_forces → iconrow,
   * comparison → compare).
   *
   * Result is copied to the clipboard, NOT downloaded — the LD's
   * intended workflow is "click button → switch to NovoEd → paste".
   *
   * Falls back gracefully if clipboard API is unavailable (Firefox
   * private mode, old browsers) by selecting the text in a hidden
   * textarea — same pattern the rest of the app uses for share-link.
   */
  async function copyHtmlEmbed() {
    if (!infographic || infographic.points.length === 0) return;
    try {
      const transform = infographicToComponent({
        title: infographic.title || infographic.topic,
        subtitle: infographic.subtitle || "",
        style: infographic.style,
        points: infographic.points,
      });
      const html = genHTML(transform.htmlComponentId, brand, transform.data);
      await navigator.clipboard.writeText(html);
      setHtmlCopied(true);
      window.setTimeout(() => setHtmlCopied(false), 2000);
    } catch (err) {
      setDownloadError(
        `Couldn't copy HTML: ${(err as Error).message || "Clipboard unavailable"}`,
      );
    }
  }

  /**
   * Track-SS v3 (HTML/SCORM split correctness): export the infographic
   * as a proper SCORM .zip — not a single .html file. NovoEd's native
   * HTML/Froala embed CAN'T host interactive HTML, so the interactive
   * variant has to be SCORM. The .zip wraps the interactive HTML
   * (genSCORMhtml output) plus an imsmanifest.xml so any LMS can
   * upload + render the activity.
   *
   * Calls downloadSCORM (existing helper from scorm/zipBuilder.ts)
   * which already does the manifest + zip assembly.
   */
  function downloadInteractiveScorm() {
    if (!infographic || infographic.points.length === 0) return;
    try {
      const transform = infographicToComponent({
        title: infographic.title || infographic.topic,
        subtitle: infographic.subtitle || "",
        style: infographic.style,
        points: infographic.points,
      });
      downloadSCORM(transform.scormComponentId, transform.data, brand);
    } catch (err) {
      setDownloadError(
        `Couldn't generate SCORM package: ${(err as Error).message || "Unknown error"}`,
      );
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
        </div>

        {isBuilding && (
          <StudioBuildLoader
            heading="Studio Copilot is composing your infographic…"
            subhead="Reading the source, sketching the layout, picking icons, tightening the wording."
            phrases={[
              "Reading the source",
              "Sketching the layout",
              "Mapping the structure",
              "Picking the right icons",
              "Tightening the wording",
              "Balancing the visual hierarchy",
              "Adding the final polish",
            ]}
            estimateMs={90_000}
          />
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
            <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
              <h3 className="text-h3 text-ink-900">Generated infographic</h3>
              <div className="flex items-center gap-2 flex-wrap">
                {/* v3: visual-mode toggles. Dark mode + hide title both
                    affect the rendered output AND the PNG export. The
                    SCORM export uses its own theming (the SCORM HTML
                    has its own light backdrop) — to be addressed in
                    a follow-on commit. */}
                <button
                  onClick={() => setDarkMode((v) => !v)}
                  className={darkMode ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
                  title={darkMode ? "Switch to light mode" : "Switch to dark mode (PNG export honors this)"}
                >
                  {darkMode ? "Light" : "Dark"} mode
                </button>
                <button
                  onClick={() => setHideTitle((v) => !v)}
                  className={hideTitle ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
                  title={hideTitle ? "Show title + subtitle" : "Hide title + subtitle (export design only)"}
                >
                  {hideTitle ? "Show title" : "Hide title"}
                </button>
                {/* BB1: edit-mode toggle. Off → text reads as final
                    rendered output; on → click-to-edit affordance
                    on every text element. Visual cue: when active,
                    the button uses the brand-active styling so the
                    LD knows the renderer is in edit mode. */}
                <button
                  onClick={() => setEditMode((v) => !v)}
                  className={editMode ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
                  title={editMode ? "Exit edit mode" : "Edit text in place"}
                >
                  {editMode ? (
                    <>
                      <Check size={14} /> Done editing
                    </>
                  ) : (
                    <>
                      <Pencil size={14} /> Edit mode
                    </>
                  )}
                </button>
                <button
                  onClick={downloadPng}
                  disabled={downloading}
                  className="btn-secondary btn-sm"
                >
                  <Download size={14} /> {downloading ? "Rendering…" : "Download PNG"}
                </button>
                {/* Track-SS v3: STATIC HTML embed for NovoEd's Froala
                    editor. Static = no JS, no click handlers, just
                    layout HTML — that's what Froala accepts. Click-to-
                    flip / accordion / reveal interactivity is NOT here
                    (NovoEd's native HTML embed strips JS); for that,
                    use the SCORM export → "Interactive SCORM (.zip)". */}
                <button
                  onClick={copyHtmlEmbed}
                  disabled={!infographic.points.length}
                  className="btn-secondary btn-sm"
                  title="Copy NovoEd-paste-ready static HTML (Froala-embed compatible)"
                >
                  {htmlCopied ? (
                    <>
                      <Check size={14} /> Copied!
                    </>
                  ) : (
                    <>
                      <Code size={14} /> Static HTML
                    </>
                  )}
                </button>
                {/* Track-SS v3: INTERACTIVE SCORM .zip — packaged with
                    imsmanifest.xml so any LMS (NovoEd, Rise, Cornerstone,
                    Docebo) can upload + run it. The HTML inside has
                    click-to-flip / expand / reveal handlers — that's
                    the variant that needs SCORM packaging because
                    Froala embed strips JS. */}
                <button
                  onClick={downloadInteractiveScorm}
                  disabled={!infographic.points.length}
                  className="btn-cta-primary btn-sm"
                  title="Download an interactive SCORM .zip — upload to any LMS"
                >
                  <Sparkles size={14} /> Interactive SCORM
                </button>
              </div>
            </div>
            {editMode && (
              <div className="mb-4 text-xs text-brand-700 italic">
                Edit mode is on — click any text in the infographic to revise it. Click Done editing when finished.
              </div>
            )}
            {downloadError && (
              <div className="mb-4 text-xs text-red-600">
                Download failed: {downloadError}
              </div>
            )}
            <div
              ref={renderRef}
              className={`infographic-render-host${darkMode ? " ig-dark" : ""}${hideTitle ? " ig-hide-title" : ""}`}
            >
              <InfographicRenderer
                title={infographic.title}
                subtitle={infographic.subtitle}
                style={infographic.style}
                points={infographic.points}
                editable={editMode}
                onPointChange={updatePointField}
                onTitleChange={updateTitle}
                onSubtitleChange={updateSubtitle}
                styleOverrides={infographic.styleOverrides}
                onStyleOverride={updateStyleOverride}
                openPickerKey={openPickerKey}
                setOpenPickerKey={setOpenPickerKey}
                pointPhotoUrls={infographic.pointPhotoUrls}
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
