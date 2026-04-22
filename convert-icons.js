/**
 * Converts BCG DrawingML icons (from deckster-slide-generator skill)
 * into inline SVG strings for use in the NovoEd HTML toolkit.
 *
 * Output: bcg-icons.js  — defines window.BCG_ICONS = { "Alert": "<svg...>", ... }
 */

const fs   = require('fs');
const zlib = require('zlib');
const path = require('path');

const BUNDLE_PATH = 'C:/Users/Patial Jatin/AppData/Roaming/Claude/local-agent-mode-sessions/skills-plugin/7131fce3-cdc9-4280-8216-e9716f2cd1bf/f0c9d1ab-0c8f-47cd-8c11-b1e1a69fcc21/skills/deckster-slide-generator/assets/icons/icons_bundle.json';
const OUT_PATH    = path.join(__dirname, 'bcg-icons.js');

// ── helpers ──────────────────────────────────────────────────────────────────

function getAttr(str, attr) {
  const m = new RegExp(attr + '="([^"]*)"').exec(str);
  return m ? m[1] : null;
}

// Extract the first matching tag's full content (non-nested, for simple tags)
function extractTags(xml, tag) {
  const results = [];
  const re = new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>', 'g');
  let m;
  while ((m = re.exec(xml)) !== null) results.push({ full: m[0], inner: m[1] });
  return results;
}

function extractSelfClose(xml, tag) {
  const results = [];
  const re = new RegExp('<' + tag + '(?:\\s[^>]*)?\\/>', 'g');
  let m;
  while ((m = re.exec(xml)) !== null) results.push(m[0]);
  return results;
}

// Parse <a:xfrm> returning {offX, offY, cx, cy, chOffX, chOffY, chCx, chCy}
function parseXfrm(xfrmXml) {
  const off   = /<a:off\s[^>]*x="([^"]+)"[^>]*y="([^"]+)"/.exec(xfrmXml);
  const ext   = /<a:ext\s[^>]*cx="([^"]+)"[^>]*cy="([^"]+)"/.exec(xfrmXml);
  const chOff = /<a:chOff\s[^>]*x="([^"]+)"[^>]*y="([^"]+)"/.exec(xfrmXml);
  const chExt = /<a:chExt\s[^>]*cx="([^"]+)"[^>]*cy="([^"]+)"/.exec(xfrmXml);
  return {
    offX : off   ? +off[1]   : 0,
    offY : off   ? +off[2]   : 0,
    cx   : ext   ? +ext[1]   : 0,
    cy   : ext   ? +ext[2]   : 0,
    chOffX : chOff ? +chOff[1] : 0,
    chOffY : chOff ? +chOff[2] : 0,
    chCx   : chExt ? +chExt[1] : 0,
    chCy   : chExt ? +chExt[2] : 0,
  };
}

// Parse all <a:pt x="…" y="…"/> inside a command element
function parsePts(cmdXml) {
  const pts = [];
  const re  = /<a:pt\s[^>]*x="([^"]+)"[^>]*y="([^"]+)"/g;
  let m;
  while ((m = re.exec(cmdXml)) !== null) pts.push({ x: +m[1], y: +m[2] });
  return pts;
}

// Scale a single coordinate from path space (pw×ph) to child space
function scaleCoord(val, pathDim, shapeOff, shapeExt) {
  return shapeOff + (val / pathDim) * shapeExt;
}

function fmt(n) { return +n.toFixed(3); }

// Convert one <a:path …>…</a:path> block to an SVG path d-string
function pathXmlToD(pathXml, pathW, pathH, shapeOffX, shapeOffY, shapeCx, shapeCy) {
  let d = '';
  // Walk through path commands in document order
  const cmdRe = /<a:(moveTo|lnTo|cubicBezTo|quadBezTo|arcTo|close)(?:\s[^>]*)?>(?:([\s\S]*?)<\/a:\1>|)/g;
  let m;
  while ((m = cmdRe.exec(pathXml)) !== null) {
    const cmd   = m[1];
    const inner = m[2] || '';
    const pts   = parsePts(inner);
    if (cmd === 'moveTo' && pts.length >= 1) {
      d += `M${fmt(scaleCoord(pts[0].x, pathW, shapeOffX, shapeCx))},${fmt(scaleCoord(pts[0].y, pathH, shapeOffY, shapeCy))} `;
    } else if (cmd === 'lnTo' && pts.length >= 1) {
      d += `L${fmt(scaleCoord(pts[0].x, pathW, shapeOffX, shapeCx))},${fmt(scaleCoord(pts[0].y, pathH, shapeOffY, shapeCy))} `;
    } else if (cmd === 'cubicBezTo' && pts.length >= 3) {
      d += `C${fmt(scaleCoord(pts[0].x,pathW,shapeOffX,shapeCx))},${fmt(scaleCoord(pts[0].y,pathH,shapeOffY,shapeCy))} `
         + `${fmt(scaleCoord(pts[1].x,pathW,shapeOffX,shapeCx))},${fmt(scaleCoord(pts[1].y,pathH,shapeOffY,shapeCy))} `
         + `${fmt(scaleCoord(pts[2].x,pathW,shapeOffX,shapeCx))},${fmt(scaleCoord(pts[2].y,pathH,shapeOffY,shapeCy))} `;
    } else if (cmd === 'quadBezTo' && pts.length >= 2) {
      d += `Q${fmt(scaleCoord(pts[0].x,pathW,shapeOffX,shapeCx))},${fmt(scaleCoord(pts[0].y,pathH,shapeOffY,shapeCy))} `
         + `${fmt(scaleCoord(pts[1].x,pathW,shapeOffX,shapeCx))},${fmt(scaleCoord(pts[1].y,pathH,shapeOffY,shapeCy))} `;
    } else if (cmd === 'close') {
      d += 'Z ';
    }
    // arcTo: skip for now — rare in flat icon sets
  }
  return d.trim();
}

// Decide fill colour — MONOCHROME: all visible shapes inherit currentColor
// (the only exception is explicit noFill, which stays invisible)
function parseFill(spXml) {
  // Strip stroke block first so <a:noFill/> inside <a:ln> doesn't false-trigger
  const fillXml = spXml.replace(/<a:ln[\s\S]*?<\/a:ln>/g, '');
  if (/<a:noFill\s*\/>/.test(fillXml)) return 'none';
  // Force monochrome: any visible fill becomes currentColor so the entire
  // icon recolours to match brand.pri / brand.priDk via CSS color inheritance
  return 'currentColor';
}

function parseStroke(spXml) {
  const lnM = /<a:ln[^>]*>([\s\S]*?)<\/a:ln>/.exec(spXml);
  if (!lnM) return { stroke: 'none', sw: 0 };
  const inner = lnM[1];
  if (/<a:noFill\s*\/>/.test(inner)) return { stroke: 'none', sw: 0 };
  const wM = /w="(\d+)"/.exec(lnM[0]);
  const sw = wM ? +wM[1] : 12700; // 1pt default in EMU
  // Force monochrome: visible strokes also inherit currentColor
  return { stroke: 'currentColor', sw };
}

// Convert a single icon's DrawingML XML → SVG string
function convertToSVG(iconName, xml) {
  // 1. Parse group bounding box
  const grpXfrmM = /<p:grpSpPr[^>]*>[\s\S]*?<a:xfrm>([\s\S]*?)<\/a:xfrm>/.exec(xml);
  if (!grpXfrmM) return null;
  const grp = parseXfrm(grpXfrmM[0]);

  // viewBox = child coordinate space
  const vbX = grp.chOffX, vbY = grp.chOffY;
  const vbW = grp.chCx  || grp.cx;
  const vbH = grp.chCy  || grp.cy;
  if (!vbW || !vbH) return null;

  // 2. Iterate <p:sp> shapes
  const shapeParts = [];
  const spRe = /<p:sp>([\s\S]*?)<\/p:sp>/g;
  let spM;
  while ((spM = spRe.exec(xml)) !== null) {
    const spXml = spM[1];

    // shape transform (within child space)
    const xfrmM = /<a:xfrm>([\s\S]*?)<\/a:xfrm>/.exec(spXml);
    if (!xfrmM) continue;
    const xfrm = parseXfrm(xfrmM[0]);

    const fill   = parseFill(spXml);
    const { stroke, sw } = parseStroke(spXml);

    // ── custGeom ──
    const custM = /<a:custGeom>([\s\S]*?)<\/a:custGeom>/.exec(spXml);
    if (custM) {
      const pathListM = /<a:pathLst>([\s\S]*?)<\/a:pathLst>/.exec(custM[1]);
      if (pathListM) {
        // iterate individual <a:path> elements
        const pathRe = /<a:path\s([^>]*)>([\s\S]*?)<\/a:path>/g;
        let pM;
        while ((pM = pathRe.exec(pathListM[1])) !== null) {
          const attrs   = pM[1];
          const pathXml = pM[2];
          const pw = +(getAttr(attrs, 'w') || vbW);
          const ph = +(getAttr(attrs, 'h') || vbH);
          const extrudeAttr = getAttr(attrs, 'extrusionOk');
          const fillOverride = getAttr(attrs, 'fill');

          const d = pathXmlToD(pathXml, pw, ph, xfrm.offX, xfrm.offY, xfrm.cx, xfrm.cy);
          if (!d) continue;

          const pathFill   = fillOverride === 'none' ? 'none' : fill;
          // stroke width scaled from EMU to viewBox units
          const swScaled   = sw ? sw * (vbW / (grp.cx || vbW)) * 0.01 : 0;
          const swStr      = swScaled > 0.1 ? ` stroke="${stroke}" stroke-width="${fmt(swScaled)}"` : '';

          shapeParts.push(`<path d="${d}" fill="${pathFill}"${swStr}/>`);
        }
      }
    }

    // ── prstGeom ── (rect, ellipse, rtTriangle, etc.)
    const prstM = /<a:prstGeom\s+prst="([^"]+)"/.exec(spXml);
    if (prstM && !custM) {
      const prst = prstM[1];
      const x = xfrm.offX, y = xfrm.offY, w = xfrm.cx, h = xfrm.cy;
      if (fill === 'none' && stroke === 'none') continue; // invisible bounding box

      if (prst === 'rect' || prst === 'roundRect') {
        const rx = prst === 'roundRect' ? Math.min(w, h) * 0.1 : 0;
        shapeParts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`);
      } else if (prst === 'ellipse') {
        shapeParts.push(`<ellipse cx="${x + w/2}" cy="${y + h/2}" rx="${w/2}" ry="${h/2}" fill="${fill}"/>`);
      } else if (prst === 'triangle' || prst === 'rtTriangle') {
        shapeParts.push(`<polygon points="${x},${y+h} ${x+w/2},${y} ${x+w},${y+h}" fill="${fill}"/>`);
      }
      // other preset shapes: skip (too many variants, rare in icon sets)
    }
  }

  if (!shapeParts.length) return null;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" fill="currentColor">${shapeParts.join('')}</svg>`;
}

// ── main ─────────────────────────────────────────────────────────────────────

console.log('Reading icons bundle…');
const raw   = fs.readFileSync(BUNDLE_PATH, 'utf8');
const data  = JSON.parse(raw);
const icons = data.icons;
const keys  = Object.keys(icons);
console.log(`Total icons: ${keys.length}`);

const result   = {};
let ok = 0, skipped = 0;

for (const key of keys) {
  try {
    const buf = Buffer.from(icons[key].z, 'base64');
    const xml = zlib.inflateSync(buf).toString('utf8');
    // Strip the "bcgIcons_" prefix for cleaner keys
    const name = key.replace(/^bcgIcons_/, '');
    const svg  = convertToSVG(name, xml);
    if (svg) {
      result[name] = svg;
      ok++;
    } else {
      skipped++;
    }
  } catch (e) {
    skipped++;
  }
}

console.log(`Converted: ${ok} | Skipped: ${skipped}`);

// Build output JS file
const lines = Object.entries(result).map(([k, v]) =>
  `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`
);

const js = `// BCG Icon Set — converted from deckster-slide-generator skill
// ${ok} icons, auto-generated by convert-icons.js
// Usage: BCG_ICONS["Alert"]  →  SVG string (fill="currentColor" = inherits brand colour)
window.BCG_ICONS = {
${lines.join(',\n')}
};
`;

fs.writeFileSync(OUT_PATH, js, 'utf8');
const sizeMB = (fs.statSync(OUT_PATH).size / 1024 / 1024).toFixed(2);
console.log(`Written: bcg-icons.js (${sizeMB} MB)`);
