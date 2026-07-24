import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// PORT/BASE_PATH are injected by the Replit managed workflow (preview
// registration). Bare `pnpm --filter @haetae/web run dev` still works
// without them: port 5173, base "/".
const port = Number(process.env.PORT ?? 5173);
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
    base,
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(import.meta.dirname, "src"),
        },
    },
    server: {
        port,
        strictPort: true,
        host: "0.0.0.0",
        allowedHosts: true,
    },
    preview: {
        port,
        host: "0.0.0.0",
        allowedHosts: true,
    },
});
