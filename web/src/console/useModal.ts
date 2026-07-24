import { useEffect, useRef, useCallback } from "react";

interface ModalEntry {
    token: symbol;
    el: HTMLElement | null;
    requestClose: () => void;
}

let stack: ModalEntry[] = [];
let originalOverflow = "";

function lock() {
    window.addEventListener("keydown", handleKeyDown);
    if (window.__lenis) window.__lenis.stop();
    originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
}

function unlock() {
    window.removeEventListener("keydown", handleKeyDown);
    if (window.__lenis) window.__lenis.start();
    document.body.style.overflow = originalOverflow;
}

function focusables(root: HTMLElement): HTMLElement[] {
    const nodes = root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    return Array.from(nodes).filter((el) => !el.hasAttribute("disabled"));
}

function handleKeyDown(e: KeyboardEvent) {
    if (stack.length === 0) return;
    const top = stack[stack.length - 1];

    if (e.key === "Escape") {
        e.stopPropagation();
        top.requestClose();
        return;
    }

    // Focus trap: applies to the topmost overlay only.
    if (e.key === "Tab") {
        const el = top.el;
        if (!el) return;
        const items = focusables(el);
        if (items.length === 0) {
            e.preventDefault();
            return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        const inside = el.contains(active);
        if (e.shiftKey) {
            if (!inside || active === first || active === el) {
                last.focus();
                e.preventDefault();
            }
        } else {
            if (!inside || active === last || active === el) {
                first.focus();
                e.preventDefault();
            }
        }
    }
}

function popEntry(token: symbol) {
    const had = stack.length > 0;
    stack = stack.filter((m) => m.token !== token);
    if (had && stack.length === 0) unlock();
}

/**
 * Shared overlay contract. Focus restoration happens synchronously at
 * close-intent time (requestClose), NOT at unmount — AnimatePresence defers
 * unmount for exit animations, so unmount-time focus work is never reliable.
 * The unmount cleanup only does idempotent stack bookkeeping.
 *
 * Usage: const { dialogRef, requestClose } = useModal(onClose, opener);
 * - attach dialogRef + tabIndex={-1} to the dialog element (initial focus
 *   goes to the container per the WAI-ARIA dialog pattern),
 * - route EVERY close path (Escape is automatic, backdrop, close button,
 *   item selection) through requestClose.
 */
export function useModal(onRequestClose: () => void, opener: HTMLElement | null) {
    const tokenRef = useRef<symbol | null>(null);
    if (tokenRef.current === null) tokenRef.current = Symbol("modal");
    const tk = tokenRef.current;

    const closedRef = useRef(false);
    const elRef = useRef<HTMLElement | null>(null);
    const onCloseRef = useRef(onRequestClose);
    onCloseRef.current = onRequestClose;
    const openerRef = useRef(opener);
    openerRef.current = opener;

    const requestClose = useCallback(() => {
        if (closedRef.current) return;
        closedRef.current = true;
        const isTop = stack.length > 0 && stack[stack.length - 1].token === tk;
        popEntry(tk);
        if (isTop && stack.length === 0) {
            const op = openerRef.current;
            if (op && op.isConnected && typeof op.focus === "function") op.focus();
        } else if (stack.length > 0) {
            const newTop = stack[stack.length - 1];
            if (newTop.el) {
                const items = focusables(newTop.el);
                (items[0] ?? newTop.el).focus();
            }
        }
        onCloseRef.current();
    }, [tk]);

    const dialogRef = useCallback(
        (el: HTMLElement | null) => {
            elRef.current = el;
            const entry = stack.find((m) => m.token === tk);
            if (entry) entry.el = el;
            if (el) el.focus();
        },
        [tk]
    );

    useEffect(() => {
        closedRef.current = false;
        const wasEmpty = stack.length === 0;
        stack.push({ token: tk, el: elRef.current, requestClose });
        if (wasEmpty) lock();
        return () => {
            popEntry(tk);
        };
    }, [tk, requestClose]);

    return { dialogRef, requestClose };
}

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        window.removeEventListener("keydown", handleKeyDown);
        stack = [];
        document.body.style.overflow = "";
    });
}
