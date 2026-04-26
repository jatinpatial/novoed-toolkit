import { B, FR, esc, type BrandKey } from "../../brand/tokens";
import type { ComponentData } from "../../types";

type ColorMap = Record<string, { bg: string; brd: string; tx: string }>;

export function genHTML(id: string, brand: BrandKey, data: ComponentData): string {
  const b = B[brand];
  const items = data.items || [];
  const bg =
    "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.1) 30%, transparent 30%), linear-gradient(225deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.07) 20%, transparent 20%), " +
    b.grad;

  if (id === "highlight")
    return '<table style="width:100%;border-collapse:collapse;"><tr><td style="background:' + bg + ';padding:36px 40px;text-align:center;"><p ' + FR + ' style="margin:0 0 12px;color:#FFFFFF;">' + esc(data.title || "") + '</p><div style="font-size:14px;color:rgba(255,255,255,0.88);line-height:1.8;">' + esc(data.body || "") + '</div></td></tr></table>';

  if (id === "callout") {
    const tp: Record<string, { bg: string; brd: string; ic: string; lbl: string }> = {
      info:    { bg: "#EBF5F0", brd: b.pri, ic: "ℹ️", lbl: "Info" },
      tip:     { bg: "#EBF5F0", brd: b.pri, ic: "💡", lbl: "Tip" },
      warning: { bg: "#FFF8E6", brd: "#D4A017", ic: "⚠️", lbl: "Warning" },
      success: { bg: "#EBF5F0", brd: b.pri, ic: "✅", lbl: "Success" },
    };
    const t = tp[data.type || "info"];
    return '<table style="width:100%;border-collapse:collapse;"><tr><td style="width:5px;background:' + t.brd + ';padding:0;"></td><td style="padding:18px 22px;background:' + t.bg + ';"><p ' + FR + ' style="margin:0 0 8px;color:' + b.tx + ';">' + t.ic + ' ' + t.lbl + '</p><div style="font-size:13px;color:' + b.tx + ';line-height:1.8;">' + esc(data.body || "") + '</div></td></tr></table>';
  }

  if (id === "quote")
    return '<table style="width:100%;border-collapse:collapse;"><tr><td style="width:5px;background:' + b.pri + ';padding:0;"></td><td style="padding:28px 30px;background:' + b.n1 + ';"><div style="font-size:18px;font-style:italic;color:' + b.tx + ';line-height:1.8;font-weight:300;margin-bottom:14px;">"' + esc(data.body || "") + '"</div><div style="font-size:12px;font-weight:700;color:' + b.pri + ';">— ' + esc(data.author || "") + '</div></td></tr></table>';

  if (id === "divider")
    return '<table style="width:100%;border-collapse:collapse;"><tr><td style="width:40%;padding:0;"><div style="height:2px;background:' + b.pri + ';"></div></td><td style="padding:0 16px;text-align:center;white-space:nowrap;"><span style="font-size:12px;font-weight:700;color:' + b.pri + ';letter-spacing:1px;text-transform:uppercase;">' + esc(data.title || "") + '</span></td><td style="width:40%;padding:0;"><div style="height:2px;background:' + b.pri + ';"></div></td></tr></table>';

  if (id === "table") {
    let r = "";
    items.forEach((it, i) => {
      r += '<tr><td style="padding:12px 18px;font-size:13px;font-weight:600;color:' + b.tx + ';border-bottom:1px solid ' + b.n2 + ';background:' + (i % 2 === 0 ? b.wh : b.n1) + ';">' + esc(it.title) + '</td><td style="padding:12px 18px;font-size:13px;color:' + b.txL + ';border-bottom:1px solid ' + b.n2 + ';background:' + (i % 2 === 0 ? b.wh : b.n1) + ';line-height:1.6;">' + esc(it.desc) + '</td></tr>';
    });
    return '<table style="width:100%;border-collapse:collapse;border:1px solid ' + b.n2 + ';"><thead><tr><th style="padding:14px 18px;text-align:left;font-size:13px;font-weight:700;color:' + b.wh + ';background:' + bg + ';">' + esc(data.col1 || "Category") + '</th><th style="padding:14px 18px;text-align:left;font-size:13px;font-weight:700;color:' + b.wh + ';background:' + bg + ';">' + esc(data.col2 || "Description") + '</th></tr></thead><tbody>' + r + '</tbody></table>';
  }

  if (id === "compare") {
    let r = "";
    items.forEach((it, i) => {
      r += '<tr><td style="padding:12px 16px;font-size:12px;font-weight:700;color:' + b.wh + ';background:' + b.pri + ';width:130px;border-bottom:1px solid rgba(255,255,255,0.15);text-align:center;">' + esc(it.title) + '</td><td style="padding:12px 16px;font-size:13px;color:' + b.tx + ';border-bottom:1px solid ' + b.n2 + ';background:' + (i % 2 === 0 ? b.wh : b.n1) + ';line-height:1.6;">' + esc(it.desc) + '</td><td style="padding:12px 16px;font-size:13px;color:' + b.tx + ';border-bottom:1px solid ' + b.n2 + ';background:' + (i % 2 === 0 ? b.wh : b.n1) + ';line-height:1.6;">' + esc(it.desc2 || "") + '</td></tr>';
    });
    return '<table style="width:100%;border-collapse:collapse;border:1px solid ' + b.n2 + ';"><thead><tr><th style="padding:14px;background:' + b.n1 + ';width:130px;"></th><th style="padding:14px 18px;text-align:left;font-size:14px;font-weight:700;color:' + b.wh + ';background:' + b.grad + ';">' + esc(data.col1 || "Option A") + '</th><th style="padding:14px 18px;text-align:left;font-size:14px;font-weight:700;color:' + b.wh + ';background:' + b.priDk + ';">' + esc(data.col2 || "Option B") + '</th></tr></thead><tbody>' + r + '</tbody></table>';
  }

  if (id === "glossary") {
    let r = "";
    items.forEach((it, i) => {
      r += '<tr><td style="padding:14px 18px;width:160px;vertical-align:top;border-bottom:1px solid ' + b.n2 + ';background:' + (i % 2 === 0 ? b.wh : b.n1) + ';"><span style="font-size:14px;font-weight:700;color:' + b.pri + ';">' + esc(it.title) + '</span></td><td style="padding:14px 18px;font-size:13px;color:' + b.tx + ';line-height:1.7;border-bottom:1px solid ' + b.n2 + ';background:' + (i % 2 === 0 ? b.wh : b.n1) + ';">' + esc(it.desc) + '</td></tr>';
    });
    return '<table style="width:100%;border-collapse:collapse;border:1px solid ' + b.n2 + ';">' + r + '</table>';
  }

  if (id === "cards") {
    const cols = Math.min(items.length, 3);
    let c = "";
    for (let i = 0; i < items.length; i += cols) {
      c += "<tr>";
      for (let j = 0; j < cols; j++) {
        const it = items[i + j];
        if (it) {
          c += '<td style="padding:8px;vertical-align:top;width:' + Math.floor(100 / cols) + '%;"><div style="padding:20px;border:1px solid ' + b.n2 + ';border-top:3px solid ' + b.pri + ';"><p ' + FR + ' style="margin:0 0 10px;color:' + b.tx + ';">' + esc(it.title) + '</p><div style="font-size:12px;color:' + b.txL + ';line-height:1.7;">' + esc(it.desc) + '</div></div></td>';
        } else {
          c += '<td style="padding:8px;"></td>';
        }
      }
      c += "</tr>";
    }
    return '<table style="width:100%;border-collapse:collapse;">' + c + '</table>';
  }

  if (id === "columns") {
    let c = "<tr>";
    items.forEach((it) => {
      c += '<td style="vertical-align:top;padding:0 12px;width:' + Math.floor(100 / items.length) + '%;"><p ' + FR + ' style="margin:0 0 10px;color:' + b.tx + ';padding-bottom:10px;border-bottom:3px solid ' + b.pri + ';">' + esc(it.title) + '</p><div style="font-size:13px;color:' + b.txL + ';line-height:1.8;">' + esc(it.desc) + '</div></td>';
    });
    return '<table style="width:100%;border-collapse:collapse;">' + c + '</tr></table>';
  }

  if (id === "process") {
    let c = "<tr>";
    items.forEach((it, i) => {
      c += '<td style="vertical-align:top;padding:6px;width:' + Math.floor(100 / items.length) + '%;text-align:center;"><div style="background:' + b.grad + ';padding:16px 10px;margin-bottom:10px;"><div style="font-size:24px;font-weight:200;color:rgba(255,255,255,0.6);">' + String(i + 1).padStart(2, "0") + '</div><div style="font-size:13px;font-weight:700;color:' + b.wh + ';margin-top:4px;">' + esc(it.title) + '</div></div><div style="font-size:11px;color:' + b.txL + ';line-height:1.6;">' + esc(it.desc) + '</div></td>';
    });
    return '<table style="width:100%;border-collapse:collapse;">' + c + '</tr></table>';
  }

  if (id === "stats") {
    let c = "<tr>";
    items.forEach((it) => {
      c += '<td style="text-align:center;padding:24px 16px;vertical-align:top;border-right:1px solid ' + b.n2 + ';"><div style="font-size:42px;font-weight:200;color:' + b.pri + ';">' + esc(it.title) + '</div><div style="font-size:12px;color:' + b.txL + ';margin-top:10px;font-weight:500;">' + esc(it.desc) + '</div></td>';
    });
    return '<table style="width:100%;border-collapse:collapse;border:1px solid ' + b.n2 + ';">' + c + '</tr></table>';
  }

  if (id === "iconrow") {
    let c = "<tr>";
    items.forEach((it) => {
      c += '<td style="text-align:center;padding:16px 8px;vertical-align:top;"><div style="width:56px;height:56px;background:' + b.priLt + ';border:2px solid ' + b.pri + ';margin:0 auto 12px;line-height:56px;font-size:22px;font-weight:700;color:' + b.pri + ';">' + esc(it.icon || "●") + '</div><div style="font-size:13px;font-weight:700;color:' + b.tx + ';margin-bottom:4px;">' + esc(it.title) + '</div><div style="font-size:11px;color:' + b.txL + ';line-height:1.5;">' + esc(it.desc || "") + '</div></td>';
    });
    return '<table style="width:100%;border-collapse:collapse;">' + c + '</tr></table>';
  }

  if (id === "timeline") {
    let r = "";
    items.forEach((it, i) => {
      r += '<tr><td style="width:40px;vertical-align:top;padding:0;text-align:center;"><div style="width:16px;height:16px;background:' + b.pri + ';margin:4px auto 0;"></div>' + (i < items.length - 1 ? '<div style="width:2px;height:40px;background:' + b.n2 + ';margin:0 auto;"></div>' : '') + '</td><td style="padding:0 0 20px 12px;vertical-align:top;"><p ' + FR + ' style="margin:0 0 4px;color:' + b.tx + ';">' + esc(it.title) + '</p><div style="font-size:12px;color:' + b.txL + ';line-height:1.7;">' + esc(it.desc) + '</div></td></tr>';
    });
    return '<table style="width:100%;max-width:600px;border-collapse:collapse;">' + r + '</table>';
  }

  if (id === "numbered") {
    let r = "";
    items.forEach((it, i) => {
      r += '<tr><td style="width:44px;vertical-align:top;padding:12px 0;"><div style="width:32px;height:32px;background:' + b.grad + ';text-align:center;line-height:32px;color:' + b.wh + ';font-size:14px;font-weight:700;">' + (i + 1) + '</div></td><td style="padding:12px 0 12px 12px;border-bottom:1px solid ' + b.n1 + ';vertical-align:top;"><p ' + FR + ' style="margin:0 0 4px;color:' + b.tx + ';">' + esc(it.title) + '</p><div style="font-size:12px;color:' + b.txL + ';line-height:1.7;">' + esc(it.desc || "") + '</div></td></tr>';
    });
    return '<table style="width:100%;max-width:650px;border-collapse:collapse;">' + r + '</table>';
  }

  if (id === "checklist") {
    let r = "";
    items.forEach((it) => {
      r += '<tr><td style="width:30px;vertical-align:top;padding:10px 0;"><div style="width:22px;height:22px;background:' + b.pri + ';text-align:center;line-height:22px;color:' + b.wh + ';font-size:13px;">✓</div></td><td style="padding:10px 0 10px 10px;font-size:13px;color:' + b.tx + ';line-height:1.6;border-bottom:1px solid ' + b.n1 + ';">' + esc(it.title) + '</td></tr>';
    });
    return '<table style="width:100%;max-width:500px;border-collapse:collapse;">' + r + '</table>';
  }

  if (id === "progress") {
    const act = data.active || 0;
    let c = "<tr>";
    items.forEach((it, i) => {
      const d = i <= act;
      c += '<td style="text-align:center;padding:0 2px;"><div style="height:10px;background:' + (d ? b.pri : b.n2) + ';"></div><div style="font-size:10px;font-weight:' + (i === act ? "700" : "400") + ';color:' + (d ? b.pri : b.txL) + ';margin-top:8px;">' + esc(it.title) + '</div></td>';
    });
    return '<table style="width:100%;border-collapse:collapse;">' + c + '</tr></table>';
  }

  if (id === "keypoints") {
    const ktitle = data.title || "Key Takeaways";
    let rows = "";
    items.forEach((it) => {
      rows += '<tr><td style="width:28px;padding:9px 4px 9px 16px;vertical-align:top;"><div style="width:14px;height:14px;background:' + b.pri + ';border-radius:50%;margin-top:3px;"></div></td><td style="padding:9px 16px 9px 8px;font-size:13px;color:' + b.tx + ';line-height:1.7;border-bottom:1px solid ' + b.n1 + ';">' + esc(it.title) + '</td></tr>';
    });
    return '<table style="width:100%;border-collapse:collapse;border:1px solid ' + b.n2 + ';border-left:4px solid ' + b.pri + ';background:' + b.n1 + ';"><tr><td colspan="2" style="padding:14px 16px 10px;background:' + b.priLt + ';"><p ' + FR + ' style="margin:0;color:' + b.tx + ';">' + esc(ktitle) + '</p></td></tr>' + rows + '</table>';
  }

  if (id === "faq") {
    let rows = "";
    items.forEach((it, i) => {
      rows +=
        '<tr><td style="padding:14px 18px;border-bottom:1px solid ' + b.n2 + ';background:' + (i % 2 === 0 ? b.wh : b.n1) + ';">' +
        '<div style="font-size:13px;font-weight:700;color:' + b.pri + ';margin-bottom:6px;">' + esc(it.title) + '</div>' +
        '<div style="font-size:12px;color:' + b.tx + ';line-height:1.75;">' + esc(it.desc || "") + '</div>' +
        '</td></tr>';
    });
    return '<table style="width:100%;border-collapse:collapse;border:1px solid ' + b.n2 + ';">' + rows + '</table>';
  }

  if (id === "twostat") {
    return (
      '<table style="width:100%;border-collapse:collapse;"><tr>' +
      '<td style="width:38%;padding:32px 24px;background:' + b.priLt + ';text-align:center;vertical-align:middle;border-left:4px solid ' + b.pri + ';">' +
      '<div style="font-size:52px;font-weight:700;color:' + b.pri + ';line-height:1;margin-bottom:6px;">' + esc(data.stat || "87%") + '</div>' +
      '<div style="font-size:11px;font-weight:600;color:' + b.priDk + ';text-transform:uppercase;letter-spacing:1px;">' + esc(data.label || "") + '</div>' +
      '</td>' +
      '<td style="padding:28px 32px;background:' + b.wh + ';vertical-align:middle;">' +
      '<div style="font-size:15px;color:' + b.tx + ';line-height:1.8;font-weight:300;">' + esc(data.body || "") + '</div>' +
      '</td></tr></table>'
    );
  }

  if (id === "badge") {
    const cmap: ColorMap = {
      green: { bg: b.priLt, brd: b.pri, tx: b.priDk },
      blue: { bg: "#DBEAFE", brd: "#2563EB", tx: "#1D4ED8" },
      gray: { bg: b.n1, brd: b.n2, tx: b.txL },
      orange: { bg: "#FFF7ED", brd: "#EA580C", tx: "#C2410C" },
    };
    let cells = "";
    items.forEach((it) => {
      const c = cmap[it.color || "green"] || cmap.green;
      cells += '<td style="padding:0 4px;"><span style="display:inline-block;padding:6px 16px;background:' + c.bg + ';border:1.5px solid ' + c.brd + ';border-radius:20px;font-size:12px;font-weight:600;color:' + c.tx + ';white-space:nowrap;">' + esc(it.title) + '</span></td>';
    });
    return '<table style="border-collapse:collapse;"><tr>' + cells + '</tr></table>';
  }

  return "";
}
