import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Copy, Download, Save, Check, Search, Shapes, Sparkles, Plus, Trash2,
} from "lucide-react";
import { AppShell } from "../shell/AppShell";
import { PageHeader } from "../ui/PageHeader";
import { EmptyState } from "../ui/EmptyState";
import { useActiveBrand } from "../shell/TopBar";
import { HTML_COMPS, SCORM_COMPS } from "../generators/registry";
import { DEFAULTS } from "../generators/defaults";
import { genHTML } from "../generators/html/genHTML";
import { genSCORMhtml } from "../generators/scorm/genSCORM";
import { downloadSCORM } from "../scorm/zipBuilder";
import type { ComponentData, ComponentRegistryEntry } from "../types";
import { getProject, saveProject, uid, type Project } from "../store/projects";

type Mode = "html" | "scorm";

export default function InfographicStudio() {
  const [brand] = useActiveBrand();
  const [params, setParams] = useSearchParams();

  const [mode, setMode] = useState<Mode>(() => (params.get("mode") === "scorm" ? "scorm" : "html"));
  const [sel, setSel] = useState<string | null>(null);
  const [data, setData] = useState<ComponentData | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>("Untitled");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load project from URL if provided
  useEffect(() => {
    const pid = params.get("project");
    if (pid) {
      const p = getProject(pid);
      if (p && (p.data.kind === "component" || p.data.kind === "scorm")) {
        setProjectId(p.id);
        setProjectName(p.name);
        setMode(p.data.kind === "component" ? "html" : "scorm");
        setSel(p.data.compId);
        setData(JSON.parse(JSON.stringify(p.data.data)));
      }
    }
  }, [params]);

  const registry: ComponentRegistryEntry[] = mode === "html" ? HTML_COMPS : SCORM_COMPS;
  const isScorm = mode === "scorm";

  const output = useMemo(() => {
    if (!sel || !data) return "";
    return isScorm ? genSCORMhtml(sel, data, brand) : genHTML(sel, brand, data);
  }, [sel, data, brand, isScorm]);

  function pick(compId: string) {
    setSel(compId);
    setData(JSON.parse(JSON.stringify(DEFAULTS[compId] || {})));
    if (!projectId) setProjectName(registry.find((c) => c.id === compId)?.n || "Untitled");
  }

  function back() {
    setSel(null);
    setData(null);
    setProjectId(null);
    setCopied(false);
    setSaved(false);
    setParams((prev) => { const n = new URLSearchParams(prev); n.delete("project"); return n; }, { replace: true });
  }

  function handleCopy() {
    if (!output) return;
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  function handleSave() {
    if (!sel || !data) return;
    const id = projectId || uid();
    const project: Omit<Project, "createdAt" | "updatedAt"> = {
      id,
      name: projectName || "Untitled",
      kind: isScorm ? "scorm" : "component",
      brand,
      data: { kind: isScorm ? "scorm" : "component", compId: sel, data },
    };
    saveProject(project);
    setProjectId(id);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  function handleDownload() {
    if (!sel || !data) return;
    downloadSCORM(sel, data, brand);
  }

  // ── LIBRARY VIEW ──
  if (!sel || !data) {
    const q = query.toLowerCase();
    const filtered = registry.filter((c) => !q || c.n.toLowerCase().includes(q) || c.d.toLowerCase().includes(q));

    return (
      <AppShell>
        <PageHeader
          eyebrow="Infographic Studio"
          title="Pick something to design."
          subtitle="Static HTML components paste directly into NovoEd. Interactive SCORM activities download as a .zip."
        />

        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-ink-100">
            <button onClick={() => setMode("html")} className={`px-3.5 h-8 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${mode === "html" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"}`}>
              <Shapes size={13} /> HTML ({HTML_COMPS.length})
            </button>
            <button onClick={() => setMode("scorm")} className={`px-3.5 h-8 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${mode === "scorm" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"}`}>
              <Sparkles size={13} /> Interactive ({SCORM_COMPS.length})
            </button>
          </div>
          <div className="flex-1 max-w-sm relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${mode === "html" ? "components" : "interactives"}...`}
              className="input pl-9"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={<Search size={24} />} title="No matches" description={`Nothing matches "${query}".`} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => pick(c.id)}
                className="card card-hover p-4 text-left"
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center text-sm font-bold ${mode === "html" ? "bg-brand-50 text-brand-600" : "bg-amber-50 text-amber-600"}`}>
                    {c.ic}
                  </div>
                  <span className="text-sm font-semibold text-ink-900">{c.n}</span>
                </div>
                <p className="text-xs text-ink-500 leading-relaxed">{c.d}</p>
              </button>
            ))}
          </div>
        )}
      </AppShell>
    );
  }

  // ── EDITOR VIEW ──
  const comp = registry.find((c) => c.id === sel);

  return (
    <AppShell>
      <div className="flex items-center justify-between gap-3 pb-4 mb-4 border-b border-ink-200">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={back} className="btn-ghost btn-sm"><ArrowLeft size={14} /> Back</button>
          <div className="h-6 w-px bg-ink-200" />
          <div className="min-w-0">
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="text-lg font-bold text-ink-900 bg-transparent border-none outline-none w-64 -ml-1 px-1 rounded hover:bg-ink-50 focus:bg-white focus:shadow-focus"
            />
            <div className="text-xs text-ink-400 flex items-center gap-2">
              <span className={`chip ${isScorm ? "chip-amber" : "chip-brand"} text-[10px]`}>{isScorm ? "Interactive" : "HTML"}</span>
              <span>{comp?.n}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} className="btn-secondary btn-sm">
            {saved ? <><Check size={14} /> Saved</> : <><Save size={14} /> Save</>}
          </button>
          {!isScorm && (
            <button onClick={handleCopy} className="btn-primary btn-sm">
              {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy HTML</>}
            </button>
          )}
          {isScorm && (
            <button onClick={handleDownload} className="btn-primary btn-sm"><Download size={14} /> Download .zip</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor */}
        <div>
          <div className="label mb-3">Edit</div>
          <Editor data={data} setData={setData} isScorm={isScorm} />
        </div>

        {/* Preview */}
        <div>
          <div className="label mb-3">Preview</div>
          {!isScorm ? (
            <div className="card p-5 overflow-auto" dangerouslySetInnerHTML={{ __html: output }} />
          ) : (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between h-8 px-3 bg-ink-50 border-b border-ink-100">
                <span className="text-[10px] font-semibold text-ink-500 uppercase tracking-wide">Live preview</span>
                <span className="text-[10px] text-ink-400">Click, interact — it's live</span>
              </div>
              <iframe srcDoc={output} sandbox="allow-scripts allow-same-origin" className="w-full h-[560px] border-0 block" title="Preview" />
            </div>
          )}

          {!isScorm && (
            <div className="card mt-4 p-3 bg-ink-50 border-dashed">
              <div className="text-[10px] font-semibold text-ink-500 uppercase tracking-wide mb-1.5">Raw HTML</div>
              <textarea readOnly value={output} className="w-full h-28 bg-transparent text-[10px] font-mono text-ink-600 resize-none outline-none" onClick={(e) => (e.target as HTMLTextAreaElement).select()} />
            </div>
          )}

          <div className="mt-4 p-3 rounded-lg bg-brand-50 border border-brand-100 text-xs text-brand-800 leading-relaxed">
            <strong>{isScorm ? "Upload:" : "NovoEd:"}</strong>{" "}
            {isScorm ? "Download .zip → NovoEd → Add SCORM/AICC → Upload" : "Copy HTML → NovoEd → Contents → HTML. Works in Quiz & Survey too."}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ─────────────────────────────────────────────────
function Editor({ data, setData, isScorm }: { data: ComponentData; setData: (d: ComponentData) => void; isScorm: boolean }) {
  return (
    <div className="card p-4 space-y-3">
      {data.col1 !== undefined && (
        <div className="grid grid-cols-2 gap-2">
          <FieldInput label="Column 1" value={data.col1} onChange={(v) => setData({ ...data, col1: v })} />
          <FieldInput label="Column 2" value={data.col2 || ""} onChange={(v) => setData({ ...data, col2: v })} />
        </div>
      )}
      {data.title !== undefined && (
        <FieldInput label="Title / Heading" value={data.title} onChange={(v) => setData({ ...data, title: v })} />
      )}
      {data.body !== undefined && (
        <FieldTextarea label="Subtitle / Description" value={data.body} onChange={(v) => setData({ ...data, body: v })} rows={2} />
      )}
      {isScorm && (
        <FieldPills
          label="Background"
          value={data.bg || "gradient"}
          options={[{ v: "gradient", l: "Gradient" }, { v: "none", l: "Plain white" }]}
          onChange={(v) => setData({ ...data, bg: v })}
        />
      )}
      {data.author !== undefined && (
        <FieldInput label="Author" value={data.author} onChange={(v) => setData({ ...data, author: v })} />
      )}
      {data.type !== undefined && (
        <FieldPills
          label="Type"
          value={data.type}
          options={[{ v: "info", l: "Info" }, { v: "tip", l: "Tip" }, { v: "warning", l: "Warning" }, { v: "success", l: "Success" }]}
          onChange={(v) => setData({ ...data, type: v })}
        />
      )}
      {data.stat !== undefined && (
        <div className="grid grid-cols-2 gap-2">
          <FieldInput label="Stat" value={data.stat} onChange={(v) => setData({ ...data, stat: v })} />
          <FieldInput label="Label" value={data.label || ""} onChange={(v) => setData({ ...data, label: v })} />
        </div>
      )}
      {data.active !== undefined && (
        <div>
          <div className="label mb-1.5">Active step: {data.active}</div>
          <input type="range" min={0} max={(data.items?.length || 1) - 1} value={data.active} onChange={(e) => setData({ ...data, active: parseInt(e.target.value) })} className="w-full accent-brand-500" />
        </div>
      )}
      {data.items && (
        <div>
          <div className="label mb-2">Items ({data.items.length})</div>
          <div className="space-y-2">
            {data.items.map((it, i) => (
              <div key={i} className="rounded-lg bg-ink-50 border border-ink-100 p-2.5 relative">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-bold text-brand-600 flex-shrink-0">#{i + 1}</span>
                  {it.icon !== undefined && (
                    <input
                      value={it.icon}
                      onChange={(e) => { const n = [...data.items!]; n[i] = { ...n[i], icon: e.target.value }; setData({ ...data, items: n }); }}
                      className="w-9 h-7 rounded border border-ink-200 bg-white px-1 text-center text-sm"
                    />
                  )}
                  <input
                    value={it.title}
                    onChange={(e) => { const n = [...data.items!]; n[i] = { ...n[i], title: e.target.value }; setData({ ...data, items: n }); }}
                    placeholder="Title"
                    className="flex-1 h-7 px-2 rounded border border-ink-200 bg-white text-xs font-semibold outline-none focus:border-brand-500"
                  />
                  {data.items!.length > 1 && (
                    <button
                      onClick={() => setData({ ...data, items: data.items!.filter((_, j) => j !== i) })}
                      className="w-7 h-7 rounded hover:bg-red-50 text-ink-300 hover:text-red-500 flex items-center justify-center"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                {it.img !== undefined && (
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] text-ink-400">IMG</span>
                    <input
                      value={it.img}
                      onChange={(e) => { const n = [...data.items!]; n[i] = { ...n[i], img: e.target.value }; setData({ ...data, items: n }); }}
                      placeholder="Image URL"
                      className="flex-1 h-7 px-2 rounded border border-ink-200 bg-white text-xs outline-none focus:border-brand-500"
                    />
                    {it.img && <img src={it.img} className="w-6 h-6 object-cover rounded border border-ink-200" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />}
                  </div>
                )}
                {it.desc !== undefined && (
                  <textarea
                    value={it.desc}
                    onChange={(e) => { const n = [...data.items!]; n[i] = { ...n[i], desc: e.target.value }; setData({ ...data, items: n }); }}
                    placeholder="Description"
                    rows={2}
                    className="w-full px-2 py-1.5 rounded border border-ink-200 bg-white text-xs outline-none focus:border-brand-500 resize-none"
                  />
                )}
                {it.desc2 !== undefined && (
                  <textarea
                    value={it.desc2}
                    onChange={(e) => { const n = [...data.items!]; n[i] = { ...n[i], desc2: e.target.value }; setData({ ...data, items: n }); }}
                    placeholder="Column 2 content"
                    rows={2}
                    className="w-full px-2 py-1.5 rounded border border-ink-200 bg-white text-xs outline-none focus:border-brand-500 resize-none mt-1.5"
                  />
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              const tpl = data.items![0] || { title: "" };
              const nw: typeof tpl = { title: "New item" };
              if (tpl.desc !== undefined) nw.desc = "";
              if (tpl.desc2 !== undefined) nw.desc2 = "";
              if (tpl.icon !== undefined) nw.icon = "●";
              if (tpl.img !== undefined) nw.img = "";
              setData({ ...data, items: [...data.items!, nw] });
            }}
            className="w-full mt-2 h-8 rounded-lg border-2 border-dashed border-ink-200 text-xs font-semibold text-ink-500 hover:border-brand-500 hover:text-brand-600 hover:bg-brand-50 transition flex items-center justify-center gap-1.5"
          >
            <Plus size={12} /> Add item
          </button>
        </div>
      )}
    </div>
  );
}

function FieldInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="label mb-1 block">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="input" />
    </label>
  );
}

function FieldTextarea({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="block">
      <span className="label mb-1 block">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className="textarea" />
    </label>
  );
}

function FieldPills({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <div>
      <div className="label mb-1.5">{label}</div>
      <div className="flex gap-1 flex-wrap">
        {options.map((o) => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className={`px-3 h-7 rounded-md text-xs font-semibold transition border ${value === o.v ? "bg-brand-500 border-brand-500 text-white" : "bg-white border-ink-200 text-ink-500 hover:border-ink-300"}`}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}
