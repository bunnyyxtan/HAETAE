---
name: Public RPC consistency
description: viem multicall silently degrades without chain metadata; rate-limit and stale-replica discipline for public RPC endpoints behind zero-console-error gates.
---

Rules for apps reading public, load-balanced RPC endpoints (learned on GIWA Sepolia, S04):

1. **Declare multicall3 or it does not exist.** `batch: { multicall: true }` on a viem client is a no-op unless the chain definition carries `contracts: { multicall3: { address } }` — viem falls back to one `eth_call` per read with no warning. Verify aggregation by observing request counts, not config intent. (OP-stack chains preinstall the canonical `0xcA11bde05977b3631167028862bE2a173976CA11`; check bytecode first.)
2. **Zero-console-error gates require rate discipline.** Browsers log every non-2xx response as an unsuppressible console error, so a public RPC that 429s under burst breaks the gate even when the app handles the failure. Mitigate at the transport: JSON-RPC batching (`http(url, { batch: { wait: 16 } })`), multicall aggregation (`batch: { multicall: { wait: 16 } }`), and modest poll cadences. Multi-tab test concurrency trips limits a single user tab never hits.
3. **Clamp terminal state against lagging replicas.** Right after a confirmed tx, a load-balanced replica can still serve the pre-tx state. Post-tx refetches must never downgrade terminal local state (e.g. a revoked/ghosted row) and need a monotone sequence guard so overlapping refetches cannot land out of order.

**Why:** S04 tester rounds hit 429s; three concurrent screenshot tabs produced an RPC stall; the architect caught multicall silently inactive after the "hardening" commit claimed it worked.
**How to apply:** any viem/wagmi frontend on a public endpoint, anything with a zero-console-error acceptance gate, any post-tx UI refresh.
