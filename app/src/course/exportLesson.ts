import { B, esc, type BrandKey, type BrandTokens } from "../brand/tokens";
import { createZip } from "../scorm/zipBuilder";
import type { Block, Course, Lesson } from "./types";

function genExportBlock(blk: Block, b: BrandTokens): string {
  const d = blk.data || {};
  const items = d.items || [];
  const bid = "eb_" + blk.id;
  const E = esc;

  switch (blk.type) {
    case "text":
      return '<div class="cb-text">' + E(d.content || "").replace(/\n/g, "<br>") + "</div>";

    case "video": {
      if (!d.url) return "";
      const eu = d.url.replace("watch?v=", "embed/").replace("youtu.be/", "www.youtube.com/embed/");
      return '<div class="cb-vwrap"><iframe src="' + E(eu) + '" style="position:absolute;inset:0;width:100%;height:100%;border:none;" allowfullscreen></iframe></div>' +
        (d.caption ? '<div class="cb-caption">' + E(d.caption) + "</div>" : "");
    }

    case "image": {
      if (!d.url) return "";
      return '<img src="' + E(d.url) + '" style="width:100%;border-radius:10px;display:block;" alt="' + E(d.alt || "") + '">' +
        (d.caption ? '<div class="cb-caption">' + E(d.caption) + "</div>" : "");
    }

    case "banner":
      return '<div class="cb-banner"><div class="cb-banner-title">' + E(d.title || "") + '</div><div class="cb-banner-body">' + E(d.body || "") + "</div></div>";

    case "callout": {
      const ctypes: Record<string, { ic: string; brd: string; bg: string }> = {
        info: { ic: "ℹ️", brd: b.pri, bg: "#EBF8F2" },
        tip: { ic: "💡", brd: b.pri, bg: "#EBF8F2" },
        warning: { ic: "⚠️", brd: "#D4A017", bg: "#FFF8E6" },
        success: { ic: "✅", brd: b.pri, bg: "#EBF8F2" },
      };
      const cv = ctypes[d.type || "tip"] || ctypes.tip;
      return '<div class="cb-callout" style="border-left-color:' + cv.brd + ";background:" + cv.bg + '"><span class="cb-callout-ic">' + cv.ic + '</span><div class="cb-callout-body">' + E(d.body || "") + "</div></div>";
    }

    case "cards": {
      const cardsH = items.map((it) => '<div class="cb-card" style="border-top-color:' + b.pri + '"><div class="cb-card-title">' + E(it.title) + '</div><div class="cb-card-desc">' + E(it.desc || "") + "</div></div>").join("");
      return '<div class="cb-cards">' + cardsH + "</div>";
    }

    case "stats": {
      const statsH = items.map((it) => '<div class="cb-stat"><div class="cb-stat-num" style="color:' + b.pri + '">' + E(it.title) + '</div><div class="cb-stat-lbl">' + E(it.desc || "") + "</div></div>").join("");
      return '<div class="cb-stats" style="border-color:' + b.n2 + '">' + statsH + "</div>";
    }

    case "accordion": {
      const accH = items.map((it) =>
        '<div class="cb-acc-item" style="border-color:' + b.n2 + '">' +
        '<div class="cb-acc-head" onclick="toggleAcc(this)" style="color:' + b.tx + '">' +
        "<span>" + E(it.title) + "</span>" +
        '<span class="acc-arr" style="color:' + b.pri + '">+</span>' +
        "</div>" +
        '<div class="cb-acc-body" style="color:' + b.txL + '">' + E(it.desc || "") + "</div>" +
        "</div>"
      ).join("");
      return (d.title ? '<div class="cb-stitle" style="color:' + b.tx + '">' + E(d.title) + "</div>" : "") +
        (d.body ? '<div class="cb-sbody" style="color:' + b.txL + '">' + E(d.body) + "</div>" : "") +
        '<div class="cb-accordion" style="border-color:' + b.n2 + '">' + accH + "</div>";
    }

    case "flipcard": {
      const flipH = items.map((it) =>
        '<div class="flip-card" onclick="this.classList.toggle(\'flipped\')">' +
        '<div class="flip-inner">' +
        '<div class="flip-front" style="background:' + b.grad + '">' +
        '<div class="flip-title">' + E(it.title) + "</div>" +
        '<div class="flip-hint">Tap to flip ↺</div>' +
        "</div>" +
        '<div class="flip-back" style="border-color:' + b.n2 + '">' +
        '<div class="flip-back-content" style="color:' + b.tx + '">' + E(it.desc || "") + "</div>" +
        "</div>" +
        "</div></div>"
      ).join("");
      return (d.title ? '<div class="cb-stitle" style="color:' + b.tx + '">' + E(d.title) + "</div>" : "") +
        (d.body ? '<div class="cb-sbody" style="color:' + b.txL + '">' + E(d.body) + "</div>" : "") +
        '<div class="cb-flipcards">' + flipH + "</div>";
    }

    case "timeline": {
      const tlH = items.map((it, i) => {
        const isLast = i === items.length - 1;
        return '<div class="tl-item">' +
          '<div class="tl-left">' +
          '<div class="tl-dot" style="background:' + b.pri + '"></div>' +
          (isLast ? "" : '<div class="tl-line" style="background:' + b.n2 + '"></div>') +
          "</div>" +
          '<div class="tl-right">' +
          '<div class="tl-item-title" style="color:' + b.tx + '">' + E(it.title) + "</div>" +
          '<div class="tl-item-desc" style="color:' + b.txL + '">' + E(it.desc || "") + "</div>" +
          "</div></div>";
      }).join("");
      return '<div class="cb-timeline">' + tlH + "</div>";
    }

    case "quiz": {
      if (items.length < 2) return "";
      const qId = bid + "_quiz";
      const qText = items[0].title || "Question";
      const qopts = items.slice(1);
      const correctIdx = qopts.findIndex((o) => o.desc === "1");
      const correctVal = correctIdx >= 0 ? String(correctIdx) : "0";
      const optsH = qopts.map((o, i) => '<label class="quiz-opt"><input type="radio" name="' + qId + '_r" value="' + i + '"><span class="opt-text" style="color:' + b.tx + '">' + E(o.title) + "</span></label>").join("");
      return '<div class="cb-quiz" id="' + qId + '" data-correct="' + correctVal + '" style="background:' + b.n1 + ";border-color:" + b.n2 + '">' +
        (d.title ? '<div class="cb-stitle" style="color:' + b.tx + '">' + E(d.title) + "</div>" : "") +
        '<div class="quiz-q" style="color:' + b.tx + '">' + E(qText) + "</div>" +
        '<div class="quiz-opts">' + optsH + "</div>" +
        '<div class="quiz-feedback" style="display:none;"></div>' +
        (d.body ? '<div class="quiz-explanation" style="display:none;border-left-color:' + b.pri + ";color:" + b.txL + '">' + E(d.body) + "</div>" : "") +
        '<button class="quiz-submit" style="background:' + b.grad + '" onclick="submitQuiz(\'' + qId + "')\">Submit Answer</button>" +
        "</div>";
    }

    case "poll": {
      const pId = bid + "_poll";
      const pollH = items.map((o, i) =>
        '<div class="poll-opt" onclick="selectOpt(\'' + pId + "'," + i + ')">' +
        '<div class="poll-opt-label"><span style="color:' + b.tx + '">' + E(o.title) + "</span>" +
        '<span class="poll-pct" style="color:' + b.pri + ';opacity:0">' + E(o.desc || "0") + "%</span></div>" +
        '<div class="poll-bar" style="background:' + b.n2 + '"><div class="poll-bar-fill" data-pct="' + (o.desc || 0) + '" style="width:0%;background:' + b.grad + '"></div></div>' +
        "</div>"
      ).join("");
      return '<div class="cb-poll" id="' + pId + '">' +
        (d.title ? '<div class="cb-stitle" style="color:' + b.tx + '">' + E(d.title) + "</div>" : "") +
        pollH + "</div>";
    }

    case "divider":
      return '<div class="cb-divider" style="border-top-color:' + b.pri + ';">' +
        (d.title ? '<span class="cb-div-label" style="color:' + b.pri + '">' + E(d.title) + "</span>" : "") +
        "</div>";

    default:
      return "";
  }
}

function getLessonCSS(b: BrandTokens): string {
  return `*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:#f6f7f8;color:${b.tx};min-height:100vh;}
.lp-header{background:${b.grad};padding:22px 40px 20px;color:#fff;}
.lp-course{font-size:11px;opacity:0.7;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;}
.lp-title{font-size:22px;font-weight:700;line-height:1.3;}
.lp-body{max-width:760px;margin:0 auto;padding:36px 24px 16px;}
.cb-block{margin-bottom:28px;}
.cb-text{font-size:15px;line-height:1.9;color:${b.tx};}
.cb-vwrap{position:relative;padding-top:56.25%;border-radius:10px;overflow:hidden;background:#000;}
.cb-caption{font-size:12px;color:${b.txL};text-align:center;margin-top:8px;}
.cb-banner{background:${b.grad};padding:28px 32px;border-radius:12px;}
.cb-banner-title{font-size:18px;font-weight:700;color:#fff;margin-bottom:8px;line-height:1.3;}
.cb-banner-body{font-size:14px;color:rgba(255,255,255,0.88);line-height:1.7;}
.cb-callout{display:flex;gap:12px;padding:14px 18px;border-left:4px solid ${b.pri};border-radius:0 10px 10px 0;}
.cb-callout-ic{font-size:18px;flex-shrink:0;line-height:1.6;}
.cb-callout-body{font-size:14px;line-height:1.7;}
.cb-cards{display:flex;gap:12px;flex-wrap:wrap;}
.cb-card{flex:1;min-width:160px;padding:18px;border:1px solid ${b.n2};border-top:3px solid ${b.pri};border-radius:10px;}
.cb-card-title{font-size:14px;font-weight:700;color:${b.tx};margin-bottom:6px;}
.cb-card-desc{font-size:13px;color:${b.txL};line-height:1.6;}
.cb-stats{display:flex;border:1px solid ${b.n2};border-radius:10px;overflow:hidden;}
.cb-stat{flex:1;text-align:center;padding:24px 16px;border-right:1px solid ${b.n2};}
.cb-stat:last-child{border-right:none;}
.cb-stat-num{font-size:42px;font-weight:200;line-height:1;}
.cb-stat-lbl{font-size:12px;color:${b.txL};margin-top:8px;}
.cb-accordion{border:1px solid ${b.n2};border-radius:10px;overflow:hidden;}
.cb-acc-item{border-bottom:1px solid ${b.n2};}
.cb-acc-item:last-child{border-bottom:none;}
.cb-acc-head{padding:14px 18px;font-size:14px;font-weight:600;cursor:pointer;display:flex;justify-content:space-between;align-items:center;user-select:none;transition:background 0.15s;}
.cb-acc-head:hover{background:${b.priLt};}
.acc-arr{font-size:20px;font-weight:300;line-height:1;}
.cb-acc-body{padding:0 18px;font-size:14px;line-height:1.8;overflow:hidden;max-height:0;transition:max-height 0.35s ease;}
.cb-flipcards{display:flex;gap:12px;flex-wrap:wrap;}
.flip-card{width:190px;height:155px;perspective:700px;cursor:pointer;}
.flip-inner{width:100%;height:100%;transition:transform 0.55s;transform-style:preserve-3d;position:relative;}
.flip-card.flipped .flip-inner{transform:rotateY(180deg);}
.flip-front,.flip-back{position:absolute;inset:0;border-radius:12px;backface-visibility:hidden;-webkit-backface-visibility:hidden;}
.flip-front{background:${b.grad};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;gap:7px;}
.flip-title{font-size:14px;font-weight:700;color:#fff;text-align:center;line-height:1.3;}
.flip-hint{font-size:10px;color:rgba(255,255,255,0.6);}
.flip-back{background:#fff;border:1px solid ${b.n2};transform:rotateY(180deg);display:flex;align-items:center;justify-content:center;padding:16px;}
.flip-back-content{font-size:13px;line-height:1.65;text-align:center;}
.cb-timeline{}
.tl-item{display:flex;gap:12px;margin-bottom:18px;}
.tl-left{display:flex;flex-direction:column;align-items:center;flex-shrink:0;}
.tl-dot{width:14px;height:14px;border-radius:50%;flex-shrink:0;margin-top:4px;}
.tl-line{width:2px;flex:1;min-height:22px;margin:4px 0;}
.tl-right{padding-bottom:6px;}
.tl-item-title{font-size:14px;font-weight:600;margin-bottom:4px;}
.tl-item-desc{font-size:13px;line-height:1.7;}
.cb-quiz{padding:24px;border-radius:12px;border:1px solid ${b.n2};}
.quiz-q{font-size:15px;font-weight:600;line-height:1.6;color:${b.tx};margin-bottom:18px;}
.quiz-opts{display:flex;flex-direction:column;gap:10px;margin-bottom:18px;}
.quiz-opt{display:flex;align-items:center;gap:10px;padding:12px 16px;border:1.5px solid ${b.n2};border-radius:10px;cursor:pointer;background:#fff;transition:border-color 0.15s;}
.quiz-opt:hover{border-color:${b.pri};}
.quiz-opt input{accent-color:${b.pri};width:16px;height:16px;flex-shrink:0;cursor:pointer;}
.opt-text{font-size:14px;line-height:1.4;}
.q-correct{background:#f0fdf4!important;border-color:#22c55e!important;}
.q-wrong{background:#fef2f2!important;border-color:#ef4444!important;}
.quiz-feedback{padding:12px 16px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:14px;}
.fb-right{background:#f0fdf4;color:#15803d;}
.fb-wrong{background:#fef2f2;color:#dc2626;}
.quiz-submit{background:${b.grad};color:#fff;border:none;padding:11px 28px;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;transition:opacity 0.2s;}
.quiz-submit:hover:not(:disabled){opacity:0.88;}
.quiz-submit:disabled{opacity:0.45;cursor:default;}
.quiz-explanation{margin-top:14px;padding:12px 16px;background:#fff;border-left:3px solid ${b.pri};border-radius:0 8px 8px 0;font-size:13px;line-height:1.7;}
.cb-poll{}
.poll-opt{padding:12px 0;border-bottom:1px solid ${b.n2};cursor:pointer;transition:opacity 0.2s;}
.poll-opt:last-child{border-bottom:none;}
.poll-opt:hover{opacity:0.8;}
.poll-opt.voted .poll-opt-label span:first-child{font-weight:600;}
.poll-opt-label{display:flex;justify-content:space-between;font-size:14px;margin-bottom:7px;}
.poll-pct{font-weight:700;transition:opacity 0.3s;}
.poll-bar{height:7px;border-radius:4px;overflow:hidden;}
.poll-bar-fill{height:100%;width:0%;border-radius:4px;transition:width 0.6s ease;}
.cb-divider{border-top:2px solid ${b.pri};position:relative;text-align:center;margin:8px 0;}
.cb-div-label{position:relative;top:-11px;display:inline-block;padding:0 14px;background:#f6f7f8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;}
.cb-stitle{font-size:18px;font-weight:700;margin-bottom:8px;line-height:1.3;}
.cb-sbody{font-size:14px;line-height:1.7;margin-bottom:16px;}
.lp-footer{max-width:760px;margin:0 auto;padding:16px 24px 56px;display:flex;justify-content:flex-end;}
.lp-complete{background:${b.grad};color:#fff;border:none;padding:14px 36px;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.15);transition:opacity 0.2s,transform 0.2s;}
.lp-complete:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.18);}
.lp-complete:disabled{opacity:0.55;cursor:default;transform:none;}`;
}

function getLessonJS(): string {
  return `var SCORM_API=null;
(function findAPI(){var w=window,t=0;while(!w.API&&w.parent&&w.parent!==w&&t<10){w=w.parent;t++;}SCORM_API=w.API||null;})();
if(SCORM_API)try{SCORM_API.LMSInitialize('');}catch(e){}
function markComplete(){
  try{
    if(SCORM_API){
      SCORM_API.LMSSetValue('cmi.core.lesson_status','completed');
      SCORM_API.LMSSetValue('cmi.core.score.raw','100');
      SCORM_API.LMSSetValue('cmi.core.score.min','0');
      SCORM_API.LMSSetValue('cmi.core.score.max','100');
      SCORM_API.LMSFinish('');
    }
  }catch(e){}
  var btn=document.getElementById('lp_done');
  if(btn){btn.textContent='\u2713 Completed!';btn.disabled=true;}
}
window.addEventListener('beforeunload',function(){try{if(SCORM_API)SCORM_API.LMSFinish('');}catch(e){}});
function toggleAcc(el){
  var body=el.nextElementSibling;
  var open=body.style.maxHeight&&body.style.maxHeight!=='0px';
  body.style.maxHeight=open?'0px':'600px';
  el.querySelector('.acc-arr').textContent=open?'+':'\u2212';
}
function selectOpt(pid,idx){
  var poll=document.getElementById(pid);
  if(!poll||poll.dataset.voted)return;
  poll.dataset.voted='1';
  poll.querySelectorAll('.poll-opt').forEach(function(opt,i){
    var bar=opt.querySelector('.poll-bar-fill');
    var pct=opt.querySelector('.poll-pct');
    if(bar){bar.style.width=bar.dataset.pct+'%';}
    if(pct){pct.style.opacity='1';}
    if(i===idx)opt.classList.add('voted');
  });
}
function submitQuiz(qid){
  var form=document.getElementById(qid);
  if(!form||form.dataset.done)return;
  var sel=form.querySelector('input[type=radio]:checked');
  if(!sel){alert('Please select an answer.');return;}
  form.dataset.done='1';
  var correct=form.dataset.correct;
  var isRight=(sel.value===correct);
  form.querySelectorAll('.quiz-opt').forEach(function(opt){
    var inp=opt.querySelector('input');
    if(!inp)return;
    if(inp.value===correct)opt.classList.add('q-correct');
    else if(inp.value===sel.value)opt.classList.add('q-wrong');
  });
  var fb=form.querySelector('.quiz-feedback');
  if(fb){
    fb.style.display='block';
    fb.className='quiz-feedback '+(isRight?'fb-right':'fb-wrong');
    fb.textContent=isRight?'\u2713 Correct! Well done.':'\u2717 Not quite. The correct answer is highlighted in green.';
  }
  var exp=form.querySelector('.quiz-explanation');
  if(exp)exp.style.display='block';
  var btn=form.querySelector('.quiz-submit');
  if(btn)btn.disabled=true;
}`;
}

function genLessonHTML(les: Lesson, b: BrandTokens, courseTitle: string): string {
  let blocksHtml = (les.blocks || [])
    .map((blk) => {
      const bh = genExportBlock(blk, b);
      return bh ? '<div class="cb-block">' + bh + "</div>" : "";
    })
    .join("\n");

  if (!blocksHtml.trim()) blocksHtml = '<div style="text-align:center;padding:60px;color:#aaa;font-size:14px;">This lesson has no content yet.</div>';

  return "<!DOCTYPE html>\n" +
    '<html lang="en">\n<head>\n' +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
    "<title>" + esc(les.title) + "</title>\n" +
    "<style>\n" + getLessonCSS(b) + "\n</style>\n" +
    "</head>\n<body>\n" +
    '<div class="lp-header">' +
    '<div class="lp-course">' + esc(courseTitle) + "</div>" +
    '<div class="lp-title">' + esc(les.title) + "</div>" +
    "</div>\n" +
    '<div class="lp-body">\n' + blocksHtml + "\n</div>\n" +
    '<div class="lp-footer">' +
    '<button class="lp-complete" id="lp_done" onclick="markComplete()">\u2713 Mark as Complete</button>' +
    "</div>\n" +
    "<script>\n" + getLessonJS() + "\n<\/script>\n" +
    "</body>\n</html>";
}

function genManifest(id: string, fullTitle: string, lesTitle: string): string {
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<manifest identifier="' + id + '" version="1.0"\n' +
    '  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"\n' +
    '  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"\n' +
    '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n' +
    '  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd">\n' +
    "  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>\n" +
    '  <organizations default="org1">\n' +
    '    <organization identifier="org1">\n' +
    "      <title>" + fullTitle + "</title>\n" +
    '      <item identifier="item1" identifierref="res1">\n' +
    "        <title>" + lesTitle + "</title>\n" +
    "      </item>\n" +
    "    </organization>\n" +
    "  </organizations>\n" +
    "  <resources>\n" +
    '    <resource identifier="res1" type="webcontent" adlcp:scormtype="sco" href="index.html">\n' +
    '      <file href="index.html"/>\n' +
    "    </resource>\n" +
    "  </resources>\n" +
    "</manifest>";
}

export function exportLessonSCORM(course: Course, lesson: Lesson): void {
  const b = B[course.brand] || B.bcgu;
  const safeId = "lesson_" + lesson.id.replace(/[^a-z0-9]/gi, "_");
  const lesTitle = lesson.title;
  const courseTitle = course.title;

  const manifest = genManifest(safeId, courseTitle + " — " + lesTitle, lesTitle);
  const html = genLessonHTML(lesson, b, courseTitle);

  const blob = createZip([
    { name: "imsmanifest.xml", content: manifest },
    { name: "index.html", content: html },
  ]);
  const fname = (lesTitle || "lesson").replace(/\s+/g, "_") + ".zip";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fname;
  a.click();
}

export function exportCourseJSON(course: Course): void {
  const blob = new Blob([JSON.stringify(course, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = (course.title || "course").replace(/\s+/g, "_") + ".json";
  a.click();
}

export function exportOutlineText(course: Course): void {
  let txt = course.title + "\n" + "═".repeat(course.title.length) + "\n\n";
  course.modules.forEach((mod, mi) => {
    txt += "MODULE " + (mi + 1) + ": " + mod.title + "\n";
    mod.lessons.forEach((les) => {
      txt += "  • " + les.title + " (" + les.duration + " mins) — " + les.blocks.length + " block" + (les.blocks.length !== 1 ? "s" : "") + "\n";
      les.blocks.forEach((bl) => { txt += "      ▸ " + bl.type + "\n"; });
    });
    txt += "\n";
  });
  const blob = new Blob([txt], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = (course.title || "course").replace(/\s+/g, "_") + "_outline.txt";
  a.click();
}

export type { BrandKey };
