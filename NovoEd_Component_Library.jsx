import { useState } from "react";

/* ── Brand Tokens ── */
const B = {
  bcg: { n:"BCG", pri:"#29BA74", priDk:"#1B7A4F", priLt:"#E6F7EF", tx:"#333333", txL:"#666666", n1:"#F5F5F5", n2:"#E8E8E8", wh:"#FFFFFF", grad:"linear-gradient(135deg, #29BA74, #1B7A4F)" },
  bcgu: { n:"BCG U", pri:"#197A56", priDk:"#0D3B2C", priLt:"#E8F3ED", tx:"#323232", txL:"#666666", n1:"#F1EEEA", n2:"#DFD7CD", wh:"#FFFFFF", grad:"linear-gradient(135deg, #197A56, #0D3B2C)" },
};

const FR = 'class="froala-style-subtitle" role="heading" aria-level="3"';

function esc(s) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ── Fisher-Yates Shuffle ── */
function shuffle(arr){var a=arr.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a;}

/* ── Component Registries ── */
const HTML_COMPS = [
  { id:"highlight", n:"Banner",        d:"Full-width gradient header banner",      ic:"★", cat:"layout"  },
  { id:"callout",   n:"Callout",       d:"Info, tip, warning or success box",      ic:"!", cat:"content" },
  { id:"quote",     n:"Blockquote",    d:"Pull quote with green accent bar",       ic:"❝", cat:"content" },
  { id:"divider",   n:"Divider",       d:"Labeled section separator",             ic:"—", cat:"layout"  },
  { id:"table",     n:"Table",         d:"Green header with alternating rows",     ic:"▦", cat:"data"    },
  { id:"compare",   n:"Comparison",    d:"Side-by-side two-column comparison",    ic:"⇔", cat:"data"    },
  { id:"glossary",  n:"Glossary",      d:"Term–definition pairs",                 ic:"Aa",cat:"data"    },
  { id:"cards",     n:"Cards",         d:"2–3 content cards side by side",        ic:"▦", cat:"layout"  },
  { id:"columns",   n:"Columns",       d:"Multi-column text layout",              ic:"║", cat:"layout"  },
  { id:"process",   n:"Process",       d:"Numbered steps in a row",               ic:"→", cat:"layout"  },
  { id:"stats",     n:"Statistics",    d:"Big numbers with labels",               ic:"#", cat:"data"    },
  { id:"iconrow",   n:"Icons",         d:"Symbol icons with labels in a row",     ic:"●", cat:"layout"  },
  { id:"timeline",  n:"Timeline",      d:"Vertical timeline with dots",           ic:"│", cat:"content" },
  { id:"numbered",  n:"Numbered list", d:"Green numbered items with descriptions",ic:"1.",cat:"content" },
  { id:"checklist", n:"Checklist",     d:"Green checkmark list",                  ic:"✓", cat:"content" },
  { id:"progress",  n:"Progress bar",  d:"Stage completion tracker",              ic:"━", cat:"layout"  },
  { id:"keypoints", n:"Key Takeaways", d:"Highlighted bullet summary box",        ic:"★", cat:"content" },
  { id:"faq",       n:"FAQ",           d:"Question & answer pairs",               ic:"?", cat:"content" },
  { id:"twostat",   n:"Stat Highlight",d:"One big stat with supporting text",     ic:"#", cat:"data"    },
  { id:"badge",     n:"Label Badges",  d:"Colored pill tags — skills, topics",    ic:"◉", cat:"layout"  },
];

const SCORM_COMPS = [
  { id:"s_flipcard",   n:"Flip cards",          d:"Click cards to flip and reveal back content",   ic:"↻", cat:"interactive" },
  { id:"s_accordion",  n:"Accordion",           d:"Click to expand/collapse sections",             ic:"▼", cat:"interactive" },
  { id:"s_tabs",       n:"Tabs",                d:"Switch between tabbed content panels",          ic:"▭", cat:"interactive" },
  { id:"s_reveal",     n:"Click to reveal",     d:"Hidden content revealed behind buttons",        ic:"◉", cat:"interactive" },
  { id:"s_stepper",    n:"Step by step",        d:"Navigate through steps with next/prev",        ic:"→", cat:"interactive" },
  { id:"s_stacked",    n:"Stacked cards",       d:"Overlapping cards, click to expand",           ic:"▣", cat:"interactive" },
  { id:"s_cycle",      n:"Cycle diagram",       d:"Circular process with click-to-expand nodes",  ic:"⟳", cat:"interactive" },
  { id:"s_timeline_i", n:"Interactive timeline",d:"Click timeline points for details",            ic:"│", cat:"interactive" },
  { id:"s_sort",       n:"Drag to sort",        d:"Drag items into the correct order",            ic:"↕", cat:"assessment"  },
  { id:"s_match",      n:"Matching",            d:"Match terms with definitions",                 ic:"⇄", cat:"assessment"  },
  { id:"s_quiz",       n:"Multiple Choice",     d:"Question with 4 options and instant feedback", ic:"?", cat:"assessment"  },
  { id:"s_poll",       n:"Opinion Poll",        d:"Vote and see animated bar chart results",      ic:"📊",cat:"assessment"  },
];

/* ── HTML Generator ── */
function genHTML(id, brand, data) {
  const b = B[brand];
  const items = data.items || [];
  const bg = "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.1) 30%, transparent 30%), linear-gradient(225deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.07) 20%, transparent 20%), " + b.grad;

  if (id === "highlight")
    return '<table style="width:100%;border-collapse:collapse;"><tr><td style="background:'+bg+';padding:36px 40px;text-align:center;"><p '+FR+' style="margin:0 0 12px;color:#FFFFFF;">'+esc(data.title||"")+'</p><div style="font-size:14px;color:rgba(255,255,255,0.88);line-height:1.8;">'+esc(data.body||"")+'</div></td></tr></table>';

  if (id === "callout") {
    const tp = {
      info:    { bg:"#EBF5F0", brd:b.pri, ic:"ℹ️", lbl:"Info" },
      tip:     { bg:"#EBF5F0", brd:b.pri, ic:"💡", lbl:"Tip" },
      warning: { bg:"#FFF8E6", brd:"#D4A017", ic:"⚠️", lbl:"Warning" },
      success: { bg:"#EBF5F0", brd:b.pri, ic:"✅", lbl:"Success" },
    };
    const t = tp[data.type || "info"];
    return '<table style="width:100%;border-collapse:collapse;"><tr><td style="width:5px;background:'+t.brd+';padding:0;"></td><td style="padding:18px 22px;background:'+t.bg+';"><p '+FR+' style="margin:0 0 8px;color:'+b.tx+';">'+t.ic+' '+t.lbl+'</p><div style="font-size:13px;color:'+b.tx+';line-height:1.8;">'+esc(data.body||"")+'</div></td></tr></table>';
  }

  if (id === "quote")
    return '<table style="width:100%;border-collapse:collapse;"><tr><td style="width:5px;background:'+b.pri+';padding:0;"></td><td style="padding:28px 30px;background:'+b.n1+';"><div style="font-size:18px;font-style:italic;color:'+b.tx+';line-height:1.8;font-weight:300;margin-bottom:14px;">"'+esc(data.body||"")+'"</div><div style="font-size:12px;font-weight:700;color:'+b.pri+';">— '+esc(data.author||"")+'</div></td></tr></table>';

  if (id === "divider")
    return '<table style="width:100%;border-collapse:collapse;"><tr><td style="width:40%;padding:0;"><div style="height:2px;background:'+b.pri+';"></div></td><td style="padding:0 16px;text-align:center;white-space:nowrap;"><span style="font-size:12px;font-weight:700;color:'+b.pri+';letter-spacing:1px;text-transform:uppercase;">'+esc(data.title||"")+'</span></td><td style="width:40%;padding:0;"><div style="height:2px;background:'+b.pri+';"></div></td></tr></table>';

  if (id === "table") {
    let r = "";
    items.forEach((it, i) => {
      r += '<tr><td style="padding:12px 18px;font-size:13px;font-weight:600;color:'+b.tx+';border-bottom:1px solid '+b.n2+';background:'+(i%2===0?b.wh:b.n1)+';">'+esc(it.title)+'</td><td style="padding:12px 18px;font-size:13px;color:'+b.txL+';border-bottom:1px solid '+b.n2+';background:'+(i%2===0?b.wh:b.n1)+';line-height:1.6;">'+esc(it.desc)+'</td></tr>';
    });
    return '<table style="width:100%;border-collapse:collapse;border:1px solid '+b.n2+';"><thead><tr><th style="padding:14px 18px;text-align:left;font-size:13px;font-weight:700;color:'+b.wh+';background:'+bg+';">'+esc(data.col1||"Category")+'</th><th style="padding:14px 18px;text-align:left;font-size:13px;font-weight:700;color:'+b.wh+';background:'+bg+';">'+esc(data.col2||"Description")+'</th></tr></thead><tbody>'+r+'</tbody></table>';
  }

  if (id === "compare") {
    let r = "";
    items.forEach((it, i) => {
      r += '<tr><td style="padding:12px 16px;font-size:12px;font-weight:700;color:'+b.wh+';background:'+b.pri+';width:130px;border-bottom:1px solid rgba(255,255,255,0.15);text-align:center;">'+esc(it.title)+'</td><td style="padding:12px 16px;font-size:13px;color:'+b.tx+';border-bottom:1px solid '+b.n2+';background:'+(i%2===0?b.wh:b.n1)+';line-height:1.6;">'+esc(it.desc)+'</td><td style="padding:12px 16px;font-size:13px;color:'+b.tx+';border-bottom:1px solid '+b.n2+';background:'+(i%2===0?b.wh:b.n1)+';line-height:1.6;">'+esc(it.desc2||"")+'</td></tr>';
    });
    return '<table style="width:100%;border-collapse:collapse;border:1px solid '+b.n2+';"><thead><tr><th style="padding:14px;background:'+b.n1+';width:130px;"></th><th style="padding:14px 18px;text-align:left;font-size:14px;font-weight:700;color:'+b.wh+';background:'+b.grad+';">'+esc(data.col1||"Option A")+'</th><th style="padding:14px 18px;text-align:left;font-size:14px;font-weight:700;color:'+b.wh+';background:'+b.priDk+';">'+esc(data.col2||"Option B")+'</th></tr></thead><tbody>'+r+'</tbody></table>';
  }

  if (id === "glossary") {
    let r = "";
    items.forEach((it, i) => {
      r += '<tr><td style="padding:14px 18px;width:160px;vertical-align:top;border-bottom:1px solid '+b.n2+';background:'+(i%2===0?b.wh:b.n1)+';"><span style="font-size:14px;font-weight:700;color:'+b.pri+';">'+esc(it.title)+'</span></td><td style="padding:14px 18px;font-size:13px;color:'+b.tx+';line-height:1.7;border-bottom:1px solid '+b.n2+';background:'+(i%2===0?b.wh:b.n1)+';">'+esc(it.desc)+'</td></tr>';
    });
    return '<table style="width:100%;border-collapse:collapse;border:1px solid '+b.n2+';">'+r+'</table>';
  }

  if (id === "cards") {
    const cols = Math.min(items.length, 3);
    let c = "";
    for (let i = 0; i < items.length; i += cols) {
      c += "<tr>";
      for (let j = 0; j < cols; j++) {
        const it = items[i + j];
        if (it) {
          c += '<td style="padding:8px;vertical-align:top;width:'+Math.floor(100/cols)+'%;"><div style="padding:20px;border:1px solid '+b.n2+';border-top:3px solid '+b.pri+';"><p '+FR+' style="margin:0 0 10px;color:'+b.tx+';">'+esc(it.title)+'</p><div style="font-size:12px;color:'+b.txL+';line-height:1.7;">'+esc(it.desc)+'</div></div></td>';
        } else {
          c += '<td style="padding:8px;"></td>';
        }
      }
      c += "</tr>";
    }
    return '<table style="width:100%;border-collapse:collapse;">'+c+'</table>';
  }

  if (id === "columns") {
    let c = "<tr>";
    items.forEach((it) => {
      c += '<td style="vertical-align:top;padding:0 12px;width:'+Math.floor(100/items.length)+'%;"><p '+FR+' style="margin:0 0 10px;color:'+b.tx+';padding-bottom:10px;border-bottom:3px solid '+b.pri+';">'+esc(it.title)+'</p><div style="font-size:13px;color:'+b.txL+';line-height:1.8;">'+esc(it.desc)+'</div></td>';
    });
    return '<table style="width:100%;border-collapse:collapse;">'+c+'</tr></table>';
  }

  if (id === "process") {
    let c = "<tr>";
    items.forEach((it, i) => {
      c += '<td style="vertical-align:top;padding:6px;width:'+Math.floor(100/items.length)+'%;text-align:center;"><div style="background:'+b.grad+';padding:16px 10px;margin-bottom:10px;"><div style="font-size:24px;font-weight:200;color:rgba(255,255,255,0.6);">'+String(i+1).padStart(2,"0")+'</div><div style="font-size:13px;font-weight:700;color:'+b.wh+';margin-top:4px;">'+esc(it.title)+'</div></div><div style="font-size:11px;color:'+b.txL+';line-height:1.6;">'+esc(it.desc)+'</div></td>';
    });
    return '<table style="width:100%;border-collapse:collapse;">'+c+'</tr></table>';
  }

  if (id === "stats") {
    let c = "<tr>";
    items.forEach((it) => {
      c += '<td style="text-align:center;padding:24px 16px;vertical-align:top;border-right:1px solid '+b.n2+';"><div style="font-size:42px;font-weight:200;color:'+b.pri+';">'+esc(it.title)+'</div><div style="font-size:12px;color:'+b.txL+';margin-top:10px;font-weight:500;">'+esc(it.desc)+'</div></td>';
    });
    return '<table style="width:100%;border-collapse:collapse;border:1px solid '+b.n2+';">'+c+'</tr></table>';
  }

  if (id === "iconrow") {
    let c = "<tr>";
    items.forEach((it) => {
      c += '<td style="text-align:center;padding:16px 8px;vertical-align:top;"><div style="width:56px;height:56px;background:'+b.priLt+';border:2px solid '+b.pri+';margin:0 auto 12px;line-height:56px;font-size:22px;font-weight:700;color:'+b.pri+';">'+esc(it.icon||"●")+'</div><div style="font-size:13px;font-weight:700;color:'+b.tx+';margin-bottom:4px;">'+esc(it.title)+'</div><div style="font-size:11px;color:'+b.txL+';line-height:1.5;">'+esc(it.desc||"")+'</div></td>';
    });
    return '<table style="width:100%;border-collapse:collapse;">'+c+'</tr></table>';
  }

  if (id === "timeline") {
    let r = "";
    items.forEach((it, i) => {
      r += '<tr><td style="width:40px;vertical-align:top;padding:0;text-align:center;"><div style="width:16px;height:16px;background:'+b.pri+';margin:4px auto 0;"></div>'+(i<items.length-1?'<div style="width:2px;height:40px;background:'+b.n2+';margin:0 auto;"></div>':'')+'</td><td style="padding:0 0 20px 12px;vertical-align:top;"><p '+FR+' style="margin:0 0 4px;color:'+b.tx+';">'+esc(it.title)+'</p><div style="font-size:12px;color:'+b.txL+';line-height:1.7;">'+esc(it.desc)+'</div></td></tr>';
    });
    return '<table style="width:100%;max-width:600px;border-collapse:collapse;">'+r+'</table>';
  }

  if (id === "numbered") {
    let r = "";
    items.forEach((it, i) => {
      r += '<tr><td style="width:44px;vertical-align:top;padding:12px 0;"><div style="width:32px;height:32px;background:'+b.grad+';text-align:center;line-height:32px;color:'+b.wh+';font-size:14px;font-weight:700;">'+(i+1)+'</div></td><td style="padding:12px 0 12px 12px;border-bottom:1px solid '+b.n1+';vertical-align:top;"><p '+FR+' style="margin:0 0 4px;color:'+b.tx+';">'+esc(it.title)+'</p><div style="font-size:12px;color:'+b.txL+';line-height:1.7;">'+esc(it.desc||"")+'</div></td></tr>';
    });
    return '<table style="width:100%;max-width:650px;border-collapse:collapse;">'+r+'</table>';
  }

  if (id === "checklist") {
    let r = "";
    items.forEach((it) => {
      r += '<tr><td style="width:30px;vertical-align:top;padding:10px 0;"><div style="width:22px;height:22px;background:'+b.pri+';text-align:center;line-height:22px;color:'+b.wh+';font-size:13px;">✓</div></td><td style="padding:10px 0 10px 10px;font-size:13px;color:'+b.tx+';line-height:1.6;border-bottom:1px solid '+b.n1+';">'+esc(it.title)+'</td></tr>';
    });
    return '<table style="width:100%;max-width:500px;border-collapse:collapse;">'+r+'</table>';
  }

  if (id === "progress") {
    const act = data.active || 0;
    let c = "<tr>";
    items.forEach((it, i) => {
      const d = i <= act;
      c += '<td style="text-align:center;padding:0 2px;"><div style="height:10px;background:'+(d?b.pri:b.n2)+';"></div><div style="font-size:10px;font-weight:'+(i===act?"700":"400")+';color:'+(d?b.pri:b.txL)+';margin-top:8px;">'+esc(it.title)+'</div></td>';
    });
    return '<table style="width:100%;border-collapse:collapse;">'+c+'</tr></table>';
  }

  if (id === "keypoints") {
    const ktitle = data.title || "Key Takeaways";
    let rows = "";
    items.forEach(it => {
      rows += '<tr><td style="width:28px;padding:9px 4px 9px 16px;vertical-align:top;"><div style="width:14px;height:14px;background:'+b.pri+';border-radius:50%;margin-top:3px;"></div></td><td style="padding:9px 16px 9px 8px;font-size:13px;color:'+b.tx+';line-height:1.7;border-bottom:1px solid '+b.n1+';">'+esc(it.title)+'</td></tr>';
    });
    return '<table style="width:100%;border-collapse:collapse;border:1px solid '+b.n2+';border-left:4px solid '+b.pri+';background:'+b.n1+';"><tr><td colspan="2" style="padding:14px 16px 10px;background:'+b.priLt+';"><p '+FR+' style="margin:0;color:'+b.tx+';">'+esc(ktitle)+'</p></td></tr>'+rows+'</table>';
  }

  if (id === "faq") {
    let rows = "";
    items.forEach((it, i) => {
      rows += '<tr><td style="padding:14px 18px;border-bottom:1px solid '+b.n2+';background:'+(i%2===0?b.wh:b.n1)+';">'
        + '<div style="font-size:13px;font-weight:700;color:'+b.pri+';margin-bottom:6px;">'+esc(it.title)+'</div>'
        + '<div style="font-size:12px;color:'+b.tx+';line-height:1.75;">'+esc(it.desc||"")+'</div>'
        + '</td></tr>';
    });
    return '<table style="width:100%;border-collapse:collapse;border:1px solid '+b.n2+';">'+rows+'</table>';
  }

  if (id === "twostat") {
    return '<table style="width:100%;border-collapse:collapse;"><tr>'
      + '<td style="width:38%;padding:32px 24px;background:'+b.priLt+';text-align:center;vertical-align:middle;border-left:4px solid '+b.pri+';">'
      + '<div style="font-size:52px;font-weight:700;color:'+b.pri+';line-height:1;margin-bottom:6px;">'+esc(data.stat||"87%")+'</div>'
      + '<div style="font-size:11px;font-weight:600;color:'+b.priDk+';text-transform:uppercase;letter-spacing:1px;">'+esc(data.label||"")+'</div>'
      + '</td>'
      + '<td style="padding:28px 32px;background:'+b.wh+';vertical-align:middle;">'
      + '<div style="font-size:15px;color:'+b.tx+';line-height:1.8;font-weight:300;">'+esc(data.body||"")+'</div>'
      + '</td></tr></table>';
  }

  if (id === "badge") {
    const cmap = {green:{bg:b.priLt,brd:b.pri,tx:b.priDk},blue:{bg:"#DBEAFE",brd:"#2563EB",tx:"#1D4ED8"},gray:{bg:b.n1,brd:b.n2,tx:b.txL},orange:{bg:"#FFF7ED",brd:"#EA580C",tx:"#C2410C"}};
    let cells = "";
    items.forEach(it => {
      const c = cmap[it.color||"green"]||cmap.green;
      cells += '<td style="padding:0 4px;"><span style="display:inline-block;padding:6px 16px;background:'+c.bg+';border:1.5px solid '+c.brd+';border-radius:20px;font-size:12px;font-weight:600;color:'+c.tx+';white-space:nowrap;">'+esc(it.title)+'</span></td>';
    });
    return '<table style="border-collapse:collapse;"><tr>'+cells+'</tr></table>';
  }

  return "";
}

/* ── Default Data ── */
const DEFAULTS = {
  highlight:{ title:"Unleash. Unlock. Upskill.", body:"BCG U delivers transformative upskilling outcomes at speed, at scale, and with measurable return on learning investment." },
  callout:{ type:"tip", body:"AI transformation requires both top-down strategic vision and bottom-up experimentation." },
  quote:{ body:"The organizations that will thrive treat AI not as a technology initiative, but as a fundamental transformation.", author:"BCG Global AI Study, 2025" },
  divider:{ title:"Next section" },
  table:{ col1:"Concept", col2:"Description", items:[{title:"GenAI",desc:"AI that creates new content"},{title:"LLM",desc:"Large Language Model"},{title:"RAG",desc:"Retrieval-Augmented Generation"},{title:"Fine-tuning",desc:"Adapting models on specific data"}] },
  compare:{ col1:"Traditional ML", col2:"Generative AI", items:[{title:"Objective",desc:"Predictions from data",desc2:"Broad content creation"},{title:"Use cases",desc:"Classification, NLP",desc2:"Text, code, image gen"},{title:"Users",desc:"Data scientists",desc2:"End users via prompts"}] },
  glossary:{ items:[{title:"GenAI",desc:"AI that generates new content"},{title:"LLM",desc:"Neural network with billions of parameters"},{title:"RAG",desc:"Enhancing LLM with document retrieval"},{title:"Hallucination",desc:"AI generating plausible but incorrect info"}] },
  cards:{ items:[{title:"Define success",desc:"Set metrics for AI transformation"},{title:"Build talent",desc:"Upskill for AI proficiency"},{title:"Move culture",desc:"Set AI use expectations"}] },
  columns:{ items:[{title:"Speed",desc:"Programs in weeks, not months."},{title:"Scale",desc:"Thousands with personalization."},{title:"Impact",desc:"Real outcomes, not just completions."}] },
  process:{ items:[{title:"Assess",desc:"Evaluate maturity"},{title:"Plan",desc:"Build roadmap"},{title:"Build",desc:"Launch pilots"},{title:"Scale",desc:"Expand org-wide"},{title:"Optimize",desc:"Measure ROLI"}] },
  stats:{ items:[{title:"3.5x",desc:"Patent growth"},{title:"2.7x",desc:"Return on capital"},{title:"3.6x",desc:"Three-year TSR"},{title:"1.7x",desc:"Revenue growth"}] },
  iconrow:{ items:[{icon:"◎",title:"Define",desc:"Set metrics"},{icon:"◈",title:"Vision",desc:"Future state"},{icon:"▣",title:"Culture",desc:"Expectations"},{icon:"⚖",title:"Risk",desc:"Responsible AI"},{icon:"◉",title:"Talent",desc:"Upskill"},{icon:"↻",title:"Iterate",desc:"Evolve"}] },
  timeline:{ items:[{title:"Q1 — Foundation",desc:"Establish AI CoE"},{title:"Q2 — Pilots",desc:"Launch 3 programs"},{title:"Q3 — Scale",desc:"Expand org-wide"},{title:"Q4 — Optimize",desc:"Measure ROLI"}] },
  numbered:{ items:[{title:"Assess maturity",desc:"Evaluate readiness"},{title:"Define ambition",desc:"Set 12-18 month goals"},{title:"Identify use cases",desc:"Pick 3-5 to pilot"},{title:"Build capabilities",desc:"Data, talent, governance"},{title:"Scale",desc:"Expand with playbooks"}] },
  checklist:{ items:[{title:"Complete pre-work reading"},{title:"Watch intro video"},{title:"Submit use case proposal"},{title:"Schedule coaching"},{title:"Complete assessment"}] },
  progress:{ active:2, items:[{title:"Enroll"},{title:"Pre-work"},{title:"Mod 1"},{title:"Mod 2"},{title:"Mod 3"},{title:"Capstone"}] },
  s_flipcard:{ title:"Interactive", body:"Tap each card to explore", items:[{title:"AI Strategy",img:"",desc:"Align AI initiatives with business objectives to maximize value."},{title:"Data Foundation",img:"",desc:"Build robust data infrastructure for reliable AI training."},{title:"Talent",img:"",desc:"Develop internal capabilities through upskilling."}] },
  s_accordion:{ title:"Explore", body:"Click each section to learn more", items:[{title:"What is GenAI?",desc:"AI systems that create new content from patterns in training data."},{title:"What is an LLM?",desc:"A neural network trained on vast text to understand and generate language."},{title:"What is RAG?",desc:"Combining LLMs with real-time document retrieval for grounded answers."}] },
  s_tabs:{ title:"Navigate", body:"Switch between sections", items:[{title:"Overview",desc:"This module covers AI strategy fundamentals."},{title:"Objectives",desc:"By the end, identify key AI use cases and evaluate impact."},{title:"Resources",desc:"Download reference guide and case study materials."}] },
  s_reveal:{ title:"Discover", body:"Click to reveal key insights", items:[{title:"Key Insight",desc:"Organizations investing in AI upskilling see 2.7x higher return on capital."},{title:"Case Study",desc:"A Fortune 500 retailer reduced inventory waste by 35% with AI forecasting."}] },
  s_stepper:{ title:"Step by Step", body:"Navigate through each stage", items:[{title:"Assess",desc:"Evaluate your org's AI maturity and gaps."},{title:"Plan",desc:"Develop a strategic roadmap with milestones."},{title:"Build",desc:"Implement pilots and build capabilities."},{title:"Scale",desc:"Expand successful pilots across the org."}] },
  s_stacked:{ title:"Explore", body:"Click each card to reveal insights", items:[{title:"Thinking too incrementally",img:"",desc:"Start with bold ambitions that can transform how your organization operates, not just optimize existing workflows."},{title:"Not grounding in holistic value",img:"",desc:"Apply clear outcome metrics to track results and ensure accountability, making initiatives easier to scale and sustain."},{title:"Overlooking people readiness",img:"",desc:"Invest in change management and upskilling alongside technology to ensure adoption across the organization."},{title:"Underestimating adoption challenges",img:"",desc:"Plan for resistance, iterate on feedback, and build champions at every level to drive sustainable change."}] },
  s_cycle:{ title:"Process", body:"Click each node to explore the cycle", items:[{title:"Better algorithms",icon:"🧮",desc:"Interpret complex behavioral patterns by training models on real-world data, enabling smarter and more responsive services."},{title:"Better services",icon:"🤝",desc:"Deliver personalized, adaptive user experiences that foster deep engagement and sustained interaction."},{title:"(More) usage",icon:"📈",desc:"Increases user interaction and engagement, generating richer behavioral signals that inform future data collection."},{title:"More data",icon:"💾",desc:"Captures more diverse, real-world behavior and context, providing the foundation for training even more effective algorithms."}] },
  s_sort:{ title:"Activity", body:"Drag items into the correct order", items:[{title:"Assess maturity"},{title:"Define strategy"},{title:"Launch pilots"},{title:"Scale org-wide"}] },
  s_match:{ title:"Match", body:"Connect terms with definitions", items:[{title:"GenAI",desc:"Creates new content"},{title:"LLM",desc:"Trained on text data"},{title:"RAG",desc:"Retrieves then generates"}] },
  s_timeline_i:{ title:"Timeline", body:"Explore each milestone", items:[{title:"Q1 — Foundation",desc:"Establish AI CoE, assess capabilities."},{title:"Q2 — Pilots",desc:"Launch targeted pilot programs."},{title:"Q3 — Scale",desc:"Expand org-wide training."},{title:"Q4 — Optimize",desc:"Measure and plan next wave."}] },
  keypoints:{ title:"Key Takeaways", items:[{title:"AI transformation requires top-down vision and bottom-up experimentation."},{title:"Data quality is the single biggest determinant of AI model performance."},{title:"Change management is as critical as technology investment."},{title:"Start with 3–5 high-value use cases before scaling."}] },
  faq:{ items:[{title:"What is Generative AI?",desc:"AI systems that generate new content — text, code, images — by learning patterns from training data."},{title:"How is GenAI different from traditional ML?",desc:"Traditional ML predicts from labelled data. GenAI creates new outputs using broad, unlabelled training at massive scale."},{title:"What is a hallucination?",desc:"When an AI model produces plausible but factually incorrect information, often due to gaps in training data."}] },
  twostat:{ stat:"3.5×", label:"Return on upskilling investment", body:"Organizations that invest systematically in AI capability building see 3.5× higher return on learning investment compared to ad-hoc training approaches." },
  badge:{ items:[{title:"Strategic Thinking",color:"green"},{title:"AI Literacy",color:"blue"},{title:"Data Fluency",color:"orange"},{title:"Leadership",color:"gray"}] },
  s_quiz:{ title:"Knowledge Check", body:"RAG (Retrieval-Augmented Generation) lets models access current, reliable information — grounding responses in real facts rather than relying solely on training data.", items:[{title:"What is the primary benefit of RAG?"},{title:"Faster model training",desc:"0"},{title:"Access to current, verified information",desc:"1"},{title:"Lower compute requirements",desc:"0"},{title:"Better base language understanding",desc:"0"}] },
  s_poll:{ title:"Quick Poll", body:"What is your organisation's biggest AI adoption challenge?", items:[{title:"Data quality & infrastructure",desc:"34"},{title:"Talent and capability gaps",desc:"28"},{title:"Governance & risk concerns",desc:"22"},{title:"Budget constraints",desc:"16"}] },
};

/* ── SCORM HTML Builder (shared by preview + download) ── */
// Helper to create script tags without breaking HTML parser
function scTag(code) { return '<scr'+'ipt>'+code+'</scr'+'ipt>'; }

function genSCORMhtml(sel, data, brand) {
  const b2 = B[brand];
  const items = data.items || [];
  // If title field exists and is empty string, respect that (show nothing)
  // Only fall back to component name if title field doesn't exist at all
  const compTitle = data.title !== undefined ? data.title : (SCORM_COMPS.find(c => c.id === sel)?.n || "Activity");
  const compBody = data.body !== undefined ? data.body : "";

  const bgStyle = data.bg === "none" ? "#ffffff" : "linear-gradient(150deg,#fafbfc 0%,"+b2.priLt+" 50%,#fafbfc 100%)";

  const baseCSS = '*{margin:0;padding:0;box-sizing:border-box;}' +
    '@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}' +
    '@keyframes fadeIn{from{opacity:0}to{opacity:1}}' +
    '@keyframes scaleIn{from{opacity:0;transform:scale(0.93)}to{opacity:1;transform:scale(1)}}' +
    '@keyframes dotPop{0%{transform:scale(0)}60%{transform:scale(1.15)}100%{transform:scale(1)}}' +
    'html,body{height:100%;}' +
    'body{font-family:"Segoe UI",Trebuchet MS,system-ui,sans-serif;padding:0;margin:0;background:'+bgStyle+';color:'+b2.tx+';display:flex;align-items:center;justify-content:center;min-height:100%;}' +
    '.container{width:100%;max-width:720px;margin:0 auto;padding:28px 32px;}' +
    '.page-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:'+b2.pri+';margin-bottom:5px;animation:fadeIn 0.5s ease;}' +
    '.page-subtitle{font-size:19px;font-weight:300;color:'+b2.tx+';margin-bottom:22px;animation:fadeUp 0.5s ease 0.1s both;line-height:1.4;}' +
    '.instruction{font-size:11px;color:'+b2.txL+';margin-bottom:18px;padding:8px 14px;background:rgba(255,255,255,0.7);border-radius:8px;border-left:3px solid '+b2.pri+';animation:fadeUp 0.5s ease 0.2s both;}';

  // Only render title/subtitle if they have content
  const pageHeader = (compTitle ? '<div class="page-title">'+esc(compTitle)+'</div>' : '') + (compBody ? '<div class="page-subtitle">'+esc(compBody)+'</div>' : '');

  let h = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(compTitle || "Activity")+'</title><style>'+baseCSS;

  if (sel === "s_flipcard") {
    h += '.grid{display:flex;flex-wrap:wrap;gap:18px;justify-content:center;padding-top:4px;}' +
      '.card{width:200px;height:200px;perspective:800px;cursor:pointer;animation:scaleIn 0.5s ease both;}' +
      '.card:nth-child(1){animation-delay:0.2s}.card:nth-child(2){animation-delay:0.35s}.card:nth-child(3){animation-delay:0.5s}.card:nth-child(4){animation-delay:0.65s}' +
      '.card-inner{width:100%;height:100%;position:relative;transition:transform 0.7s cubic-bezier(0.4,0,0.2,1);transform-style:preserve-3d;}' +
      '.card.flipped .card-inner{transform:rotateY(180deg);}' +
      '.face{position:absolute;width:100%;height:100%;backface-visibility:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:22px;border-radius:16px;}' +
      '.front{background:rgba(255,255,255,0.9);backdrop-filter:blur(10px);border:1px solid rgba(0,0,0,0.06);box-shadow:0 4px 24px rgba(0,0,0,0.06);}' +
      '.front .icon{width:44px;height:44px;background:linear-gradient(135deg,'+b2.pri+','+b2.priDk+');border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:14px;color:#fff;font-size:18px;font-weight:700;}' +
      '.front h3{font-size:14px;font-weight:700;color:'+b2.tx+';margin-bottom:6px;text-align:center;}' +
      '.front span{font-size:10px;color:'+b2.pri+';font-weight:600;opacity:0.7;}' +
      '.back{background:linear-gradient(135deg,'+b2.pri+','+b2.priDk+');transform:rotateY(180deg);border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.12);}' +
      '.back p{font-size:12px;color:rgba(255,255,255,0.95);text-align:center;line-height:1.7;font-weight:300;}' +
      '.back .flip-hint{position:absolute;bottom:12px;font-size:9px;color:rgba(255,255,255,0.45);}';
    h += '</style></head><body><div class="container">';
    h += pageHeader+'<div class="grid">';
    items.forEach((it, i) => {
      const hasImg = it.img && it.img.trim();
      const iconHtml = hasImg ? '<img src="'+esc(it.img)+'" style="width:48px;height:48px;object-fit:contain;margin-bottom:14px;border-radius:8px;"/>' : '<div class="icon">'+(it.icon || String(i+1).padStart(2,'0'))+'</div>';
      h += '<div class="card" onclick="this.classList.toggle(\'flipped\')"><div class="card-inner"><div class="face front">'+iconHtml+'<h3>'+esc(it.title)+'</h3><span>Tap to flip</span></div><div class="face back"><p>'+esc(it.desc)+'</p><span class="flip-hint">Tap to return</span></div></div></div>';
    });
    h += '</div></div></body></html>';

  } else if (sel === "s_accordion") {
    h += '.item{margin-bottom:10px;border-radius:14px;overflow:hidden;background:rgba(255,255,255,0.85);backdrop-filter:blur(8px);box-shadow:0 2px 12px rgba(0,0,0,0.04);border:1px solid rgba(0,0,0,0.05);animation:fadeUp 0.5s ease both;transition:box-shadow 0.3s;}' +
      '.item:nth-child(1){animation-delay:0.15s}.item:nth-child(2){animation-delay:0.25s}.item:nth-child(3){animation-delay:0.35s}.item:nth-child(4){animation-delay:0.45s}' +
      '.item:hover{box-shadow:0 4px 20px rgba(0,0,0,0.08);}' +
      '.header{padding:18px 22px;cursor:pointer;font-size:14px;font-weight:600;display:flex;align-items:center;transition:all 0.3s;}' +
      '.header .num{width:28px;height:28px;background:linear-gradient(135deg,'+b2.pri+','+b2.priDk+');border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;margin-right:14px;flex-shrink:0;}' +
      '.header .label{flex:1;color:'+b2.tx+';}' +
      '.header .arrow{width:28px;height:28px;background:'+b2.priLt+';border-radius:50%;display:flex;align-items:center;justify-content:center;color:'+b2.pri+';transition:all 0.4s cubic-bezier(0.4,0,0.2,1);font-size:12px;flex-shrink:0;}' +
      '.item.open .arrow{transform:rotate(180deg);background:'+b2.pri+';color:#fff;}' +
      '.body{max-height:0;overflow:hidden;transition:max-height 0.5s cubic-bezier(0.4,0,0.2,1);}' +
      '.body-inner{padding:0 22px 20px 64px;font-size:13px;color:'+b2.txL+';line-height:1.8;}' +
      '.item.open .body{max-height:300px;}';
    h += '</style></head><body><div class="container">';
    h += pageHeader;
    items.forEach((it, i) => {
      h += '<div class="item" onclick="this.classList.toggle(\'open\')"><div class="header"><span class="num">'+(i+1)+'</span><span class="label">'+esc(it.title)+'</span><span class="arrow">\u25BC</span></div><div class="body"><div class="body-inner">'+esc(it.desc)+'</div></div></div>';
    });
    h += '</div></body></html>';

  } else if (sel === "s_tabs") {
    h += '.tab-bar{display:flex;gap:4px;background:rgba(255,255,255,0.6);backdrop-filter:blur(8px);border-radius:12px;padding:4px;margin-bottom:20px;border:1px solid rgba(0,0,0,0.05);animation:fadeUp 0.5s ease 0.1s both;}' +
      '.tab{flex:1;padding:12px 8px;cursor:pointer;font-size:12px;font-weight:600;color:'+b2.txL+';border-radius:10px;text-align:center;transition:all 0.35s cubic-bezier(0.4,0,0.2,1);}' +
      '.tab:hover{color:'+b2.tx+';}' +
      '.tab.active{background:linear-gradient(135deg,'+b2.pri+','+b2.priDk+');color:#fff;box-shadow:0 4px 16px '+b2.pri+'33;}' +
      '.panel{display:none;animation:fadeUp 0.4s ease both;}.panel.active{display:block;}' +
      '.panel-card{background:rgba(255,255,255,0.85);backdrop-filter:blur(8px);border-radius:16px;padding:24px;box-shadow:0 2px 16px rgba(0,0,0,0.05);border:1px solid rgba(0,0,0,0.05);}' +
      '.panel-card p{font-size:13px;color:'+b2.tx+';line-height:1.85;}';
    h += '</style></head><body><div class="container">';
    h += pageHeader+'<div class="tab-bar">';
    items.forEach((it, i) => { h += '<div class="tab'+(i===0?" active":"")+'" onclick="switchTab('+i+')">'+esc(it.title)+'</div>'; });
    h += '</div>';
    items.forEach((it, i) => { h += '<div id="p'+i+'" class="panel'+(i===0?" active":"")+'"><div class="panel-card"><p>'+esc(it.desc)+'</p></div></div>'; });
    h += '' + scTag('function switchTab(idx){document.querySelectorAll(".tab").forEach(function(t,i){t.classList.toggle("active",i===idx);});document.querySelectorAll(".panel").forEach(function(p,i){p.classList.toggle("active",i===idx);});}');
    h += '</div></body></html>';

  } else if (sel === "s_reveal") {
    h += '.reveal-item{margin-bottom:12px;animation:fadeUp 0.5s ease both;}' +
      '.reveal-item:nth-child(1){animation-delay:0.15s}.reveal-item:nth-child(2){animation-delay:0.25s}.reveal-item:nth-child(3){animation-delay:0.35s}' +
      '.reveal-btn{width:100%;padding:16px 22px;border:none;background:rgba(255,255,255,0.85);backdrop-filter:blur(8px);color:'+b2.tx+';font-size:14px;font-weight:600;cursor:pointer;border-radius:14px;text-align:left;display:flex;align-items:center;gap:14px;transition:all 0.3s;box-shadow:0 2px 12px rgba(0,0,0,0.04);border:1px solid rgba(0,0,0,0.05);}' +
      '.reveal-btn:hover{box-shadow:0 4px 20px rgba(0,0,0,0.08);transform:translateY(-1px);}' +
      '.reveal-btn .icon{width:36px;height:36px;background:linear-gradient(135deg,'+b2.priLt+','+b2.pri+'22);border-radius:10px;display:flex;align-items:center;justify-content:center;color:'+b2.pri+';font-size:14px;transition:all 0.4s;flex-shrink:0;}' +
      '.reveal-btn.open .icon{background:linear-gradient(135deg,'+b2.pri+','+b2.priDk+');color:#fff;transform:rotate(90deg);}' +
      '.reveal-content{max-height:0;overflow:hidden;transition:max-height 0.5s cubic-bezier(0.4,0,0.2,1),opacity 0.3s;opacity:0;}' +
      '.reveal-content.open{max-height:300px;opacity:1;}' +
      '.reveal-inner{padding:16px 22px 20px 72px;font-size:13px;color:'+b2.txL+';line-height:1.85;}';
    h += '</style></head><body><div class="container">';
    h += pageHeader;
    items.forEach((it, i) => {
      h += '<div class="reveal-item"><button class="reveal-btn" id="btn'+i+'" onclick="toggleReveal('+i+')"><span class="icon">\u25B6</span>'+esc(it.title)+'</button><div class="reveal-content" id="r'+i+'"><div class="reveal-inner">'+esc(it.desc)+'</div></div></div>';
    });
    h += '' + scTag('function toggleReveal(i){document.getElementById("btn"+i).classList.toggle("open");document.getElementById("r"+i).classList.toggle("open");}');
    h += '</div></body></html>';

  } else if (sel === "s_stepper") {
    h += '.stepper-track{display:flex;align-items:center;margin-bottom:28px;animation:fadeUp 0.5s ease 0.1s both;}' +
      '.step-dot{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:'+b2.txL+';background:rgba(255,255,255,0.8);border:2px solid '+b2.n2+';transition:all 0.4s cubic-bezier(0.4,0,0.2,1);flex-shrink:0;z-index:1;}' +
      '.step-dot.active{background:linear-gradient(135deg,'+b2.pri+','+b2.priDk+');color:#fff;border-color:'+b2.pri+';box-shadow:0 4px 16px '+b2.pri+'44;}' +
      '.step-dot.done{background:'+b2.pri+';color:#fff;border-color:'+b2.pri+';}' +
      '.step-line{flex:1;height:3px;background:'+b2.n2+';position:relative;overflow:hidden;border-radius:2px;}.step-line .fill{position:absolute;top:0;left:0;height:100%;background:linear-gradient(90deg,'+b2.pri+','+b2.priDk+');transition:width 0.5s;width:0;border-radius:2px;}.step-line.done .fill{width:100%;}' +
      '.step-panel{display:none;animation:fadeUp 0.4s ease both;}.step-panel.active{display:block;}' +
      '.step-card{background:rgba(255,255,255,0.85);backdrop-filter:blur(8px);border-radius:16px;padding:24px;box-shadow:0 2px 16px rgba(0,0,0,0.05);border:1px solid rgba(0,0,0,0.05);margin-bottom:20px;}' +
      '.step-card .step-num{font-size:10px;color:'+b2.pri+';font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;}' +
      '.step-card h3{font-size:17px;font-weight:700;color:'+b2.tx+';margin-bottom:8px;}' +
      '.step-card p{font-size:13px;color:'+b2.txL+';line-height:1.85;}' +
      '.step-nav{display:flex;gap:10px;}.step-nav button{padding:12px 28px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.25s;}' +
      '.btn-prev{border:1.5px solid '+b2.n2+';background:rgba(255,255,255,0.8);color:'+b2.txL+';}.btn-prev:hover{border-color:'+b2.pri+';color:'+b2.pri+';}' +
      '.btn-next{border:none;background:linear-gradient(135deg,'+b2.pri+','+b2.priDk+');color:#fff;box-shadow:0 4px 16px '+b2.pri+'33;}.btn-next:hover{transform:translateY(-1px);}';
    h += '</style></head><body><div class="container">';
    h += pageHeader+'<div class="stepper-track">';
    items.forEach((it, i) => {
      h += '<div class="step-dot'+(i===0?' active':'')+'" id="d'+i+'">'+(i+1)+'</div>';
      if (i < items.length-1) h += '<div class="step-line" id="l'+i+'"><div class="fill"></div></div>';
    });
    h += '</div>';
    items.forEach((it, i) => { h += '<div class="step-panel'+(i===0?' active':'')+'" id="s'+i+'"><div class="step-card"><div class="step-num">Step '+(i+1)+' of '+items.length+'</div><h3>'+esc(it.title)+'</h3><p>'+esc(it.desc)+'</p></div></div>'; });
    h += '<div class="step-nav"><button class="btn-prev" onclick="go(-1)">\u2190 Previous</button><button class="btn-next" onclick="go(1)">Next \u2192</button></div>';
    h += '' + scTag('var cur=0,max='+items.length+';function go(d){cur=Math.max(0,Math.min(max-1,cur+d));for(var i=0;i<max;i++){document.getElementById("s"+i).classList.toggle("active",i===cur);var dot=document.getElementById("d"+i);dot.className="step-dot";if(i<cur)dot.classList.add("done");if(i===cur)dot.classList.add("active");if(i<max-1){document.getElementById("l"+i).classList.toggle("done",i<cur);}}}');
    h += '</div></body></html>';

  } else if (sel === "s_stacked") {
    h += '.cards-wrap{display:flex;justify-content:center;align-items:flex-end;min-height:320px;position:relative;padding:20px 10px;}' +
      '.scard{width:150px;min-height:190px;background:'+b2.n1+';border-radius:18px;position:absolute;cursor:pointer;transition:all 0.5s cubic-bezier(0.4,0,0.2,1);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px 16px;text-align:center;border:1px solid rgba(0,0,0,0.04);box-shadow:0 4px 20px rgba(0,0,0,0.06);}' +
      '.scard:hover{box-shadow:0 8px 32px rgba(0,0,0,0.1);transform-origin:bottom center;}' +
      '.scard .s-num{font-size:28px;font-weight:200;color:'+b2.pri+';margin-bottom:10px;opacity:0.6;}' +
      '.scard .s-title{font-size:12px;font-weight:700;color:'+b2.pri+';line-height:1.4;}' +
      '.scard .s-flip{position:absolute;bottom:10px;right:12px;width:22px;height:22px;background:'+b2.n2+';border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;color:'+b2.txL+';transition:all 0.3s;}' +
      '.scard:hover .s-flip{background:'+b2.pri+';color:#fff;}' +
      '.scard.active{width:280px;min-height:auto;z-index:20!important;background:rgba(255,255,255,0.97);backdrop-filter:blur(12px);box-shadow:0 12px 48px rgba(0,0,0,0.15);border:2px dashed '+b2.pri+'44;padding:24px;transform:translateX(0) translateY(-10px) rotate(0deg)!important;}' +
      '.scard.active .s-desc{display:block;}' +
      '.scard.active .s-flip{background:'+b2.pri+';color:#fff;transform:rotate(45deg);}' +
      '.s-desc{display:none;font-size:12px;color:'+b2.txL+';line-height:1.7;margin-top:10px;}';
    h += '</style></head><body><div class="container">';
    h += pageHeader;
    h += '<div class="cards-wrap">';
    const total = items.length;
    const spread = Math.min(total * 85, 420);
    items.forEach((it, i) => {
      const pct = total === 1 ? 0.5 : i / (total - 1);
      const x = -spread/2 + pct * spread;
      const yWave = -Math.sin(pct * Math.PI) * 15;
      const r = (pct - 0.5) * (total <= 3 ? 10 : 14);
      const num = String(i+1).padStart(2, '0');
      const hasImg = it.img && it.img.trim();
      const visual = hasImg ? '<img src="'+esc(it.img)+'" style="width:48px;height:48px;object-fit:contain;margin-bottom:10px;border-radius:8px;"/>' : '<div class="s-num">'+num+'</div>';
      h += '<div class="scard" style="transform:translateX('+x.toFixed(0)+'px) translateY('+yWave.toFixed(0)+'px) rotate('+r.toFixed(1)+'deg);z-index:'+(10+i)+';" onclick="var c=this;if(c.classList.contains(\'active\')){c.classList.remove(\'active\');}else{document.querySelectorAll(\'.scard\').forEach(function(s){s.classList.remove(\'active\');});c.classList.add(\'active\');}">';
      h += visual;
      h += '<div class="s-title">'+esc(it.title)+'</div>';
      h += '<div class="s-desc">'+esc(it.desc)+'</div>';
      h += '<div class="s-flip">+</div></div>';
    });
    h += '</div></div></body></html>';

  } else if (sel === "s_sort") {
    h += '.sort-card{background:rgba(255,255,255,0.85);backdrop-filter:blur(8px);border-radius:16px;padding:24px;box-shadow:0 2px 16px rgba(0,0,0,0.05);border:1px solid rgba(0,0,0,0.05);animation:scaleIn 0.5s ease 0.2s both;}' +
      '.item{padding:14px 18px;margin-bottom:8px;border:2px solid rgba(0,0,0,0.06);border-radius:12px;background:rgba(255,255,255,0.9);font-size:13px;font-weight:500;color:'+b2.tx+';cursor:grab;display:flex;align-items:center;gap:12px;transition:all 0.25s;user-select:none;}' +
      '.item:hover{border-color:'+b2.pri+';box-shadow:0 4px 16px rgba(0,0,0,0.06);}' +
      '.item:active{cursor:grabbing;transform:scale(1.02);box-shadow:0 8px 24px rgba(0,0,0,0.1);}' +
      '.num{width:28px;height:28px;background:linear-gradient(135deg,'+b2.pri+','+b2.priDk+');border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0;}' +
      '.grip{color:'+b2.n2+';font-size:18px;margin-left:auto;}.item:hover .grip{color:'+b2.pri+';}' +
      '.check-btn{margin-top:16px;padding:12px 28px;border:none;background:linear-gradient(135deg,'+b2.pri+','+b2.priDk+');color:#fff;font-size:13px;font-weight:600;border-radius:10px;cursor:pointer;box-shadow:0 4px 16px '+b2.pri+'33;transition:all 0.25s;}.check-btn:hover{transform:translateY(-1px);}' +
      '.feedback{margin-top:14px;padding:14px 18px;border-radius:12px;font-size:13px;font-weight:600;display:none;animation:scaleIn 0.3s ease;}.feedback.show{display:block;}' +
      '.item.correct-pos{border-color:'+b2.pri+';background:'+b2.priLt+';}';
    h += '</style></head><body><div class="container">';
    h += pageHeader;
    h += '<div class="sort-card"><div class="instruction">Drag and drop to reorder, then check your answer</div><div id="list">';
    const shuffled = shuffle(items);
    shuffled.forEach((it, i) => {
      h += '<div class="item" draggable="true" data-correct="'+items.indexOf(it)+'" ondragstart="ds(event)" ondragover="event.preventDefault()" ondrop="dp(event,this)"><span class="num">'+(i+1)+'</span>'+esc(it.title)+'<span class="grip">\u2807</span></div>';
    });
    h += '</div><button class="check-btn" onclick="checkSort()">Check Order</button><div class="feedback" id="fb"></div></div>';
    h += '' + scTag('var dragEl=null;function ds(e){dragEl=e.target.closest(".item");e.dataTransfer.effectAllowed="move";}function dp(e,target){e.preventDefault();var t=target.closest(".item");if(!t||t===dragEl)return;var list=document.getElementById("list");var items=Array.from(list.children);var di=items.indexOf(dragEl),ti=items.indexOf(t);if(di<ti)list.insertBefore(dragEl,t.nextSibling);else list.insertBefore(dragEl,t);renum();}function renum(){document.querySelectorAll(".item .num").forEach(function(n,i){n.textContent=i+1;});}function checkSort(){var items=Array.from(document.querySelectorAll(".item"));var correct=items.every(function(el,i){return parseInt(el.dataset.correct)===i;});var fb=document.getElementById("fb");fb.classList.add("show");items.forEach(function(el,i){el.classList.toggle("correct-pos",parseInt(el.dataset.correct)===i);});if(correct){fb.textContent="\\u2705 Perfect order!";fb.style.background="'+b2.priLt+'";fb.style.color="'+b2.priDk+'";}else{fb.textContent="\\u274c Not quite. Green items are correctly placed.";fb.style.background="#fef2f2";fb.style.color="#c0392b";}}');
    h += '</div></body></html>';

  } else if (sel === "s_match") {
    h += '.match-card{background:rgba(255,255,255,0.85);backdrop-filter:blur(8px);border-radius:16px;padding:24px;box-shadow:0 2px 16px rgba(0,0,0,0.05);border:1px solid rgba(0,0,0,0.05);animation:scaleIn 0.5s ease 0.2s both;}' +
      '.cols{display:flex;gap:16px;}.col{flex:1;}' +
      '.col-head{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:'+b2.txL+';margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid '+b2.n2+';}' +
      '.term,.def{padding:12px 16px;margin-bottom:8px;border:2px solid rgba(0,0,0,0.06);border-radius:10px;font-size:12px;font-weight:500;cursor:pointer;transition:all 0.3s;background:rgba(255,255,255,0.9);color:'+b2.tx+';}' +
      '.term:hover,.def:hover{border-color:'+b2.pri+';transform:translateX(2px);}' +
      '.term.selected{border-color:'+b2.pri+';background:'+b2.priLt+';box-shadow:0 0 0 3px '+b2.pri+'22;}' +
      '.term.matched,.def.matched{border-color:'+b2.pri+';background:'+b2.priLt+';opacity:0.6;pointer-events:none;}' +
      '.term.matched::after{content:"\\2713";position:absolute;right:12px;top:50%;transform:translateY(-50%);color:'+b2.pri+';font-weight:700;}' +
      '.term.matched{position:relative;}' +
      '.feedback{margin-top:14px;padding:12px 16px;border-radius:10px;font-size:12px;font-weight:600;text-align:center;display:none;animation:scaleIn 0.3s ease;}.feedback.show{display:block;}';
    h += '</style></head><body><div class="container">';
    h += pageHeader;
    h += '<div class="match-card"><div class="instruction">Select a term, then click its matching definition</div><div class="cols"><div class="col"><div class="col-head">Terms</div>';
    items.forEach((it, i) => { h += '<div class="term" data-idx="'+i+'" onclick="pickTerm(this)">'+esc(it.title)+'</div>'; });
    h += '</div><div class="col"><div class="col-head">Definitions</div>';
    const shuffDefs = shuffle(items);
    shuffDefs.forEach(it => {
      const origIdx = items.indexOf(it);
      h += '<div class="def" data-idx="'+origIdx+'" onclick="pickDef(this)">'+esc(it.desc)+'</div>';
    });
    h += '</div></div><div class="feedback" id="fb"></div></div>';
    h += '' + scTag('var selTerm=null,matched=0,total='+items.length+';function pickTerm(el){if(el.classList.contains("matched"))return;document.querySelectorAll(".term").forEach(function(t){t.classList.remove("selected");});el.classList.add("selected");selTerm=el;}function pickDef(el){if(!selTerm||el.classList.contains("matched"))return;var fb=document.getElementById("fb");fb.classList.add("show");if(selTerm.dataset.idx===el.dataset.idx){selTerm.classList.remove("selected");selTerm.classList.add("matched");el.classList.add("matched");matched++;selTerm=null;if(matched===total){fb.textContent="\\u2705 All matched! Great work.";fb.style.background="'+b2.priLt+'";fb.style.color="'+b2.priDk+'";}else{fb.textContent="\\u2705 Correct! "+(total-matched)+" remaining.";fb.style.background="'+b2.priLt+'";fb.style.color="'+b2.priDk+'";}}else{fb.textContent="\\u274c Not a match. Try again.";fb.style.background="#fef2f2";fb.style.color="#c0392b";}}');
    h += '</div></body></html>';

  } else if (sel === "s_timeline_i") {
    h += '.tl{position:relative;padding-left:48px;}' +
      '.tl-line{position:absolute;left:22px;top:8px;bottom:8px;width:3px;background:linear-gradient(180deg,'+b2.pri+'22,'+b2.pri+','+b2.pri+'22);border-radius:2px;}' +
      '.tl-item{position:relative;margin-bottom:14px;cursor:pointer;animation:fadeUp 0.5s ease both;transition:transform 0.2s;}' +
      '.tl-item:nth-child(2){animation-delay:0.15s}.tl-item:nth-child(3){animation-delay:0.25s}.tl-item:nth-child(4){animation-delay:0.35s}.tl-item:nth-child(5){animation-delay:0.45s}' +
      '.tl-item:hover{transform:translateX(4px);}' +
      '.tl-dot{position:absolute;left:-36px;top:16px;width:18px;height:18px;background:#fff;border:3px solid '+b2.n2+';border-radius:50%;transition:all 0.4s cubic-bezier(0.4,0,0.2,1);z-index:1;}' +
      '.tl-item.active .tl-dot{background:'+b2.pri+';border-color:'+b2.pri+';box-shadow:0 0 0 5px '+b2.pri+'22;}' +
      '.tl-card{background:rgba(255,255,255,0.85);backdrop-filter:blur(8px);border-radius:14px;padding:18px 20px;box-shadow:0 2px 12px rgba(0,0,0,0.04);border:1px solid rgba(0,0,0,0.05);transition:all 0.3s;}' +
      '.tl-item.active .tl-card{border-color:'+b2.pri+'33;box-shadow:0 4px 20px rgba(0,0,0,0.08);}' +
      '.tl-title{font-size:14px;font-weight:700;color:'+b2.tx+';transition:color 0.3s;}' +
      '.tl-item.active .tl-title{color:'+b2.pri+';}' +
      '.tl-desc{font-size:12px;color:'+b2.txL+';line-height:1.7;max-height:0;overflow:hidden;transition:max-height 0.5s cubic-bezier(0.4,0,0.2,1),opacity 0.3s,margin 0.3s;opacity:0;margin-top:0;}' +
      '.tl-item.active .tl-desc{max-height:200px;opacity:1;margin-top:8px;}';
    h += '</style></head><body><div class="container">';
    h += pageHeader;
    h += '<div class="tl"><div class="tl-line"></div>';
    items.forEach((it, i) => {
      h += '<div class="tl-item'+(i===0?' active':'')+'" onclick="toggleTL(this)"><div class="tl-dot"></div><div class="tl-card"><div class="tl-title">'+esc(it.title)+'</div><div class="tl-desc">'+esc(it.desc)+'</div></div></div>';
    });
    h += '</div>' + scTag('function toggleTL(el){el.classList.toggle("active");}');
    h += '</div></body></html>';

  } else if (sel === "s_cycle") {
    const n = items.length;
    const radius = 130;
    h += '.cycle-wrap{position:relative;width:340px;height:340px;margin:0 auto;}' +
      '.cycle-ring{position:absolute;inset:40px;border-radius:50%;border:4px solid '+b2.n2+';background:rgba(255,255,255,0.5);}' +
      '.cycle-center{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;z-index:5;pointer-events:none;width:120px;}' +
      '.cycle-center .cc-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:'+b2.pri+';margin-bottom:4px;}' +
      '.cycle-center .cc-count{font-size:11px;color:'+b2.txL+';}' +
      '.node{position:absolute;width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,'+b2.pri+','+b2.priDk+');cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.4s cubic-bezier(0.4,0,0.2,1);z-index:10;border:3px solid #fff;box-shadow:0 4px 20px '+b2.pri+'33;animation:dotPop 0.5s ease both;}' +
      '.node:nth-child(1){animation-delay:0.1s}.node:nth-child(2){animation-delay:0.2s}.node:nth-child(3){animation-delay:0.25s}.node:nth-child(4){animation-delay:0.35s}' +
      '.node:hover{transform-origin:center;box-shadow:0 6px 28px '+b2.pri+'55;}' +
      '.node .n-icon{font-size:24px;filter:brightness(10);transition:transform 0.3s;}' +
      '.node.active{background:#fff;border-color:'+b2.pri+';box-shadow:0 0 0 5px '+b2.pri+'22,0 8px 32px rgba(0,0,0,0.12);}' +
      '.node.active .n-icon{filter:none;}' +
      '.node-label{position:absolute;font-size:11px;font-weight:700;color:'+b2.tx+';text-align:center;width:100px;pointer-events:none;transition:color 0.3s;}' +
      '.node.active~.node-label,.active-label{color:'+b2.pri+';}' +
      '.detail-panel{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:180px;background:rgba(255,255,255,0.95);backdrop-filter:blur(12px);border-radius:14px;padding:16px 18px;box-shadow:0 8px 32px rgba(0,0,0,0.12);border:1px solid rgba(0,0,0,0.05);z-index:15;display:none;animation:scaleIn 0.3s ease;}' +
      '.detail-panel.show{display:block;}' +
      '.detail-panel .dp-icon{font-size:22px;margin-bottom:6px;}' +
      '.detail-panel .dp-title{font-size:13px;font-weight:700;color:'+b2.pri+';margin-bottom:6px;}' +
      '.detail-panel .dp-desc{font-size:11px;color:'+b2.txL+';line-height:1.7;}' +
      '.arrow-hint{position:absolute;font-size:22px;color:'+b2.n2+';pointer-events:none;animation:fadeIn 1s ease 0.5s both;}';
    h += '</style></head><body><div class="container">';
    h += pageHeader;
    h += '<div class="cycle-wrap"><div class="cycle-ring"></div>';
    h += '<div class="cycle-center"><div class="cc-title">Cycle</div><div class="cc-count">'+n+' stages</div></div>';
    // Place curved arrows between nodes
    h += '<div class="arrow-hint" style="top:38px;left:50%;transform:translateX(-50%) rotate(90deg);">\u27F3</div>';
    items.forEach((it, i) => {
      const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
      const cx = 170 + radius * Math.cos(angle) - 36;
      const cy = 170 + radius * Math.sin(angle) - 36;
      const lx = 170 + (radius + 52) * Math.cos(angle) - 50;
      const ly = 170 + (radius + 52) * Math.sin(angle) - 8;
      h += '<div class="node" id="nd'+i+'" style="left:'+cx+'px;top:'+cy+'px;" onclick="toggleNode('+i+')"><span class="n-icon">'+(it.icon || '\u25C9')+'</span></div>';
      h += '<div class="node-label" id="nl'+i+'" style="left:'+lx+'px;top:'+ly+'px;">'+esc(it.title)+'</div>';
    });
    h += '<div class="detail-panel" id="dp"><div class="dp-icon" id="dpi"></div><div class="dp-title" id="dpt"></div><div class="dp-desc" id="dpd"></div></div>';
    h += '</div></div>';
    h += '' + scTag('var data='+JSON.stringify(items.map(it=>({title:it.title,icon:it.icon||'\u25C9',desc:it.desc||''})))+';var activeNode=-1;function toggleNode(i){var nodes=document.querySelectorAll(".node");var dp=document.getElementById("dp");if(activeNode===i){nodes[i].classList.remove("active");dp.classList.remove("show");activeNode=-1;}else{nodes.forEach(function(n){n.classList.remove("active");});nodes[i].classList.add("active");document.getElementById("dpi").textContent=data[i].icon;document.getElementById("dpt").textContent=data[i].title;document.getElementById("dpd").textContent=data[i].desc;dp.classList.add("show");activeNode=i;}}');
    h += '</body></html>';

  } else if (sel === "s_quiz") {
    const question = items[0] ? items[0].title : "Question goes here?";
    const opts = items.slice(1);
    const correctIdx = opts.findIndex(o => o.desc === "1");
    h += '.quiz-wrap{background:rgba(255,255,255,0.92);backdrop-filter:blur(10px);border-radius:18px;padding:28px;box-shadow:0 4px 24px rgba(0,0,0,0.07);border:1px solid rgba(0,0,0,0.05);animation:fadeUp 0.5s ease 0.1s both;}'
      + '.question{font-size:17px;font-weight:400;color:'+b2.tx+';line-height:1.55;margin-bottom:22px;padding-bottom:18px;border-bottom:1px solid '+b2.n2+';}'
      + '.opt{padding:13px 18px;margin-bottom:10px;border:2px solid rgba(0,0,0,0.07);border-radius:12px;font-size:13px;font-weight:500;color:'+b2.tx+';cursor:pointer;display:flex;align-items:center;gap:12px;transition:all 0.25s;background:rgba(255,255,255,0.8);}'
      + '.opt:hover{border-color:'+b2.pri+';background:'+b2.priLt+';}'
      + '.opt.sel{border-color:'+b2.pri+';background:'+b2.priLt+';}'
      + '.opt.correct{border-color:#22c55e;background:#f0fdf4;color:#15803d;}'
      + '.opt.wrong{border-color:#ef4444;background:#fef2f2;color:#b91c1c;}'
      + '.radio{width:18px;height:18px;border:2px solid '+b2.n2+';border-radius:50%;flex-shrink:0;transition:all 0.2s;display:flex;align-items:center;justify-content:center;}'
      + '.opt.sel .radio,.opt.correct .radio{border-color:#22c55e;background:#22c55e;}'
      + '.opt.wrong .radio{border-color:#ef4444;background:#ef4444;}'
      + '.radio-dot{width:7px;height:7px;border-radius:50%;background:#fff;display:none;}'
      + '.opt.sel .radio-dot,.opt.correct .radio-dot,.opt.wrong .radio-dot{display:block;}'
      + '.chk-btn{margin-top:18px;padding:12px 28px;border:none;background:linear-gradient(135deg,'+b2.pri+','+b2.priDk+');color:#fff;font-size:13px;font-weight:600;border-radius:10px;cursor:pointer;box-shadow:0 4px 14px '+b2.pri+'33;transition:all 0.2s;}'
      + '.chk-btn:hover{transform:translateY(-1px);}.chk-btn:disabled{opacity:0.4;cursor:not-allowed;transform:none;}'
      + '.explanation{margin-top:14px;padding:14px 18px;background:'+b2.priLt+';border-radius:10px;border-left:3px solid '+b2.pri+';font-size:12px;color:'+b2.tx+';line-height:1.7;display:none;animation:fadeUp 0.4s ease;}'
      + '.explanation.show{display:block;}'
      + '.res-badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;margin-bottom:8px;}'
      + '.res-ok{background:#f0fdf4;color:#15803d;border:1.5px solid #22c55e;}'
      + '.res-no{background:#fef2f2;color:#b91c1c;border:1.5px solid #ef4444;}';
    h += '</style></head><body><div class="container">';
    h += pageHeader;
    h += '<div class="quiz-wrap"><div class="question">'+esc(question)+'</div>';
    opts.forEach((o,i) => { h += '<div class="opt" id="o'+i+'" onclick="pickOpt('+i+')"><span class="radio"><span class="radio-dot"></span></span>'+esc(o.title)+'</div>'; });
    h += '<button class="chk-btn" id="chkBtn" onclick="checkAns()" disabled>Check Answer</button>';
    h += '<div class="explanation" id="expl"><div id="resBadge" class="res-badge"></div><div>'+(compBody?esc(compBody):"")+'</div></div></div>';
    h += scTag('var sel=-1,cor='+correctIdx+',done=false;function pickOpt(i){if(done)return;document.querySelectorAll(".opt").forEach(function(o){o.classList.remove("sel");});document.getElementById("o"+i).classList.add("sel");sel=i;document.getElementById("chkBtn").disabled=false;}function checkAns(){if(sel<0||done)return;done=true;document.getElementById("chkBtn").disabled=true;document.querySelectorAll(".opt").forEach(function(o,i){if(i===cor)o.classList.add("correct");else if(i===sel&&i!==cor)o.classList.add("wrong");});var ex=document.getElementById("expl");ex.classList.add("show");var b=document.getElementById("resBadge");if(sel===cor){b.textContent="\u2713 Correct!";b.className="res-badge res-ok";}else{b.textContent="\u2717 Not quite";b.className="res-badge res-no";}}');
    h += '</div></body></html>';

  } else if (sel === "s_poll") {
    const pcts = items.map(it => parseInt(it.desc)||25);
    h += '.poll-wrap{background:rgba(255,255,255,0.92);backdrop-filter:blur(10px);border-radius:18px;padding:28px;box-shadow:0 4px 24px rgba(0,0,0,0.07);border:1px solid rgba(0,0,0,0.05);animation:fadeUp 0.5s ease 0.1s both;}'
      + '.poll-opt{padding:13px 18px;margin-bottom:10px;border:2px solid rgba(0,0,0,0.07);border-radius:12px;font-size:13px;font-weight:500;color:'+b2.tx+';cursor:pointer;transition:all 0.25s;background:rgba(255,255,255,0.8);}'
      + '.poll-opt:hover{border-color:'+b2.pri+';transform:translateX(3px);}'
      + '.poll-opt.sel{border-color:'+b2.pri+';background:'+b2.priLt+';}'
      + '.vote-btn{margin-top:18px;padding:12px 28px;border:none;background:linear-gradient(135deg,'+b2.pri+','+b2.priDk+');color:#fff;font-size:13px;font-weight:600;border-radius:10px;cursor:pointer;box-shadow:0 4px 14px '+b2.pri+'33;transition:all 0.2s;}'
      + '.vote-btn:hover{transform:translateY(-1px);}.vote-btn:disabled{opacity:0.4;cursor:not-allowed;transform:none;}'
      + '.results{display:none;animation:fadeUp 0.4s ease;}.results.show{display:block;}'
      + '.rhead{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:'+b2.txL+';margin-bottom:16px;}'
      + '.rrow{margin-bottom:14px;}'
      + '.rlabel{font-size:12px;font-weight:600;color:'+b2.tx+';margin-bottom:6px;display:flex;justify-content:space-between;}'
      + '.rtrack{height:10px;background:'+b2.n2+';border-radius:6px;overflow:hidden;}'
      + '.rbar{height:100%;border-radius:6px;width:0;transition:width 0.8s cubic-bezier(0.4,0,0.2,1);background:linear-gradient(90deg,'+b2.pri+','+b2.priDk+');}'
      + '.rrow.myvote .rbar{background:linear-gradient(90deg,'+b2.priDk+','+b2.pri+');}'
      + '.rrow.myvote .rlabel{color:'+b2.pri+';}';
    h += '</style></head><body><div class="container">';
    h += pageHeader;
    h += '<div class="poll-wrap"><div id="vphase">';
    items.forEach((it,i) => { h += '<div class="poll-opt" id="po'+i+'" onclick="pickPoll('+i+')">'+esc(it.title)+'</div>'; });
    h += '<button class="vote-btn" id="vbtn" onclick="doVote()" disabled>Submit Vote</button></div>';
    h += '<div class="results" id="rphase"><div class="rhead">Results</div>';
    items.forEach((it,i) => {
      h += '<div class="rrow" id="rr'+i+'"><div class="rlabel"><span>'+esc(it.title)+'</span><span id="rpct'+i+'">'+pcts[i]+'%</span></div><div class="rtrack"><div class="rbar" id="rb'+i+'"></div></div></div>';
    });
    h += '</div></div>';
    h += scTag('var sp=-1,voted=false,pcts='+JSON.stringify(pcts)+';function pickPoll(i){if(voted)return;document.querySelectorAll(".poll-opt").forEach(function(o){o.classList.remove("sel");});document.getElementById("po"+i).classList.add("sel");sp=i;document.getElementById("vbtn").disabled=false;}function doVote(){if(sp<0||voted)return;voted=true;document.getElementById("vphase").style.display="none";var rp=document.getElementById("rphase");rp.classList.add("show");setTimeout(function(){pcts.forEach(function(p,i){document.getElementById("rb"+i).style.width=p+"%";if(i===sp)document.getElementById("rr"+i).classList.add("myvote");});},80);}');
    h += '</div></body></html>';

  } else {
    h += '</style></head><body><div class="container"><div style="padding:40px;text-align:center;"><p style="font-size:16px;font-weight:600;color:'+b2.tx+';margin-bottom:8px;">'+esc(compTitle)+'</p><p style="color:'+b2.txL+';">This interactive component is coming soon.</p></div></div></body></html>';
  }
  return h;
}

/* ── Inline ZIP creator (no external dependencies) ── */
function createZip(files) {
  // Minimal ZIP file creator - supports storing uncompressed files
  function str2buf(s) { var b = new Uint8Array(s.length); for (var i=0;i<s.length;i++) b[i]=s.charCodeAt(i)&0xff; return b; }
  function crc32(buf) {
    var table = new Uint32Array(256);
    for (var i=0;i<256;i++) { var c=i; for(var j=0;j<8;j++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1); table[i]=c; }
    var crc = 0xFFFFFFFF;
    for (var i=0;i<buf.length;i++) crc = table[(crc^buf[i])&0xFF]^(crc>>>8);
    return (crc^0xFFFFFFFF)>>>0;
  }
  function u16(v) { return [v&0xff,(v>>8)&0xff]; }
  function u32(v) { return [v&0xff,(v>>8)&0xff,(v>>16)&0xff,(v>>24)&0xff]; }

  var localHeaders = [], centralHeaders = [], offset = 0;
  var encoder = new TextEncoder();

  files.forEach(function(f) {
    var nameBytes = encoder.encode(f.name);
    var dataBytes = encoder.encode(f.content);
    var crc = crc32(dataBytes);
    var local = new Uint8Array([].concat(
      [0x50,0x4b,0x03,0x04], u16(20), u16(0), u16(0),
      u16(0), u16(0),
      u32(crc), u32(dataBytes.length), u32(dataBytes.length),
      u16(nameBytes.length), u16(0)
    ));
    var entry = new Uint8Array(local.length + nameBytes.length + dataBytes.length);
    entry.set(local, 0);
    entry.set(nameBytes, local.length);
    entry.set(dataBytes, local.length + nameBytes.length);
    localHeaders.push(entry);

    var central = new Uint8Array([].concat(
      [0x50,0x4b,0x01,0x02], u16(20), u16(20), u16(0), u16(0),
      u16(0), u16(0),
      u32(crc), u32(dataBytes.length), u32(dataBytes.length),
      u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0),
      u32(0x20), u32(offset)
    ));
    var centEntry = new Uint8Array(central.length + nameBytes.length);
    centEntry.set(central, 0);
    centEntry.set(nameBytes, central.length);
    centralHeaders.push(centEntry);
    offset += entry.length;
  });

  var centralOffset = offset;
  var centralSize = centralHeaders.reduce(function(a,b){return a+b.length;},0);
  var eocd = new Uint8Array([].concat(
    [0x50,0x4b,0x05,0x06], u16(0), u16(0),
    u16(files.length), u16(files.length),
    u32(centralSize), u32(centralOffset),
    u16(0)
  ));

  var totalSize = offset + centralSize + eocd.length;
  var result = new Uint8Array(totalSize);
  var pos = 0;
  localHeaders.forEach(function(h) { result.set(h, pos); pos += h.length; });
  centralHeaders.forEach(function(h) { result.set(h, pos); pos += h.length; });
  result.set(eocd, pos);
  return new Blob([result], {type:"application/zip"});
}

/* ── SCORM Download ── */
function downloadSCORM(sel, data, brand) {
  const title = data.title || SCORM_COMPS.find(c => c.id === sel)?.n || "Activity";
  const htmlContent = genSCORMhtml(sel, data, brand);
  const imsXml = '<?xml version="1.0" encoding="UTF-8"?><manifest identifier="BCG_SCORM" version="1.0" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"><metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata><organizations default="org1"><organization identifier="org1"><title>'+esc(title)+'</title><item identifier="item1" identifierref="res1"><title>'+esc(title)+'</title></item></organization></organizations><resources><resource identifier="res1" type="webcontent" adlcp:scormtype="sco" href="index.html"><file href="index.html"/></resource></resources></manifest>';

  var blob = createZip([
    { name: "index.html", content: htmlContent },
    { name: "imsmanifest.xml", content: imsXml }
  ]);
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = title.replace(/\s+/g, "_") + "_SCORM.zip";
  a.click();
}

/* ── Brand Switcher ── */
function BrandSwitch({ brand, setBrand, size = "md" }) {
  const pad = size === "sm" ? "5px 12px" : "8px 18px";
  const fs = size === "sm" ? 11 : 12;
  return (
    <div style={{ display:"flex", background:"#f0f0f0", borderRadius: size === "sm" ? 6 : 8, overflow:"hidden" }}>
      {Object.entries(B).map(([k, v]) => (
        <button key={k} onClick={() => setBrand(k)} style={{ padding: pad, border:"none", cursor:"pointer", fontSize: fs, fontWeight:600, background: brand === k ? v.pri : "transparent", color: brand === k ? "#fff" : "#888", transition:"all 0.15s" }}>
          {v.n}
        </button>
      ))}
    </div>
  );
}

/* ── Main App ── */
export default function App() {
  const [brand, setBrand] = useState("bcg");
  const [mode, setMode] = useState(null);
  const [sel, setSel] = useState(null);
  const [data, setData] = useState(null);
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);
  const [scormPreview, setScormPreview] = useState("");
  const [search, setSearch] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResults, setAiResults] = useState(null);
  const b = B[brand];

  async function aiGenerate() {
    if (!aiPrompt.trim() || aiLoading) return;
    setAiLoading(true);
    setAiResults(null);
    try {
      const allComps = [...HTML_COMPS.map(c=>({...c,t:"html"})), ...SCORM_COMPS.map(c=>({...c,t:"scorm"}))];
      const compList = allComps.map(c => c.id + ": " + c.n + " (" + c.d + ") [" + c.t.toUpperCase() + "]").join("\n");

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `You are a NovoEd course content generator. Given a user request, generate content for the BEST matching component(s).

Available components:
${compList}

User request: "${aiPrompt}"

Respond ONLY with a JSON object (no markdown, no backticks, no preamble):
{
  "suggestions": [
    {
      "component_id": "the component id",
      "component_type": "html or scorm",
      "component_name": "name",
      "why": "one line why this fits",
      "data": { the component data matching its DEFAULTS structure exactly }
    }
  ]
}

Generate 2-3 suggestions with the best matching components. For items arrays, generate 3-5 items with realistic, professional content based on the user's request. Include title and body fields for SCORM components. Keep content concise and BCG-professional in tone.`
          }]
        })
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

  function applyAiSuggestion(suggestion) {
    const compType = suggestion.component_type;
    const compId = suggestion.component_id;
    setMode(compType);
    setSel(compId);
    const d = JSON.parse(JSON.stringify(suggestion.data));
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

  function doSelect(id) {
    setSel(id);
    const d = JSON.parse(JSON.stringify(DEFAULTS[id] || {}));
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
  if (!mode) return (
    <div style={{ maxWidth:880, margin:"0 auto", padding:"0 16px 20px", fontFamily:"'Trebuchet MS', system-ui, sans-serif", color:b.tx }}>
      {/* Banner with abstract SVG art */}
      <div style={{ background:b.grad, padding:"36px 40px", marginBottom:24, position:"relative", overflow:"hidden" }}>
        <svg style={{ position:"absolute", top:0, right:0, width:320, height:"100%", opacity:0.12 }} viewBox="0 0 320 200" fill="none"><circle cx="280" cy="40" r="80" fill="#fff"/><circle cx="220" cy="160" r="50" fill="#fff"/><circle cx="320" cy="140" r="60" fill="#fff"/><rect x="160" y="20" width="40" height="40" rx="10" fill="#fff" transform="rotate(20 180 40)"/><rect x="240" y="100" width="30" height="30" rx="8" fill="#fff" transform="rotate(-15 255 115)"/><polygon points="180,80 200,60 220,80" fill="#fff" opacity="0.6"/><polygon points="260,50 280,30 300,50 290,70 270,70" fill="#fff" opacity="0.4"/></svg>
        <div style={{ position:"relative", zIndex:1 }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:2.5, color:"rgba(255,255,255,0.7)", marginBottom:8 }}>BCG U × NovoEd</div>
          <div style={{ fontSize:28, fontWeight:200, color:"#fff", lineHeight:1.3, marginBottom:6 }}>Component Toolkit</div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.8)", lineHeight:1.6, maxWidth:500 }}>Design and generate professional HTML components and interactive SCORM activities for NovoEd courses — no coding required.</div>
        </div>
      </div>

      {/* Search + Brand row */}
      <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:20 }}>
        <div style={{ flex:1, position:"relative" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search components..." style={{ width:"100%", padding:"9px 14px 9px 32px", border:"1.5px solid "+b.n2, borderRadius:8, fontSize:12, outline:"none", background:"#fff" }} onFocus={e => e.target.style.borderColor=b.pri} onBlur={e => { setTimeout(() => { if(!document.activeElement.closest('.sr')) setSearch(""); }, 200); e.target.style.borderColor=b.n2; }} />
          <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", fontSize:13, color:"#bbb" }}>⌕</span>
          {search && (() => {
            const sq = search.toLowerCase();
            const all = [...HTML_COMPS.map(c=>({...c,t:"HTML"})), ...SCORM_COMPS.map(c=>({...c,t:"SCORM"}))];
            const hits = all.filter(c => c.n.toLowerCase().includes(sq) || c.d.toLowerCase().includes(sq));
            return hits.length > 0 ? (
              <div className="sr" style={{ position:"absolute", top:"100%", left:0, right:0, marginTop:4, background:"#fff", border:"1.5px solid "+b.n2, borderRadius:10, boxShadow:"0 8px 24px rgba(0,0,0,0.1)", zIndex:50, maxHeight:240, overflow:"auto" }}>
                {hits.slice(0,8).map(c => (
                  <div key={c.id} style={{ padding:"10px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:10, borderBottom:"1px solid "+b.n1 }} onClick={() => { setMode(c.t === "HTML" ? "html" : "scorm"); doSelect(c.id); setSearch(""); }} onMouseEnter={e => e.currentTarget.style.background=b.n1} onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                    <span style={{ fontSize:14, color:b.pri }}>{c.ic}</span>
                    <div>
                      <div style={{ fontSize:12, fontWeight:600, color:b.tx }}>{c.n}</div>
                      <div style={{ fontSize:10, color:"#999" }}>{c.d}</div>
                    </div>
                    <span style={{ marginLeft:"auto", fontSize:9, padding:"2px 6px", background:c.t==="HTML"?b.priLt:"#FFF8E6", color:c.t==="HTML"?b.pri:"#856404", borderRadius:4, fontWeight:600 }}>{c.t}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="sr" style={{ position:"absolute", top:"100%", left:0, right:0, marginTop:4, background:"#fff", border:"1.5px solid "+b.n2, borderRadius:10, boxShadow:"0 8px 24px rgba(0,0,0,0.1)", zIndex:50, padding:"16px", textAlign:"center", fontSize:11, color:"#999" }}>
                No components match "{search}"
              </div>
            );
          })()}
        </div>
        <BrandSwitch brand={brand} setBrand={setBrand} />
      </div>

      {/* AI Content Generator */}
      <div style={{ marginBottom:24, padding:"20px 22px", background:"#fff", borderRadius:14, border:"1.5px solid "+b.n2, boxShadow:"0 2px 12px rgba(0,0,0,0.03)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
          <div style={{ width:32, height:32, background:b.grad, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, color:"#fff" }}>⚡</div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:b.tx }}>AI Content Generator</div>
            <div style={{ fontSize:10, color:"#999" }}>Describe what you need — AI will create the component for you</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} onKeyDown={e => { if(e.key==="Enter") aiGenerate(); }} placeholder='e.g. "Create a 4-step process for AI adoption" or "Flip cards explaining RAG, LLM, and Fine-tuning"' style={{ flex:1, padding:"10px 14px", border:"1.5px solid "+b.n2, borderRadius:8, fontSize:12, outline:"none" }} onFocus={e=>e.target.style.borderColor=b.pri} onBlur={e=>e.target.style.borderColor=b.n2} />
          <button onClick={aiGenerate} disabled={aiLoading} style={{ padding:"10px 20px", borderRadius:8, border:"none", background:aiLoading?"#ccc":b.grad, color:"#fff", fontSize:12, fontWeight:600, cursor:aiLoading?"wait":"pointer", whiteSpace:"nowrap", transition:"all 0.2s" }} onMouseEnter={e=>{if(!aiLoading){e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.15)";}}} onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
            {aiLoading ? "Generating..." : "Generate ⚡"}
          </button>
        </div>

        {/* AI Results */}
        {aiLoading && (
          <div style={{ marginTop:16, textAlign:"center", padding:20 }}>
            <div style={{ fontSize:12, color:b.pri, fontWeight:600 }}>Creating your components...</div>
            <div style={{ fontSize:11, color:"#999", marginTop:4 }}>AI is analyzing your request and generating content</div>
          </div>
        )}
        {aiResults && aiResults.length === 0 && (
          <div style={{ marginTop:12, padding:12, background:b.n1, borderRadius:8, fontSize:11, color:"#999", textAlign:"center" }}>
            Couldn't generate results. Try rephrasing your request.
          </div>
        )}
        {aiResults && aiResults.length > 0 && (
          <div style={{ marginTop:14 }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#aaa", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>AI Suggestions — click to use</div>
            {aiResults.map((s, i) => (
              <div key={i} onClick={() => applyAiSuggestion(s)} style={{ padding:"14px 16px", background:b.n1, borderRadius:10, marginBottom:8, cursor:"pointer", border:"1.5px solid transparent", transition:"all 0.2s" }} onMouseEnter={e=>{e.currentTarget.style.borderColor=b.pri;e.currentTarget.style.background=b.priLt;}} onMouseLeave={e=>{e.currentTarget.style.borderColor="transparent";e.currentTarget.style.background=b.n1;}}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                  <span style={{ fontSize:9, padding:"2px 6px", background:s.component_type==="html"?b.priLt:"#FFF8E6", color:s.component_type==="html"?b.pri:"#856404", borderRadius:4, fontWeight:700 }}>{s.component_type.toUpperCase()}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:b.tx }}>{s.component_name}</span>
                </div>
                <div style={{ fontSize:11, color:b.txL, lineHeight:1.5 }}>{s.why}</div>
                {s.data?.items && <div style={{ fontSize:10, color:"#aaa", marginTop:4 }}>{s.data.items.length} items: {s.data.items.map(it=>it.title).join(", ")}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tool cards with context */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:28 }}>
        <div onClick={() => setMode("html")} style={{ padding:"24px 22px", border:"2px solid "+b.pri, cursor:"pointer", background:b.priLt, borderRadius:12, transition:"transform 0.15s, box-shadow 0.15s" }} onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,0.08)"; }} onMouseLeave={e => { e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="none"; }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
            <div style={{ width:38, height:38, background:b.pri, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, color:"#fff" }}>📋</div>
            <div style={{ fontSize:15, fontWeight:700 }}>HTML Components</div>
          </div>
          <div style={{ fontSize:11, color:b.txL, lineHeight:1.7, marginBottom:10 }}>Static visual components — tables, banners, cards, timelines, stats, and more. Copy and paste directly into NovoEd.</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:10 }}>
            {[{l:"Seamless",c:b.pri},{l:"Fast loading",c:b.pri},{l:"Native look",c:b.pri}].map((t,i) => <span key={i} style={{ fontSize:9, padding:"2px 8px", background:b.pri+"15", color:t.c, borderRadius:10, fontWeight:600 }}>{t.l}</span>)}
          </div>
          <div style={{ fontSize:10, color:b.txL, lineHeight:1.6, padding:"8px 10px", background:"rgba(255,255,255,0.6)", borderRadius:6, fontStyle:"italic" }}>Looks like a native part of NovoEd, loads instantly. Best for visual formatting, data display, and structured content.</div>
          <div style={{ fontSize:11, color:b.pri, marginTop:10, fontWeight:700 }}>16 components →</div>
        </div>
        <div onClick={() => setMode("scorm")} style={{ padding:"24px 22px", border:"2px solid "+b.n2, cursor:"pointer", background:b.wh, borderRadius:12, transition:"transform 0.15s, box-shadow 0.15s" }} onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,0.08)"; }} onMouseLeave={e => { e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="none"; }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
            <div style={{ width:38, height:38, background:b.n2, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>✨</div>
            <div style={{ fontSize:15, fontWeight:700 }}>SCORM Interactives</div>
          </div>
          <div style={{ fontSize:11, color:b.txL, lineHeight:1.7, marginBottom:10 }}>Fully interactive activities with animations — flip cards, accordions, stacked cards, cycle diagrams, and more.</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:10 }}>
            {[{l:"Animated",c:"#D4A017"},{l:"Interactive",c:"#D4A017"},{l:"Engaging",c:"#D4A017"}].map((t,i) => <span key={i} style={{ fontSize:9, padding:"2px 8px", background:"#FFF8E6", color:t.c, borderRadius:10, fontWeight:600 }}>{t.l}</span>)}
          </div>
          <div style={{ fontSize:10, color:b.txL, lineHeight:1.6, padding:"8px 10px", background:b.n1, borderRadius:6, fontStyle:"italic" }}>Rich animations and click interactions. Loads in an iframe — may take a moment. Best for engaging learner activities.</div>
          <div style={{ fontSize:11, color:b.pri, marginTop:10, fontWeight:700 }}>10 activities →</div>
        </div>
      </div>

      {/* What's New */}
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1.5, color:b.pri, marginBottom:10 }}>What's New</div>
        <div style={{ padding:"16px 20px", background:b.n1, borderRadius:10, border:"1px solid "+b.n2 }}>
          <div style={{ fontSize:13, color:b.tx, lineHeight:1.7 }}>
            <span style={{ fontWeight:700 }}>v1.0 — Launch</span><br/>
            <span style={{ color:b.txL }}>16 HTML components + 10 SCORM interactives with BCG & BCG U branding, live preview, and one-click SCORM download. More components coming soon!</span>
          </div>
        </div>
      </div>

      {/* Feedback */}
      <div style={{ padding:"14px 20px", background:b.priLt, borderRadius:10, border:"1px solid "+b.pri+"22", display:"flex", alignItems:"center", gap:14 }}>
        <div style={{ width:32, height:32, background:b.pri, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, color:"#fff", flexShrink:0 }}>✉</div>
        <div style={{ fontSize:12, color:b.tx, lineHeight:1.6 }}>
          <span style={{ fontWeight:600 }}>Feedback or suggestions?</span> Drop a note at{" "}
          <span style={{ color:b.pri, fontWeight:700, textDecoration:"underline", cursor:"pointer" }} onClick={() => window.open("mailto:jatin.patial@bcg.com")}>jatin.patial@bcg.com</span>
        </div>
      </div>
    </div>
  );

  /* ── LIST SCREEN ── */
  if (!sel) {
    const allComps = mode === "html" ? HTML_COMPS : SCORM_COMPS;
    const comps = search ? allComps.filter(c => c.n.toLowerCase().includes(search.toLowerCase()) || c.d.toLowerCase().includes(search.toLowerCase())) : allComps;
    return (
      <div style={{ maxWidth:880, margin:"0 auto", padding:"20px 16px", fontFamily:"'Trebuchet MS', system-ui, sans-serif", color:b.tx }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <button onClick={() => { setMode(null); setSearch(""); }} style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, color:"#999" }}>← Back</button>
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            <span style={{ fontSize:13, fontWeight:700, color:b.pri }}>{mode === "html" ? "HTML Components" : "SCORM Interactives"}</span>
            <BrandSwitch brand={brand} setBrand={setBrand} size="sm" />
          </div>
        </div>
        {/* Search box */}
        <div style={{ marginBottom:14 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={"Search " + (mode === "html" ? "HTML components" : "SCORM interactives") + "..."} style={{ width:"100%", padding:"10px 14px 10px 36px", border:"1.5px solid "+b.n2, borderRadius:10, fontSize:12, outline:"none", background:"#fff url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"%23999\" stroke-width=\"2\"><circle cx=\"11\" cy=\"11\" r=\"8\"/><line x1=\"21\" y1=\"21\" x2=\"16.65\" y2=\"16.65\"/></svg>') 12px center no-repeat" }} onFocus={e => e.target.style.borderColor=b.pri} onBlur={e => e.target.style.borderColor=b.n2} />
        </div>
        <div style={{ padding:"10px 14px", background: mode === "html" ? b.priLt : "#FFF8E6", marginBottom:16, fontSize:11, color: mode === "html" ? b.pri : "#856404", fontWeight:500, borderRadius:8 }}>
          {mode === "html" ? "Copy code → NovoEd → Contents → HTML. Also works in Quiz & Survey edit view." : "Download as SCORM .zip → Upload to NovoEd's SCORM/AICC block."}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {comps.length === 0 && <div style={{ gridColumn:"1/-1", padding:24, textAlign:"center", color:"#999", fontSize:12 }}>No components match "{search}"</div>}
          {comps.map(c => (
            <button key={c.id} onClick={() => doSelect(c.id)} style={{ padding:"14px 16px", borderRadius:12, border:"1.5px solid #e8e8e8", background:"#fff", cursor:"pointer", textAlign:"left", transition:"border-color 0.15s, box-shadow 0.15s" }} onMouseEnter={e => { e.currentTarget.style.borderColor=b.pri; e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.06)"; }} onMouseLeave={e => { e.currentTarget.style.borderColor="#e8e8e8"; e.currentTarget.style.boxShadow="none"; }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                <span style={{ fontSize:16, color:b.pri }}>{c.ic}</span>
                <span style={{ fontSize:13, fontWeight:700, color:b.tx }}>{c.n}</span>
              </div>
              <div style={{ fontSize:11, color:"#999" }}>{c.d}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ── EDITOR SCREEN ── */
  const isScorm = sel.startsWith("s_");
  const compName = (isScorm ? SCORM_COMPS : HTML_COMPS).find(c => c.id === sel)?.n;

  return (
    <div style={{ maxWidth:880, margin:"0 auto", padding:"20px 16px", fontFamily:"'Trebuchet MS', system-ui, sans-serif", color:b.tx }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <button onClick={() => { setSel(null); setOutput(""); setCopied(false); setScormPreview(""); }} style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, color:"#999", transition:"color 0.15s" }} onMouseEnter={e=>e.currentTarget.style.color=b.pri} onMouseLeave={e=>e.currentTarget.style.color="#999"}>← Back</button>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <span style={{ fontSize:12, fontWeight:700, color:b.pri }}>{compName}</span>
          <span style={{ fontSize:10, padding:"2px 8px", background: isScorm ? "#FFF8E6" : b.priLt, color: isScorm ? "#856404" : b.pri, fontWeight:600, borderRadius:4 }}>{isScorm ? "SCORM" : "HTML"}</span>
          <BrandSwitch brand={brand} setBrand={(k) => { setBrand(k); if (!isScorm) setOutput(genHTML(sel, k, data)); else setScormPreview(genSCORMhtml(sel, data, k)); }} size="sm" />
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18 }}>
        {/* ── LEFT: EDITOR ── */}
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:"#aaa", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Edit</div>

          {data?.col1 !== undefined && (
            <div style={{ marginBottom:8 }}>
              <input value={data.col1} onChange={e => setData({...data, col1: e.target.value})} placeholder="Col 1" style={{ width:"100%", padding:"6px 8px", border:"1px solid #e5e5e5", borderRadius:4, fontSize:11, fontWeight:600, marginBottom:4, outline:"none" }} />
              <input value={data.col2} onChange={e => setData({...data, col2: e.target.value})} placeholder="Col 2" style={{ width:"100%", padding:"6px 8px", border:"1px solid #e5e5e5", borderRadius:4, fontSize:11, fontWeight:600, outline:"none" }} />
            </div>
          )}

          {data?.title !== undefined && (
            <input value={data.title} onChange={e => setData({...data, title: e.target.value})} placeholder="Title / Heading" style={{ width:"100%", padding:"8px 10px", border:"1px solid #e5e5e5", borderRadius:6, fontSize:12, fontWeight:600, marginBottom:6, outline:"none" }} />
          )}

          {data?.body !== undefined && (
            <textarea value={data.body} onChange={e => setData({...data, body: e.target.value})} rows={2} placeholder="Subtitle / Description" style={{ width:"100%", padding:"8px 10px", border:"1px solid #e5e5e5", borderRadius:6, fontSize:12, resize:"vertical", outline:"none", marginBottom:6 }} />
          )}

          {isScorm && (
            <div style={{ display:"flex", gap:4, marginBottom:8, alignItems:"center" }}>
              <span style={{ fontSize:10, fontWeight:600, color:"#888", marginRight:4 }}>Background:</span>
              {[{v:"gradient",l:"Gradient"},{v:"none",l:"Plain white"}].map(o => (
                <button key={o.v} onClick={() => setData({...data, bg: o.v})} style={{ padding:"4px 10px", border:"1px solid "+((data.bg||"gradient")===o.v?b.pri:"#ddd"), background:(data.bg||"gradient")===o.v?b.priLt:"#fff", color:(data.bg||"gradient")===o.v?b.pri:b.txL, fontSize:10, fontWeight:600, cursor:"pointer", borderRadius:4, transition:"all 0.15s" }}>
                  {o.l}
                </button>
              ))}
            </div>
          )}

          {data?.author !== undefined && (
            <input value={data.author} onChange={e => setData({...data, author: e.target.value})} placeholder="Author" style={{ width:"100%", padding:"6px 10px", border:"1px solid #e5e5e5", borderRadius:6, fontSize:11, marginBottom:6, outline:"none" }} />
          )}

          {data?.type !== undefined && (
            <div style={{ display:"flex", gap:4, marginBottom:8 }}>
              {["info","tip","warning","success"].map(t => (
                <button key={t} onClick={() => setData({...data, type: t})} style={{ padding:"4px 10px", border:"1px solid "+(data.type === t ? b.pri : "#ddd"), background: data.type === t ? b.priLt : "#fff", color: data.type === t ? b.pri : b.txL, fontSize:10, fontWeight:600, cursor:"pointer", borderRadius:4, transition:"all 0.15s" }}>
                  {t}
                </button>
              ))}
            </div>
          )}

          {data?.active !== undefined && (
            <div style={{ marginBottom:8 }}>
              <label style={{ fontSize:10, fontWeight:600, color:"#888" }}>Active step: {data.active}</label>
              <input type="range" min={0} max={(data.items?.length || 1) - 1} value={data.active} onChange={e => setData({...data, active: parseInt(e.target.value)})} style={{ width:"100%", accentColor: b.pri }} />
            </div>
          )}

          {data?.items && data.items.map((it, i) => (
            <div key={i} style={{ marginBottom:6, padding:8, background:"#FAFAFA", borderRadius:6 }}>
              <div style={{ display:"flex", gap:4, alignItems:"center", marginBottom:3 }}>
                <span style={{ fontSize:10, fontWeight:700, color:b.pri }}>#{i+1}</span>
                {it.icon !== undefined && (
                  <input value={it.icon} onChange={e => { const n = [...data.items]; n[i] = {...n[i], icon: e.target.value}; setData({...data, items: n}); }} style={{ width:36, padding:"5px 4px", border:"1px solid #e5e5e5", borderRadius:4, fontSize:14, outline:"none", textAlign:"center" }} />
                )}
                <input value={it.title} onChange={e => { const n = [...data.items]; n[i] = {...n[i], title: e.target.value}; setData({...data, items: n}); }} placeholder="Title" style={{ flex:1, padding:"5px 6px", border:"1px solid #e5e5e5", borderRadius:4, fontSize:11, fontWeight:600, outline:"none" }} />
                {data.items.length > 1 && (
                  <button onClick={() => setData({...data, items: data.items.filter((_, j) => j !== i)})} style={{ background:"none", border:"none", color:"#ccc", cursor:"pointer", fontSize:12, transition:"color 0.15s" }} onMouseEnter={e=>e.currentTarget.style.color="#e74c3c"} onMouseLeave={e=>e.currentTarget.style.color="#ccc"}>✕</button>
                )}
              </div>
              {it.img !== undefined && (
                <div style={{ display:"flex", gap:4, alignItems:"center", marginBottom:3 }}>
                  <span style={{ fontSize:9, color:"#aaa", flexShrink:0 }}>🖼</span>
                  <input value={it.img} onChange={e => { const n = [...data.items]; n[i] = {...n[i], img: e.target.value}; setData({...data, items: n}); }} placeholder="Image URL (paste link)" style={{ flex:1, padding:"4px 6px", border:"1px solid #e5e5e5", borderRadius:4, fontSize:10, outline:"none", color:"#666" }} />
                  {it.img && <img src={it.img} style={{ width:24, height:24, objectFit:"cover", borderRadius:3, border:"1px solid #e5e5e5" }} onError={e => e.target.style.display="none"} />}
                </div>
              )}
              {it.desc !== undefined && (
                <textarea value={it.desc} onChange={e => { const n = [...data.items]; n[i] = {...n[i], desc: e.target.value}; setData({...data, items: n}); }} placeholder="Description" rows={2} style={{ width:"100%", padding:"5px 6px", border:"1px solid #e5e5e5", borderRadius:4, fontSize:10, resize:"none", outline:"none" }} />
              )}
              {it.desc2 !== undefined && (
                <textarea value={it.desc2} onChange={e => { const n = [...data.items]; n[i] = {...n[i], desc2: e.target.value}; setData({...data, items: n}); }} placeholder="Column 2" rows={2} style={{ width:"100%", padding:"5px 6px", border:"1px solid #e5e5e5", borderRadius:4, fontSize:10, resize:"none", outline:"none", marginTop:3 }} />
              )}
            </div>
          ))}

          {data?.items && (
            <button onClick={() => {
              const tpl = data.items[0] || {};
              const nw = { title: "" };
              if (tpl.desc !== undefined) nw.desc = "";
              if (tpl.desc2 !== undefined) nw.desc2 = "";
              if (tpl.icon !== undefined) nw.icon = "●";
              if (tpl.img !== undefined) nw.img = "";
              setData({...data, items: [...data.items, nw]});
            }} style={{ fontSize:10, padding:"4px 10px", borderRadius:4, border:"1px solid "+b.pri, background:"transparent", color:b.pri, cursor:"pointer", fontWeight:600, transition:"all 0.15s" }} onMouseEnter={e=>{e.currentTarget.style.background=b.pri;e.currentTarget.style.color="#fff";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=b.pri;}}>
              + Add
            </button>
          )}

          {!isScorm && (
            <button onClick={doRegen} style={{ width:"100%", padding:"10px", borderRadius:8, border:"none", background:b.pri, color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer", marginTop:10, transition:"all 0.2s" }} onMouseEnter={e => {e.currentTarget.style.background=b.priDk;e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.15)";}} onMouseLeave={e => {e.currentTarget.style.background=b.pri;e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
              Update preview
            </button>
          )}

          {isScorm && (
            <div style={{ display:"flex", gap:8, marginTop:10 }}>
              <button onClick={doRegen} style={{ flex:1, padding:"10px", borderRadius:8, border:"2px solid "+b.pri, background:"#fff", color:b.pri, fontSize:12, fontWeight:600, cursor:"pointer", transition:"all 0.2s" }} onMouseEnter={e=>{e.currentTarget.style.background=b.priLt;e.currentTarget.style.transform="translateY(-1px)";}} onMouseLeave={e=>{e.currentTarget.style.background="#fff";e.currentTarget.style.transform="none";}}>
                Update preview
              </button>
              <button onClick={() => downloadSCORM(sel, data, brand)} style={{ flex:1, padding:"10px", borderRadius:8, border:"none", background:b.pri, color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer", transition:"all 0.2s" }} onMouseEnter={e=>{e.currentTarget.style.background=b.priDk;e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.15)";}} onMouseLeave={e=>{e.currentTarget.style.background=b.pri;e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
                ⬇ Download .zip
              </button>
            </div>
          )}
        </div>

        {/* ── RIGHT: PREVIEW ── */}
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:"#aaa", textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Preview</div>

          {!isScorm && (
            <div style={{ border:"1px solid #eee", borderRadius:10, padding:16, background:"#fff", minHeight:200, overflow:"auto" }} dangerouslySetInnerHTML={{ __html: output }} />
          )}

          {isScorm && scormPreview && (
            <div style={{ border:"1px solid #eee", borderRadius:10, overflow:"hidden", background:"#fff" }}>
              <div style={{ padding:"8px 12px", background:b.n1, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:10, fontWeight:700, color:b.txL, textTransform:"uppercase", letterSpacing:0.5 }}>Live Interactive Preview</span>
                <span style={{ fontSize:9, color:"#aaa" }}>Try clicking / interacting below</span>
              </div>
              <iframe
                srcDoc={scormPreview}
                style={{ width:"100%", height:560, border:"none", display:"block" }}
                sandbox="allow-scripts allow-same-origin"
                title="SCORM Preview"
              />
            </div>
          )}

          {!isScorm && (
            <div style={{ marginTop:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <div style={{ fontSize:10, fontWeight:700, color:"#aaa", textTransform:"uppercase", letterSpacing:1 }}>HTML Code</div>
                <button onClick={handleCopy} style={{ fontSize:10, padding:"3px 10px", borderRadius:4, border:"1px solid "+(copied ? b.pri : "#ddd"), background: copied ? b.priLt : "#fff", color: copied ? b.pri : "#888", cursor:"pointer", fontWeight:600, transition:"all 0.2s" }}>
                  {copied ? "✓ Copied!" : "Copy"}
                </button>
              </div>
              <textarea readOnly value={output} onClick={e => { e.target.focus(); e.target.select(); }} style={{ width:"100%", height:120, padding:10, border:"2px solid "+b.pri, fontSize:10, fontFamily:"monospace", color:"#444", background:"#FAFAFA", resize:"vertical", cursor:"pointer", borderRadius:6 }} />
            </div>
          )}

          <div style={{ marginTop:8, padding:10, background:b.n1, fontSize:10, color:"#888", borderRadius:6 }}>
            <strong style={{ color:b.tx }}>{isScorm ? "Upload:" : "NovoEd:"}</strong>{" "}
            {isScorm ? "Download .zip → NovoEd → Add SCORM/AICC → Upload" : "Copy code → NovoEd → Contents → HTML. Also works in Quiz & Survey edit view."}
          </div>
        </div>
      </div>
    </div>
  );
}
