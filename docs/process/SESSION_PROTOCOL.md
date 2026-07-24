# HAETAE — Session Protocol (MEMORY.md · LOG.md · HANDOFF.md · Git)

**Why this exists:** coding AIs lose context between chats. These three files are the project's brain outside the model. The agent never re-reads the codebase to orient itself, and never re-decides a settled question. You (Ranbir) enforce this protocol; the agent executes it.

---

## 1. MEMORY.md — the map (create after Session 1, not before)

Purpose: orient a fresh session in under a minute. Rewritten (not appended) at session end. Keep under ~60 lines.

```markdown
# MEMORY — HAETAE                      updated: <date> session-<NN>
## Where we are
Phase <N> (<name>) — <one-line status>
## What exists and works
- contracts/src/HaetaeLicense.sol — mint/revoke/expiry done, tests green
- <file> — <state>
## Deployed (GIWA Sepolia, 91342)
- HaetaeLicense: 0x… (verified ✅) | HaetaePolicy: 0x… | DemoVault: 0x…
- Dojang VerifiedAddress schema UID: 0x… | attester: 0x…
## Gotchas a fresh session must know
- <e.g. Blockscout verify needs --compiler-version pinned>
## Do NOT touch
- <files that are done and frozen>
```

## 2. LOG.md — the black box recorder (append-only, newest at top)

Purpose: every session's decisions, bugs, and the rule each bug earned. On demo day, when a judge drills into a detail, you quote your own log.

```markdown
## S07 · 2026-07-26 · Phase 2
FOUND  Dojang attestation query returned empty for PRINCIPAL — wrong schema UID
       (docs list two; playground uses the v2 schema).
FIXED  Pinned schema UID 0x…v2 in IVerifiedAddress impl; added a fork test that
       asserts the attestation exists before mint.
RULE EARNED  Never hardcode an attestation schema from docs without verifying
       against a live playground-issued attestation first.
COMMIT phase2: real Dojang verification wired [session-07]
```

Rules: one entry per session, no editing old entries, every bug gets a RULE EARNED line, every entry names its commit.

## 3. HANDOFF.md — the baton (rewritten every session end)

Purpose: the next session starts here. Blockers at top, then ordered next actions, then the standing rules each session earned. The agent reads this FIRST, always.

```markdown
# HANDOFF — read me first                updated: <date> session-<NN>
## BLOCKERS (fix before anything else)
1. <blocker + what was already tried>
## NEXT ACTIONS (in order — do #1 first)
1. <smallest next concrete step>
2. <then this>
## STANDING RULES (earned — never violate, never re-decide)
- Testnet gas is real: no script sends a tx without explicit human GO this session.
- Schema UID 0x…v2 is THE Verified Address schema. Do not "re-discover" it.
- ERC-721-with-reverting-transfers is settled as the SBT approach. Closed.
```

## 4. Git ritual (boring; it will save you twice)

1. Commit at the end of **every** session, green or not (if red: prefix `wip:` and say why in LOG.md).
2. Format: `phaseN: <what> [session-NN]` · tag phase exits `phase-N-done` · tag releases (`v1.0-haetae`).
3. Never rewrite pushed history. Roll forward, or `git revert` — the log explains either way.
4. `.env` is gitignored from commit zero. Verify with `git check-ignore .env` in Session 1 — then it's a standing rule.

## 5. Session lifecycle (the loop you run every time)

**START** → agent reads HANDOFF.md → MEMORY.md → current phase in PHASES.md → states its plan for THIS session in ≤5 bullets → you approve → work begins.

**DURING** → one concern at a time · tests with every change · any on-chain action gets explicit GO · budget/scope smells stop work and surface a question.

**END** → full gate green (`forge test` + `pnpm -r typecheck` + `pnpm -r test`) → LOG.md entry appended → HANDOFF.md rewritten → MEMORY.md rewritten → commit → you skim the diff of all three docs (60 seconds) before closing the chat.
