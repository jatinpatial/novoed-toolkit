import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Command, HelpCircle, LogOut, Search, Settings } from "lucide-react";
import { B, type BrandKey } from "../brand/tokens";
import { clearUser, getUser, initialsFor, subscribeUser, type StudioUser } from "../store/user";

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
  /** Track-H: open the help drawer when the avatar dropdown's "Help"
      item is clicked, OR when the persistent ? icon is clicked.
      AppShell wires this to a single HelpDrawer at the shell level. */
  onShowHelp?: () => void;
  /** Track-H: re-open the WelcomeModal (e.g. from Reset profile, or
      after clearUser fires). Dashboard already wires reopenWelcome
      via its existing onShowWelcome path; passing it through here
      lets the avatar dropdown reach it. */
  onShowWelcome?: () => void;
}

// Tooltip text shared across both brand toggles (here + the
// CourseTopBar inside CourseStudio.tsx). Kept tight per B3d spec.
const BRAND_TOOLTIP = "Theme used in preview & export";

export function TopBar({ onSearch, onShowHelp, onShowWelcome }: Props) {
  const [brand, setBrand] = useActiveBrand();
  // Track-P / P5: scope the brand toggle to surfaces where it
  // matters. User feedback: brand toggle on the home page is
  // cognitive overhead — the LD hasn't picked a Studio yet, so
  // there's nothing to brand. Show it only on Infographic Studio
  // routes (where the rendered output uses the brand colors).
  // Course / Script / KC studios have their own brand handling
  // baked into the export path; they don't need the top-level
  // toggle either. Future: surface it on lesson canvas only when
  // an export is in progress.
  const location = useLocation();
  const showBrandToggle = location.pathname.startsWith("/infographics");
  // Track-H: local user profile. Subscribes to studio.user changes so
  // a fresh save (WelcomeModal submit) updates the avatar without a
  // page refresh.
  const [user, setUser] = useState<StudioUser | null>(() => getUser());
  useEffect(() => subscribeUser(() => setUser(getUser())), []);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  // Click-outside dismiss for the dropdown.
  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);
  // Cmd/Ctrl + ? → open help drawer.
  useEffect(() => {
    const handler = onShowHelp;
    if (!handler) return;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "?" || e.key === "/")) {
        if (e.shiftKey || e.key === "?") {
          e.preventDefault();
          handler!();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onShowHelp]);

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
        {showBrandToggle && (
          <>
            <div className="flex items-center gap-1.5 text-xs text-ink-500">
              <span className="font-medium">Brand</span>
            </div>
            {/* B3d: title attribute on the toggle group; per-button
                color swatch shows each brand's primary color. */}
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
          </>
        )}

        {/* Track-H: persistent help icon. Opens HelpDrawer; Cmd/Ctrl+?
            shortcut also wired above. Sits between brand toggle and
            user avatar so the help affordance is visible without a
            menu open. */}
        {onShowHelp && (
          <button
            onClick={onShowHelp}
            className="w-9 h-9 rounded-md text-ink-500 hover:text-ink-900 hover:bg-ink-100 flex items-center justify-center transition"
            title="Help & guides (Cmd+?)"
            aria-label="Open help"
          >
            <HelpCircle size={16} />
          </button>
        )}

        {/* Track-H: user avatar + dropdown. Initials when a name is
            saved; "Sign in" link otherwise (re-opens WelcomeModal). */}
        {user ? (
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 pl-1 pr-2.5 h-9 rounded-md hover:bg-ink-100 transition"
              title={`Signed in as ${user.name}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span
                className="w-7 h-7 rounded-full bg-brand-gradient text-white text-[11px] font-bold flex items-center justify-center"
                aria-hidden="true"
              >
                {initialsFor(user.name)}
              </span>
              <span className="text-sm font-semibold text-ink-800">
                {user.name.split(/\s+/)[0]}
              </span>
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-ink-200 rounded-lg shadow-elevated overflow-hidden z-50"
              >
                <div className="px-3 py-2.5 border-b border-ink-100">
                  <div className="text-xs font-bold text-ink-900">{user.name}</div>
                  <div className="text-[10px] text-ink-500 mt-0.5">
                    Local profile · this computer
                  </div>
                </div>
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    // Settings is a soon placeholder — no-op for now.
                  }}
                  className="w-full px-3 py-2 flex items-center gap-2 text-xs text-ink-500 cursor-not-allowed"
                  disabled
                >
                  <Settings size={13} /> Settings
                  <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-ink-400">
                    soon
                  </span>
                </button>
                {onShowHelp && (
                  <button
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onShowHelp();
                    }}
                    className="w-full px-3 py-2 flex items-center gap-2 text-xs text-ink-700 hover:bg-ink-50"
                  >
                    <HelpCircle size={13} /> Help guide
                  </button>
                )}
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    if (
                      confirm(
                        "Reset profile? This clears your local name + the welcome flag. Your courses, scripts, and KCs are not affected.",
                      )
                    ) {
                      clearUser();
                      // Re-open the WelcomeModal so the LD lands somewhere
                      // useful immediately rather than on an unbranded
                      // TopBar.
                      onShowWelcome?.();
                    }
                  }}
                  className="w-full px-3 py-2 flex items-center gap-2 text-xs text-ink-700 hover:bg-ink-50 border-t border-ink-100"
                >
                  <LogOut size={13} /> Reset profile
                </button>
              </div>
            )}
          </div>
        ) : (
          onShowWelcome && (
            <button
              onClick={onShowWelcome}
              className="px-3 h-9 rounded-md text-sm font-semibold text-brand-700 hover:bg-brand-50 transition"
            >
              Sign in
            </button>
          )
        )}
      </div>
    </header>
  );
}
