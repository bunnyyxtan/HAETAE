# HAETAE

On-chain AI-agent licensing and enforcement protocol on GIWA Sepolia (chain ID
91342). Every agent is bound to a KYC-verified human principal (Dojang Verified
Address), enforced at the contract layer (HaetaeGate) and the ERC-4337
validation layer (HaetaeValidator + HaetaePaymaster), watched by an autonomous
rule-based Sentinel.

## Project law (read in this order of precedence)

RULES.md > PHASES.md > ARCHITECTURE.md > PRD.md — ARCHITECTURE.md at repo
root, the rest in docs/process/ (S07 sweep), all human-owned.
SESSION_PROTOCOL.md defines the working loop; LOG.md, HANDOFF.md, and
MEMORY.md (all docs/process/) are the project's brain between sessions: read
HANDOFF.md first, always.

## Structure

The HAETAE product tree per ARCHITECTURE.md §4: contracts/ (Foundry), web/,
standard/ — sdk/, indexer/, sentinel/, agents/ return when their build phase
opens (stubs were removed in the S07 sweep; stubs lie about progress).
The Replit workspace scaffolding (artifacts/ and attached_assets/, both
untracked; scripts/; root tsconfigs) is environment plumbing — outside the
HAETAE file budget; do not put product code there.

## User preferences

- Session-based protocol: no work outside the current phase; no on-chain
  action without an explicit human "GO" in that session.
- Stop-and-ask culture (RULES R7): one-line question, options A/B, wait.
- Commit format `phaseN: <what> [session-NN]`; phase exits tagged
  `phase-N-done`; never claim a gate/CI green that did not actually run.
- All Foundry deps pinned to exact tags/commits, recorded in LOG.md.
- Never print, log, or commit private keys; `.env` is gitignored from commit
  zero (PRINCIPAL_PK / AGENT_PK / SENTINEL_PK — role separation is law).
