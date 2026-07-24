import { useState, useEffect } from "react";

// Use a simple pubsub to notify settings changes across the app without a full React Context provider tree.
type Settings = {
    motionOverride: "system" | "reduce" | "allow";
    soundEnabled: boolean;
};

const defaultSettings: Settings = {
    motionOverride: "system",
    soundEnabled: true,
};

let currentSettings = { ...defaultSettings };
const listeners = new Set<() => void>();

function getSystemReduced() {
    if (typeof window !== "undefined" && window.matchMedia) {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return false;
}

let systemReduced = getSystemReduced();

if (typeof window !== "undefined" && window.matchMedia) {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Use the modern addEventListener pattern, with a fallback if needed
    if (mq.addEventListener) {
        const handler = (e: MediaQueryListEvent) => {
            systemReduced = e.matches;
            applySettingsToDOM();
            listeners.forEach((l) => l());
        };
        mq.addEventListener("change", handler);

        if (import.meta.hot) {
            import.meta.hot.dispose(() => {
                mq.removeEventListener("change", handler);
            });
        }
    }
}

export function getSettings() {
    return currentSettings;
}

export function getResolvedMotion(): "reduce" | "allow" {
    if (currentSettings.motionOverride === "reduce") return "reduce";
    if (currentSettings.motionOverride === "allow") return "allow";
    return systemReduced ? "reduce" : "allow";
}

export function isMotionReduced() {
    return getResolvedMotion() === "reduce";
}

export function updateSettings(partial: Partial<Settings>) {
    currentSettings = { ...currentSettings, ...partial };
    localStorage.setItem("haetae_settings", JSON.stringify(currentSettings));
    applySettingsToDOM();
    listeners.forEach((l) => l());
}

export function useSettings() {
    const [state, setState] = useState(() => ({
        settings: currentSettings,
        resolvedMotion: getResolvedMotion()
    }));

    useEffect(() => {
        const listener = () => setState({
            settings: currentSettings,
            resolvedMotion: getResolvedMotion()
        });
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    }, []);

    return {
        ...state.settings,
        resolvedMotion: state.resolvedMotion
    };
}

export function initSettings() {
    try {
        const stored = localStorage.getItem("haetae_settings");
        if (stored) {
            currentSettings = { ...defaultSettings, ...JSON.parse(stored) };
        }
    } catch (e) {
        // ignore
    }
    applySettingsToDOM();
}

function applySettingsToDOM() {
    const resolved = getResolvedMotion();
    document.documentElement.setAttribute("data-motion", resolved);
}
