// Sandbox insurance (S04 order, Stage B item 3; naming-sweep law): ?sandbox
// pins the console to the S02 fixture dataset — no RPC traffic at all.
// ?demo=fixtures is honored as a legacy alias (documented in HANDOFF,
// removable at P4) so existing walks/tasks don't break. The flag is read once
// at boot; switching modes is a page load, never a silent runtime fallback. A
// live-mode RPC failure surfaces as the error state, it does NOT auto-degrade
// to fixtures: a sandbox that silently faked liveness would be worse than one
// that visibly failed.
const params =
    typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : null;
export const isFixtureMode =
    params !== null &&
    (params.has("sandbox") || params.get("demo") === "fixtures");
