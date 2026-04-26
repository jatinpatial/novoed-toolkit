# NovoEd Toolkit (Vite + React + TS)

Migration of the NovoEd Component Toolkit to a modern Vite + React + TypeScript + Tailwind stack.

## Stack

- **Vite 5** + React 18 + TypeScript
- **Tailwind CSS** for builder-UI chrome (generators still produce inline-style HTML for Froala/NovoEd compatibility)
- **React Router** for `/` (Component Library) and `/course-builder`
- Pure-JS ZIP builder — no JSZip dependency
- `gh-pages` for deployment

## Setup

```bash
cd app
npm install
npm run dev        # http://localhost:5173/novoed-toolkit/
```

## Build & deploy

```bash
npm run build      # tsc -b && vite build → dist/
npm run preview    # serve dist/ locally
npm run deploy     # build + publish dist/ to gh-pages branch
```

`vite.config.ts` sets `base: "/novoed-toolkit/"` to match the GitHub Pages subpath.

## Structure

```
app/
├── src/
│   ├── brand/tokens.ts          BCG, BCG U, Client brand tokens + esc/shuffle helpers
│   ├── generators/
│   │   ├── registry.ts          HTML_COMPS, SCORM_COMPS
│   │   ├── defaults.ts          DEFAULTS for every component
│   │   ├── html/genHTML.ts      20 HTML component string generators
│   │   └── scorm/genSCORM.ts    12 SCORM interactive string generators
│   ├── scorm/zipBuilder.ts      Pure-JS ZIP + SCORM 1.2 manifest + downloadSCORM
│   ├── course/                  Course-builder-specific types/blocks/preview/export
│   ├── components/BrandSwitch.tsx
│   ├── pages/
│   │   ├── ComponentLibrary.tsx   replaces index.html
│   │   └── CourseBuilder.tsx      replaces course-builder.html
│   ├── main.tsx                 Router + entry
│   └── index.css                Tailwind directives
├── vite.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

## Notes on the port

- **Generators are pure functions** producing inline-style HTML strings — required so output survives NovoEd's Froala editor (strips classes).
- **Script-tag safety** preserved via the `scTag()` helper in `genSCORM.ts` (splits `<scr`+`ipt>` so embedding in a host `<script>` block doesn't break the parser).
- **JSZip removed** — the pure-JS STORE-compression ZIP builder handles both single SCORM components and full lesson exports.
- **Course autosave** persists to `localStorage` under `bcgu_cb_<course-id>` (same key scheme as the legacy `course-builder.html`).
