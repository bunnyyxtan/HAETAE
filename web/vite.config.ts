import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// PORT and BASE_PATH may be injected by the hosting environment. A bare
// `npm run dev` works without them: port 5173, base "/".
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
