---
name: Foundry testing quirks (this env)
description: vm.prank argument-evaluation trap; coverage vs invariant-campaign timeouts; snapshot conventions.
---

## vm.prank is consumed by argument evaluation
`vm.prank(X); target.f(other.g())` — `other.g()` is itself an external
call, so it EATS the prank; `f` then runs unpranked. Symptom: auth checks
pass/fail mysteriously in tests.
**Why:** cost a debugging round in the license-registry suite
(`lic.grantRole(lic.SENTINEL_ROLE(), s)` — the getter consumed the prank).
**How to apply:** evaluate external-call arguments into locals BEFORE
`vm.prank`, then make the pranked call with plain locals. Same trap for
`vm.expectRevert` ordering: keep the very next external call the target.

## forge coverage vs stateful invariant campaigns
`forge coverage` over a suite containing invariant tests (256 runs × deep
call sequences) exceeds the 5-minute shell ceiling here.
**How to apply:** measure coverage on the unit contract only
(`forge coverage --match-contract <UnitTestContract> --report summary`)
and let invariants run in the plain `forge test` gate. State the
measurement scope wherever the % is reported.

## forge fmt normalizes blank lines between contract members
`forge fmt` re-inserts a blank line between state variables and functions
and between adjacent functions; deleting those blanks to fit a LOC budget
fails the fmt gate and silently re-inflates the count.
**How to apply:** count LOC budgets on fmt-normalized code — run
`forge fmt` before `wc -l`. Reclaim budget by inlining single-use locals
or tightening real code, never by whitespace games.

## Snapshot convention
Commit `.gas-snapshot` from a plain `forge snapshot` (default 256 fuzz
runs). Overriding FOUNDRY_FUZZ_RUNS for speed changes the file's `runs:`
metadata and invites parity questions later.

## Invariants vs mutable caps (S03)
A "spent <= cap" stateful invariant is unfalsifiable-as-stated when caps can be
lowered mid-window: legal lowering makes it fail without a bug. Restate as
(a) per-instant admission (amount <= remaining computed before the call, ghost
flag on violation) plus (b) ledger parity (per-day buckets == independent ghost
ledger). Together they imply the cap bound whenever the cap is unchanged.
Also: in-handler asserts DO bite under fail_on_revert=false — forge-std v1.9.x
asserts route through vm.assert* cheatcodes, recording global failure even when
the handler's revert is swallowed. Assert ruled conditions at action time in
the handler (e.g. no-inheritance right after a cross-principal re-mint).
