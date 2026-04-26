import { B, esc, type BrandKey } from "../brand/tokens";
import type { Block } from "./types";

export function previewBlock(blk: Block, brand: BrandKey): string {
  const b = B[brand] || B.bcgu;
  const d = blk.data || {};
  const items = d.items || [];

  switch (blk.type) {
    case "text":
      return '<div style="font-size:13px;color:' + b.tx + ';line-height:1.8;white-space:pre-wrap;">' + esc(d.content || "") + "</div>";

    case "video": {
      if (d.url) {
        const eu = d.url.replace("watch?v=", "embed/").replace("youtu.be/", "www.youtube.com/embed/");
        return '<div style="position:relative;padding-top:56.25%;border-radius:8px;overflow:hidden;"><iframe src="' + esc(eu) + '" style="position:absolute;inset:0;width:100%;height:100%;border:none;" allowfullscreen></iframe></div>' +
          (d.caption ? '<div style="font-size:11px;color:' + b.txL + ';text-align:center;margin-top:6px;">' + esc(d.caption) + "</div>" : "");
      }
      return '<div style="background:' + b.n1 + ";border-radius:8px;padding:28px;text-align:center;color:" + b.txL + ';font-size:12px;">▶ Add a video URL in settings →</div>';
    }

    case "image": {
      if (d.url) return '<img src="' + esc(d.url) + '" style="width:100%;border-radius:8px;" alt="' + esc(d.alt || "") + '">' + (d.caption ? '<div style="font-size:11px;color:' + b.txL + ';text-align:center;margin-top:6px;">' + esc(d.caption) + "</div>" : "");
      return '<div style="background:' + b.n1 + ";border-radius:8px;padding:28px;text-align:center;color:" + b.txL + ';font-size:12px;">🖼 Add an image URL in settings →</div>';
    }

    case "banner":
      return '<div style="background:' + b.grad + ';padding:22px 26px;border-radius:8px;"><div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:6px;">' + esc(d.title || "") + '</div><div style="font-size:13px;color:rgba(255,255,255,0.88);line-height:1.7;">' + esc(d.body || "") + "</div></div>";

    case "callout": {
      const ct: Record<string, { bg: string; brd: string; ic: string }> = {
        info: { bg: "#EBF5F0", brd: b.pri, ic: "ℹ️" },
        tip: { bg: "#EBF5F0", brd: b.pri, ic: "💡" },
        warning: { bg: "#FFF8E6", brd: "#D4A017", ic: "⚠️" },
        success: { bg: "#EBF5F0", brd: b.pri, ic: "✅" },
      };
      const c2 = ct[d.type || "tip"] || ct.tip;
      return '<div style="display:flex;border-left:4px solid ' + c2.brd + ";background:" + c2.bg + ';padding:12px 16px;border-radius:0 8px 8px 0;gap:10px;"><span style="font-size:16px;flex-shrink:0;">' + c2.ic + '</span><div style="font-size:13px;color:' + b.tx + ';line-height:1.7;">' + esc(d.body || "") + "</div></div>";
    }

    case "cards": {
      const cds = items.map((it) => '<div style="flex:1;min-width:130px;padding:14px;border:1px solid ' + b.n2 + ";border-top:3px solid " + b.pri + ';border-radius:8px;"><div style="font-size:12px;font-weight:700;color:' + b.tx + ';margin-bottom:5px;">' + esc(it.title) + '</div><div style="font-size:11px;color:' + b.txL + ';">' + esc(it.desc || "") + "</div></div>").join("");
      return '<div style="display:flex;gap:8px;flex-wrap:wrap;">' + cds + "</div>";
    }

    case "stats": {
      const sts = items.map((it) => '<div style="flex:1;text-align:center;padding:18px 10px;border-right:1px solid ' + b.n2 + ';"><div style="font-size:34px;font-weight:200;color:' + b.pri + ';">' + esc(it.title) + '</div><div style="font-size:11px;color:' + b.txL + ';margin-top:6px;">' + esc(it.desc || "") + "</div></div>").join("");
      return '<div style="display:flex;border:1px solid ' + b.n2 + ';border-radius:8px;overflow:hidden;">' + sts + "</div>";
    }

    case "accordion": {
      const acc = items.slice(0, 3).map((it, i) => '<div style="border:1px solid ' + b.n2 + ';border-radius:7px;margin-bottom:5px;overflow:hidden;"><div style="padding:10px 14px;font-size:12px;font-weight:600;color:' + b.tx + ";background:" + (i === 0 ? b.priLt : b.wh) + ';display:flex;justify-content:space-between;">' + esc(it.title) + "<span>" + (i === 0 ? "▲" : "▼") + "</span></div>" + (i === 0 ? '<div style="padding:10px 14px;font-size:12px;color:' + b.txL + ';line-height:1.7;">' + esc(it.desc || "") + "</div>" : "") + "</div>").join("");
      return acc + (items.length > 3 ? '<div style="font-size:10px;color:' + b.txL + ';text-align:center;padding-top:4px;">+' + (items.length - 3) + " more sections</div>" : "");
    }

    case "flipcard": {
      const fcs = items.slice(0, 4).map((it) => '<div style="width:110px;height:90px;background:' + b.grad + ';border-radius:10px;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:10px;gap:4px;"><div style="font-size:10px;font-weight:700;color:#fff;text-align:center;">' + esc(it.title) + '</div><div style="font-size:8px;color:rgba(255,255,255,0.6);">Tap to flip</div></div>').join("");
      return '<div style="display:flex;gap:7px;flex-wrap:wrap;">' + fcs + "</div>";
    }

    case "timeline": {
      const tls = items.map((it, i) => '<div style="display:flex;gap:10px;margin-bottom:12px;"><div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;"><div style="width:12px;height:12px;background:' + b.pri + ';border-radius:50%;margin-top:3px;"></div>' + (i < items.length - 1 ? '<div style="width:2px;flex:1;background:' + b.n2 + ';margin:3px 0;min-height:16px;"></div>' : "") + '</div><div style="padding-bottom:4px;"><div style="font-size:12px;font-weight:600;color:' + b.tx + ';">' + esc(it.title) + '</div><div style="font-size:11px;color:' + b.txL + ';line-height:1.6;">' + esc(it.desc || "") + "</div></div></div>").join("");
      return "<div>" + tls + "</div>";
    }

    case "quiz": {
      const qq = items[0] ? items[0].title : "Question";
      const qos = items.slice(1, 5).map((o) => '<div style="padding:7px 11px;border:1.5px solid ' + b.n2 + ";border-radius:7px;font-size:11px;color:" + b.tx + ';margin-bottom:4px;display:flex;align-items:center;gap:7px;"><span style="width:13px;height:13px;border-radius:50%;border:2px solid ' + b.n2 + ';flex-shrink:0;"></span>' + esc(o.title) + "</div>").join("");
      return '<div style="font-size:13px;font-weight:500;color:' + b.tx + ';margin-bottom:10px;line-height:1.5;">' + esc(qq) + "</div>" + qos;
    }

    case "poll": {
      const pos = items.map((o) => '<div style="margin-bottom:7px;"><div style="font-size:11px;color:' + b.tx + ';margin-bottom:3px;display:flex;justify-content:space-between;"><span>' + esc(o.title) + '</span><span style="color:' + b.pri + ';font-weight:600;">' + esc(o.desc) + '%</span></div><div style="height:6px;background:' + b.n2 + ';border-radius:3px;overflow:hidden;"><div style="height:100%;width:' + Math.min(100, parseInt(o.desc || "0") || 0) + "%;background:" + b.grad + ';border-radius:3px;"></div></div></div>').join("");
      return pos;
    }

    case "divider":
      return '<div style="display:flex;align-items:center;gap:10px;padding:4px 0;"><div style="flex:1;height:2px;background:' + b.pri + ';"></div>' + (d.title ? '<span style="font-size:10px;font-weight:700;color:' + b.pri + ';letter-spacing:1px;text-transform:uppercase;">' + esc(d.title) + '</span><div style="flex:1;height:2px;background:' + b.pri + ';"></div>' : "") + "</div>";

    default:
      return '<div style="color:#aaa;font-size:11px;">Unknown block</div>';
  }
}
