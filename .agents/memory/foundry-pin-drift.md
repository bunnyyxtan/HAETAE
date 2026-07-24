---
name: Foundry submodule pin drift
description: This environment's forge silently breaks exact submodule pins; how to detect and lock them.
---

The nix-provided forge here (reports "1.1.0-dev") has two hazards when
installing pinned git-submodule dependencies:

1. `forge install org/repo@vX.Y.Z` checks out the tag in the worktree but
   stages the gitlink at the CLONE-TIME DEFAULT-BRANCH HEAD.
2. A later `forge build` may print "Updating dependencies" and reset
   submodule worktrees to those wrongly staged SHAs — silently replacing
   exact tag pins with master tips. `--no-commit` no longer exists as a
   flag in forge 1.x (parse error).

**Why:** Cost >2 rounds to catch; the "Installed X vY.Z" banner and a
passing build both looked like success while three of four pins had
drifted. The project's rules require exact, auditable pins.

**How to apply:** After ANY forge command that touches dependencies:
- Audit each submodule: `git ls-remote --tags <repo> "<tag>^{}"` (fall back
  to the plain tag ref) vs `git -C lib/<dep> rev-parse HEAD`.
- On drift: `git -C lib/<dep> checkout -f <peeled-sha> && git clean -fdx`
  (stray untracked files from the shuffling otherwise block checkout),
  then `git add` the gitlink immediately — committed gitlinks make
  `git submodule update` self-healing instead of self-breaking.
- Re-run `forge build` afterward as a drift trigger and re-audit once.
- Note: `git describe` in a submodule can name an older annotated tag
  (e.g. OZ v5.6.1 shows "v4.8.0-1122-g…"); compare SHAs, not describe.
- Offline fallback when `git ls-remote` to github times out (happens on
  this network): a pin is proven clean if the submodule worktree HEAD
  equals the COMMITTED gitlink (`git ls-tree HEAD contracts/lib/` — note
  the trailing slash; without it you get the parent tree, not the 160000
  gitlink rows) AND that gitlink was peeled-SHA-audited in an earlier
  session. package.json inside the submodule corroborates the version.
