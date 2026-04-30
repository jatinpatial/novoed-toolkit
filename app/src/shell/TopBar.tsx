import { useEffect, useState } from "react";
import { Search, Command } from "lucide-react";
import { B, type BrandKey } from "../brand/tokens";

const KEY = "bcgu_studio_active_brand";

export function getActiveBrand(): BrandKey {
  const stored = localStorage.getItem(KEY);
  if (stored === "bcg" || stored === "bcgu" || stored === "client") return stored;
  return "bcgu";
}

export function setActiveBrand(b: BrandKey) {
  localStorage.setItem(KEY, b);
  window.dispatchEvent(new CustomEvent("active-brand-changed"));
}

export function useActiveBrand(): [BrandKey, (b: BrandKey) => void] {
  const [brand, setBrand] = useState<BrandKey>(() => getActiveBrand());
  useEffect(() => {
    const handler = () => setBrand(getActiveBrand());
    window.addEventListener("active-brand-changed", handler);
    return () => window.removeEventListener("active-brand-changed", handler);
  }, []);
  return [brand, (b: BrandKey) => { setActiveBrand(b); setBrand(b); }];
}

/**
 * BrandBodyAttribute — keeps document.body.dataset.brand synced with
 * the active brand from useActiveBrand() (B3d).
 *
 * Mounted in main.tsx inside <BrowserRouter>. Reads the active brand,
 * writes it to <body data-brand="bcg|bcgu|client">. The cascade vars
 * defined in src/index.css ([data-brand="..."] selectors with
 * --brand-500 / --brand-700 / --brand-50) then flow to any surface
 * that reads them — currently the .lesson-canvas-pane top accent
 * strip; future surfaces opt in via var(--brand-500).
 *
 * Renders nothing — pure side-effect component.
 */
export function BrandBodyAttribute() {
  const [brand] = useActiveBrand();
  useEffect(() => {
    document.body.dataset.brand = brand;
  }, [brand]);
  return null;
}

interface Props {
  onSearch?: (q: string) => void;
}

// Tooltip text shared across both brand toggles (here + the
// CourseTopBar inside CourseStudio.tsx). Kept tight per B3d spec.
const BRAND_TOOLTIP = "Theme used in preview & export";

export function TopBar({ onSearch }: Props) {
  const [brand, setBrand] = useActiveBrand();

  return (
    <header className="h-14 bg-white border-b border-ink-200 flex items-center px-5 gap-4 flex-shrink-0">
      <div className="flex-1 max-w-xl relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          onChange={(e) => onSearch?.(e.target.value)}
          placeholder="Search projects, components, lessons..."
          className="input pl-9 pr-16 bg-ink-50 border-ink-100 focus:bg-white"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <span className="kbd"><Command size={10} /></span>
          <span className="kbd">K</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-ink-500">
          <span className="font-medium">Brand</span>
        </div>
        {/* B3d: title attribute on the toggle group; per-button
            color swatch shows each brand's primary color so the LD
            sees "BCG = green / BCG U = darker green / Client = blue"
            at a glance even before hovering for the tooltip. */}
        <div
          className="flex items-center gap-0.5 p-0.5 rounded-lg bg-ink-100"
          title={BRAND_TOOLTIP}
        >
          {(Object.keys(B) as BrandKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setBrand(k)}
              className={`flex items-center gap-1.5 px-3 h-7 rounded-md text-xs font-semibold transition ${
                brand === k ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0"
                style={{ background: B[k].pri }}
                aria-hidden="true"
              />
              {B[k].n}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
