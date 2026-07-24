# HANDOFF — read me first · updated 2026-07-24 · S06+S07 DONE — S06 stage 2 OPEN (two human unblocks)

## BLOCKERS (nothing else moves until these are done)

Two human-side unblocks gate S06 stage 2 — the last submission mile:

1. FUND the deployer 0x3Af656d9Ad1307543623133bDB64A39599E08E4B
   (~0.0012 ETH left; needs ~0.01+). Faucet: sepolia-playground.giwa.io.
   Then GO: run contracts/script/Rehearsal.s.sol against GIWA Sepolia
   with a FRESH rehearsal key (openssl rand -hex 32 — the museum guard
   in the script self-enforces cast separation and will revert on any
   principal/sentinel/deployer key or non-rehearsal-scoped agent), and
   log the R1–R5 tx trail into DEMO.md's live-beats block.
2. PUBLISH the app (Replit deploy) → swap the real URL into README's
   "- **Console:**" line and DEMO.md. Until then both honestly say the
   console runs locally in 3 commands (cd web && npm install && npm run
   dev — verified end-to-end in a fresh clone, S07 gate).

## WHERE WE ARE

- S06 submission package SHIPPED: README is the judge's landing
  (verified facts, curl-checked links, 7-contract Blockscout table,
  five-beats tx story); DEMO.md is the 3-minute stage script with the
  ?demo=fixtures&delay=0 contingency; Rehearsal.s.sol carries the beat
  arc R1–R5 idempotently. Heads d5776b9 + c1a40a1, CI green both.
- S07 production repo sweep SHIPPED: judge-clean tree, no history
  rewrite. lib/ and the stub packages (sdk, indexer, sentinel, agents)
  are gone; attached_assets/ untracked; the nine process docs live in
  docs/process/ (this file included); root keeps README, ARCHITECTURE,
  DEMO, LICENSE + build plumbing. Head a84f32a, CI run 30094755619
  green, fresh-clone + stranger-path (npm) gates green, console live
  and fixture walks screenshot-verified.
- RATIFICATION of S06+S07 is with the human. LOG S06/S07 carry the
  entries; acceptance lines pending. Walk for ratification: /console
  Registry → #agents dossiers + Papers → #standard → #ledger; repeat
  with ?demo=fixtures&delay=0.

## HARD-LEARNED PLATFORM LAW (do not re-litigate)

- artifacts/ MUST STAY GIT-TRACKED. Untracking it deregistered all
  previews and deleted their workflows mid-S07; disk presence is not
  enough. Recovery was re-track + toml revalidation. Never gitignore
  artifacts/.
- Law-doc read order, new paths: docs/process/RULES.md >
  docs/process/PHASES.md > ARCHITECTURE.md > docs/process/PRD.md.
  Session brain: this file → docs/process/MEMORY.md →
  docs/process/LOG.md.

## NEXT ACTIONS (in order)

1. Human: the two BLOCKERS above (fund → rehearsal run; publish → URL
   swap). Each produces a small ordered follow-up commit (tx trail into
   DEMO.md; URL lines into README + DEMO.md) — no other surface moves.
2. S06+S07 ratification lines into LOG (human GO required; any veto
   lands as an S08 order item).
3. Nothing else. The repo is submission-shaped; new work only by
   written order.

## DEFERRED, order-gated (do not build without explicit GO)

- web/ regression tests for the revoke ceremony (test infra is its own
  GO'd item; no ad-hoc vitest). (S02)
- Policy robustness suite vs hostile IAgentLicense implementations
  (covers _isLive's defensive catch; coverage exception GRANTED S03).
- Sentinel rate limit / cooldown (Q3-A, S03): ARCHITECTURE §5 hardening
  layer, deliberately absent from SentinelAuthority v1; own ordered item.
- AA components (validator/paymaster): only if the core loop is green
  on testnet with days to spare.
- Human: bunnyyxtan/HAETAE is public; original plan said private. Flip
  or strike.

## STANDING RULINGS

- WalletConnect: REJECTED permanently (S06). Its removal commentary in
  web/src is ruling documentation — do not "clean it up".
- Museum cast (anvil/public dev keys): untouchable on live networks —
  EIP-7702 sweeper delegations exist. Fresh keccak-derived keys only.
- Ticker honesty: "~1s blocks" label scope settled in S06; the landing
  "one block, one second" copy is a frozen marketing surface.
- Frozen surfaces: contracts/, standard/, deployments/; web/ visual
  copy. web/package.json was touched ONCE by S07 gate-force (wagmi's
  react-query peer, previously a hoisting phantom) — logged, closed.

## NUMBERING ALIAS (recurring)

The human's order headers run one behind the LOG: "SESSION 05 ORDER" =
LOG S06, "SESSION 06 — PRODUCTION REPO SWEEP" = LOG S07. Keep logging
under LOG numbering and note the alias per entry.
