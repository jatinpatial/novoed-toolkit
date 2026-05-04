# Lottie animations

This folder holds Lottie JSON files used by the `<LottiePlayer>` component
(`app/src/components/LottiePlayer.tsx`).

## How to add a new Lottie animation

1. Find an animation on https://lottiefiles.com (or another source)
2. Click "Download" → choose **Lottie JSON** format
3. Save the `.json` file into this folder (`app/public/animations/`)
4. Use it via the shared component:

```tsx
import { LottiePlayer } from "../components/LottiePlayer";

<LottiePlayer src="my-animation" className="w-32 h-32" />
```

The `src` is the filename without `.json`. Vite serves this folder
under `/animations/` at runtime.

## What's currently here

| File | Origin | Wired into |
|---|---|---|
| `splash-particles.json` | hand-crafted | Welcome modal background (drifting dots) |
| `loading-orb.json` | hand-crafted | not yet wired (placeholder) |
| `completion-confetti.json` | hand-crafted | not yet wired (CSS confetti still in use) |
| `empty-state.json` | hand-crafted | not yet wired (placeholder) |
| `brain.json` | xvrh/lottie-flutter (MIT) | Build progress band — "AI thinking" anchor |
| `check-pop.json` | xvrh/lottie-flutter (MIT) | not yet wired (success moments) |
| `medal.json` | xvrh/lottie-flutter (MIT) | not yet wired (course completion stretch) |
| `typing-dot.json` | xvrh/lottie-flutter (MIT) | not yet wired (lesson streaming cursor) |
| `glow-loading.json` | xvrh/lottie-flutter (MIT) | not yet wired (splash bg accent) |
| `empty-status.json` | xvrh/lottie-flutter (MIT) | EmptyState component (Projects Library no-projects) |
| `gears.json` | xvrh/lottie-flutter (MIT) | not yet wired (backend processing indicator) |
| `flow.json` | xvrh/lottie-flutter (MIT) | not yet wired (process / flow infographic accent) |
| `progress-bar.json` | xvrh/lottie-flutter (MIT) | not yet wired (inline progress accent) |

## Sources

- **xvrh/lottie-flutter** — `https://github.com/xvrh/lottie-flutter` —
  community-curated Lottie examples. MIT-licensed; safe to bundle.
- **LottieFiles** — `https://lottiefiles.com` — most animations are
  CC-BY or free for personal/commercial use; verify per-animation
  before bundling.

## Suggested LottieFiles searches per surface

| Surface | Search keywords |
| --- | --- |
| Splash background | "abstract motion", "particles", "ai loading", "gradient flow" |
| Loading / build orb | "ai brain", "loading orb", "thinking" |
| Completion celebration | "confetti", "celebration", "checkmark success" |
| Empty state | "empty box", "looking", "search no result" |
| Lesson streaming | "writing pen", "typing cursor", "ai writing" |
| Interactive cue | "click hand", "tap", "hover indicator" |
| Tour / onboarding | "rocket launch", "guide pointer", "step by step" |

## Performance budget

- Aim for < 50KB per file. Anything > 100KB should be carefully
  considered — it bloats the page load.
- Vite's public/ folder is copied verbatim to the build, no compression.
- Brand-tinting via CSS filters is preferred over editing the JSON
  itself — that way one source file can match different brand cascades.
