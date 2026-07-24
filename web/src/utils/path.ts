export type RouteKey = "landing" | "console";

// One scroll slot per route. App's popstate handler is the single owner:
// it saves the outgoing route's position on every transition and decides
// whether the incoming route restores (see App.tsx).
const savedScroll: Record<RouteKey, number> = { landing: 0, console: 0 };

export function saveScroll(route: RouteKey, y: number) {
    savedScroll[route] = y;
}

// Dev-only observability: lets instrumented tests read the slots directly.
if (import.meta.env.DEV) {
    (window as unknown as { __scrollSlots?: Record<RouteKey, number> }).__scrollSlots =
        savedScroll;
}

export function getSavedScroll(route: RouteKey): number {
    return savedScroll[route];
}

export function normalizePath(path: string): string {
    return path.replace(/\/+/g, "/");
}

export function getConsolePath(): string {
    const base = import.meta.env.BASE_URL || "/";
    return normalizePath(`${base}/console`);
}

export function getLandingPath(): string {
    const base = import.meta.env.BASE_URL || "/";
    return normalizePath(base);
}

export function isConsoleRoute(path: string): boolean {
    const consolePath = getConsolePath();
    const normalized = normalizePath(path);
    return normalized === consolePath || normalized === `${consolePath}/`;
}

export function navigateToConsole() {
    // Scroll capture is owned by App's popstate handler (one owner for both
    // synthetic and real history navigation); pushState does not scroll, so
    // the handler still reads the pre-navigation scrollY. The synthetic
    // marker distinguishes a fresh in-app navigation (lands at top) from a
    // real Back/Forward traversal (restores the route's saved position).
    // Preserve the query string across SPA navigation: ?demo=fixtures must
    // survive the landing -> console transition (S04 fixture fallback flag).
    window.history.pushState(null, "", getConsolePath() + window.location.search);
    window.dispatchEvent(new PopStateEvent("popstate", { state: { synthetic: true } }));
}

export function navigateToLanding() {
    window.history.pushState(null, "", getLandingPath() + window.location.search);
    window.dispatchEvent(new PopStateEvent("popstate", { state: { synthetic: true } }));
}