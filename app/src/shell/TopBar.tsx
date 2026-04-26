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

interface Props {
  onSearch?: (q: string) => void;
}

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
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-ink-100">
          {(Object.keys(B) as BrandKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setBrand(k)}
              className={`px-3 h-7 rounded-md text-xs font-semibold transition ${
                brand === k ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"
              }`}
            >
              {B[k].n}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
