# Lottie animations

This folder holds Lottie JSON files used by the `<LottiePlayer>` component
(`app/src/components/LottiePlayer.tsx`).

## How to add a new Lottie animation

1. Find an animation on https://lottiefiles.com (or another source)
2. Click "Download" → choose **Lottie JSON** format (free for personal +
   commercial use on Free animations)
3. Save the `.json` file into this folder (`app/public/animations/`)
4. Use it via the shared component:

```tsx
import { LottiePlayer } from "../components/LottiePlayer";

<LottiePlayer src="my-animation" className="w-32 h-32" />
```

The `src` is the filename without `.json`. Vite serves this folder
under `/animations/` at runtime.

## What's currently here

- `splash-particles.json` — abstract floating dots for the welcome splash
- `loading-orb.json` — pulsing orb for build-progress / "thinking" states
- `completion-confetti.json` — particle burst for course-built celebration
- `empty-state.json` — orbiting ring + dot for "nothing here yet" surfaces

These four were hand-crafted and are intentionally minimal so they ship
without external dependencies. Replace any of them with richer versions
from LottieFiles by saving over the same filename — no code changes
needed.

## Suggested LottieFiles searches per surface

| Surface | Search keywords |
| --- | --- |
| Splash background | "abstract motion", "particles", "ai loading" |
| Loading / build orb | "ai brain", "loading orb", "thinking" |
| Completion celebration | "confetti", "celebration", "checkmark success" |
| Empty state | "empty box", "looking", "search no result" |
| Lesson streaming | "writing pen", "typing cursor", "ai writing" |
| Interactive cue | "click hand", "tap", "hover indicator" |
| Tour / onboarding | "rocket launch", "guide pointer", "step by step" |
