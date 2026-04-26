import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
    base: "/novoed-toolkit/",
    plugins: [react()],
});
