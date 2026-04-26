import { useState } from "react";
import { Link } from "react-router-dom";
import { B, type BrandKey } from "../brand/tokens";
import type { ComponentData } from "../types";
import { HTML_COMPS, SCORM_COMPS } from "../generators/registry";
import { DEFAULTS } from "../generators/defaults";
import { genHTML } from "../generators/html/genHTML";
import { genSCORMhtml } from "../generators/scorm/genSCORM";
import { downloadSCORM } from "../scorm/zipBuilder";
import { BrandSwitch } from "../components/BrandSwitch";

type Mode = "html" | "scorm" | null;

interface AiSuggestion {
  component_id: string;
  component_type: "html" | "scorm";
  component_name: string;
  why: string;
  data: ComponentData;
}

export default function ComponentLibrary() {
  const [brand, setBrand] = useState<BrandKey>("bcg");
  const [mode, setMode] = useState<Mode>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [data, setData] = useState<ComponentData | null>(null);
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);
  const [scormPreview, setScormPreview] = useState("");
  const [search, setSearch] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResults, setAiResults] = useState<AiSuggestion[] | null>(null);
  const b = B[brand];

  async function aiGenerate() {
    if (!aiPrompt.trim() || aiLoading) return;
    setAiLoading(true);
    setAiResults(null);
    try {
      const allComps = [
        ...HTML_COMPS.map((c) => ({ ...c, t: "html" as const })),
        ...SCORM_COMPS.map((c) => ({ ...c, t: "scorm" as const })),
      ];
      const compList = allComps.map((c) => c.id + ": " + c.n + " (" + c.d + ") [" + c.t.toUpperCase() + "]").join("\n");

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `You are a NovoEd course content generator. Given a user request, generate content for the BEST matching component(s).\n\nAvailable components:\n${compList}\n\nUser request: "${aiPrompt}"\n\nRespond ONLY with a JSON object (no markdown, no backticks, no preamble):\n{\n  "suggestions": [\n    {\n      "component_id": "the component id",\n      "component_type": "html or scorm",\n      "component_name": "name",\n      "why": "one line why this fits",\n      "data": { the component data matching its DEFAULTS structure exactly }\n    }\n  ]\n}\n\nGenerate 2-3 suggestions with the best matching components. For items arrays, generate 3-5 items with realistic, professional content based on the user's request. Include title and body fields for SCORM components. Keep content concise and BCG-professional in tone.`,
          }],
        }),
      });
      const result = await response.json();
      const text = result.content?.[0]?.text || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setAiResults(parsed.suggestions || []);
    } catch (err) {
      console.error("AI generation error:", err);
      setAiResults([]);
    }
    setAiLoading(false);
  }

  function applyAiSuggestion(suggestion: AiSuggestion) {
    const compType = suggestion.component_type;
    const compId = suggestion.component_id;
    setMode(compType);
    setSel(compId);
    const d = JSON.parse(JSON.stringify(suggestion.data)) as ComponentData;
    setData(d);
    if (compType === "html") {
      setOutput(genHTML(compId, brand, d));
      setScormPreview("");
    } else {
      setOutput("");
      setScormPreview(genSCORMhtml(compId, d, brand));
    }
    setAiResults(null);
    setAiPrompt("");
  }

  function doSelect(id: string) {
    setSel(id);
    const d = JSON.parse(JSON.stringify(DEFAULTS[id] || {})) as ComponentData;
    setData(d);
    if (!id.startsWith("s_")) {
      setOutput(genHTML(id, brand, d));
      setScormPreview("");
    } else {
      setOutput("");
      setScormPreview(genSCORMhtml(id, d, brand));
    }
  }

  function doRegen() {
    if (sel && data && !sel.startsWith("s_")) setOutput(genHTML(sel, brand, data));
    if (sel && data && sel.startsWith("s_")) setScormPreview(genSCORMhtml(sel, data, brand));
  }

  function handleCopy() {
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  /* ── HOME SCREEN ── */
  if (!mode) {
    return (
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "0 16px 20px", fontFamily: "'Trebuchet MS', system-ui, sans-serif", color: b.tx }}>
        <div style={{ background: b.grad, padding: "36px 40px", marginBottom: 24, position: "relative", overflow: "hidden" }}>
          <svg style={{ position: "absolute", top: 0, right: 0, width: 320, height: "100%", opacity: 0.12 }} viewBox="0 0 320 200" fill="none">
            <circle cx="280" cy="40" r="80" fill="#fff" />
            <circle cx="220" cy="160" r="50" fill="#fff" />
            <circle cx="320" cy="140" r="60" fill="#fff" />
            <rect x="160" y="20" width="40" height="40" rx="10" fill="#fff" transform="rotate(20 180 40)" />
            <rect x="240" y="100" width="30" height="30" rx="8" fill="#fff" transform="rotate(-15 255 115)" />
            <polygon points="180,80 200,60 220,80" fill="#fff" opacity="0.6" />
            <polygon points="260,50 280,30 300,50 290,70 270,70" fill="#fff" opacity="0.4" />
          </svg>
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2.5, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>BCG U × NovoEd</div>
            <div style={{ fontSize: 28, fontWeight: 200, color: "#fff", lineHeight: 1.3, marginBottom: 6 }}>Component Toolkit</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.6, maxWidth: 500 }}>Design and generate professional HTML components and interactive SCORM activities for NovoEd courses — no coding required.</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search components..."
              style={{ width: "100%", padding: "9px 14px 9px 32px", border: "1.5px solid " + b.n2, borderRadius: 8, fontSize: 12, outline: "none", background: "#fff" }}
              onFocus={(e) => (e.target.style.borderColor = b.pri)}
              onBlur={(e) => {
                setTimeout(() => {
                  if (!document.activeElement?.closest(".sr")) setSearch("");
                }, 200);
                e.target.style.borderColor = b.n2;
              }}
            />
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#bbb" }}>⌕</span>
            {search && (() => {
              const sq = search.toLowerCase();
              const all = [
                ...HTML_COMPS.map((c) => ({ ...c, t: "HTML" as const })),
                ...SCORM_COMPS.map((c) => ({ ...c, t: "SCORM" as const })),
              ];
              const hits = all.filter((c) => c.n.toLowerCase().includes(sq) || c.d.toLowerCase().includes(sq));
              return hits.length > 0 ? (
                <div className="sr" style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#fff", border: "1.5px solid " + b.n2, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", zIndex: 50, maxHeight: 240, overflow: "auto" }}>
                  {hits.slice(0, 8).map((c) => (
                    <div
                      key={c.id}
                      style={{ padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid " + b.n1 }}
                      onClick={() => {
                        setMode(c.t === "HTML" ? "html" : "scorm");
                        doSelect(c.id);
                        setSearch("");
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = b.n1)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span style={{ fontSize: 14, color: b.pri }}>{c.ic}</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: b.tx }}>{c.n}</div>
                        <div style={{ fontSize: 10, color: "#999" }}>{c.d}</div>
                      </div>
                      <span style={{ marginLeft: "auto", fontSize: 9, padding: "2px 6px", background: c.t === "HTML" ? b.priLt : "#FFF8E6", color: c.t === "HTML" ? b.pri : "#856404", borderRadius: 4, fontWeight: 600 }}>{c.t}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="sr" style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#fff", border: "1.5px solid " + b.n2, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", zIndex: 50, padding: "16px", textAlign: "center", fontSize: 11, color: "#999" }}>
                  No components match "{search}"
                </div>
              );
            })()}
          </div>
          <BrandSwitch brand={brand} setBrand={setBrand} />
        </div>

        <div style={{ marginBottom: 24, padding: "20px 22px", background: "#fff", borderRadius: 14, border: "1.5px solid " + b.n2, boxShadow: "0 2px 12px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, background: b.grad, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, color: "#fff" }}>⚡</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: b.tx }}>AI Content Generator</div>
              <div style={{ fontSize: 10, color: "#999" }}>Describe what you need — AI will create the component for you</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") aiGenerate(); }}
              placeholder='e.g. "Create a 4-step process for AI adoption" or "Flip cards explaining RAG, LLM, and Fine-tuning"'
              style={{ flex: 1, padding: "10px 14px", border: "1.5px solid " + b.n2, borderRadius: 8, fontSize: 12, outline: "none" }}
              onFocus={(e) => (e.target.style.borderColor = b.pri)}
              onBlur={(e) => (e.target.style.borderColor = b.n2)}
            />
            <button onClick={aiGenerate} disabled={aiLoading} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: aiLoading ? "#ccc" : b.grad, color: "#fff", fontSize: 12, fontWeight: 600, cursor: aiLoading ? "wait" : "pointer", whiteSpace: "nowrap", transition: "all 0.2s" }}>
              {aiLoading ? "Generating..." : "Generate ⚡"}
            </button>
          </div>
          {aiLoading && (
            <div style={{ marginTop: 16, textAlign: "center", padding: 20 }}>
              <div style={{ fontSize: 12, color: b.pri, fontWeight: 600 }}>Creating your components...</div>
              <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>AI is analyzing your request and generating content</div>
            </div>
          )}
          {aiResults && aiResults.length === 0 && (
            <div style={{ marginTop: 12, padding: 12, background: b.n1, borderRadius: 8, fontSize: 11, color: "#999", textAlign: "center" }}>
              Couldn't generate results. Try rephrasing your request.
            </div>
          )}
          {aiResults && aiResults.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>AI Suggestions — click to use</div>
              {aiResults.map((s, i) => (
                <div
                  key={i}
                  onClick={() => applyAiSuggestion(s)}
                  style={{ padding: "14px 16px", background: b.n1, borderRadius: 10, marginBottom: 8, cursor: "pointer", border: "1.5px solid transparent", transition: "all 0.2s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = b.pri; e.currentTarget.style.background = b.priLt; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.background = b.n1; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 9, padding: "2px 6px", background: s.component_type === "html" ? b.priLt : "#FFF8E6", color: s.component_type === "html" ? b.pri : "#856404", borderRadius: 4, fontWeight: 700 }}>{s.component_type.toUpperCase()}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: b.tx }}>{s.component_name}</span>
                  </div>
                  <div style={{ fontSize: 11, color: b.txL, lineHeight: 1.5 }}>{s.why}</div>
                  {s.data?.items && <div style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>{s.data.items.length} items: {s.data.items.map((it) => it.title).join(", ")}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 28 }}>
          <div onClick={() => setMode("html")} style={{ padding: "24px 22px", border: "2px solid " + b.pri, cursor: "pointer", background: b.priLt, borderRadius: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 38, height: 38, background: b.pri, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#fff" }}>📋</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>HTML Components</div>
            </div>
            <div style={{ fontSize: 11, color: b.txL, lineHeight: 1.7, marginBottom: 10 }}>Static visual components — tables, banners, cards, timelines, stats, and more. Copy and paste directly into NovoEd.</div>
            <div style={{ fontSize: 11, color: b.pri, marginTop: 10, fontWeight: 700 }}>{HTML_COMPS.length} components →</div>
          </div>
          <div onClick={() => setMode("scorm")} style={{ padding: "24px 22px", border: "2px solid " + b.n2, cursor: "pointer", background: b.wh, borderRadius: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 38, height: 38, background: b.n2, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✨</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>SCORM Interactives</div>
            </div>
            <div style={{ fontSize: 11, color: b.txL, lineHeight: 1.7, marginBottom: 10 }}>Fully interactive activities with animations — flip cards, accordions, stacked cards, cycle diagrams, and more.</div>
            <div style={{ fontSize: 11, color: b.pri, marginTop: 10, fontWeight: 700 }}>{SCORM_COMPS.length} activities →</div>
          </div>
        </div>

        <Link to="/course-builder" style={{ display: "block", padding: "16px 20px", background: b.n1, borderRadius: 10, border: "1px solid " + b.n2, textDecoration: "none", marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: b.pri, marginBottom: 6 }}>New</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: b.tx, marginBottom: 4 }}>Course Builder →</div>
          <div style={{ fontSize: 12, color: b.txL, lineHeight: 1.6 }}>Build a full course outline: modules, lessons, and component blocks.</div>
        </Link>

        <div style={{ padding: "14px 20px", background: b.priLt, borderRadius: 10, border: "1px solid " + b.pri + "22", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 32, height: 32, background: b.pri, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff", flexShrink: 0 }}>✉</div>
          <div style={{ fontSize: 12, color: b.tx, lineHeight: 1.6 }}>
            <span style={{ fontWeight: 600 }}>Feedback or suggestions?</span>{" "}
            <span style={{ color: b.pri, fontWeight: 700, textDecoration: "underline", cursor: "pointer" }} onClick={() => window.open("mailto:jatin.patial@bcg.com")}>jatin.patial@bcg.com</span>
          </div>
        </div>
      </div>
    );
  }

  /* ── LIST SCREEN ── */
  if (!sel) {
    const allComps = mode === "html" ? HTML_COMPS : SCORM_COMPS;
    const comps = search ? allComps.filter((c) => c.n.toLowerCase().includes(search.toLowerCase()) || c.d.toLowerCase().includes(search.toLowerCase())) : allComps;
    return (
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "20px 16px", fontFamily: "'Trebuchet MS', system-ui, sans-serif", color: b.tx }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <button onClick={() => { setMode(null); setSearch(""); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#999" }}>← Back</button>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: b.pri }}>{mode === "html" ? "HTML Components" : "SCORM Interactives"}</span>
            <BrandSwitch brand={brand} setBrand={setBrand} size="sm" />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={"Search " + (mode === "html" ? "HTML components" : "SCORM interactives") + "..."}
            style={{ width: "100%", padding: "10px 14px", border: "1.5px solid " + b.n2, borderRadius: 10, fontSize: 12, outline: "none", background: "#fff" }}
          />
        </div>
        <div style={{ padding: "10px 14px", background: mode === "html" ? b.priLt : "#FFF8E6", marginBottom: 16, fontSize: 11, color: mode === "html" ? b.pri : "#856404", fontWeight: 500, borderRadius: 8 }}>
          {mode === "html" ? "Copy code → NovoEd → Contents → HTML. Also works in Quiz & Survey edit view." : "Download as SCORM .zip → Upload to NovoEd's SCORM/AICC block."}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {comps.length === 0 && <div style={{ gridColumn: "1/-1", padding: 24, textAlign: "center", color: "#999", fontSize: 12 }}>No components match "{search}"</div>}
          {comps.map((c) => (
            <button key={c.id} onClick={() => doSelect(c.id)} style={{ padding: "14px 16px", borderRadius: 12, border: "1.5px solid #e8e8e8", background: "#fff", cursor: "pointer", textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 16, color: b.pri }}>{c.ic}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: b.tx }}>{c.n}</span>
              </div>
              <div style={{ fontSize: 11, color: "#999" }}>{c.d}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ── EDITOR SCREEN ── */
  const isScorm = sel.startsWith("s_");
  const compName = (isScorm ? SCORM_COMPS : HTML_COMPS).find((c) => c.id === sel)?.n;

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "20px 16px", fontFamily: "'Trebuchet MS', system-ui, sans-serif", color: b.tx }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <button onClick={() => { setSel(null); setOutput(""); setCopied(false); setScormPreview(""); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#999" }}>← Back</button>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: b.pri }}>{compName}</span>
          <span style={{ fontSize: 10, padding: "2px 8px", background: isScorm ? "#FFF8E6" : b.priLt, color: isScorm ? "#856404" : b.pri, fontWeight: 600, borderRadius: 4 }}>{isScorm ? "SCORM" : "HTML"}</span>
          <BrandSwitch
            brand={brand}
            setBrand={(k) => {
              setBrand(k);
              if (!data) return;
              if (!isScorm) setOutput(genHTML(sel, k, data));
              else setScormPreview(genSCORMhtml(sel, data, k));
            }}
            size="sm"
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Edit</div>

          {data?.col1 !== undefined && (
            <div style={{ marginBottom: 8 }}>
              <input value={data.col1} onChange={(e) => setData({ ...data, col1: e.target.value })} placeholder="Col 1" style={{ width: "100%", padding: "6px 8px", border: "1px solid #e5e5e5", borderRadius: 4, fontSize: 11, fontWeight: 600, marginBottom: 4, outline: "none" }} />
              <input value={data.col2} onChange={(e) => setData({ ...data, col2: e.target.value })} placeholder="Col 2" style={{ width: "100%", padding: "6px 8px", border: "1px solid #e5e5e5", borderRadius: 4, fontSize: 11, fontWeight: 600, outline: "none" }} />
            </div>
          )}

          {data?.title !== undefined && (
            <input value={data.title} onChange={(e) => setData({ ...data, title: e.target.value })} placeholder="Title / Heading" style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e5e5", borderRadius: 6, fontSize: 12, fontWeight: 600, marginBottom: 6, outline: "none" }} />
          )}

          {data?.body !== undefined && (
            <textarea value={data.body} onChange={(e) => setData({ ...data, body: e.target.value })} rows={2} placeholder="Subtitle / Description" style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e5e5", borderRadius: 6, fontSize: 12, resize: "vertical", outline: "none", marginBottom: 6 }} />
          )}

          {isScorm && (
            <div style={{ display: "flex", gap: 4, marginBottom: 8, alignItems: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#888", marginRight: 4 }}>Background:</span>
              {[{ v: "gradient", l: "Gradient" }, { v: "none", l: "Plain white" }].map((o) => (
                <button key={o.v} onClick={() => setData({ ...data, bg: o.v })} style={{ padding: "4px 10px", border: "1px solid " + ((data?.bg || "gradient") === o.v ? b.pri : "#ddd"), background: (data?.bg || "gradient") === o.v ? b.priLt : "#fff", color: (data?.bg || "gradient") === o.v ? b.pri : b.txL, fontSize: 10, fontWeight: 600, cursor: "pointer", borderRadius: 4 }}>
                  {o.l}
                </button>
              ))}
            </div>
          )}

          {data?.author !== undefined && (
            <input value={data.author} onChange={(e) => setData({ ...data, author: e.target.value })} placeholder="Author" style={{ width: "100%", padding: "6px 10px", border: "1px solid #e5e5e5", borderRadius: 6, fontSize: 11, marginBottom: 6, outline: "none" }} />
          )}

          {data?.type !== undefined && (
            <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
              {["info", "tip", "warning", "success"].map((t) => (
                <button key={t} onClick={() => setData({ ...data, type: t })} style={{ padding: "4px 10px", border: "1px solid " + (data.type === t ? b.pri : "#ddd"), background: data.type === t ? b.priLt : "#fff", color: data.type === t ? b.pri : b.txL, fontSize: 10, fontWeight: 600, cursor: "pointer", borderRadius: 4 }}>
                  {t}
                </button>
              ))}
            </div>
          )}

          {data?.active !== undefined && (
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: "#888" }}>Active step: {data.active}</label>
              <input type="range" min={0} max={(data.items?.length || 1) - 1} value={data.active} onChange={(e) => setData({ ...data, active: parseInt(e.target.value) })} style={{ width: "100%", accentColor: b.pri }} />
            </div>
          )}

          {data?.items && data.items.map((it, i) => (
            <div key={i} style={{ marginBottom: 6, padding: 8, background: "#FAFAFA", borderRadius: 6 }}>
              <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 3 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: b.pri }}>#{i + 1}</span>
                {it.icon !== undefined && (
                  <input value={it.icon} onChange={(e) => { const n = [...data.items!]; n[i] = { ...n[i], icon: e.target.value }; setData({ ...data, items: n }); }} style={{ width: 36, padding: "5px 4px", border: "1px solid #e5e5e5", borderRadius: 4, fontSize: 14, outline: "none", textAlign: "center" }} />
                )}
                <input value={it.title} onChange={(e) => { const n = [...data.items!]; n[i] = { ...n[i], title: e.target.value }; setData({ ...data, items: n }); }} placeholder="Title" style={{ flex: 1, padding: "5px 6px", border: "1px solid #e5e5e5", borderRadius: 4, fontSize: 11, fontWeight: 600, outline: "none" }} />
                {data.items!.length > 1 && (
                  <button onClick={() => setData({ ...data, items: data.items!.filter((_, j) => j !== i) })} style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 12 }}>✕</button>
                )}
              </div>
              {it.img !== undefined && (
                <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 3 }}>
                  <span style={{ fontSize: 9, color: "#aaa", flexShrink: 0 }}>🖼</span>
                  <input value={it.img} onChange={(e) => { const n = [...data.items!]; n[i] = { ...n[i], img: e.target.value }; setData({ ...data, items: n }); }} placeholder="Image URL (paste link)" style={{ flex: 1, padding: "4px 6px", border: "1px solid #e5e5e5", borderRadius: 4, fontSize: 10, outline: "none", color: "#666" }} />
                  {it.img && <img src={it.img} style={{ width: 24, height: 24, objectFit: "cover", borderRadius: 3, border: "1px solid #e5e5e5" }} onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />}
                </div>
              )}
              {it.desc !== undefined && (
                <textarea value={it.desc} onChange={(e) => { const n = [...data.items!]; n[i] = { ...n[i], desc: e.target.value }; setData({ ...data, items: n }); }} placeholder="Description" rows={2} style={{ width: "100%", padding: "5px 6px", border: "1px solid #e5e5e5", borderRadius: 4, fontSize: 10, resize: "none", outline: "none" }} />
              )}
              {it.desc2 !== undefined && (
                <textarea value={it.desc2} onChange={(e) => { const n = [...data.items!]; n[i] = { ...n[i], desc2: e.target.value }; setData({ ...data, items: n }); }} placeholder="Column 2" rows={2} style={{ width: "100%", padding: "5px 6px", border: "1px solid #e5e5e5", borderRadius: 4, fontSize: 10, resize: "none", outline: "none", marginTop: 3 }} />
              )}
            </div>
          ))}

          {data?.items && (
            <button
              onClick={() => {
                const tpl = data.items![0] || { title: "" };
                const nw: typeof tpl = { title: "" };
                if (tpl.desc !== undefined) nw.desc = "";
                if (tpl.desc2 !== undefined) nw.desc2 = "";
                if (tpl.icon !== undefined) nw.icon = "●";
                if (tpl.img !== undefined) nw.img = "";
                setData({ ...data, items: [...data.items!, nw] });
              }}
              style={{ fontSize: 10, padding: "4px 10px", borderRadius: 4, border: "1px solid " + b.pri, background: "transparent", color: b.pri, cursor: "pointer", fontWeight: 600 }}
            >
              + Add
            </button>
          )}

          {!isScorm && (
            <button onClick={doRegen} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "none", background: b.pri, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", marginTop: 10 }}>
              Update preview
            </button>
          )}

          {isScorm && data && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={doRegen} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "2px solid " + b.pri, background: "#fff", color: b.pri, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Update preview</button>
              <button onClick={() => downloadSCORM(sel, data, brand)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: b.pri, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>⬇ Download .zip</button>
            </div>
          )}
        </div>

        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Preview</div>

          {!isScorm && (
            <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 16, background: "#fff", minHeight: 200, overflow: "auto" }} dangerouslySetInnerHTML={{ __html: output }} />
          )}

          {isScorm && scormPreview && (
            <div style={{ border: "1px solid #eee", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
              <div style={{ padding: "8px 12px", background: b.n1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: b.txL, textTransform: "uppercase", letterSpacing: 0.5 }}>Live Interactive Preview</span>
                <span style={{ fontSize: 9, color: "#aaa" }}>Try clicking / interacting below</span>
              </div>
              <iframe srcDoc={scormPreview} style={{ width: "100%", height: 560, border: "none", display: "block" }} sandbox="allow-scripts allow-same-origin" title="SCORM Preview" />
            </div>
          )}

          {!isScorm && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: 1 }}>HTML Code</div>
                <button onClick={handleCopy} style={{ fontSize: 10, padding: "3px 10px", borderRadius: 4, border: "1px solid " + (copied ? b.pri : "#ddd"), background: copied ? b.priLt : "#fff", color: copied ? b.pri : "#888", cursor: "pointer", fontWeight: 600 }}>
                  {copied ? "✓ Copied!" : "Copy"}
                </button>
              </div>
              <textarea readOnly value={output} onClick={(e) => { (e.target as HTMLTextAreaElement).focus(); (e.target as HTMLTextAreaElement).select(); }} style={{ width: "100%", height: 120, padding: 10, border: "2px solid " + b.pri, fontSize: 10, fontFamily: "monospace", color: "#444", background: "#FAFAFA", resize: "vertical", cursor: "pointer", borderRadius: 6 }} />
            </div>
          )}

          <div style={{ marginTop: 8, padding: 10, background: b.n1, fontSize: 10, color: "#888", borderRadius: 6 }}>
            <strong style={{ color: b.tx }}>{isScorm ? "Upload:" : "NovoEd:"}</strong>{" "}
            {isScorm ? "Download .zip → NovoEd → Add SCORM/AICC → Upload" : "Copy code → NovoEd → Contents → HTML. Also works in Quiz & Survey edit view."}
          </div>
        </div>
      </div>
    </div>
  );
}
