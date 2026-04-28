import type { Config } from "tailwindcss";
import { fileURLToPath } from "url";
import path from "path";

// Resolve content paths absolute so Tailwind's class scan works no
// matter where node was launched from. Relative paths would otherwise
// resolve against process.cwd() — which is the parent repo dir when
// the dev server is launched via the preview MCP tool, and Tailwind
// would silently scan zero source files and emit an empty utility
// sheet (the page renders but with no classes applied).
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  content: [
    path.join(__dirname, "index.html"),
    path.join(__dirname, "src/**/*.{ts,tsx}"),
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0A0B0D",
          900: "#121318",
          800: "#1A1C22",
          700: "#2A2D36",
          600: "#464954",
          500: "#6B6F7A",
          400: "#9CA0AB",
          300: "#C8CBD2",
          200: "#E4E6EB",
          100: "#F2F3F5",
          50:  "#F9FAFB",
        },
        brand: {
          50:  "#E6F7EF",
          100: "#D1F0DD",
          200: "#A8E2BF",
          300: "#6FCE96",
          400: "#3DBD73",
          500: "#29BA74",
          600: "#1F9E5F",
          700: "#1B7A4F",
          800: "#155E3D",
          900: "#0F4028",
        },
        // BCG yellow — secondary accent. Used sparingly for callouts,
        // banners, decision-point chips. Pantone 116 C as 500. Override
        // is safe — no existing yellow-* class usage in our codebase
        // (chip-amber uses `amber`, not `yellow`).
        yellow: {
          50:  "#FFFAEB",
          100: "#FFF1C7",
          300: "#FFD96B",
          500: "#FFC72C",
          700: "#C99300",
          900: "#6B4E00",
        },
        // Semantic intent aliases — meaningful class names that resolve
        // to the existing palette. Use bg-success / text-warning / etc.
        // in surface code so the intent is readable at a glance.
        success: "#1B7A4F", // brand-700
        warning: "#C99300", // yellow-700
        error:   "#DC2626", // Tailwind red-600
        info:    "#3B82F6", // Tailwind blue-600
      },
      fontFamily: {
        // Trebuchet MS is the BCG-sanctioned Windows-built-in fallback
        // for body copy when the licensed Henderson Sans isn't
        // installed. Inter remains a webfont fallback for non-Windows
        // platforms (Linux desktops, Chromebooks).
        //
        // Henderson upgrade path: drop the licensed Henderson Sans
        // .woff2 files into app/public/fonts/, add @font-face rules
        // in src/index.css, and prepend "Henderson Sans" to both
        // sans/display stacks. Same upgrade is captured in the
        // .docx exporter — keep them in lockstep.
        sans: ['"Trebuchet MS"', "Trebuchet", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ['"Trebuchet MS"', "Trebuchet", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      // Four-tier shadow system. Surface code SHOULD use the semantic
      // names (resting / hover / active / modal). Legacy names (card /
      // elevated / hero) stay as aliases so existing code keeps working
      // while the B-series migrates.
      //
      // DISCIPLINE: shadow-active is reserved for SELECTED / ACTIVE
      // states only — selected outline row, active tab, selected
      // catalog component, drag-active drop zone. Generic hover uses
      // shadow-hover. The brand-green tint stays a deliberate accent,
      // not a background hum.
      boxShadow: {
        // Semantic four-tier system
        resting: "0 1px 2px rgba(16,18,24,0.04), 0 1px 3px rgba(16,18,24,0.04)",
        hover:   "0 4px 12px rgba(16,18,24,0.06), 0 2px 6px rgba(16,18,24,0.04)",
        active:  "0 8px 24px rgba(27,122,79,0.08), 0 2px 8px rgba(27,122,79,0.06)",
        modal:   "0 24px 80px rgba(16,18,24,0.16), 0 4px 16px rgba(16,18,24,0.06)",
        // Keyboard focus ring — unchanged
        focus:   "0 0 0 3px rgba(41,186,116,0.18)",
        // Legacy names — same values as their semantic equivalents.
        // Existing classes (`shadow-card`, `.card-hover` using
        // `shadow-elevated`, `shadow-hero` from #1a) keep working
        // without migration. B-series surfaces gradually move to the
        // semantic names; legacy aliases removed when no usages remain.
        card:     "0 1px 2px rgba(16,18,24,0.04), 0 1px 3px rgba(16,18,24,0.04)",
        elevated: "0 4px 24px rgba(16,18,24,0.06), 0 1px 3px rgba(16,18,24,0.04)",
        hero:     "0 10px 40px rgba(16,18,24,0.06), 0 2px 8px rgba(27,122,79,0.06)",
      },
      // Border radii — tightened to a clean Sana-modern progression.
      // Semantic aliases (rounded-input / rounded-button / rounded-card
      // / rounded-card-lg / rounded-hero) live as @layer components
      // utilities in src/index.css so surface code reads by intent.
      borderRadius: {
        xl: "0.75rem",   // 12px — small cards, list items
        "2xl": "1rem",   // 16px — large cards (matches Q-spec)
        "3xl": "1.5rem", // 24px — hero panels, modal corners
      },
      // Typography scale — eight levels with explicit line-height,
      // tracking, and weight tuned for Trebuchet's optical balance.
      // Display sizes top out at 56px with -0.02em tracking; Trebuchet
      // doesn't ship an extra-bold so 700 is the heaviest we go.
      fontSize: {
        "display-xl": ["3.5rem",   { lineHeight: "1.05", letterSpacing: "-0.02em",  fontWeight: "700" }], // 56px
        "display":    ["2.75rem",  { lineHeight: "1.1",  letterSpacing: "-0.015em", fontWeight: "700" }], // 44px
        "h1":         ["2rem",     { lineHeight: "1.15", letterSpacing: "-0.01em",  fontWeight: "700" }], // 32px
        "h2":         ["1.5rem",   { lineHeight: "1.2",  letterSpacing: "-0.005em", fontWeight: "600" }], // 24px
        "h3":         ["1.125rem", { lineHeight: "1.3",                              fontWeight: "600" }], // 18px
        "body-lg":    ["1rem",     { lineHeight: "1.6",                              fontWeight: "400" }], // 16px
        "body":       ["0.875rem", { lineHeight: "1.55",                             fontWeight: "400" }], // 14px
        "caption":    ["0.75rem",  { lineHeight: "1.5",  letterSpacing: "0.005em",  fontWeight: "500" }], // 12px
        "eyebrow":    ["0.625rem", { lineHeight: "1.4",  letterSpacing: "0.08em",   fontWeight: "700" }], // 10px UPPERCASE in surface code
      },
      // Motion tokens. Three durations cover the full surface budget;
      // ease-sana is the custom curve used everywhere except instant
      // state changes.
      transitionDuration: {
        fast: "150ms",
        base: "250ms",
        slow: "350ms",
      },
      transitionTimingFunction: {
        sana: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      // Hero gradient + brand accent gradients used by the new
      // dashboard hero, three-card landing, and welcome modal.
      backgroundImage: {
        "hero-fade": "linear-gradient(180deg, #F9FAFB 0%, #FFFFFF 100%)",
        "brand-gradient": "linear-gradient(135deg, #29BA74 0%, #1B7A4F 100%)",
      },
      // Animation utilities — keyframes defined in src/index.css.
      // Each is wired up here so Tailwind generates the matching
      // `animate-*` class.
      animation: {
        "fade-in":  "fade-in 250ms cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-up": "slide-up 350ms cubic-bezier(0.16, 1, 0.3, 1)",
        "scale-in": "scale-in 250ms cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
} satisfies Config;
