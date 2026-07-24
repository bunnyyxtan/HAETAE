---
name: HAETAE working protocol
description: Non-derivable working rules for the HAETAE repo — where the law lives and what the user enforces beyond it.
---

The HAETAE project runs on a strict, human-enforced session protocol. The
authoritative rules live IN THE REPO — docs/process/RULES.md >
docs/process/PHASES.md > ARCHITECTURE.md (root) > docs/process/PRD.md, plus
SESSION_PROTOCOL.md; session state in docs/process/: HANDOFF.md (read
first), MEMORY.md, LOG.md. (Process docs moved to docs/process/ in the S07
sweep.) Read those; do not trust chat memory over them.

**Why:** The user treats process violations as failures even when the code
is fine, and designed the repo docs to survive context loss.

**How to apply (the deltas the docs don't spell out):**
- Deviations from an approved plan or GO condition → stop, one-line
  question, options A/B, wait. Do not improvise substitutes.
- "Green" claims are audited: distinguish "local gate green, ci.yml
  correct" from a real Actions run; phase tags push only after remote CI
  is green.
- Session docs are written once, with real content, at session end — never
  as stubs.
- No on-chain action (deploy/tx) without an explicit human GO in-session.

## Toolchain ruling (2026-07-22, user-confirmed)
Standing split: HAETAE product packages (web/, contracts/; the sdk/indexer/sentinel/agents stubs were deleted in the S07 sweep) must stay npm-clean — no `catalog:`/`workspace:` specifiers, plain semver, npm for all use outside Replit; web/'s committed package-lock.json must be pristine-context (see shell-env-quirks). Replit plumbing (root, artifacts/*, scripts/; lib/* deleted S07) stays pnpm.
**Why:** user ordered npm-everywhere; full conversion is impossible here (root preinstall guard deletes package-lock.json and rejects non-pnpm agents, packageManager pin, pnpm-only specifiers in plumbing, managed pnpm workflows). User ruled the scoped split and asked that it never be re-litigated (LOG S01 Addendum 3).
**How to apply:** deps added to product packages use plain versions, never catalog:/workspace:; never convert plumbing to npm; inside the workspace pnpm does the linking even for product packages — the rule binds package contents and external use.

## Commit reshaping (S03)
Replit auto-checkpoints commit to main with generic messages while you work.
Before push: `git reset --soft origin/main`, stage deliberately, ONE law-format
commit (`phaseN: ... [session-NN]`). Origin history is never rewritten — only
unpushed local noise. Check `git log origin/main..HEAD` before shaping.

- Before committing a reshaped session commit, assert the staged manifest
  mechanically: `git diff --cached --name-status | sort` compared against a
  printf-expected list, abort on mismatch. Enforcement for the deliberate-
  staging law (an auto-commit index once leaked lcov.info into a session
  commit via soft-reset restaging).
