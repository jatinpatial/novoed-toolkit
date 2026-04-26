#!/usr/bin/env python3
"""Build a standalone vanilla HTML/JS app from the core logic."""

with open("/home/claude/core.js", "r") as f:
    core = f.read()

# Only escape the CLOSING </script> pattern which breaks HTML parser.
# The source uses <\/script> (JS escape) which the browser still interprets
# as </script> when inside an HTML <script> block.
# Replace with string concatenation that produces the same output at runtime.
core = core.replace("<\\/script>", '<\\/scri"+"pt>')

vanilla_ui = r"""
/* ── Vanilla UI Engine ── */
var state = { brand: "bcg", mode: null, sel: null, data: null, output: "", scormPreview: "", search: "" };
function setState(p) { Object.assign(state, p); render(); }
function deepClone(o) { return JSON.parse(JSON.stringify(o)); }
function doSelect(id) {
  var d = deepClone(DEFAULTS[id] || {});
  if (!id.startsWith("s_")) setState({ sel:id, data:d, output:genHTML(id,state.brand,d), scormPreview:"" });
  else setState({ sel:id, data:d, output:"", scormPreview:genSCORMhtml(id,d,state.brand) });
}
function doRegen() {
  if (!state.sel||!state.data) return;
  if (!state.sel.startsWith("s_")) setState({output:genHTML(state.sel,state.brand,state.data)});
  else setState({scormPreview:genSCORMhtml(state.sel,state.data,state.brand)});
}
function switchBrand(k) { state.brand=k; if(state.sel)doRegen(); else render(); }
function updateField(f,v) { state.data[f]=v; }
function updateItem(i,f,v) { state.data.items[i][f]=v; }
function removeItem(i) { state.data.items.splice(i,1); render(); }
function addItem() {
  var t=state.data.items[0]||{}, n={title:""};
  if(t.desc!==undefined)n.desc=""; if(t.desc2!==undefined)n.desc2=""; if(t.icon!==undefined)n.icon="●"; if(t.img!==undefined)n.img="";
  state.data.items.push(n); render();
}
function handleCopy() {
  navigator.clipboard.writeText(state.output).then(function(){
    var b=document.getElementById("copyBtn"); if(b){b.textContent="✓ Copied!";setTimeout(function(){b.textContent="Copy";},1800);}
  });
}
function homeSearchUpdate(val) {
  var box=document.getElementById("searchResults");
  if(!val){box.style.display="none";return;}
  var sq=val.toLowerCase(), b=B[state.brand];
  var all=HTML_COMPS.map(function(c){return Object.assign({},c,{t:"HTML"});}).concat(SCORM_COMPS.map(function(c){return Object.assign({},c,{t:"SCORM"});}));
  var hits=all.filter(function(c){return c.n.toLowerCase().indexOf(sq)>=0||c.d.toLowerCase().indexOf(sq)>=0;});
  if(hits.length===0){box.innerHTML='<div style="padding:16px;text-align:center;font-size:11px;color:#999;">No components match "'+esc(val)+'"</div>';box.style.display="block";return;}
  var h="";hits.slice(0,8).forEach(function(c){
    h+='<div onclick="setState({mode:\''+( c.t==="HTML"?"html":"scorm")+'\',search:\'\'});doSelect(\''+c.id+'\');" style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:1px solid '+b.n1+';" onmouseover="this.style.background=\''+b.n1+'\'" onmouseout="this.style.background=\'transparent\'">';
    h+='<span style="font-size:14px;color:'+b.pri+';">'+c.ic+'</span><div><div style="font-size:12px;font-weight:600;color:'+b.tx+';">'+c.n+'</div><div style="font-size:10px;color:#999;">'+c.d+'</div></div>';
    h+='<span style="margin-left:auto;font-size:9px;padding:2px 6px;background:'+(c.t==="HTML"?b.priLt:"#FFF8E6")+';color:'+(c.t==="HTML"?b.pri:"#856404")+';border-radius:4px;font-weight:600;">'+c.t+'</span></div>';
  });
  box.innerHTML=h;box.style.display="block";
}
function brandBtns(sz) {
  var b=state.brand, r='<div style="display:flex;background:#f0f0f0;border-radius:'+(sz==="sm"?6:8)+'px;overflow:hidden;">';
  Object.keys(B).forEach(function(k){var v=B[k],p=sz==="sm"?"5px 12px":"8px 18px",f=sz==="sm"?11:12;
    r+='<button onclick="switchBrand(\''+k+'\')" style="padding:'+p+';border:none;cursor:pointer;font-size:'+f+'px;font-weight:600;background:'+(b===k?v.pri:"transparent")+';color:'+(b===k?"#fff":"#888")+';">'+v.n+'</button>';
  }); return r+'</div>';
}
function render() {
  var root=document.getElementById("root"), b=B[state.brand];
  if(!state.mode){
    var hm='<div style="color:'+b.tx+';">';
    // Banner full width
    hm+='<div style="background:'+b.grad+';padding:40px 48px;margin-bottom:28px;position:relative;overflow:hidden;">';
    hm+='<svg style="position:absolute;top:0;right:0;width:400px;height:100%;opacity:0.12;" viewBox="0 0 400 200" fill="none"><circle cx="340" cy="40" r="90" fill="#fff"/><circle cx="260" cy="170" r="55" fill="#fff"/><circle cx="390" cy="140" r="65" fill="#fff"/><rect x="180" y="15" width="45" height="45" rx="12" fill="#fff" transform="rotate(20 202 37)"/><rect x="280" y="100" width="35" height="35" rx="8" fill="#fff" transform="rotate(-15 297 117)"/><polygon points="200,80 225,55 250,80" fill="#fff" opacity="0.6"/></svg>';
    hm+='<div style="position:relative;z-index:1;max-width:1100px;margin:0 auto;"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:rgba(255,255,255,0.7);margin-bottom:8px;">BCG U × NovoEd</div><div style="font-size:32px;font-weight:200;color:#fff;line-height:1.3;margin-bottom:8px;">Component Toolkit</div><div style="font-size:14px;color:rgba(255,255,255,0.8);line-height:1.6;max-width:600px;">Design and generate professional HTML components and interactive SCORM activities for NovoEd courses — no coding required.</div></div></div>';

    // Content area
    hm+='<div style="max-width:1100px;margin:0 auto;padding:0 32px;">';

    // Search + Brand
    hm+='<div style="display:flex;gap:12px;align-items:center;margin-bottom:20px;"><div style="flex:1;position:relative;"><input id="homeSearch" oninput="homeSearchUpdate(this.value)" placeholder="Search components..." style="width:100%;padding:9px 14px 9px 32px;border:1.5px solid '+b.n2+';border-radius:8px;font-size:12px;outline:none;background:#fff;"/><span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:13px;color:#bbb;">⌕</span><div id="searchResults" style="display:none;position:absolute;top:100%;left:0;right:0;margin-top:4px;background:#fff;border:1.5px solid '+b.n2+';border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.1);z-index:50;max-height:240px;overflow:auto;"></div></div>'+brandBtns("md")+'</div>';

    // Tool cards with tags and context
    hm+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;">';
    hm+='<div class="home-card" onclick="setState({mode:\'html\'})" style="padding:24px 22px;border:2px solid '+b.n2+';cursor:pointer;background:#fff;border-radius:12px;transition:all 0.2s;">';
    hm+='<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;"><div style="width:38px;height:38px;background:'+b.pri+';border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;color:#fff;">📋</div><div style="font-size:15px;font-weight:700;">HTML Components</div></div>';
    hm+='<div style="font-size:11px;color:'+b.txL+';line-height:1.7;margin-bottom:10px;">Static visual components — tables, banners, cards, timelines, stats, and more. Copy and paste directly into NovoEd.</div>';
    hm+='<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;"><span style="font-size:9px;padding:2px 8px;background:'+b.pri+'15;color:'+b.pri+';border-radius:10px;font-weight:600;">Seamless</span><span style="font-size:9px;padding:2px 8px;background:'+b.pri+'15;color:'+b.pri+';border-radius:10px;font-weight:600;">Fast loading</span><span style="font-size:9px;padding:2px 8px;background:'+b.pri+'15;color:'+b.pri+';border-radius:10px;font-weight:600;">Native look</span></div>';
    hm+='<div style="font-size:10px;color:'+b.txL+';line-height:1.6;padding:8px 10px;background:#f5f5f5;border-radius:6px;font-style:italic;">Looks like a native part of NovoEd, loads instantly. Best for visual formatting, data display, and structured content.</div>';
    hm+='<div style="font-size:11px;color:'+b.pri+';margin-top:10px;font-weight:700;">16 components →</div></div>';

    hm+='<div class="home-card" onclick="setState({mode:\'scorm\'})" style="padding:24px 22px;border:2px solid '+b.n2+';cursor:pointer;background:'+b.wh+';border-radius:12px;transition:all 0.2s;">';
    hm+='<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;"><div style="width:38px;height:38px;background:'+b.n2+';border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;">✨</div><div style="font-size:15px;font-weight:700;">SCORM Interactives</div></div>';
    hm+='<div style="font-size:11px;color:'+b.txL+';line-height:1.7;margin-bottom:10px;">Fully interactive activities with animations — flip cards, accordions, stacked cards, cycle diagrams, and more.</div>';
    hm+='<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;"><span style="font-size:9px;padding:2px 8px;background:#FFF8E6;color:#D4A017;border-radius:10px;font-weight:600;">Animated</span><span style="font-size:9px;padding:2px 8px;background:#FFF8E6;color:#D4A017;border-radius:10px;font-weight:600;">Interactive</span><span style="font-size:9px;padding:2px 8px;background:#FFF8E6;color:#D4A017;border-radius:10px;font-weight:600;">Engaging</span></div>';
    hm+='<div style="font-size:10px;color:'+b.txL+';line-height:1.6;padding:8px 10px;background:#f5f5f5;border-radius:6px;font-style:italic;">Rich animations and click interactions. Loads in an iframe — may take a moment. Best for engaging learner activities.</div>';
    hm+='<div style="font-size:11px;color:'+b.pri+';margin-top:10px;font-weight:700;">10 activities →</div></div>';
    hm+='</div>';

    // AI Generator with Claude Project link
    hm+='<div style="margin-bottom:24px;padding:18px 22px;background:#fff;border-radius:14px;border:1.5px solid '+b.n2+';box-shadow:0 2px 12px rgba(0,0,0,0.03);display:flex;align-items:center;gap:14px;">';
    hm+='<div style="width:36px;height:36px;background:'+b.grad+';border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:17px;color:#fff;flex-shrink:0;">⚡</div>';
    hm+='<div style="flex:1;"><div style="font-size:13px;font-weight:700;color:'+b.tx+';margin-bottom:2px;">AI Content Generator</div>';
    hm+='<div style="font-size:11px;color:'+b.txL+';line-height:1.5;">Describe what you need and AI creates the component for you — pick the best format, auto-fill content, ready to export.</div></div>';
    hm+='<a href="https://claude.ai/project/019d8ffd-704f-72ca-b771-e1b61ce90680" target="_blank" class="btn-pri" style="padding:10px 20px;border-radius:8px;background:'+b.grad+';color:#fff;font-size:12px;font-weight:600;text-decoration:none;white-space:nowrap;flex-shrink:0;">Open AI Chat →</a></div>';

    // What's New
    hm+='<div style="margin-bottom:24px;"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:'+b.pri+';margin-bottom:10px;">What\'s New</div><div style="padding:16px 20px;background:'+b.n1+';border-radius:10px;border:1px solid '+b.n2+';"><div style="font-size:13px;color:'+b.tx+';line-height:1.7;"><span style="font-weight:700;">v1.0 — Launch</span><br><span style="color:'+b.txL+';">16 HTML components + 10 SCORM interactives with BCG & BCG U branding, live preview, and one-click SCORM download. More components coming soon!</span></div></div></div>';

    // Feedback
    hm+='<div style="padding:14px 20px;background:'+b.priLt+';border-radius:10px;border:1px solid '+b.pri+'22;display:flex;align-items:center;gap:14px;"><div style="width:32px;height:32px;background:'+b.pri+';border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;color:#fff;flex-shrink:0;">✉</div><div style="font-size:12px;color:'+b.tx+';line-height:1.6;"><span style="font-weight:600;">Feedback or suggestions?</span> Drop a note at <a href="mailto:jatin.patial@bcg.com" style="color:'+b.pri+';font-weight:700;">jatin.patial@bcg.com</a></div></div>';
    hm+='</div></div>';
    root.innerHTML=hm;
    return;
  }
  if(!state.sel){
    var allCs=state.mode==="html"?HTML_COMPS:SCORM_COMPS;
    var sq=state.search?state.search.toLowerCase():"";
    var cs=sq?allCs.filter(function(c){return c.n.toLowerCase().indexOf(sq)>=0||c.d.toLowerCase().indexOf(sq)>=0;}):allCs;
    var lb=state.mode==="html"?"HTML Components":"SCORM Interactives";
    var ht=state.mode==="html"?"Copy code → NovoEd → Contents → HTML. Also works in Quiz & Survey edit view.":"Download SCORM .zip → Upload to NovoEd SCORM/AICC block.";
    var hb=state.mode==="html"?b.priLt:"#FFF8E6", hc=state.mode==="html"?b.pri:"#856404";
    var h='<div style="max-width:1100px;margin:0 auto;padding:20px 16px;color:'+b.tx+';"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;"><button class="btn-back" onclick="setState({mode:null,sel:null,search:\'\'})" style="background:none;border:none;cursor:pointer;font-size:12px;color:#999;">← Back</button><div style="display:flex;gap:10px;align-items:center;"><span style="font-size:13px;font-weight:700;color:'+b.pri+';">'+lb+'</span>'+brandBtns("sm")+'</div></div>';
    h+='<div style="margin-bottom:14px;"><input value="'+esc(state.search)+'" oninput="state.search=this.value;render();" placeholder="Search '+(state.mode==="html"?"HTML components":"SCORM interactives")+'..." style="width:100%;padding:10px 14px 10px 14px;border:1.5px solid '+b.n2+';border-radius:10px;font-size:12px;outline:none;"/></div>';
    h+='<div style="padding:10px 14px;background:'+hb+';margin-bottom:16px;font-size:11px;color:'+hc+';font-weight:500;border-radius:8px;">'+ht+'</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';
    if(cs.length===0)h+='<div style="grid-column:1/-1;padding:24px;text-align:center;color:#999;font-size:12px;">No components match "'+esc(state.search)+'"</div>';
    cs.forEach(function(c){h+='<button class="comp-card" onclick="doSelect(\''+c.id+'\')" style="padding:14px 16px;border-radius:12px;border:1.5px solid #e8e8e8;background:#fff;cursor:pointer;text-align:left;"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;"><span style="font-size:16px;color:'+b.pri+';">'+c.ic+'</span><span style="font-size:13px;font-weight:700;">'+c.n+'</span></div><div style="font-size:11px;color:#999;">'+c.d+'</div></button>';});
    root.innerHTML=h+'</div></div>'; return;
  }
  var iS=state.sel.startsWith("s_"), cl=iS?SCORM_COMPS:HTML_COMPS, cn="";
  cl.forEach(function(c){if(c.id===state.sel)cn=c.n;}); var d=state.data;
  var h='<div style="max-width:1100px;margin:0 auto;padding:20px 16px;color:'+b.tx+';">';
  h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;"><button class="btn-back" onclick="setState({sel:null,output:\'\',scormPreview:\'\'})" style="background:none;border:none;cursor:pointer;font-size:12px;color:#999;">← Back</button><div style="display:flex;gap:8px;align-items:center;"><span style="font-size:12px;font-weight:700;color:'+b.pri+';">'+cn+'</span><span style="font-size:10px;padding:2px 8px;background:'+(iS?"#FFF8E6":b.priLt)+';color:'+(iS?"#856404":b.pri)+';font-weight:600;border-radius:4px;">'+(iS?"SCORM":"HTML")+'</span>'+brandBtns("sm")+'</div></div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;"><div><div style="font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Edit</div>';
  if(d.col1!==undefined){h+='<div style="margin-bottom:8px;"><input value="'+esc(d.col1)+'" onchange="updateField(\'col1\',this.value)" placeholder="Col 1" style="width:100%;padding:6px 8px;border:1px solid #e5e5e5;border-radius:4px;font-size:11px;font-weight:600;margin-bottom:4px;"/><input value="'+esc(d.col2||"")+'" onchange="updateField(\'col2\',this.value)" placeholder="Col 2" style="width:100%;padding:6px 8px;border:1px solid #e5e5e5;border-radius:4px;font-size:11px;font-weight:600;"/></div>';}
  if(d.title!==undefined){h+='<input value="'+esc(d.title)+'" onchange="updateField(\'title\',this.value)" placeholder="Title / Heading" style="width:100%;padding:8px 10px;border:1px solid #e5e5e5;border-radius:6px;font-size:12px;font-weight:600;margin-bottom:6px;"/>';}
  if(d.body!==undefined){h+='<textarea onchange="updateField(\'body\',this.value)" rows="3" placeholder="Content" style="width:100%;padding:8px 10px;border:1px solid #e5e5e5;border-radius:6px;font-size:12px;resize:vertical;margin-bottom:6px;">'+esc(d.body)+'</textarea>';}
  if(iS){var curBg=d.bg||"gradient";h+='<div style="display:flex;gap:4px;margin-bottom:8px;align-items:center;"><span style="font-size:10px;font-weight:600;color:#888;margin-right:4px;">Background:</span><button onclick="updateField(\'bg\',\'gradient\');doRegen();" style="padding:4px 10px;border:1px solid '+(curBg==="gradient"?b.pri:"#ddd")+';background:'+(curBg==="gradient"?b.priLt:"#fff")+';color:'+(curBg==="gradient"?b.pri:b.txL)+';font-size:10px;font-weight:600;cursor:pointer;border-radius:4px;">Gradient</button><button onclick="updateField(\'bg\',\'none\');doRegen();" style="padding:4px 10px;border:1px solid '+(curBg==="none"?b.pri:"#ddd")+';background:'+(curBg==="none"?b.priLt:"#fff")+';color:'+(curBg==="none"?b.pri:b.txL)+';font-size:10px;font-weight:600;cursor:pointer;border-radius:4px;">Plain white</button></div>';}
  if(d.author!==undefined){h+='<input value="'+esc(d.author)+'" onchange="updateField(\'author\',this.value)" placeholder="Author" style="width:100%;padding:6px 10px;border:1px solid #e5e5e5;border-radius:6px;font-size:11px;margin-bottom:6px;"/>';}
  if(d.type!==undefined){h+='<div style="display:flex;gap:4px;margin-bottom:8px;">';["info","tip","warning","success"].forEach(function(t){h+='<button onclick="updateField(\'type\',\''+t+'\');render();" style="padding:4px 10px;border:1px solid '+(d.type===t?b.pri:"#ddd")+';background:'+(d.type===t?b.priLt:"#fff")+';color:'+(d.type===t?b.pri:b.txL)+';font-size:10px;font-weight:600;cursor:pointer;border-radius:4px;">'+t+'</button>';});h+='</div>';}
  if(d.active!==undefined){h+='<div style="margin-bottom:8px;"><label style="font-size:10px;font-weight:600;color:#888;">Active step: '+d.active+'</label><input type="range" min="0" max="'+((d.items?d.items.length:1)-1)+'" value="'+d.active+'" oninput="updateField(\'active\',parseInt(this.value));render();" style="width:100%;accent-color:'+b.pri+';"/></div>';}
  if(d.items){d.items.forEach(function(it,i){
    h+='<div style="margin-bottom:6px;padding:8px;background:#FAFAFA;border-radius:6px;"><div style="display:flex;gap:4px;align-items:center;margin-bottom:3px;"><span style="font-size:10px;font-weight:700;color:'+b.pri+';">#'+(i+1)+'</span>';
    if(it.icon!==undefined)h+='<input value="'+esc(it.icon)+'" onchange="updateItem('+i+',\'icon\',this.value)" style="width:36px;padding:5px 4px;border:1px solid #e5e5e5;border-radius:4px;font-size:14px;text-align:center;"/>';
    h+='<input value="'+esc(it.title)+'" onchange="updateItem('+i+',\'title\',this.value)" placeholder="Title" style="flex:1;padding:5px 6px;border:1px solid #e5e5e5;border-radius:4px;font-size:11px;font-weight:600;"/>';
    if(d.items.length>1)h+='<button class="btn-del" onclick="removeItem('+i+')" style="background:none;border:none;color:#ccc;cursor:pointer;font-size:12px;">✕</button>';
    h+='</div>';
    if(it.img!==undefined)h+='<div style="display:flex;gap:4px;align-items:center;margin-bottom:3px;"><span style="font-size:9px;color:#aaa;">🖼</span><input value="'+esc(it.img)+'" onchange="updateItem('+i+',\'img\',this.value)" placeholder="Image URL (paste link)" style="flex:1;padding:4px 6px;border:1px solid #e5e5e5;border-radius:4px;font-size:10px;color:#666;"/></div>';
    if(it.desc!==undefined)h+='<textarea onchange="updateItem('+i+',\'desc\',this.value)" placeholder="Description" rows="2" style="width:100%;padding:5px 6px;border:1px solid #e5e5e5;border-radius:4px;font-size:10px;resize:none;">'+esc(it.desc)+'</textarea>';
    if(it.desc2!==undefined)h+='<textarea onchange="updateItem('+i+',\'desc2\',this.value)" placeholder="Column 2" rows="2" style="width:100%;padding:5px 6px;border:1px solid #e5e5e5;border-radius:4px;font-size:10px;resize:none;margin-top:3px;">'+esc(it.desc2)+'</textarea>';
    h+='</div>';
  });h+='<button class="btn-add" onclick="addItem()" style="font-size:10px;padding:4px 10px;border-radius:4px;border:1px solid '+b.pri+';background:transparent;color:'+b.pri+';cursor:pointer;font-weight:600;">+ Add</button>';}
  if(!iS)h+='<button class="btn-pri" onclick="doRegen()" style="width:100%;padding:10px;border-radius:8px;border:none;background:'+b.pri+';color:#fff;font-size:12px;font-weight:600;cursor:pointer;margin-top:10px;">Update preview</button>';
  else h+='<div style="display:flex;gap:8px;margin-top:10px;"><button class="btn-sec" onclick="doRegen()" style="flex:1;padding:10px;border-radius:8px;border:2px solid '+b.pri+';background:#fff;color:'+b.pri+';font-size:12px;font-weight:600;cursor:pointer;">Update preview</button><button class="btn-pri" onclick="downloadSCORM(state.sel,state.data,state.brand)" style="flex:1;padding:10px;border-radius:8px;border:none;background:'+b.pri+';color:#fff;font-size:12px;font-weight:600;cursor:pointer;">⬇ Download .zip</button></div>';
  h+='</div><div><div style="font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Preview</div>';
  if(!iS){
    h+='<div style="border:1px solid #eee;border-radius:10px;padding:16px;background:#fff;min-height:200px;overflow:auto;">'+state.output+'</div>';
    h+='<div style="margin-top:10px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><div style="font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:1px;">HTML Code</div><button class="btn-copy" id="copyBtn" onclick="handleCopy()" style="font-size:10px;padding:3px 10px;border-radius:4px;border:1px solid #ddd;background:#fff;color:#888;cursor:pointer;font-weight:600;">Copy</button></div>';
    h+='<textarea readonly onclick="this.select()" style="width:100%;height:120px;padding:10px;border:2px solid '+b.pri+';font-size:10px;font-family:monospace;color:#444;background:#FAFAFA;resize:vertical;cursor:pointer;border-radius:6px;">'+esc(state.output)+'</textarea></div>';
  } else {
    h+='<div style="border:1px solid #eee;border-radius:10px;overflow:hidden;background:#fff;"><div style="padding:8px 12px;background:'+b.n1+';display:flex;justify-content:space-between;align-items:center;"><span style="font-size:10px;font-weight:700;color:'+b.txL+';text-transform:uppercase;letter-spacing:0.5px;">Live Interactive Preview</span><span style="font-size:9px;color:#aaa;">Click / interact below</span></div><iframe id="scormFrame" style="width:100%;height:560px;border:none;display:block;" sandbox="allow-scripts allow-same-origin"></iframe></div>';
  }
  h+='<div style="margin-top:8px;padding:10px;background:'+b.n1+';font-size:10px;color:#888;border-radius:6px;"><strong style="color:'+b.tx+';">'+(iS?"Upload:":"NovoEd:")+'</strong> '+(iS?"Download .zip → NovoEd → Add SCORM/AICC → Upload":"Copy code → NovoEd → Contents → HTML. Also works in Quiz & Survey edit view.")+'</div></div></div></div>';
  root.innerHTML=h;
  if(iS&&state.scormPreview){setTimeout(function(){var f=document.getElementById("scormFrame");if(f)f.srcdoc=state.scormPreview;},50);}
}
render();
"""

html_out = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n<title>NovoEd Component Library</title>\n<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:\"Trebuchet MS\",system-ui,sans-serif;background:#fff;}button{font-family:inherit;transition:all 0.2s ease;}input,textarea{font-family:inherit;transition:border-color 0.2s;}.btn-back:hover{color:#29BA74!important;}.btn-pri:hover{filter:brightness(0.9);transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,0.15);}.btn-sec:hover{background:#E6F7EF!important;transform:translateY(-1px);}.btn-add:hover{background:#29BA74!important;color:#fff!important;}.btn-del:hover{color:#e74c3c!important;}.btn-copy:hover{border-color:#29BA74!important;color:#29BA74!important;}.comp-card:hover{border-color:#29BA74!important;box-shadow:0 2px 8px rgba(0,0,0,0.06);}.home-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.08);}</style>\n</head>\n<body>\n<div id=\"root\"></div>\n<script>\n" + core + vanilla_ui + "\n</scr" + "ipt>\n</body>\n</html>"

with open("/mnt/user-data/outputs/NovoEd_Component_Library.html", "w", encoding="utf-8") as f:
    f.write(html_out)

print(f"Done: {len(html_out)} chars written")
