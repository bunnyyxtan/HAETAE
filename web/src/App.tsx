import { useEffect, useState, useRef, lazy, Suspense } from "react";
import Nav from "@/components/landing/Nav";
import SideRail from "@/components/landing/SideRail";
import Hero from "@/components/landing/Hero";
import Fold from "@/components/landing/Fold";
import Wound from "@/components/landing/Wound";
import Seal from "@/components/landing/Seal";
import Rail from "@/components/landing/Rail";
import Ceremony from "@/components/landing/Ceremony";
import Standard from "@/components/landing/Standard";
import Walk from "@/components/landing/Walk";
import Origin from "@/components/landing/Origin";
import Marquee from "@/components/landing/Marquee";
import FinalCTA from "@/components/landing/FinalCTA";
import Footer from "@/components/landing/Footer";
import { useLenis } from "@/hooks/useLenis";
import { isConsoleRoute, isVerifyRoute, saveScroll, getSavedScroll, type RouteKey } from "@/utils/path";

// Lazy console chunk: wagmi/viem ride with the console, not the landing.
const ConsoleApp = lazy(() => import("./console/ConsoleApp"));
// Wallet-free public verify surface — same lazy chunk boundary.
const VerifyPage = lazy(() => import("./console/VerifyPage"));

function App() {
    useLenis();

    // Scroll position the incoming route should restore to, decided by the
    // popstate handler at transition time. null = fresh entry, land at top.
    const pendingRestore = useRef<number | null>(null);

    const [route, setRoute] = useState<RouteKey>(() => {
        const p = window.location.pathname;
        if (isVerifyRoute(p)) return "verify"; // check first: /verify/ nests under the console prefix
        return isConsoleRoute(p) ? "console" : "landing";
    });

    useEffect(() => {
        document.title = "HAETAE — Trust rail for the AI agent economy";
    }, []);

    const routeRef = useRef(route);

    useEffect(() => {
        // SPA routing owns scroll; keep the browser's native restoration out of it.
        if ("scrollRestoration" in window.history) {
            window.history.scrollRestoration = "manual";
        }
        const onPopState = (e: PopStateEvent) => {
            const p = window.location.pathname;
            const nextRoute: RouteKey = isVerifyRoute(p)
                ? "verify"
                : isConsoleRoute(p)
                  ? "console"
                  : "landing";
            const prev = routeRef.current;
            if (prev === nextRoute) return;
            const synthetic = e.state?.synthetic === true;
            // Always capture the outgoing route's position.
            saveScroll(prev, window.scrollY);
            // Landing always resumes its reading position (logo return and
            // history traversal alike — verified UX). Console resumes only on
            // real Back/Forward; a fresh "Open Console" lands at the top.
            if (nextRoute === "landing") {
                pendingRestore.current = getSavedScroll("landing");
            } else {
                pendingRestore.current = synthetic ? null : getSavedScroll(nextRoute);
            }
            routeRef.current = nextRoute;
            setRoute(nextRoute);
        };
        window.addEventListener("popstate", onPopState);
        return () => window.removeEventListener("popstate", onPopState);
    }, []);

    useEffect(() => {
        const target = pendingRestore.current;
        pendingRestore.current = null;
        if (!target) {
            // Fresh entry, initial mount, or saved-at-top: pin to top.
            if (window.__lenis) window.__lenis.scrollTo(0, { immediate: true });
            else window.scrollTo(0, 0);
            return;
        }
        // The incoming surface has just remounted and is not at full height
        // yet (landing sections mount progressively; registry rows land after
        // the fixture delay), so an immediate scrollTo would clamp short.
        // Wait until the document is tall enough, bounded by TIME so the
        // console's ~900ms simulated load cannot outrun a frame-count bound.
        let cancelled = false;
        const startedAt = performance.now();
        const attempt = () => {
            if (cancelled) return;
            const ready =
                document.documentElement.scrollHeight >= target + window.innerHeight;
            if (ready || performance.now() - startedAt > 1600) {
                if (window.__lenis) {
                    window.__lenis.resize?.();
                    window.__lenis.scrollTo(target, { immediate: true });
                } else {
                    window.scrollTo(0, target);
                }
            } else {
                requestAnimationFrame(attempt);
            }
        };
        requestAnimationFrame(attempt);
        return () => {
            cancelled = true;
        };
    }, [route]);

    if (route === "verify") {
        return (
            <Suspense fallback={null}>
                <VerifyPage />
            </Suspense>
        );
    }

    if (route === "console") {
        return (
            <Suspense fallback={null}>
                <ConsoleApp />
            </Suspense>
        );
    }

    return (
        <div className="App" data-testid="app-root">
            <div className="grain" aria-hidden />
            <Nav />
            <SideRail />
            <main>
                <Hero />
                <Fold n="01" label="The Wound" />
                <Wound />
                <Fold n="02" label="The Seal" />
                <Seal />
                <Fold n="03" label="The Rail" />
                <Rail />
                <Fold n="04" label="The Ceremony" />
                <Ceremony />
                <Fold n="05" label="The Standard" />
                <Standard />
                <Fold n="06" label="The Walk" />
                <Walk />
                <Origin />
                <Marquee />
                <FinalCTA />
            </main>
            <Footer />
        </div>
    );
}

export default App;
