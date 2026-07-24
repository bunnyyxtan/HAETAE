import { useEffect } from "react";
import Lenis from "lenis";
import { useSettings } from "@/utils/settings";

declare global {
    interface Window {
        __lenis: Lenis | null;
    }
}

export function useLenis() {
    const { resolvedMotion } = useSettings();

    useEffect(() => {
        // respect reduced motion
        if (resolvedMotion === "reduce") {
            if (window.__lenis) {
                window.__lenis.destroy();
                window.__lenis = null;
            }
            return;
        }

        const lenis = new Lenis({
            duration: 1.15,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,
            wheelMultiplier: 0.9,
            touchMultiplier: 1.4,
        });

        // expose for anchor smooth-scroll
        window.__lenis = lenis;

        let raf: number;
        function loop(time: number) {
            lenis.raf(time);
            raf = requestAnimationFrame(loop);
        }
        raf = requestAnimationFrame(loop);

        return () => {
            cancelAnimationFrame(raf);
            lenis.destroy();
            if (window.__lenis === lenis) {
                window.__lenis = null;
            }
        };
    }, [resolvedMotion]);
}
