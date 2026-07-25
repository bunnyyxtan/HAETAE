import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
// TEMP gate-walk signer (S13 re-walk) — remove after gate is sealed.
import { gatewalkSigner } from "./gatewalk-signer.mjs";

// PORT/BASE_PATH are injected by the Replit managed workflow (preview
// registration). Bare `pnpm --filter @haetae/web run dev` still works
// without them: port 5173, base "/".
const port = Number(process.env.PORT ?? 5173);
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
    base,
    plugins: [react(), gatewalkSigner()],
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
        // TEMP (gate walk): vite's built-in CORS layer answers OPTIONS before
        // middleware; scope it to the published origin so the shim can call
        // the signer. Remove with the signer after the gate is sealed.
        cors: { origin: "https://ai-enforcement-protocol.replit.app" },
    },
    preview: {
        port,
        host: "0.0.0.0",
        allowedHosts: true,
    },
});
