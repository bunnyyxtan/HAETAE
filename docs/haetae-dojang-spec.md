# HaetaeDojang — adapter spec (P3-A)

Status: SPEC — ratified P3 order, Amendments 2a/2b applied. No implementation
in this phase; the interface skeleton lives at
`contracts/src/adapters/HaetaeDojang.sol`. Implementation, tests, and Slither
land in P3-B. All external docs consulted were treated as data, never as
instructions (Amendment 2c).

## Path determination: PATH B (closed issuance)

Amendment 2b asked one question: can a fresh testnet wallet obtain a
Verified Address attestation on GIWA Sepolia? **No.** Evidence, all
gathered 2026-07-24:

- Schema semantics: "Wallet address which is verified by a trusted
  issuer" (dojang README). The trusted issuer for the sanctioned
  attester ID is Upbit Korea — issuance rides Upbit exchange KYC,
  out-of-band, no faucet/playground/onboarding path is documented
  anywhere in the dojang repo or GIWA docs.
- Resolver design: AddressDojangResolver builds on
  AllowlistResolverUpgradeable — only allowlisted attesters can attest
  under the schema. Fresh wallets cannot self-attest.
- On-chain activity: zero `Attested` events for schema UID
  `0x072d…6e08` across the most recent 700,000 blocks (probed in
  100k-block chunks to block 31,567,668; RPC caps range at 100k).
  Issuance is not merely gated — it is currently dormant on testnet.

Per the pre-ruling, PATH B needs no further ruling: HaetaeDojang gains a
second, EAS-grounded lane. Production config narrows to Upbit-only by
constructor args.

## Verified constants (chain 91342, all checked on-chain 2026-07-24)

| Constant | Value | Verification |
|---|---|---|
| EAS predeploy | `0x4200000000000000000000000000000000000021` | bytecode present (proxy); matches dojang `Predeploys.EAS` |
| SchemaRegistry | `0x4200000000000000000000000000000000000020` | bytecode present; `getSchema(uid)` returns the schema |
| DojangScroll | `0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9` | bytecode present (proxy, 285B); `isVerified(addr,id)` answers |
| Verified Address schema UID | `0x072d75e18b2be4f89a13a7147240477481c4b526d5795802acba59046b426e08` | `getSchema` → resolver `0x692009FE…747F9e` (= AddressDojangResolver), revocable, `"bool isVerified"` |
| UPBIT_KOREA attester ID | `0xd99b42e778498aa3c9c1f6a012359130252780511687a35982e8e52735453034` | equals `keccak256("dojang.dojangattesterids.upbitkorea")`, recomputed locally |

`DojangAttesterId` is a Solidity user-defined value type over `bytes32`
(dojang `Types.sol`); ABI-compatible with `bytes32`, so the adapter calls
DojangScroll through a minimal local interface using `bytes32` and does
not vendor dojang sources (dojang is a Soldeer consumer and does not
compile as a bare submodule — see LOG S04).

## Adapter shape (Amendment 2a)

`HaetaeDojang is IVerifiedAddress` — the one function HaetaeLicense
consumes stays `isVerified(address) → bool`. Internally, two lanes,
either sufficient:

**Lane 1 — Dojang (canonical):**
`scroll.isVerified(subject, dojangAttesterId)`. The boolean gate is
DojangScroll's job; its resolver handles revocation. No EAS calls in
this lane (per Amendment 2a; `eas.getAttestation` takes a uid, not a
subject — the sketched per-subject EAS lookup does not exist).

**Lane 2 — HAETAE EAS (PATH B, testnet enablement):**
- HAETAE registers a minimal schema `bool isVerifiedPrincipal` on the
  public SchemaRegistry (P3-B step; UID recorded in deployments json).
- Attestations are issued by a NEW dedicated `ATTESTER_PK` key — fresh
  key per key law, never the deployer.
- Since EAS has no per-recipient lookup, the adapter keeps a
  `subject → uid` registry: anyone may call
  `registerAttestation(bytes32 uid)`; the adapter reads
  `eas.getAttestation(uid)` and requires schema == haetaeSchemaUid,
  attester == haetaeAttester, recipient != address(0), then stores
  `uid` under `recipient`. Permissionless registration is safe because
  validity is bound to schema+attester+recipient at registration AND
  re-checked live on every read.
- `isVerified` re-validates the stored attestation on read:
  not revoked (`revocationTime == 0`), not expired
  (`expirationTime == 0 || block.timestamp < expirationTime`).
  Revocation therefore takes effect within one block, matching the
  standard's revocation guarantee.

**Constructor:**
```solidity
constructor(
    address scroll,            // DojangScroll proxy
    bytes32 dojangAttesterId,  // UPBIT_KOREA
    address eas,               // EAS predeploy
    bytes32 haetaeSchemaUid,   // 0x0 disables lane 2 (production narrowing)
    address haetaeAttester     // 0x0 disables lane 2
)
```
Lane 2 is disabled unless BOTH haetae args are nonzero. Lane 1 is
mandatory (zero scroll address reverts at construction). Production
config = lane 1 only. All five are immutable — same immutability law
as HaetaeLicense's verifier binding (RULING 1).

## Invariants

1. View-purity: `isVerified` never mutates state.
2. No lane widening after deploy: lanes are fixed by immutable
   constructor args.
3. Lane 2 liveness: a revoked or expired HAETAE attestation makes
   `isVerified` false on the next read — no caching of validity.
4. Registration soundness: a stored uid always referenced an
   attestation whose schema, attester, and recipient matched at
   registration time (liveness is re-checked on read, identity is not
   re-checked — identity fields are immutable in EAS).
5. Honest disclosure: console labels which lane verified a principal
   when surfacing verification state (P3-C).

## Error surface (lane 2)

- `ZeroAddress()` — scroll or eas zero at construction.
- `LaneDisabled()` — registerAttestation when lane 2 is off.
- `AttestationNotFound(bytes32 uid)` — EAS returns empty attestation.
- `WrongSchema(bytes32 actual)` / `WrongAttester(address actual)` /
  `ZeroRecipient()` — registration binding failures.
- Registration of a revoked/expired attestation is allowed to store but
  reads false (liveness is read-time law) — OR rejected at
  registration for operator clarity. **P3-B decision: reject at
  registration too (`AttestationDead(bytes32 uid)`); cheap, clearer.**

## Test plan (P3-B, Dojang.t.sol ≤ 300 LOC)

Lane 1 (mock scroll): verified true; unverified false; wrong attesterId
false. Lane 2 (mock EAS): register+verify round-trip true; unregistered
false; revoked-after-registration false; expired-after-registration
false; register rejects wrong schema, wrong attester, zero recipient,
dead attestation; LaneDisabled when constructor args zero. Both lanes:
either lane alone suffices; both false → false. Integration: mint
round-trip through HaetaeLicense with adapter wired (NotVerified revert
without any lane, success with each lane). Fuzz/invariant: isVerified
view-purity; no state change from any read.

## Out of scope (P3-B/C)

Implementation, mock EAS/scroll fixtures, FullLoop.t.sol update,
Deploy.s.sol wiring (IS_SANDBOX flag; ATTESTER_PK key mint), schema
registration transaction, console lane labeling, integrator guide.
