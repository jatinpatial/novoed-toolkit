/**
 * Track-QQ3: editorial-filter pref.
 *
 * Stock photos (Pexels lesson banners + themed covers + people-image
 * placements + project card covers) read as generic AI/stock-photo
 * unless treated. The editorial filter applies a CSS pipeline —
 * desaturate slightly, lift contrast, dim midtones, brand-tint
 * overlay — that reads as magazine cover treatment. Cohesion across
 * the app + every photo feels intentional.
 *
 * Default: ON. LDs who want raw photos can flip via the SidebarFooter
 * toggle. State lives in localStorage so the pref survives reloads
 * + persists per-browser-profile.
 *
 * Wire shape:
 *   body[data-editorial-filter="off"]    → CSS filter rules disabled
 *   body[data-editorial-filter="on"]     → default, filter applied
 *   (no attribute)                       → also default to on
 */

const KEY = "studio.editorialFilterOff";

export function isEditorialFilterOff(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setEditorialFilterOff(off: boolean): void {
  try {
    if (off) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent("editorial-filter-changed"));
  } catch {
    /* ignore — privacy mode */
  }
}

export function subscribeEditorialFilter(fn: () => void): () => void {
  const handler = () => fn();
  window.addEventListener("editorial-filter-changed", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("editorial-filter-changed", handler);
    window.removeEventListener("storage", handler);
  };
}
