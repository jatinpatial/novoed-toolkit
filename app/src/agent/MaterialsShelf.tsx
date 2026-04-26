import { AlertTriangle, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import type { Material } from "../course/types";

const HTTP_URL =
  (import.meta.env.VITE_AGENT_HTTP_URL as string | undefined) ?? "http://127.0.0.1:8766";
const WARN_THRESHOLD = 50_000;
const ACCEPT = ".pdf,.pptx,.docx,.txt,.md,.markdown";

interface Props {
  materials: Material[];
  onAdd: (material: Material) => void;
  onRemove: (id: string) => void;
}

export function MaterialsShelf({ materials, onAdd, onRemove }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const totalChars = materials.reduce((s, m) => s + m.charCount, 0);
  const overThreshold = totalChars > WARN_THRESHOLD;

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          const form = new FormData();
          form.append("file", file);
          const res = await fetch(`${HTTP_URL}/parse`, { method: "POST", body: form });
          if (!res.ok) {
            const detail = await res.text().catch(() => res.statusText);
            throw new Error(`${file.name}: ${detail || res.statusText}`);
          }
          const json = (await res.json()) as { filename: string; text: string; charCount: number };
          onAdd({
            id: crypto.randomUUID(),
            filename: json.filename,
            text: json.text,
            charCount: json.charCount,
            addedAt: Date.now(),
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setUploading(false);
      }
    },
    [onAdd],
  );

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-4 py-3 border-b border-ink-100">
        <div className="text-xs font-bold text-ink-700 uppercase tracking-wider">Source materials</div>
        <div className="text-[11px] text-ink-500 mt-0.5">
          The Copilot will pull from these when writing lessons.
        </div>
      </div>

      <div className="px-3 py-3">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`rounded-lg border-2 border-dashed transition cursor-pointer p-4 text-center ${
            dragOver
              ? "border-brand-500 bg-brand-50"
              : "border-ink-200 hover:border-brand-400 hover:bg-brand-50/40"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-1.5 py-1 text-ink-500 text-xs">
              <Loader2 size={18} className="animate-spin" />
              Reading file…
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 py-1">
              <Upload size={18} className="text-ink-400" />
              <div className="text-xs font-semibold text-ink-700">
                Drop files or click to upload
              </div>
              <div className="text-[10px] text-ink-500">PDF, PPTX, DOCX, TXT, MD</div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-[11px] text-red-700">
            {error}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 space-y-1.5">
        {materials.length === 0 ? (
          <div className="text-[11px] text-ink-400 italic px-1 py-2">
            No materials yet. Drop a deck or PDF to get started.
          </div>
        ) : (
          materials.map((m) => (
            <div
              key={m.id}
              className="group flex items-center gap-2 px-2.5 py-2 rounded-md border border-ink-100 hover:border-ink-200 bg-white"
            >
              <FileText size={14} className="text-ink-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-ink-800 truncate">{m.filename}</div>
                <div className="text-[10px] text-ink-500">
                  {m.charCount.toLocaleString()} chars
                </div>
              </div>
              <button
                onClick={() => onRemove(m.id)}
                title="Remove"
                className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-red-600 p-1 -mr-1 rounded transition"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </div>

      {materials.length > 0 && (
        <div className="border-t border-ink-100 px-3 py-2 bg-ink-50/50">
          <div className="flex items-center justify-between text-[11px] text-ink-600">
            <span className="font-semibold">Total</span>
            <span>{totalChars.toLocaleString()} chars</span>
          </div>
          {overThreshold && (
            <div className="mt-1.5 flex items-start gap-1.5 text-[10px] text-amber-700 leading-snug">
              <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
              <span>
                This is a lot of text — the Copilot may not use it all in a single pass. Consider
                trimming to the most relevant decks.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
