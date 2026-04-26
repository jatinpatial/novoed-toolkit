import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, FileArchive, X, Maximize2, Minimize2, RefreshCw, ExternalLink, AlertTriangle, CheckCircle2 } from "lucide-react";
import { AppShell } from "../shell/AppShell";
import { PageHeader } from "../ui/PageHeader";
import { ensureWorker, loadScorm, scormIframeSrc, unloadScorm, isScormPlayerSupported, type LoadedScorm } from "../scorm/player";

export default function ScormPlayer() {
  const [scorm, setScorm] = useState<LoadedScorm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [workerReady, setWorkerReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Warm up service worker
  useEffect(() => {
    if (!isScormPlayerSupported()) {
      setError("Your browser does not support the SCORM player (service workers unavailable).");
      return;
    }
    ensureWorker()
      .then(() => setWorkerReady(true))
      .catch((e) => setError(e?.message || "Could not start the SCORM player."));
  }, []);

  const loadFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      if (scorm) await unloadScorm(scorm.sessionId);
      const loaded = await loadScorm(file);
      setScorm(loaded);
      setIframeKey((k) => k + 1);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not read this file.";
      setError(msg);
      setScorm(null);
    } finally {
      setLoading(false);
    }
  }, [scorm]);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) loadFile(f);
  }

  async function clearPackage() {
    if (scorm) await unloadScorm(scorm.sessionId);
    setScorm(null);
    setError(null);
  }

  function reload() {
    setIframeKey((k) => k + 1);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && fullscreen) setFullscreen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (scorm) unloadScorm(scorm.sessionId); };
  }, [scorm]);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Preview"
        title="SCORM Player"
        subtitle="Drop any SCORM .zip — Articulate, Rise, Storyline, or one made here. Plays locally in your browser with full scripts and media, just like an LMS."
        actions={
          scorm && (
            <>
              <button onClick={reload} className="btn-secondary btn-sm" title="Reload"><RefreshCw size={14} /></button>
              <button onClick={() => setFullscreen((v) => !v)} className="btn-secondary btn-sm">
                {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                {fullscreen ? "Exit" : "Fullscreen"}
              </button>
              <button onClick={() => window.open(scormIframeSrc(scorm), "_blank")} className="btn-secondary btn-sm" title="Open in new tab">
                <ExternalLink size={14} />
              </button>
              <button onClick={clearPackage} className="btn-ghost btn-sm"><X size={14} /> Close</button>
            </>
          )
        }
      />

      {!scorm ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`rounded-2xl border-2 border-dashed ${dragOver ? "border-brand-500 bg-brand-50" : "border-ink-200 bg-white"} p-12 text-center transition`}
        >
          <div className="w-16 h-16 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-4">
            <Upload size={28} />
          </div>
          <h3 className="text-lg font-semibold text-ink-900 mb-1.5">Drop a SCORM .zip here</h3>
          <p className="text-sm text-ink-500 max-w-md mx-auto mb-5">
            Or click below to pick a file. Your package plays locally in your browser — nothing is uploaded anywhere.
          </p>
          <button onClick={() => fileInputRef.current?.click()} className="btn-primary btn-sm" disabled={loading || !workerReady}>
            {loading ? "Reading..." : workerReady ? "Choose file" : "Starting up..."}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }}
          />
          {error && (
            <div className="mt-6 inline-flex items-start gap-2 px-4 py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs max-w-md text-left">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <div className="mt-10 pt-6 border-t border-ink-100 text-left max-w-md mx-auto">
            <div className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">What works</div>
            <ul className="text-xs text-ink-500 space-y-1.5 leading-relaxed">
              <li className="flex gap-2"><CheckCircle2 size={13} className="flex-shrink-0 mt-0.5 text-brand-500" /> SCORM 1.2 and 2004 packages</li>
              <li className="flex gap-2"><CheckCircle2 size={13} className="flex-shrink-0 mt-0.5 text-brand-500" /> Articulate Rise, Storyline, iSpring, any vendor</li>
              <li className="flex gap-2"><CheckCircle2 size={13} className="flex-shrink-0 mt-0.5 text-brand-500" /> Nested HTML, scripts, videos, fonts, images</li>
              <li className="flex gap-2 text-ink-400"><AlertTriangle size={13} className="flex-shrink-0 mt-0.5" /> LMS tracking (completion, score) is simulated, not saved</li>
            </ul>
          </div>
        </div>
      ) : (
        <div>
          <div className="card p-4 mb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">
              <FileArchive size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold text-ink-900 truncate">{scorm.title || scorm.name}</div>
                {scorm.isStudioExport && <span className="chip chip-brand text-[10px]">Made in Studio</span>}
              </div>
              <div className="text-xs text-ink-400 flex items-center gap-3 flex-wrap mt-0.5">
                <span>{scorm.name}</span>
                <span>{(scorm.sizeBytes / 1024 / 1024).toFixed(1)} MB</span>
                <span>{scorm.fileCount} files</span>
                <span>launches: <code className="text-ink-600">{scorm.launchFile}</code></span>
              </div>
            </div>
          </div>

          <div className={fullscreen ? "fixed inset-0 z-50 bg-ink-950 p-6 flex flex-col" : ""}>
            {fullscreen && (
              <div className="flex items-center justify-between text-white mb-4">
                <span className="text-sm font-medium">{scorm.title || scorm.name}</span>
                <button onClick={() => setFullscreen(false)} className="text-ink-300 hover:text-white flex items-center gap-1.5 text-sm">
                  <Minimize2 size={14} /> Exit fullscreen (Esc)
                </button>
              </div>
            )}
            <iframe
              key={iframeKey}
              src={scormIframeSrc(scorm)}
              title="SCORM Preview"
              allow="autoplay; fullscreen; clipboard-read; clipboard-write"
              className={fullscreen ? "flex-1 w-full bg-white rounded-xl border-0" : "w-full h-[720px] bg-white rounded-xl border border-ink-200"}
            />
          </div>
        </div>
      )}
    </AppShell>
  );
}
