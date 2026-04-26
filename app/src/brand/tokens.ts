export type BrandKey = "bcg" | "bcgu" | "client";

export interface BrandTokens {
  n: string;
  pri: string;
  priDk: string;
  priLt: string;
  tx: string;
  txL: string;
  n1: string;
  n2: string;
  wh: string;
  grad: string;
}

export const B: Record<BrandKey, BrandTokens> = {
  bcg: {
    n: "BCG",
    pri: "#29BA74",
    priDk: "#1B7A4F",
    priLt: "#E6F7EF",
    tx: "#333333",
    txL: "#666666",
    n1: "#F5F5F5",
    n2: "#E8E8E8",
    wh: "#FFFFFF",
    grad: "linear-gradient(135deg, #29BA74, #1B7A4F)",
  },
  bcgu: {
    n: "BCG U",
    pri: "#197A56",
    priDk: "#0D3B2C",
    priLt: "#E8F3ED",
    tx: "#323232",
    txL: "#666666",
    n1: "#F1EEEA",
    n2: "#DFD7CD",
    wh: "#FFFFFF",
    grad: "linear-gradient(135deg, #197A56, #0D3B2C)",
  },
  client: {
    n: "Client",
    pri: "#2563EB",
    priDk: "#1D4ED8",
    priLt: "#DBEAFE",
    tx: "#1e293b",
    txL: "#64748b",
    n1: "#F8FAFC",
    n2: "#E2E8F0",
    wh: "#FFFFFF",
    grad: "linear-gradient(135deg, #2563EB, #1D4ED8)",
  },
};

export const FR = 'class="froala-style-subtitle" role="heading" aria-level="3"';

export function esc(s: string | undefined | null): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
