import { B, type BrandKey } from "../brand/tokens";

interface Props {
  brand: BrandKey;
  setBrand: (k: BrandKey) => void;
  size?: "sm" | "md";
}

export function BrandSwitch({ brand, setBrand, size = "md" }: Props) {
  const pad = size === "sm" ? "5px 12px" : "8px 18px";
  const fs = size === "sm" ? 11 : 12;
  return (
    <div style={{ display: "flex", background: "#f0f0f0", borderRadius: size === "sm" ? 6 : 8, overflow: "hidden" }}>
      {(Object.entries(B) as [BrandKey, (typeof B)[BrandKey]][]).map(([k, v]) => (
        <button
          key={k}
          onClick={() => setBrand(k)}
          style={{
            padding: pad,
            border: "none",
            cursor: "pointer",
            fontSize: fs,
            fontWeight: 600,
            background: brand === k ? v.pri : "transparent",
            color: brand === k ? "#fff" : "#888",
            transition: "all 0.15s",
          }}
        >
          {v.n}
        </button>
      ))}
    </div>
  );
}
