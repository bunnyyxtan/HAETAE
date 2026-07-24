---
name: AnimatePresence unkeyed modals
description: Conditional modals inside framer-motion AnimatePresence must carry identity keys, or quick close-then-reopen shows stale content.
---

# AnimatePresence unkeyed modals resurrect frozen props

The rule: any conditionally rendered modal/overlay inside `<AnimatePresence>`
whose content varies by entity (agent, row, record) MUST have a `key` tied to
that entity's identity (`key={entity.id}`).

**Why:** AnimatePresence keeps an exiting child mounted with FROZEN props for
the exit animation. Without a key, a new open during the exit window (~300ms)
is diffed as the same child and the exiting instance is recycled — the dialog
shows the OLD entity while state holds the new one. Proven live in session 01:
row A's Revoke button produced row B's dialog; state said A, screen said B.
Symptom set: wrong-entity modal content, stale dev globals from a component
that "was never opened", focus resting on the previous opener.

**How to apply:** When adding any modal under AnimatePresence, key it by the
entity it renders. When debugging "wrong content in modal" reports, first ask
whether a prior modal could still have been exiting when the new one opened
(test harness warm-up probes and retry loops hit this window consistently, so
"impossible" manual repros are still real bugs).
