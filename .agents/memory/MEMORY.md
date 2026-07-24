# Agent memory index

- [HAETAE working protocol](haetae-working-protocol.md) — GO-gated: repo docs law, HANDOFF first, unrun gates never green, A/B deviations, reshape auto-commits; single author bunnyyxtan; rewrite ban (reboot spent).
- [Foundry submodule pin drift](foundry-pin-drift.md) — this env's forge stages gitlinks at clone HEAD, not the tag; builds can silently reset pins; always peeled-SHA audit + stage gitlinks.
- [Foundry testing quirks](foundry-testing-quirks.md) — prank eaten by call args; coverage excludes invariant campaigns; snapshot at defaults; mutable-cap invariants need per-instant admission + ledger parity.
- [Fork rehearsal keys](fork-rehearsal-keys.md) — anvil/public dev keys carry EIP-7702 sweeper delegations on live testnets; rehearse forks with fresh keccak-derived keys + anvil_setBalance.
- [Mockup sandbox hover CSS](mockup-sandbox-hover-css.md) — Tailwind hover/transform variants silently fail there; put interactive states in component-injected CSS, same element + block.
- [Shell/env quirks](shell-env-quirks.md) — pkill -f self-match (kill by port); cd-failure falls through (guard before rm -rf); /tmp not durable across calls; npm locks made under pnpm are poisoned (13-pkg tell); pipefail.
- [Replit artifact registry](replit-artifact-registry.md) — untracking artifacts/ deregisters previews + deletes workflows; disk presence isn't enough; re-track + toml revalidation recovers.
- [GitHub push auth](github-push-auth.md) — git endpoints need basic-scheme extraheader b64(x-access-token:PAT); bearer passes /user but fails push; disable credential helper via GIT_CONFIG env.
- [CI local mirror parity](ci-local-mirror.md) — purge lib/*/dist AND tsbuildinfo before mirroring CI; tsc --build trusts stale tsbuildinfo; the gate is root `pnpm run typecheck`, never bare `pnpm -r typecheck`.
- [Evidence capture](replit-evidence-capture.md) — Screenshot omits empty browser logs (presence-proven); tester-vs-code disputes: dev state globals + fixture ground-truth + zero-coordinate protocols; vite-preview swap for prod evidence.
- [AnimatePresence unkeyed modals](animatepresence-unkeyed-modals.md) — conditional modals in AnimatePresence need identity keys; exiting instances resurrect frozen props on quick reopen.
- [Public RPC consistency](public-rpc-consistency.md) — declare multicall3 in defineChain or viem silently degrades; browsers log every non-2xx; clamp terminal state against lagging replicas.
