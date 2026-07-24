# ERC-Agent-License — Draft Standard

**Status:** Draft · Reference implementation: `contracts/src/HaetaeLicense.sol`

---

## Abstract

This standard defines a minimal on-chain interface for **AI agent licenses**: non-transferable
tokens that bind an AI agent address to a KYC-verified human principal, carry an expiry and an
opaque scope tag, and are revocable in a single block. Any protocol, dApp, or enforcement layer
that needs to answer "was this agent allowed, and which human answers for it?" can consume
`IAgentLicense` without knowing the underlying registry implementation.

---

## Motivation

AI agents hold wallets and move money. No existing chain primitive answers two questions at once:

1. **Authority** — was this agent licensed to act at all?
2. **Accountability** — which verified human principal is responsible for it?

ERC-20 and ERC-721 model fungible and non-fungible *assets*; ERC-4337 models *execution*.
None models *delegated agency* — the relationship between a verified human and the autonomous
program acting on their behalf.

Without a shared interface:
- Every dApp re-invents its own agent allowlist, with no cross-protocol composability.
- Enforcement layers (account-abstraction validators, sentinel watchers) have no single read
  surface to query.
- Revocation is ad hoc: one protocol's kill switch does not propagate to another.

This standard proposes that a license is **identity + authority + expiry** — not policy. Spend
caps, target allowlists, and selector filters belong in a separate policy layer that reads the
license as a precondition. Conflating the two collapses composability: a policy change should not
require re-minting an identity primitive.

---

## Specification

### Enum

```solidity
enum Status { None, Active, Revoked }
```

`None` — the agent has never been mapped to a license record.
`Active` — the license exists and has not been explicitly revoked.
`Revoked` — the license has been permanently revoked. This state is terminal and one-way.

### Struct

```solidity
struct License {
    address principal; // human principal who holds the SBT and answers for the agent
    address agent;     // agent address bound by this license
    uint64  expiry;    // unix timestamp after which isLicensed returns false
    bytes32 scope;     // opaque tag; semantics are caller-defined
    Status  status;    // current lifecycle state
}
```

### Events

```solidity
event Licensed(
    uint256 indexed licenseId,
    address indexed principal,
    address indexed agent,
    uint64  expiry,
    bytes32 scope
);

event Revoked(
    uint256 indexed licenseId,
    address indexed agent,
    address indexed revoker
);
```

### Errors

```solidity
error NotLicensed();               // agent has no license record, or the call requires one
error NotAuthorized();             // caller lacks revocation authority
error AlreadyLicensed(address agent); // agent currently holds an active, unexpired license
error AlreadyRevoked();            // license is already in the Revoked state
```

### Functions

```solidity
function isLicensed(address agent) external view returns (bool);
```

Returns `true` if and only if: a license record exists for `agent` **AND** its `status` is
`Active` **AND** `block.timestamp < expiry`. All three conditions must hold simultaneously.
This is the primary enforcement predicate; every gate must call this before accepting an agent's
action.

```solidity
function licenseOf(address agent) external view returns (License memory);
```

Returns the agent's **current** license record. Revoked and expired records remain readable —
history is part of accountability. Reverts `NotLicensed()` only when the agent has **never** had
a license mapped (i.e., `Status.None`). Callers must not use `licenseOf` as an active-check
shorthand; use `isLicensed` for that.

```solidity
function licenseById(uint256 id) external view returns (License memory);
```

Returns the raw license record for a token id. For ids that have **never** been minted,
implementations **MUST** return a zero-value struct (`status == None`) and **MUST NOT** revert.
Superseded records — a revoked license whose agent has since been re-licensed under a new id —
remain readable by id **forever**. `licenseOf` answers "what is this agent's current record?";
`licenseById` answers "what does the permanent record say about verdict N?". Indexers, auditors,
and dispute processes need the second question answered on-chain: every verdict stays on the
record.

```solidity
function revoke(address agent) external;
```

Authorized callers: the license's `principal` **OR** any address holding the implementation's
designated sentinel role. Reverts `NotLicensed()` if no record exists. Reverts `AlreadyRevoked()`
if `status == Revoked`. Reverts `NotAuthorized()` otherwise.

Revocation **MUST** take effect in the same block it is called: `isLicensed` **MUST** return
`false` immediately after the transaction is mined, with no timelock or grace period. This
one-block guarantee is the entire point of the revocation primitive — the next agent action
reverts everywhere.

A revoked license id can **NEVER** return to `Active`. Re-licensing an agent requires a **new
mint** with a **new id**. This one-way constraint is not a choice; it is what makes revocation
trustworthy as an accountability primitive.

---

## Rationale

### Why a license primitive at all?

An allowlist mapping `address → bool` is stateless and composability-blind. A license record
carries the who (principal), the when (expiry), and the what (scope) in a single query, emits
indexed events for off-chain indexers, and is enumerable per principal (the SBT model). Any
protocol in the ecosystem can read the same surface without coordinating with others.

### Why revocation MUST be one-block

A timelock or grace period breaks the accountability story: if an agent can keep acting for
minutes after revocation, the principal is still exposed. The only acceptable semantics is
immediate: `isLicensed` flips in the same block the `revoke` transaction lands. Any enforcement
layer that caches this value for longer than one block is broken and must not be used.

### Why ERC-721-with-reverting-transfers as the SBT model

Soulbound token proposals range from burn-to-transfer to separate identity contracts. ERC-721
with reverting `_update` (for non-zero `from`) is the simplest credible approach: it reuses
audited enumeration and ownership semantics, is queryable via standard tooling, and makes the
non-transferability explicit and hard to accidentally bypass. The principal owns the token; the
agent is bound by it. The SBT cannot be sold or reassigned.

### Why caps and venues are NOT license terms

A license is an identity + authority primitive. Whether the agent may spend 0.1 ETH per
transaction, or call a specific contract, is a *policy* question that changes frequently.
If policy were encoded in the license struct, every parameter tweak would require revoke +
re-mint, breaking continuity of the identity record and the accountability chain. The correct
model: a separate policy layer reads `isLicensed` as a precondition, then applies its own rules.

---

## Security Considerations

### Revocation authority model

Two classes of caller may revoke: the license's own `principal` (self-service) and holders of a
designated sentinel role (delegated authority). The sentinel role MUST be tightly controlled:
it grants the ability to revoke any agent without principal consent, which is a significant
capability. Role assignment should be restricted to the admin (a multisig in production) and
each sentinel key's scope documented on-chain via reason codes.

### Expiry semantics

Expiry is checked against `block.timestamp`. Implementations MUST treat an agent as unlicensed
at the exact timestamp of expiry (`block.timestamp >= expiry` → not licensed), not one block
later. Callers that need a safety margin must set expiry conservatively, not rely on any
implementation grace period.

### Verification gate at mint

Implementations SHOULD gate minting on a verified-identity check (e.g., EAS attestation via
`IVerifiedAddress`). This is not part of the minimal interface because the verification
mechanism is chain-specific. Reference implementations MUST NOT allow permissionless minting
without a verification gate: an unverified principal severs the accountability chain.

### Agent-address squatting at mint

Minting binds an agent address that the caller does not need to control: any verified principal
may license any currently-unlicensed agent address, and re-mint after revocation or expiry
follows the same rule. A hostile verified principal can therefore license an agent address they
do not operate, blocking the true operator via `AlreadyLicensed()` until that license is revoked
or expires. This standard knowingly accepts the vector at this layer, for two reasons: the
squatter is by definition identity-verified, so squatting is attributable rather than anonymous;
and restricting re-mint to a prior principal would not remove the vector (first-mint squatting
remains) while breaking legitimate agent re-assignment. **Agent-consent binding at mint** — for
example, requiring a signature from the agent address over the (principal, expiry, scope) tuple —
is named as a future extension of this standard for deployments where the vector is unacceptable.

### Soulbound guarantees

Implementations MUST revert on any transfer attempt (including approvals, which create a
transfer precondition). Reverting approvals is not optional: an implementation that allows
approvals even if transfers revert is broken, because approved operators can attempt transfers
and produce misleading reverted-but-not-impossible semantics.
