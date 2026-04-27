// Resolve tailwind.config.ts relative to THIS file rather than relying
// on process.cwd(). When `vite dev` is launched from the parent repo
// directory (e.g. via the preview MCP tool), Tailwind's default config
// search would otherwise miss app/tailwind.config.ts and silently fall
// back to defaults — dropping our custom `ink` and `brand` palettes
// and breaking @apply text-ink-900 in index.css.
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  plugins: {
    tailwindcss: { config: path.join(__dirname, "tailwind.config.ts") },
    autoprefixer: {},
  },
};
