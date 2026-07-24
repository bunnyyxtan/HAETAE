---
name: Fork rehearsal keys
description: Anvil/public dev keys are booby-trapped on live testnets; how to pick actors for fork rehearsals
---

Rule: never use well-known dev keys (anvil/hardhat #0-#9) as actors in a fork rehearsal of a live testnet, and never fund them on a live chain.

**Why:** on GIWA Sepolia (observed 2026-07-24), anvil dev address #1 carries an EIP-7702 delegation to a sweeper contract: any inbound call — even the `onERC721Received` probe during an OZ `_safeMint` — executes delegated code that forwards the account's entire balance to a sink and returns empty data, so `checkOnERC721Received` sees a with-code account returning garbage and reverts with `<empty revert data>`. An anvil fork inherits that live state, so the rehearsal broke at the first SBT mint, and anvil's 10000-ETH prefund was swept into the sink inside the simulation. Assume every well-known key is delegated/watched on every public chain.

**How to apply:** rehearsal actors = fresh keccak-derived scalars (`cast keccak "project.session.role"`) — publicly derivable, rehearsal-only, never to be funded live. Fund only the deployer via `cast rpc anvil_setBalance`; let the seed script's gas top-up phase fund the other actors — this mirrors the live topology and exercises the top-up path that prefunded dev accounts would silently skip. Live keys must be freshly generated (`cast wallet new`) by the human; any key that has ever appeared in chat, logs, or argv is burned for live use.

## Scratch-key delivery without transcript exposure (S04, July 2026)
Derive throwaway keys INSIDE CodeExecution (`"use impure"`; import viem by exact `web/node_modules/viem/_esm/index.js` path — the workspace root does not resolve the package) and pass the value programmatically to `setEnvVars` (development scope). The value never appears in chat, args, files, or logs. Verify in shell with `cast wallet address --private-key "$VAR"` (prints only the address). Delete the env var after the test round. `VITE_`-prefixed vars reach `import.meta.env` in the dev server; the managed workflow inherits repl env on restart.
