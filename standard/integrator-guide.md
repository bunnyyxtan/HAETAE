# Integrating HaetaeGate — a guide for vault and executor developers

You run a contract that moves funds on behalf of AI agents — a vault, an
executor, a strategy router. This guide shows how to put every one of those
moves behind a HAETAE checkpoint with **one external call**. It assumes you
have never seen this repository.

## The one call

```solidity
interface IHaetaeGate {
    /// Reverts with a verdict error if the trade must not happen.
    /// Returns (and RECORDS THE SPEND) if it may.
    function check(address agent, address venue, address token, uint256 amount) external;
}
```

- `agent` — the licensed AI agent attempting the action. In the reference
  integration this is `msg.sender`: the transaction signature is the agent's
  signing act.
- `venue` — the destination the funds would go to.
- `token` / `amount` — what would move.

`check` is **not a view**. A passing call records `amount` against the
agent's daily cap in the same call frame as the verdicts — verdict and
accounting are atomic, so nothing can interleave between "you may" and
"it counted" (no TOCTOU gap). Two consequences for you:

1. **Never call `check` speculatively.** A passing check consumes cap even
   if you then decide not to trade. Call it exactly once, immediately
   before the transfer, and let a transfer failure revert the whole
   transaction so a recorded spend cannot exist without its trade.
2. **Your contract must be allowlisted.** Because checks consume cap,
   permissionless checking would be a griefing vector. The gate admin
   allowlists your contract once via `setCaller(yourContract, true)`;
   until then every call reverts `NotAuthorizedCaller`.

## The verdicts

`check` either returns, or reverts with one of five custom errors, ordered:

| # | Error | Meaning | What you should do |
|---|-------|---------|--------------------|
| 0 | `NotAuthorizedCaller()` | Your contract is not on the gate's caller allowlist. | Configuration error — contact the gate admin. Never retry in a loop. |
| 1 | `NotLicensed()` | The agent has no license, or its license is Revoked/Suspended. Never-licensed and revoked share this verdict deliberately. | Refuse the action. A revoked agent stays revoked; do not retry. |
| 2 | `LicenseExpired()` | License exists and is Active but `block.timestamp >= expiry`. | Refuse. The principal must re-mint; expiry is not extendable. |
| 3 | `VenueNotAllowed()` | The agent's policy does not allow this venue. Also fires for stamp-mismatched (re-minted) agents whose old policy records are dead-on-read. | Refuse. Venue allowances are the principal's live policy. |
| 4 | `CapExceeded()` | `amount` exceeds the agent's remaining daily budget for `token` (UTC day). An unconfigured token has zero allowance, so unknown tokens die here. | Refuse now; the same call may pass after the UTC rollover or a cap raise. |

On success the gate emits `CheckPassed(agent, venue, token, amount, caller)`
— your audit trail, on-chain, for free.

Treat the verdict list as **closed**: any revert from `check` means NO. If
you cannot decode the selector, still refuse — never fail open.

## The CEI wrapping pattern

Wrap the check and the effect so they succeed or fail together
(checks-effects-interactions):

```solidity
function execute(address venue, address token, uint256 amount) external {
    // CHECK — one call, immediately before the move. Reverts on any verdict.
    gate.check(msg.sender, venue, token, amount);

    // EFFECTS + INTERACTIONS — if this transfer reverts, the recorded
    // spend above unwinds with it: no spend without a trade.
    IERC20(token).safeTransfer(venue, amount);
    emit TradeExecuted(msg.sender, venue, token, amount);
}
```

That is the minimum correct integration. Two hard rules it encodes:

- **No code between check and transfer.** Anything you insert there runs
  with the spend already recorded; keep the window empty.
- **Fail closed.** If you catch the gate's revert (see below), the ONLY
  branch that moves funds is the one where `check` returned.

### Variant: surfacing refusals as events

`ReferenceVault` (the worked example, deployed and verified — addresses
below) chooses to *log* refusals instead of reverting, because on GIWA the
refusal itself is the product — a public court record. It try/catches the
gate and emits the verdict selector:

```solidity
function execute(address venue, address token, uint256 amount) external {
    try gate.check(msg.sender, venue, token, amount) {
        IERC20(token).safeTransfer(venue, amount);
        emit TradeExecuted(msg.sender, venue, token, amount);
    } catch (bytes memory reason) {
        bytes4 selector; // first 4 bytes of the revert payload = the verdict
        if (reason.length >= 4) {
            assembly ("memory-safe") { selector := mload(add(reason, 0x20)) }
        }
        emit TradeRefused(msg.sender, venue, token, amount, selector);
    }
}
```

Both shapes are correct. Revert if your callers need atomic composability;
log if refusals are data you want on the record. In both, funds move only
on the `check`-passed path.

### What ReferenceVault deliberately does NOT do

It holds no allowlists of its own — unknown venues die at
`VenueNotAllowed`, unknown tokens at `CapExceeded` (no cap configured means
zero allowance). Your production vault will add ownership, withdrawal, and
strategy logic; none of that changes the gate contract between you and the
checkpoint.

## Worked example — live on GIWA Sepolia

Chain id 91342 · RPC `https://sepolia-rpc.giwa.io` · explorer
`https://sepolia-explorer.giwa.io`. All contracts Blockscout-verified:

| Contract | Address |
|----------|---------|
| `HaetaeGate` (call this) | `0x82345FC04BDaa853A11115C557B1c54dF9dc48EF` |
| `ReferenceVault` (the worked example) | `0xb419F747AF35490F6c8e26aA2A07B1AbEc126879` |
| `HaetaeLicense` (verdicts 1–2 read this) | `0x7409E7Dc675f13957343340D2a6935fACA0773f8` |
| `HaetaePolicy` (verdicts 3–4 + spend records) | `0xF8f909C5Dc9D0e80D5E1b0332450fAF3D79D9C7d` |
| `TestUSDC` (6-decimals test token, `tUSDC`) | `0x3f9EC3DBFEca9ddc6c41A7f8924C39665EBfCE12` |

Watch a full arc through this exact gate — one legal trade, a cap refusal,
a venue refusal, a revocation, and a post-revocation ghost refusal — in the
rehearsal transactions recorded in `deployments/giwa-sepolia.json` and the
README beat table.

## Integration checklist

1. Point your contract at the gate address (immutable constructor arg is
   the reference pattern).
2. Ask the gate admin to `setCaller(yourContract, true)`; verify with
   `authorizedCallers(yourContract)`.
3. Call `check(agent, venue, token, amount)` exactly once per action,
   immediately before the funds move, with nothing in between.
4. Fail closed on every revert; move funds only when `check` returns.
5. Do not cache verdicts. Licenses revoke in one block; policy is live.
   Every action gets its own check.
