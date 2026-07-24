// Demo insurance (S04 order, Stage B item 3): ?demo=fixtures pins the console
// to the S02 fixture dataset — no RPC traffic at all. The flag is read once at
// boot; switching modes is a page load, never a silent runtime fallback. A
// live-mode RPC failure surfaces as the error state, it does NOT auto-degrade
// to fixtures: a demo that silently faked liveness would be worse than one
// that visibly failed.
export const isFixtureMode =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("demo") === "fixtures";
