---
name: CI local mirror parity
description: How to mirror the GitHub Actions gate locally without false greens (stale composite-lib outputs).
---

# CI local mirror parity

The rule: before claiming a local CI mirror is green, purge
`lib/*/dist` AND `lib/*/*.tsbuildinfo`, then run the root canonical
`pnpm run typecheck` (which does `tsc --build` for composite libs first) —
not bare `pnpm -r typecheck`.

**Why:** Session 01's first Actions run was RED (TS6305 in
artifacts/api-server) while the local mirror had been green. Two stacked
traps:
- Bare `pnpm -r typecheck` never builds composite lib declarations; it only
  passed locally because a stale `lib/*/dist` existed. A fresh CI checkout
  has no dist.
- Deleting `dist` alone is not enough to reproduce CI: `tsc --build` trusts
  `.tsbuildinfo` and silently skips re-emit ("up to date") even when the
  outputs are gone. A clean checkout has neither dist nor tsbuildinfo.

**How to apply:** Any time a gate must be declared "CI-equivalent locally",
start from the purged state above. If CI and local disagree on typecheck,
suspect stale build state before suspecting the code.
