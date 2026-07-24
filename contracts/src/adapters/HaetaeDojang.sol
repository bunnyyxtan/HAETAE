// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IVerifiedAddress} from "../interfaces/IVerifiedAddress.sol";

/// @title IDojangScrollLike — minimal read surface of GIWA's DojangScroll
/// @notice DojangAttesterId is a user-defined value type over bytes32 in dojang's
///         Types.sol; ABI-compatible with bytes32, so this local interface avoids
///         vendoring dojang sources (a Soldeer consumer; does not compile as a bare
///         submodule — LOG S04). Proxy on GIWA Sepolia:
///         0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9.
interface IDojangScrollLike {
    /// @notice True if `addr` holds a live Verified Address attestation from `attesterId`.
    /// @dev Revocation is handled by Dojang's resolver/indexer — the boolean is the law.
    function isVerified(address addr, bytes32 attesterId) external view returns (bool);
}

/// @title IHaetaeDojang — P3-A interface skeleton for the Dojang/EAS adapter
/// @notice SPEC ONLY (P3-A): implementation, tests, and Slither land in P3-B under
///         the ratified session order. See docs/haetae-dojang-spec.md for the full
///         spec, PATH B determination, and verified chain constants.
/// @dev The implementing contract `HaetaeDojang is IVerifiedAddress` verifies a
///      principal through EITHER of two lanes (PATH B, Amendment 2b pre-ruling):
///
///      Lane 1 — Dojang (canonical, production-only config):
///        scroll.isVerified(subject, dojangAttesterId) with UPBIT_KOREA
///        (0xd99b42e778498aa3c9c1f6a012359130252780511687a35982e8e52735453034
///         = keccak256("dojang.dojangattesterids.upbitkorea")).
///
///      Lane 2 — HAETAE EAS (testnet enablement; disabled when either haetae
///        constructor arg is zero):
///        a subject→uid registry filled via registerAttestation(uid); the adapter
///        binds schema/attester/recipient at registration and re-checks
///        revocation/expiry on every read (one-block revocation law).
///
///      Constructor (all immutable — RULING 1 immutability law):
///        constructor(
///            address scroll,            // DojangScroll proxy; zero reverts
///            bytes32 dojangAttesterId,  // UPBIT_KOREA
///            address eas,               // EAS predeploy 0x42…21
///            bytes32 haetaeSchemaUid,   // 0x0 disables lane 2
///            address haetaeAttester     // 0x0 disables lane 2
///        )
interface IHaetaeDojang is IVerifiedAddress {
    // ---- lane 2 registration ------------------------------------------------

    /// @notice Emitted when a HAETAE attestation uid is bound to its recipient.
    event AttestationRegistered(address indexed subject, bytes32 indexed uid);

    /// @notice registerAttestation called while lane 2 is disabled.
    error LaneDisabled();
    /// @notice EAS holds no attestation under `uid`.
    error AttestationNotFound(bytes32 uid);
    /// @notice Attestation schema does not match haetaeSchemaUid.
    error WrongSchema(bytes32 actual);
    /// @notice Attestation attester does not match haetaeAttester.
    error WrongAttester(address actual);
    /// @notice Attestation recipient is the zero address.
    error ZeroRecipient();
    /// @notice Attestation already revoked or expired at registration time.
    error AttestationDead(bytes32 uid);

    /// @notice Permissionlessly bind a HAETAE attestation uid to its recipient.
    /// @dev Safe to open to anyone: validity is bound to schema+attester+recipient
    ///      here AND liveness is re-checked on every isVerified read.
    /// @param uid The EAS attestation uid to register.
    function registerAttestation(bytes32 uid) external;

    /// @notice The registered HAETAE attestation uid for `subject` (0x0 if none).
    function attestationUidOf(address subject) external view returns (bytes32);

    // ---- immutable config views ---------------------------------------------

    /// @notice DojangScroll proxy this adapter reads (lane 1).
    function scroll() external view returns (IDojangScrollLike);
    /// @notice Dojang attester identifier accepted in lane 1.
    function dojangAttesterId() external view returns (bytes32);
    /// @notice EAS contract read in lane 2 (predeploy on GIWA).
    function eas() external view returns (address);
    /// @notice HAETAE schema uid accepted in lane 2 (0x0 = lane disabled).
    function haetaeSchemaUid() external view returns (bytes32);
    /// @notice HAETAE attester accepted in lane 2 (0x0 = lane disabled).
    function haetaeAttester() external view returns (address);
}
