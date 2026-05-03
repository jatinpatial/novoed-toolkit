import { useRef, useState } from "react";
import { Download, FileText, Loader2, Upload, X } from "lucide-react";
import { useAgent } from "../agent/AgentContext";

const HTTP_URL = (import.meta.env.VITE_AGENT_HTTP_URL as string | undefined) ?? "http://127.0.0.1:8766";

/**
 * Track-B + KC Studio (Track-B-Quiz): shared source-material drop
 * zone for any brief-creation surface. Files POST to /parse → text
 * extracts → lands in AgentContext.pendingMaterials (a context
 * slice the read_materials tool falls back to when course.materials
 * is empty).
 *
 * Originally inline on CreateCoursePage; lifted to a shared
 * component when KC Studio (CreateKcPage) needed the same
 * affordance. Both pages mount this and rely on the same
 * AgentContext slice — pendingMaterials persists in localStorage
 * across nav, gets migrated onto the built artifact's materials
 * list at submission time.
 *
 * Imports `Download` so it's available in surfaces that want a
 * "download all materials" button later — not used in the body
 * here, just held for symmetry with the courses/scripts download
 * pattern.
 */
export function MaterialsDropZone({
  hint,
}: {
  /** Override the drop-zone subtitle copy. Default reads as a
      generic prompt; pages can tighten ("Drop the deck the KC
      should test understanding of"). */
  hint?: string;
}) {
  const { pendingMaterials, attachPendingMaterial, removePendingMaterial } = useAgent();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Held purely to keep the import non-dead; future iterations can
  // expose a download-all-materials affordance from this component.
  void Download;

  async function ingestFile(file: File) {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${HTTP_URL}/parse`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(detail || `server returned ${res.status}`);
      }
      const data = (await res.json()) as {
        filename: string;
        text: string;
        charCount: number;
      };
      attachPendingMaterial({
        id: crypto.randomUUID(),
        filename: data.filename,
        text: data.text,
        charCount: data.charCount,
        addedAt: Date.now(),
      });
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function onPickFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach(ingestFile);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    onPickFiles(e.dataTransfer.files);
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.pptx,.docx,.txt,.md"
        multiple
        hidden
        onChange={(e) => onPickFiles(e.target.files)}
      />
      <div
        className={`materials-dropzone${uploading ? " materials-dropzone-active" : ""}`}
        onClick={() => fileInputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
      >
        {uploading ? (
          <Loader2 size={20} className="text-brand-500 mb-2 animate-spin" aria-hidden="true" />
        ) : (
          <Upload size={20} className="text-ink-400 mb-2" aria-hidden="true" />
        )}
        <div className="text-sm font-semibold text-ink-700 mb-1">
          {uploading ? "Reading…" : hint ?? "Drop files here or click to choose"}
        </div>
        <div className="text-xs text-ink-500">PPTX · PDF · DOCX · TXT · MD</div>
      </div>
      {uploadError && (
        <div className="mt-2 text-xs text-red-600">
          Upload failed: {uploadError}
        </div>
      )}
      {pendingMaterials.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {pendingMaterials.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-2 px-3 py-2 rounded-md bg-brand-50 border border-brand-200 text-xs"
            >
              <FileText size={14} className="text-brand-700 flex-shrink-0" />
              <span className="flex-1 truncate font-medium text-ink-800">
                {m.filename}
              </span>
              <span className="text-ink-500 flex-shrink-0">
                {Math.round(m.charCount / 1000)}K chars
              </span>
              <button
                type="button"
                onClick={() => removePendingMaterial(m.id)}
                className="text-ink-400 hover:text-red-500 transition-colors flex-shrink-0"
                title={`Remove ${m.filename}`}
                aria-label={`Remove ${m.filename}`}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
