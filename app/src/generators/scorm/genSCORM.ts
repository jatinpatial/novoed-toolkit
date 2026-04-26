import { B, esc, shuffle, type BrandKey } from "../../brand/tokens";
import type { ComponentData } from "../../types";
import { SCORM_COMPS } from "../registry";

function scTag(code: string): string {
  return "<scr" + "ipt>" + code + "</scr" + "ipt>";
}

export function genSCORMhtml(sel: string, data: ComponentData, brand: BrandKey): string {
  const b2 = B[brand];
  const items = data.items || [];
  const compTitle = data.title !== undefined ? data.title : SCORM_COMPS.find((c) => c.id === sel)?.n || "Activity";
  const compBody = data.body !== undefined ? data.body : "";

  const bgStyle = data.bg === "none" ? "#ffffff" : "linear-gradient(150deg,#fafbfc 0%," + b2.priLt + " 50%,#fafbfc 100%)";

  const baseCSS =
    "*{margin:0;padding:0;box-sizing:border-box;}" +
    "@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}" +
    "@keyframes fadeIn{from{opacity:0}to{opacity:1}}" +
    "@keyframes scaleIn{from{opacity:0;transform:scale(0.93)}to{opacity:1;transform:scale(1)}}" +
    "@keyframes dotPop{0%{transform:scale(0)}60%{transform:scale(1.15)}100%{transform:scale(1)}}" +
    "html,body{height:100%;}" +
    'body{font-family:"Segoe UI",Trebuchet MS,system-ui,sans-serif;padding:0;margin:0;background:' + bgStyle + ";color:" + b2.tx + ";display:flex;align-items:center;justify-content:center;min-height:100%;}" +
    ".container{width:100%;max-width:720px;margin:0 auto;padding:28px 32px;}" +
    ".page-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:" + b2.pri + ";margin-bottom:5px;animation:fadeIn 0.5s ease;}" +
    ".page-subtitle{font-size:19px;font-weight:300;color:" + b2.tx + ";margin-bottom:22px;animation:fadeUp 0.5s ease 0.1s both;line-height:1.4;}" +
    ".instruction{font-size:11px;color:" + b2.txL + ";margin-bottom:18px;padding:8px 14px;background:rgba(255,255,255,0.7);border-radius:8px;border-left:3px solid " + b2.pri + ";animation:fadeUp 0.5s ease 0.2s both;}";

  const pageHeader =
    (compTitle ? '<div class="page-title">' + esc(compTitle) + "</div>" : "") +
    (compBody ? '<div class="page-subtitle">' + esc(compBody) + "</div>" : "");

  let h = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(compTitle || "Activity") + "</title><style>" + baseCSS;

  if (sel === "s_flipcard") {
    h +=
      ".grid{display:flex;flex-wrap:wrap;gap:18px;justify-content:center;padding-top:4px;}" +
      ".card{width:200px;height:200px;perspective:800px;cursor:pointer;animation:scaleIn 0.5s ease both;}" +
      ".card:nth-child(1){animation-delay:0.2s}.card:nth-child(2){animation-delay:0.35s}.card:nth-child(3){animation-delay:0.5s}.card:nth-child(4){animation-delay:0.65s}" +
      ".card-inner{width:100%;height:100%;position:relative;transition:transform 0.7s cubic-bezier(0.4,0,0.2,1);transform-style:preserve-3d;}" +
      ".card.flipped .card-inner{transform:rotateY(180deg);}" +
      ".face{position:absolute;width:100%;height:100%;backface-visibility:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:22px;border-radius:16px;}" +
      ".front{background:rgba(255,255,255,0.9);backdrop-filter:blur(10px);border:1px solid rgba(0,0,0,0.06);box-shadow:0 4px 24px rgba(0,0,0,0.06);}" +
      ".front .icon{width:44px;height:44px;background:linear-gradient(135deg," + b2.pri + "," + b2.priDk + ");border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:14px;color:#fff;font-size:18px;font-weight:700;}" +
      ".front h3{font-size:14px;font-weight:700;color:" + b2.tx + ";margin-bottom:6px;text-align:center;}" +
      ".front span{font-size:10px;color:" + b2.pri + ";font-weight:600;opacity:0.7;}" +
      ".back{background:linear-gradient(135deg," + b2.pri + "," + b2.priDk + ");transform:rotateY(180deg);border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.12);}" +
      ".back p{font-size:12px;color:rgba(255,255,255,0.95);text-align:center;line-height:1.7;font-weight:300;}" +
      ".back .flip-hint{position:absolute;bottom:12px;font-size:9px;color:rgba(255,255,255,0.45);}";
    h += '</style></head><body><div class="container">';
    h += pageHeader + '<div class="grid">';
    items.forEach((it, i) => {
      const hasImg = it.img && it.img.trim();
      const iconHtml = hasImg
        ? '<img src="' + esc(it.img) + '" style="width:48px;height:48px;object-fit:contain;margin-bottom:14px;border-radius:8px;"/>'
        : '<div class="icon">' + (it.icon || String(i + 1).padStart(2, "0")) + "</div>";
      h += '<div class="card" onclick="this.classList.toggle(\'flipped\')"><div class="card-inner"><div class="face front">' + iconHtml + "<h3>" + esc(it.title) + "</h3><span>Tap to flip</span></div><div class=\"face back\"><p>" + esc(it.desc) + '</p><span class="flip-hint">Tap to return</span></div></div></div>';
    });
    h += "</div></div></body></html>";
  } else if (sel === "s_accordion") {
    h +=
      ".item{margin-bottom:10px;border-radius:14px;overflow:hidden;background:rgba(255,255,255,0.85);backdrop-filter:blur(8px);box-shadow:0 2px 12px rgba(0,0,0,0.04);border:1px solid rgba(0,0,0,0.05);animation:fadeUp 0.5s ease both;transition:box-shadow 0.3s;}" +
      ".item:nth-child(1){animation-delay:0.15s}.item:nth-child(2){animation-delay:0.25s}.item:nth-child(3){animation-delay:0.35s}.item:nth-child(4){animation-delay:0.45s}" +
      ".item:hover{box-shadow:0 4px 20px rgba(0,0,0,0.08);}" +
      ".header{padding:18px 22px;cursor:pointer;font-size:14px;font-weight:600;display:flex;align-items:center;transition:all 0.3s;}" +
      ".header .num{width:28px;height:28px;background:linear-gradient(135deg," + b2.pri + "," + b2.priDk + ");border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;margin-right:14px;flex-shrink:0;}" +
      ".header .label{flex:1;color:" + b2.tx + ";}" +
      ".header .arrow{width:28px;height:28px;background:" + b2.priLt + ";border-radius:50%;display:flex;align-items:center;justify-content:center;color:" + b2.pri + ";transition:all 0.4s cubic-bezier(0.4,0,0.2,1);font-size:12px;flex-shrink:0;}" +
      ".item.open .arrow{transform:rotate(180deg);background:" + b2.pri + ";color:#fff;}" +
      ".body{max-height:0;overflow:hidden;transition:max-height 0.5s cubic-bezier(0.4,0,0.2,1);}" +
      ".body-inner{padding:0 22px 20px 64px;font-size:13px;color:" + b2.txL + ";line-height:1.8;}" +
      ".item.open .body{max-height:300px;}";
    h += '</style></head><body><div class="container">';
    h += pageHeader;
    items.forEach((it, i) => {
      h += '<div class="item" onclick="this.classList.toggle(\'open\')"><div class="header"><span class="num">' + (i + 1) + '</span><span class="label">' + esc(it.title) + '</span><span class="arrow">\u25BC</span></div><div class="body"><div class="body-inner">' + esc(it.desc) + "</div></div></div>";
    });
    h += "</div></body></html>";
  } else if (sel === "s_tabs") {
    h +=
      ".tab-bar{display:flex;gap:4px;background:rgba(255,255,255,0.6);backdrop-filter:blur(8px);border-radius:12px;padding:4px;margin-bottom:20px;border:1px solid rgba(0,0,0,0.05);animation:fadeUp 0.5s ease 0.1s both;}" +
      ".tab{flex:1;padding:12px 8px;cursor:pointer;font-size:12px;font-weight:600;color:" + b2.txL + ";border-radius:10px;text-align:center;transition:all 0.35s cubic-bezier(0.4,0,0.2,1);}" +
      ".tab:hover{color:" + b2.tx + ";}" +
      ".tab.active{background:linear-gradient(135deg," + b2.pri + "," + b2.priDk + ");color:#fff;box-shadow:0 4px 16px " + b2.pri + "33;}" +
      ".panel{display:none;animation:fadeUp 0.4s ease both;}.panel.active{display:block;}" +
      ".panel-card{background:rgba(255,255,255,0.85);backdrop-filter:blur(8px);border-radius:16px;padding:24px;box-shadow:0 2px 16px rgba(0,0,0,0.05);border:1px solid rgba(0,0,0,0.05);}" +
      ".panel-card p{font-size:13px;color:" + b2.tx + ";line-height:1.85;}";
    h += '</style></head><body><div class="container">';
    h += pageHeader + '<div class="tab-bar">';
    items.forEach((it, i) => {
      h += '<div class="tab' + (i === 0 ? " active" : "") + '" onclick="switchTab(' + i + ')">' + esc(it.title) + "</div>";
    });
    h += "</div>";
    items.forEach((it, i) => {
      h += '<div id="p' + i + '" class="panel' + (i === 0 ? " active" : "") + '"><div class="panel-card"><p>' + esc(it.desc) + "</p></div></div>";
    });
    h += "" + scTag('function switchTab(idx){document.querySelectorAll(".tab").forEach(function(t,i){t.classList.toggle("active",i===idx);});document.querySelectorAll(".panel").forEach(function(p,i){p.classList.toggle("active",i===idx);});}');
    h += "</div></body></html>";
  } else if (sel === "s_reveal") {
    h +=
      ".reveal-item{margin-bottom:12px;animation:fadeUp 0.5s ease both;}" +
      ".reveal-item:nth-child(1){animation-delay:0.15s}.reveal-item:nth-child(2){animation-delay:0.25s}.reveal-item:nth-child(3){animation-delay:0.35s}" +
      ".reveal-btn{width:100%;padding:16px 22px;border:none;background:rgba(255,255,255,0.85);backdrop-filter:blur(8px);color:" + b2.tx + ";font-size:14px;font-weight:600;cursor:pointer;border-radius:14px;text-align:left;display:flex;align-items:center;gap:14px;transition:all 0.3s;box-shadow:0 2px 12px rgba(0,0,0,0.04);border:1px solid rgba(0,0,0,0.05);}" +
      ".reveal-btn:hover{box-shadow:0 4px 20px rgba(0,0,0,0.08);transform:translateY(-1px);}" +
      ".reveal-btn .icon{width:36px;height:36px;background:linear-gradient(135deg," + b2.priLt + "," + b2.pri + "22);border-radius:10px;display:flex;align-items:center;justify-content:center;color:" + b2.pri + ";font-size:14px;transition:all 0.4s;flex-shrink:0;}" +
      ".reveal-btn.open .icon{background:linear-gradient(135deg," + b2.pri + "," + b2.priDk + ");color:#fff;transform:rotate(90deg);}" +
      ".reveal-content{max-height:0;overflow:hidden;transition:max-height 0.5s cubic-bezier(0.4,0,0.2,1),opacity 0.3s;opacity:0;}" +
      ".reveal-content.open{max-height:300px;opacity:1;}" +
      ".reveal-inner{padding:16px 22px 20px 72px;font-size:13px;color:" + b2.txL + ";line-height:1.85;}";
    h += '</style></head><body><div class="container">';
    h += pageHeader;
    items.forEach((it, i) => {
      h += '<div class="reveal-item"><button class="reveal-btn" id="btn' + i + '" onclick="toggleReveal(' + i + ')"><span class="icon">\u25B6</span>' + esc(it.title) + '</button><div class="reveal-content" id="r' + i + '"><div class="reveal-inner">' + esc(it.desc) + "</div></div></div>";
    });
    h += "" + scTag('function toggleReveal(i){document.getElementById("btn"+i).classList.toggle("open");document.getElementById("r"+i).classList.toggle("open");}');
    h += "</div></body></html>";
  } else if (sel === "s_stepper") {
    h +=
      ".stepper-track{display:flex;align-items:center;margin-bottom:28px;animation:fadeUp 0.5s ease 0.1s both;}" +
      ".step-dot{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:" + b2.txL + ";background:rgba(255,255,255,0.8);border:2px solid " + b2.n2 + ";transition:all 0.4s cubic-bezier(0.4,0,0.2,1);flex-shrink:0;z-index:1;}" +
      ".step-dot.active{background:linear-gradient(135deg," + b2.pri + "," + b2.priDk + ");color:#fff;border-color:" + b2.pri + ";box-shadow:0 4px 16px " + b2.pri + "44;}" +
      ".step-dot.done{background:" + b2.pri + ";color:#fff;border-color:" + b2.pri + ";}" +
      ".step-line{flex:1;height:3px;background:" + b2.n2 + ";position:relative;overflow:hidden;border-radius:2px;}.step-line .fill{position:absolute;top:0;left:0;height:100%;background:linear-gradient(90deg," + b2.pri + "," + b2.priDk + ");transition:width 0.5s;width:0;border-radius:2px;}.step-line.done .fill{width:100%;}" +
      ".step-panel{display:none;animation:fadeUp 0.4s ease both;}.step-panel.active{display:block;}" +
      ".step-card{background:rgba(255,255,255,0.85);backdrop-filter:blur(8px);border-radius:16px;padding:24px;box-shadow:0 2px 16px rgba(0,0,0,0.05);border:1px solid rgba(0,0,0,0.05);margin-bottom:20px;}" +
      ".step-card .step-num{font-size:10px;color:" + b2.pri + ";font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;}" +
      ".step-card h3{font-size:17px;font-weight:700;color:" + b2.tx + ";margin-bottom:8px;}" +
      ".step-card p{font-size:13px;color:" + b2.txL + ";line-height:1.85;}" +
      ".step-nav{display:flex;gap:10px;}.step-nav button{padding:12px 28px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.25s;}" +
      ".btn-prev{border:1.5px solid " + b2.n2 + ";background:rgba(255,255,255,0.8);color:" + b2.txL + ";}.btn-prev:hover{border-color:" + b2.pri + ";color:" + b2.pri + ";}" +
      ".btn-next{border:none;background:linear-gradient(135deg," + b2.pri + "," + b2.priDk + ");color:#fff;box-shadow:0 4px 16px " + b2.pri + "33;}.btn-next:hover{transform:translateY(-1px);}";
    h += '</style></head><body><div class="container">';
    h += pageHeader + '<div class="stepper-track">';
    items.forEach((_, i) => {
      h += '<div class="step-dot' + (i === 0 ? " active" : "") + '" id="d' + i + '">' + (i + 1) + "</div>";
      if (i < items.length - 1) h += '<div class="step-line" id="l' + i + '"><div class="fill"></div></div>';
    });
    h += "</div>";
    items.forEach((it, i) => {
      h += '<div class="step-panel' + (i === 0 ? " active" : "") + '" id="s' + i + '"><div class="step-card"><div class="step-num">Step ' + (i + 1) + " of " + items.length + "</div><h3>" + esc(it.title) + "</h3><p>" + esc(it.desc) + "</p></div></div>";
    });
    h += '<div class="step-nav"><button class="btn-prev" onclick="go(-1)">\u2190 Previous</button><button class="btn-next" onclick="go(1)">Next \u2192</button></div>';
    h += "" + scTag('var cur=0,max=' + items.length + ';function go(d){cur=Math.max(0,Math.min(max-1,cur+d));for(var i=0;i<max;i++){document.getElementById("s"+i).classList.toggle("active",i===cur);var dot=document.getElementById("d"+i);dot.className="step-dot";if(i<cur)dot.classList.add("done");if(i===cur)dot.classList.add("active");if(i<max-1){document.getElementById("l"+i).classList.toggle("done",i<cur);}}}');
    h += "</div></body></html>";
  } else if (sel === "s_stacked") {
    h +=
      ".cards-wrap{display:flex;justify-content:center;align-items:flex-end;min-height:320px;position:relative;padding:20px 10px;}" +
      ".scard{width:150px;min-height:190px;background:" + b2.n1 + ";border-radius:18px;position:absolute;cursor:pointer;transition:all 0.5s cubic-bezier(0.4,0,0.2,1);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px 16px;text-align:center;border:1px solid rgba(0,0,0,0.04);box-shadow:0 4px 20px rgba(0,0,0,0.06);}" +
      ".scard:hover{box-shadow:0 8px 32px rgba(0,0,0,0.1);transform-origin:bottom center;}" +
      ".scard .s-num{font-size:28px;font-weight:200;color:" + b2.pri + ";margin-bottom:10px;opacity:0.6;}" +
      ".scard .s-title{font-size:12px;font-weight:700;color:" + b2.pri + ";line-height:1.4;}" +
      ".scard .s-flip{position:absolute;bottom:10px;right:12px;width:22px;height:22px;background:" + b2.n2 + ";border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;color:" + b2.txL + ";transition:all 0.3s;}" +
      ".scard:hover .s-flip{background:" + b2.pri + ";color:#fff;}" +
      ".scard.active{width:280px;min-height:auto;z-index:20!important;background:rgba(255,255,255,0.97);backdrop-filter:blur(12px);box-shadow:0 12px 48px rgba(0,0,0,0.15);border:2px dashed " + b2.pri + "44;padding:24px;transform:translateX(0) translateY(-10px) rotate(0deg)!important;}" +
      ".scard.active .s-desc{display:block;}" +
      ".scard.active .s-flip{background:" + b2.pri + ";color:#fff;transform:rotate(45deg);}" +
      ".s-desc{display:none;font-size:12px;color:" + b2.txL + ";line-height:1.7;margin-top:10px;}";
    h += '</style></head><body><div class="container">';
    h += pageHeader;
    h += '<div class="cards-wrap">';
    const total = items.length;
    const spread = Math.min(total * 85, 420);
    items.forEach((it, i) => {
      const pct = total === 1 ? 0.5 : i / (total - 1);
      const x = -spread / 2 + pct * spread;
      const yWave = -Math.sin(pct * Math.PI) * 15;
      const r = (pct - 0.5) * (total <= 3 ? 10 : 14);
      const num = String(i + 1).padStart(2, "0");
      const hasImg = it.img && it.img.trim();
      const visual = hasImg
        ? '<img src="' + esc(it.img) + '" style="width:48px;height:48px;object-fit:contain;margin-bottom:10px;border-radius:8px;"/>'
        : '<div class="s-num">' + num + "</div>";
      h += '<div class="scard" style="transform:translateX(' + x.toFixed(0) + "px) translateY(" + yWave.toFixed(0) + "px) rotate(" + r.toFixed(1) + 'deg);z-index:' + (10 + i) + ';" onclick="var c=this;if(c.classList.contains(\'active\')){c.classList.remove(\'active\');}else{document.querySelectorAll(\'.scard\').forEach(function(s){s.classList.remove(\'active\');});c.classList.add(\'active\');}">';
      h += visual;
      h += '<div class="s-title">' + esc(it.title) + "</div>";
      h += '<div class="s-desc">' + esc(it.desc) + "</div>";
      h += '<div class="s-flip">+</div></div>';
    });
    h += "</div></div></body></html>";
  } else if (sel === "s_sort") {
    h +=
      ".sort-card{background:rgba(255,255,255,0.85);backdrop-filter:blur(8px);border-radius:16px;padding:24px;box-shadow:0 2px 16px rgba(0,0,0,0.05);border:1px solid rgba(0,0,0,0.05);animation:scaleIn 0.5s ease 0.2s both;}" +
      ".item{padding:14px 18px;margin-bottom:8px;border:2px solid rgba(0,0,0,0.06);border-radius:12px;background:rgba(255,255,255,0.9);font-size:13px;font-weight:500;color:" + b2.tx + ";cursor:grab;display:flex;align-items:center;gap:12px;transition:all 0.25s;user-select:none;}" +
      ".item:hover{border-color:" + b2.pri + ";box-shadow:0 4px 16px rgba(0,0,0,0.06);}" +
      ".item:active{cursor:grabbing;transform:scale(1.02);box-shadow:0 8px 24px rgba(0,0,0,0.1);}" +
      ".num{width:28px;height:28px;background:linear-gradient(135deg," + b2.pri + "," + b2.priDk + ");border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0;}" +
      ".grip{color:" + b2.n2 + ";font-size:18px;margin-left:auto;}.item:hover .grip{color:" + b2.pri + ";}" +
      ".check-btn{margin-top:16px;padding:12px 28px;border:none;background:linear-gradient(135deg," + b2.pri + "," + b2.priDk + ");color:#fff;font-size:13px;font-weight:600;border-radius:10px;cursor:pointer;box-shadow:0 4px 16px " + b2.pri + "33;transition:all 0.25s;}.check-btn:hover{transform:translateY(-1px);}" +
      ".feedback{margin-top:14px;padding:14px 18px;border-radius:12px;font-size:13px;font-weight:600;display:none;animation:scaleIn 0.3s ease;}.feedback.show{display:block;}" +
      ".item.correct-pos{border-color:" + b2.pri + ";background:" + b2.priLt + ";}";
    h += '</style></head><body><div class="container">';
    h += pageHeader;
    h += '<div class="sort-card"><div class="instruction">Drag and drop to reorder, then check your answer</div><div id="list">';
    const shuffled = shuffle(items);
    shuffled.forEach((it, i) => {
      h += '<div class="item" draggable="true" data-correct="' + items.indexOf(it) + '" ondragstart="ds(event)" ondragover="event.preventDefault()" ondrop="dp(event,this)"><span class="num">' + (i + 1) + "</span>" + esc(it.title) + '<span class="grip">\u2807</span></div>';
    });
    h += '</div><button class="check-btn" onclick="checkSort()">Check Order</button><div class="feedback" id="fb"></div></div>';
    h += "" + scTag('var dragEl=null;function ds(e){dragEl=e.target.closest(".item");e.dataTransfer.effectAllowed="move";}function dp(e,target){e.preventDefault();var t=target.closest(".item");if(!t||t===dragEl)return;var list=document.getElementById("list");var items=Array.from(list.children);var di=items.indexOf(dragEl),ti=items.indexOf(t);if(di<ti)list.insertBefore(dragEl,t.nextSibling);else list.insertBefore(dragEl,t);renum();}function renum(){document.querySelectorAll(".item .num").forEach(function(n,i){n.textContent=i+1;});}function checkSort(){var items=Array.from(document.querySelectorAll(".item"));var correct=items.every(function(el,i){return parseInt(el.dataset.correct)===i;});var fb=document.getElementById("fb");fb.classList.add("show");items.forEach(function(el,i){el.classList.toggle("correct-pos",parseInt(el.dataset.correct)===i);});if(correct){fb.textContent="\\u2705 Perfect order!";fb.style.background="' + b2.priLt + '";fb.style.color="' + b2.priDk + '";}else{fb.textContent="\\u274c Not quite. Green items are correctly placed.";fb.style.background="#fef2f2";fb.style.color="#c0392b";}}');
    h += "</div></body></html>";
  } else if (sel === "s_match") {
    h +=
      ".match-card{background:rgba(255,255,255,0.85);backdrop-filter:blur(8px);border-radius:16px;padding:24px;box-shadow:0 2px 16px rgba(0,0,0,0.05);border:1px solid rgba(0,0,0,0.05);animation:scaleIn 0.5s ease 0.2s both;}" +
      ".cols{display:flex;gap:16px;}.col{flex:1;}" +
      ".col-head{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:" + b2.txL + ";margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid " + b2.n2 + ";}" +
      ".term,.def{padding:12px 16px;margin-bottom:8px;border:2px solid rgba(0,0,0,0.06);border-radius:10px;font-size:12px;font-weight:500;cursor:pointer;transition:all 0.3s;background:rgba(255,255,255,0.9);color:" + b2.tx + ";}" +
      ".term:hover,.def:hover{border-color:" + b2.pri + ";transform:translateX(2px);}" +
      ".term.selected{border-color:" + b2.pri + ";background:" + b2.priLt + ";box-shadow:0 0 0 3px " + b2.pri + "22;}" +
      ".term.matched,.def.matched{border-color:" + b2.pri + ";background:" + b2.priLt + ";opacity:0.6;pointer-events:none;}" +
      '.term.matched::after{content:"\\2713";position:absolute;right:12px;top:50%;transform:translateY(-50%);color:' + b2.pri + ";font-weight:700;}" +
      ".term.matched{position:relative;}" +
      ".feedback{margin-top:14px;padding:12px 16px;border-radius:10px;font-size:12px;font-weight:600;text-align:center;display:none;animation:scaleIn 0.3s ease;}.feedback.show{display:block;}";
    h += '</style></head><body><div class="container">';
    h += pageHeader;
    h += '<div class="match-card"><div class="instruction">Select a term, then click its matching definition</div><div class="cols"><div class="col"><div class="col-head">Terms</div>';
    items.forEach((it, i) => {
      h += '<div class="term" data-idx="' + i + '" onclick="pickTerm(this)">' + esc(it.title) + "</div>";
    });
    h += '</div><div class="col"><div class="col-head">Definitions</div>';
    const shuffDefs = shuffle(items);
    shuffDefs.forEach((it) => {
      const origIdx = items.indexOf(it);
      h += '<div class="def" data-idx="' + origIdx + '" onclick="pickDef(this)">' + esc(it.desc) + "</div>";
    });
    h += '</div></div><div class="feedback" id="fb"></div></div>';
    h += "" + scTag('var selTerm=null,matched=0,total=' + items.length + ';function pickTerm(el){if(el.classList.contains("matched"))return;document.querySelectorAll(".term").forEach(function(t){t.classList.remove("selected");});el.classList.add("selected");selTerm=el;}function pickDef(el){if(!selTerm||el.classList.contains("matched"))return;var fb=document.getElementById("fb");fb.classList.add("show");if(selTerm.dataset.idx===el.dataset.idx){selTerm.classList.remove("selected");selTerm.classList.add("matched");el.classList.add("matched");matched++;selTerm=null;if(matched===total){fb.textContent="\\u2705 All matched! Great work.";fb.style.background="' + b2.priLt + '";fb.style.color="' + b2.priDk + '";}else{fb.textContent="\\u2705 Correct! "+(total-matched)+" remaining.";fb.style.background="' + b2.priLt + '";fb.style.color="' + b2.priDk + '";}}else{fb.textContent="\\u274c Not a match. Try again.";fb.style.background="#fef2f2";fb.style.color="#c0392b";}}');
    h += "</div></body></html>";
  } else if (sel === "s_timeline_i") {
    h +=
      ".tl{position:relative;padding-left:48px;}" +
      ".tl-line{position:absolute;left:22px;top:8px;bottom:8px;width:3px;background:linear-gradient(180deg," + b2.pri + "22," + b2.pri + "," + b2.pri + "22);border-radius:2px;}" +
      ".tl-item{position:relative;margin-bottom:14px;cursor:pointer;animation:fadeUp 0.5s ease both;transition:transform 0.2s;}" +
      ".tl-item:nth-child(2){animation-delay:0.15s}.tl-item:nth-child(3){animation-delay:0.25s}.tl-item:nth-child(4){animation-delay:0.35s}.tl-item:nth-child(5){animation-delay:0.45s}" +
      ".tl-item:hover{transform:translateX(4px);}" +
      ".tl-dot{position:absolute;left:-36px;top:16px;width:18px;height:18px;background:#fff;border:3px solid " + b2.n2 + ";border-radius:50%;transition:all 0.4s cubic-bezier(0.4,0,0.2,1);z-index:1;}" +
      ".tl-item.active .tl-dot{background:" + b2.pri + ";border-color:" + b2.pri + ";box-shadow:0 0 0 5px " + b2.pri + "22;}" +
      ".tl-card{background:rgba(255,255,255,0.85);backdrop-filter:blur(8px);border-radius:14px;padding:18px 20px;box-shadow:0 2px 12px rgba(0,0,0,0.04);border:1px solid rgba(0,0,0,0.05);transition:all 0.3s;}" +
      ".tl-item.active .tl-card{border-color:" + b2.pri + "33;box-shadow:0 4px 20px rgba(0,0,0,0.08);}" +
      ".tl-title{font-size:14px;font-weight:700;color:" + b2.tx + ";transition:color 0.3s;}" +
      ".tl-item.active .tl-title{color:" + b2.pri + ";}" +
      ".tl-desc{font-size:12px;color:" + b2.txL + ";line-height:1.7;max-height:0;overflow:hidden;transition:max-height 0.5s cubic-bezier(0.4,0,0.2,1),opacity 0.3s,margin 0.3s;opacity:0;margin-top:0;}" +
      ".tl-item.active .tl-desc{max-height:200px;opacity:1;margin-top:8px;}";
    h += '</style></head><body><div class="container">';
    h += pageHeader;
    h += '<div class="tl"><div class="tl-line"></div>';
    items.forEach((it, i) => {
      h += '<div class="tl-item' + (i === 0 ? " active" : "") + '" onclick="toggleTL(this)"><div class="tl-dot"></div><div class="tl-card"><div class="tl-title">' + esc(it.title) + '</div><div class="tl-desc">' + esc(it.desc) + "</div></div></div>";
    });
    h += "</div>" + scTag('function toggleTL(el){el.classList.toggle("active");}');
    h += "</div></body></html>";
  } else if (sel === "s_cycle") {
    const n = items.length;
    const radius = 130;
    h +=
      ".cycle-wrap{position:relative;width:340px;height:340px;margin:0 auto;}" +
      ".cycle-ring{position:absolute;inset:40px;border-radius:50%;border:4px solid " + b2.n2 + ";background:rgba(255,255,255,0.5);}" +
      ".cycle-center{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;z-index:5;pointer-events:none;width:120px;}" +
      ".cycle-center .cc-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:" + b2.pri + ";margin-bottom:4px;}" +
      ".cycle-center .cc-count{font-size:11px;color:" + b2.txL + ";}" +
      ".node{position:absolute;width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg," + b2.pri + "," + b2.priDk + ");cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.4s cubic-bezier(0.4,0,0.2,1);z-index:10;border:3px solid #fff;box-shadow:0 4px 20px " + b2.pri + "33;animation:dotPop 0.5s ease both;}" +
      ".node:nth-child(1){animation-delay:0.1s}.node:nth-child(2){animation-delay:0.2s}.node:nth-child(3){animation-delay:0.25s}.node:nth-child(4){animation-delay:0.35s}" +
      ".node:hover{transform-origin:center;box-shadow:0 6px 28px " + b2.pri + "55;}" +
      ".node .n-icon{font-size:24px;filter:brightness(10);transition:transform 0.3s;}" +
      ".node.active{background:#fff;border-color:" + b2.pri + ";box-shadow:0 0 0 5px " + b2.pri + "22,0 8px 32px rgba(0,0,0,0.12);}" +
      ".node.active .n-icon{filter:none;}" +
      ".node-label{position:absolute;font-size:11px;font-weight:700;color:" + b2.tx + ";text-align:center;width:100px;pointer-events:none;transition:color 0.3s;}" +
      ".node.active~.node-label,.active-label{color:" + b2.pri + ";}" +
      ".detail-panel{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:180px;background:rgba(255,255,255,0.95);backdrop-filter:blur(12px);border-radius:14px;padding:16px 18px;box-shadow:0 8px 32px rgba(0,0,0,0.12);border:1px solid rgba(0,0,0,0.05);z-index:15;display:none;animation:scaleIn 0.3s ease;}" +
      ".detail-panel.show{display:block;}" +
      ".detail-panel .dp-icon{font-size:22px;margin-bottom:6px;}" +
      ".detail-panel .dp-title{font-size:13px;font-weight:700;color:" + b2.pri + ";margin-bottom:6px;}" +
      ".detail-panel .dp-desc{font-size:11px;color:" + b2.txL + ";line-height:1.7;}" +
      ".arrow-hint{position:absolute;font-size:22px;color:" + b2.n2 + ";pointer-events:none;animation:fadeIn 1s ease 0.5s both;}";
    h += '</style></head><body><div class="container">';
    h += pageHeader;
    h += '<div class="cycle-wrap"><div class="cycle-ring"></div>';
    h += '<div class="cycle-center"><div class="cc-title">Cycle</div><div class="cc-count">' + n + " stages</div></div>";
    h += '<div class="arrow-hint" style="top:38px;left:50%;transform:translateX(-50%) rotate(90deg);">\u27F3</div>';
    items.forEach((it, i) => {
      const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
      const cx = 170 + radius * Math.cos(angle) - 36;
      const cy = 170 + radius * Math.sin(angle) - 36;
      const lx = 170 + (radius + 52) * Math.cos(angle) - 50;
      const ly = 170 + (radius + 52) * Math.sin(angle) - 8;
      h += '<div class="node" id="nd' + i + '" style="left:' + cx + "px;top:" + cy + 'px;" onclick="toggleNode(' + i + ')"><span class="n-icon">' + (it.icon || "\u25C9") + "</span></div>";
      h += '<div class="node-label" id="nl' + i + '" style="left:' + lx + "px;top:" + ly + 'px;">' + esc(it.title) + "</div>";
    });
    h += '<div class="detail-panel" id="dp"><div class="dp-icon" id="dpi"></div><div class="dp-title" id="dpt"></div><div class="dp-desc" id="dpd"></div></div>';
    h += "</div></div>";
    h += "" + scTag('var data=' + JSON.stringify(items.map((it) => ({ title: it.title, icon: it.icon || "\u25C9", desc: it.desc || "" }))) + ';var activeNode=-1;function toggleNode(i){var nodes=document.querySelectorAll(".node");var dp=document.getElementById("dp");if(activeNode===i){nodes[i].classList.remove("active");dp.classList.remove("show");activeNode=-1;}else{nodes.forEach(function(n){n.classList.remove("active");});nodes[i].classList.add("active");document.getElementById("dpi").textContent=data[i].icon;document.getElementById("dpt").textContent=data[i].title;document.getElementById("dpd").textContent=data[i].desc;dp.classList.add("show");activeNode=i;}}');
    h += "</body></html>";
  } else if (sel === "s_quiz") {
    const question = items[0] ? items[0].title : "Question goes here?";
    const opts = items.slice(1);
    const correctIdx = opts.findIndex((o) => o.desc === "1");
    h +=
      ".quiz-wrap{background:rgba(255,255,255,0.92);backdrop-filter:blur(10px);border-radius:18px;padding:28px;box-shadow:0 4px 24px rgba(0,0,0,0.07);border:1px solid rgba(0,0,0,0.05);animation:fadeUp 0.5s ease 0.1s both;}" +
      ".question{font-size:17px;font-weight:400;color:" + b2.tx + ";line-height:1.55;margin-bottom:22px;padding-bottom:18px;border-bottom:1px solid " + b2.n2 + ";}" +
      ".opt{padding:13px 18px;margin-bottom:10px;border:2px solid rgba(0,0,0,0.07);border-radius:12px;font-size:13px;font-weight:500;color:" + b2.tx + ";cursor:pointer;display:flex;align-items:center;gap:12px;transition:all 0.25s;background:rgba(255,255,255,0.8);}" +
      ".opt:hover{border-color:" + b2.pri + ";background:" + b2.priLt + ";}" +
      ".opt.sel{border-color:" + b2.pri + ";background:" + b2.priLt + ";}" +
      ".opt.correct{border-color:#22c55e;background:#f0fdf4;color:#15803d;}" +
      ".opt.wrong{border-color:#ef4444;background:#fef2f2;color:#b91c1c;}" +
      ".radio{width:18px;height:18px;border:2px solid " + b2.n2 + ";border-radius:50%;flex-shrink:0;transition:all 0.2s;display:flex;align-items:center;justify-content:center;}" +
      ".opt.sel .radio,.opt.correct .radio{border-color:#22c55e;background:#22c55e;}" +
      ".opt.wrong .radio{border-color:#ef4444;background:#ef4444;}" +
      ".radio-dot{width:7px;height:7px;border-radius:50%;background:#fff;display:none;}" +
      ".opt.sel .radio-dot,.opt.correct .radio-dot,.opt.wrong .radio-dot{display:block;}" +
      ".chk-btn{margin-top:18px;padding:12px 28px;border:none;background:linear-gradient(135deg," + b2.pri + "," + b2.priDk + ");color:#fff;font-size:13px;font-weight:600;border-radius:10px;cursor:pointer;box-shadow:0 4px 14px " + b2.pri + "33;transition:all 0.2s;}" +
      ".chk-btn:hover{transform:translateY(-1px);}.chk-btn:disabled{opacity:0.4;cursor:not-allowed;transform:none;}" +
      ".explanation{margin-top:14px;padding:14px 18px;background:" + b2.priLt + ";border-radius:10px;border-left:3px solid " + b2.pri + ";font-size:12px;color:" + b2.tx + ";line-height:1.7;display:none;animation:fadeUp 0.4s ease;}" +
      ".explanation.show{display:block;}" +
      ".res-badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;margin-bottom:8px;}" +
      ".res-ok{background:#f0fdf4;color:#15803d;border:1.5px solid #22c55e;}" +
      ".res-no{background:#fef2f2;color:#b91c1c;border:1.5px solid #ef4444;}";
    h += '</style></head><body><div class="container">';
    h += pageHeader;
    h += '<div class="quiz-wrap"><div class="question">' + esc(question) + "</div>";
    opts.forEach((o, i) => {
      h += '<div class="opt" id="o' + i + '" onclick="pickOpt(' + i + ')"><span class="radio"><span class="radio-dot"></span></span>' + esc(o.title) + "</div>";
    });
    h += '<button class="chk-btn" id="chkBtn" onclick="checkAns()" disabled>Check Answer</button>';
    h += '<div class="explanation" id="expl"><div id="resBadge" class="res-badge"></div><div>' + (compBody ? esc(compBody) : "") + "</div></div></div>";
    h += scTag('var sel=-1,cor=' + correctIdx + ',done=false;function pickOpt(i){if(done)return;document.querySelectorAll(".opt").forEach(function(o){o.classList.remove("sel");});document.getElementById("o"+i).classList.add("sel");sel=i;document.getElementById("chkBtn").disabled=false;}function checkAns(){if(sel<0||done)return;done=true;document.getElementById("chkBtn").disabled=true;document.querySelectorAll(".opt").forEach(function(o,i){if(i===cor)o.classList.add("correct");else if(i===sel&&i!==cor)o.classList.add("wrong");});var ex=document.getElementById("expl");ex.classList.add("show");var b=document.getElementById("resBadge");if(sel===cor){b.textContent="\u2713 Correct!";b.className="res-badge res-ok";}else{b.textContent="\u2717 Not quite";b.className="res-badge res-no";}}');
    h += "</div></body></html>";
  } else if (sel === "s_poll") {
    const pcts = items.map((it) => parseInt(it.desc || "25") || 25);
    h +=
      ".poll-wrap{background:rgba(255,255,255,0.92);backdrop-filter:blur(10px);border-radius:18px;padding:28px;box-shadow:0 4px 24px rgba(0,0,0,0.07);border:1px solid rgba(0,0,0,0.05);animation:fadeUp 0.5s ease 0.1s both;}" +
      ".poll-opt{padding:13px 18px;margin-bottom:10px;border:2px solid rgba(0,0,0,0.07);border-radius:12px;font-size:13px;font-weight:500;color:" + b2.tx + ";cursor:pointer;transition:all 0.25s;background:rgba(255,255,255,0.8);}" +
      ".poll-opt:hover{border-color:" + b2.pri + ";transform:translateX(3px);}" +
      ".poll-opt.sel{border-color:" + b2.pri + ";background:" + b2.priLt + ";}" +
      ".vote-btn{margin-top:18px;padding:12px 28px;border:none;background:linear-gradient(135deg," + b2.pri + "," + b2.priDk + ");color:#fff;font-size:13px;font-weight:600;border-radius:10px;cursor:pointer;box-shadow:0 4px 14px " + b2.pri + "33;transition:all 0.2s;}" +
      ".vote-btn:hover{transform:translateY(-1px);}.vote-btn:disabled{opacity:0.4;cursor:not-allowed;transform:none;}" +
      ".results{display:none;animation:fadeUp 0.4s ease;}.results.show{display:block;}" +
      ".rhead{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:" + b2.txL + ";margin-bottom:16px;}" +
      ".rrow{margin-bottom:14px;}" +
      ".rlabel{font-size:12px;font-weight:600;color:" + b2.tx + ";margin-bottom:6px;display:flex;justify-content:space-between;}" +
      ".rtrack{height:10px;background:" + b2.n2 + ";border-radius:6px;overflow:hidden;}" +
      ".rbar{height:100%;border-radius:6px;width:0;transition:width 0.8s cubic-bezier(0.4,0,0.2,1);background:linear-gradient(90deg," + b2.pri + "," + b2.priDk + ");}" +
      ".rrow.myvote .rbar{background:linear-gradient(90deg," + b2.priDk + "," + b2.pri + ");}" +
      ".rrow.myvote .rlabel{color:" + b2.pri + ";}";
    h += '</style></head><body><div class="container">';
    h += pageHeader;
    h += '<div class="poll-wrap"><div id="vphase">';
    items.forEach((it, i) => {
      h += '<div class="poll-opt" id="po' + i + '" onclick="pickPoll(' + i + ')">' + esc(it.title) + "</div>";
    });
    h += '<button class="vote-btn" id="vbtn" onclick="doVote()" disabled>Submit Vote</button></div>';
    h += '<div class="results" id="rphase"><div class="rhead">Results</div>';
    items.forEach((it, i) => {
      h += '<div class="rrow" id="rr' + i + '"><div class="rlabel"><span>' + esc(it.title) + '</span><span id="rpct' + i + '">' + pcts[i] + '%</span></div><div class="rtrack"><div class="rbar" id="rb' + i + '"></div></div></div>';
    });
    h += "</div></div>";
    h += scTag('var sp=-1,voted=false,pcts=' + JSON.stringify(pcts) + ';function pickPoll(i){if(voted)return;document.querySelectorAll(".poll-opt").forEach(function(o){o.classList.remove("sel");});document.getElementById("po"+i).classList.add("sel");sp=i;document.getElementById("vbtn").disabled=false;}function doVote(){if(sp<0||voted)return;voted=true;document.getElementById("vphase").style.display="none";var rp=document.getElementById("rphase");rp.classList.add("show");setTimeout(function(){pcts.forEach(function(p,i){document.getElementById("rb"+i).style.width=p+"%";if(i===sp)document.getElementById("rr"+i).classList.add("myvote");});},80);}');
    h += "</div></body></html>";
  } else {
    h += '</style></head><body><div class="container"><div style="padding:40px;text-align:center;"><p style="font-size:16px;font-weight:600;color:' + b2.tx + ';margin-bottom:8px;">' + esc(compTitle) + '</p><p style="color:' + b2.txL + ';">This interactive component is coming soon.</p></div></div></body></html>';
  }
  return h;
}
