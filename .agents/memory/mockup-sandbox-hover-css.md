---
name: Mockup sandbox hover CSS
description: Tailwind hover/transform variant utilities silently fail in the mockup sandbox; use component-injected CSS
---

# Mockup sandbox: interactive states need component-injected CSS

Rule: in the mockup sandbox, do not rely on Tailwind variant utilities for interactive
states (`hover:*`, `group-hover:*`, especially transforms). Define interactive states in
the component's injected `<style>` block with plain classes scoped under the component
root, and keep a state's declarations (e.g. tint + transform) in ONE block on ONE element
— cross-element hover rules have also proven unreliable there.

**Why:** Browser-measured verification showed hover-variant classes present in the DOM
with the rule never applied (computed transform stayed none while `:hover` was active).
Static utilities (color, spacing, grid) work fine. The same-element, same-block injected
CSS pattern verified working repeatedly.

**How to apply:** Any mockup component with hover/active/copied/pressed states. Verify
interactions with the browser-driving testing subagent, not screenshots — screenshots
cannot hover.
