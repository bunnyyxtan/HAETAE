---
name: Shell/env quirks in this workspace
description: pkill self-match kills your own ShellExec; npm/yarn registry fetches can wedge — use the pnpm store for scratch installs.
---

# Shell and environment quirks

## pkill/pgrep -f match your own ShellExec command line
The whole ShellExec command string becomes the bash process's cmdline. Any
`pkill -f PATTERN` — or `kill $(pgrep -f PATTERN)` — whose pattern matches
ANY substring of that command kills your own shell mid-run (exit code -1,
chain truncated). This includes file paths referenced elsewhere in the same
command (`cat > /tmp/consink.mjs`, `node /tmp/consink.mjs`): bracket-escaping
the pkill argument (`consink[.]mjs`) protected against the argument itself
but NOT against those plain occurrences. Bit twice in the CRA-port session
and twice more in the closeout sweep.

**Why:** -f scans full cmdlines; the invoking bash's cmdline contains every
literal in your command, not just the pkill argument.

**How to apply:** kill listeners by port, never by cmdline pattern:
`fuser -k 19997/tcp` matches the socket owner only and cannot self-match.
If there is no port, capture the PID at spawn (`node x.mjs & echo $!`) and
kill that PID. Bracket-escaping is safe only when the plain text appears
nowhere else in the same command — treat it as a last resort.

## npm/yarn registry fetches can wedge for tens of minutes
A plain `npm install` of a large tree (CRA-sized) in /tmp sat 30+ minutes
with zero files written; yarn fetch was similarly throttled. The pnpm store,
by contrast, links instantly for anything already in the workspace.

**Why:** outbound registry bandwidth appears throttled/flaky in this env;
pnpm's content-addressed store avoids refetching.

**How to apply:** for scratch/verification installs, write a minimal
package.json and use `pnpm install --prefer-offline` (seconds when deps
overlap the workspace). Do not wait on npm/yarn for big cold trees; treat a
silent, zero-progress npm after ~5 min as wedged.

## Piping a gate through tail/grep masks its exit code
`forge build 2>&1 | tail -3 && forge test` gates the chain on tail's exit
(always 0), not the build's. A stack-too-deep compiler ERROR scrolled past as
three context lines and the chain continued; `forge test` then passed anyway
(test compilation can succeed where `forge build` fails), so a red gate
looked green end to end. Caught only by re-checking with `${PIPESTATUS[0]}`.

**Why:** a pipeline's exit status is its last command's; `&&` sees only that.

**How to apply:** `set -o pipefail` at the top of any ShellExec that gates on
piped commands, or assert `${PIPESTATUS[0]}` explicitly. Never report a gate
green from a piped run without one of the two.

## Verifying a ported/rebuilt frontend without registering an artifact
Static-build the app with `vite build --base ./`, copy dist into
`artifacts/mockup-sandbox/public/<slot>/`, and screenshot via the sandbox
artifact at `/<slot>/index.html` (vite serves public/ from disk, no restart).
Identical capture pipeline for before/after makes RMSE comparable; entrance
animations add phase noise — compare stable regions and check whether CSS
bundles hash-identical (strongest fidelity signal). Remove the mounts after.

## Locale-sensitive sort in manifest asserts (S04)
Pipe `git diff --cached --name-only` through `LC_ALL=C sort` before comparing to a fixed list: UTF-8 collation interleaves `dir.css` vs `dir/file` differently than C order and breaks heredoc diffs.

## cd failure falls through to the next command (destructive-op guard)
`set -uo pipefail` does NOT stop a script when `cd` fails; subsequent
commands run in the PREVIOUS cwd (ShellExec starts in the workspace root).
A `cd /tmp/x` whose target had vanished let `rm -rf node_modules` execute
in the workspace root. Related: /tmp contents are NOT durable between
ShellExec calls — any call may start from a wiped /tmp.

**How to apply:** `cd X || exit 1` (or `set -e`) before any destructive
command; prefer absolute paths in `rm -rf`; create and consume /tmp
fixtures within a single ShellExec call.

## npm lockfiles generated inside the pnpm workspace are poisoned
Any npm lock write (`npm install`, even `--package-lock-only`) run in a
package whose node_modules is a pnpm symlink farm encodes `"link": true`
entries. Installing from such a lock in a clean clone "adds 13 packages"
in ~1s, creates zero .bin shims, and the build dies (`vite: command not
found`). The added-13-in-1s signature IS the tell — and the lock, not the
environment, carries the poison to every consumer.

**How to apply:** generate npm locks only in a pristine context (fresh
clone; `rm package-lock.json node_modules` first); gate with
`grep -c '"link": true' package-lock.json` == 0 before committing.
