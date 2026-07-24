import { useEffect, useRef, useState } from "react";

// Copy-to-clipboard with a keyed "copied" flash. The key distinguishes which
// of several copy buttons on a surface just fired. Confirmation lights up
// only after the clipboard write actually resolved — a failed write shows
// nothing rather than a false "Copied".
export function useCopy(timeoutMs = 1600) {
    const [copied, setCopied] = useState<string | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
        () => () => {
            if (timer.current) clearTimeout(timer.current);
        },
        [],
    );

    const copy = (key: string, text: string) => {
        if (!navigator.clipboard) return;
        navigator.clipboard
            .writeText(text)
            .then(() => {
                setCopied(key);
                if (timer.current) clearTimeout(timer.current);
                timer.current = setTimeout(() => setCopied(null), timeoutMs);
            })
            .catch(() => {
                /* no false confirmation */
            });
    };

    return { copied, copy };
}
