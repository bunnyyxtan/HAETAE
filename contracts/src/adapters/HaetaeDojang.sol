// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IVerifiedAddress} from "../interfaces/IVerifiedAddress.sol";
import {IEAS} from "eas-contracts/IEAS.sol";
import {Attestation} from "eas-contracts/Common.sol";

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

/// @title IHaetaeDojang — Dojang/EAS adapter interface (PATH B, dual lane)
/// @notice See docs/haetae-dojang-spec.md for the ratified spec, PATH B
///         determination, and verified chain constants.
/// @dev The adapter verifies a principal through EITHER of two lanes:
///
///      Lane 1 — Dojang (canonical, production-only config):
///        scroll.isVerified(subject, dojangAttesterId) with UPBIT_KOREA
///        (0xd99b42e778498aa3c9c1f6a012359130252780511687a35982e8e52735453034
///         = keccak256("dojang.dojangattesterids.upbitkorea")).
///
///      Lane 2 — HAETAE EAS (testnet enablement; disabled when either haetae
///        constructor arg is zero): a subject→uid registry filled via
///        registerAttestation(uid); the adapter binds schema/attester/recipient
///        at registration and re-checks revocation/expiry on every read
///        (one-block revocation law).
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
    ///      here AND liveness is re-checked on every isVerified read. Re-registering
    ///      a recipient overwrites the stored uid (the new one must itself be valid).
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

/// @title HaetaeDojang — the sanctioned IVerifiedAddress implementation
/// @notice Dual-lane verifier per the ratified P3 spec: Dojang (Upbit KYC lane)
///         OR a HAETAE-issued EAS attestation. Production deployments disable
///         lane 2 by passing zero haetae args, narrowing to Upbit-only.
///         All five bindings are immutable — no owner, no setters, no lane
///         widening after deploy (RULING 1 immutability law). Every lane error
///         fails CLOSED: isVerified never reverts and never returns true on a
///         misbehaving dependency.
contract HaetaeDojang is IHaetaeDojang {
    // -------------------------------------------------------------------------
    // Immutable config
    // -------------------------------------------------------------------------

    /// @inheritdoc IHaetaeDojang
    IDojangScrollLike public immutable scroll;
    /// @inheritdoc IHaetaeDojang
    bytes32 public immutable dojangAttesterId;
    /// @inheritdoc IHaetaeDojang
    address public immutable eas;
    /// @inheritdoc IHaetaeDojang
    bytes32 public immutable haetaeSchemaUid;
    /// @inheritdoc IHaetaeDojang
    address public immutable haetaeAttester;

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    /// @dev Lane-2 registry: subject → registered HAETAE attestation uid.
    mapping(address => bytes32) private _uids;

    // -------------------------------------------------------------------------
    // Construction-only errors
    // -------------------------------------------------------------------------

    /// @notice scroll or eas is the zero address at construction.
    error ZeroAddress();

    /// @notice Deploy with all five bindings fixed forever.
    /// @param scroll_           DojangScroll proxy; zero reverts (lane 1 is mandatory).
    /// @param dojangAttesterId_ Dojang attester id accepted in lane 1 (UPBIT_KOREA).
    /// @param eas_              EAS contract; zero reverts (predeploy always exists).
    /// @param haetaeSchemaUid_  HAETAE schema uid; 0x0 disables lane 2.
    /// @param haetaeAttester_   HAETAE attester; 0x0 disables lane 2.
    constructor(
        IDojangScrollLike scroll_,
        bytes32 dojangAttesterId_,
        address eas_,
        bytes32 haetaeSchemaUid_,
        address haetaeAttester_
    ) {
        if (address(scroll_) == address(0) || eas_ == address(0)) revert ZeroAddress();
        scroll = scroll_;
        dojangAttesterId = dojangAttesterId_;
        eas = eas_;
        haetaeSchemaUid = haetaeSchemaUid_;
        haetaeAttester = haetaeAttester_;
    }

    // -------------------------------------------------------------------------
    // IVerifiedAddress
    // -------------------------------------------------------------------------

    /// @inheritdoc IVerifiedAddress
    /// @dev OR of the two lanes; each lane fails closed on any dependency error.
    function isVerified(address subject) external view returns (bool) {
        return _dojangLane(subject) || _haetaeLane(subject);
    }

    // -------------------------------------------------------------------------
    // Lane 2 registration
    // -------------------------------------------------------------------------

    /// @inheritdoc IHaetaeDojang
    function registerAttestation(bytes32 uid) external {
        if (haetaeSchemaUid == bytes32(0) || haetaeAttester == address(0)) revert LaneDisabled();
        // EAS returns an empty struct (not a revert) for unknown uids.
        Attestation memory att = IEAS(eas).getAttestation(uid);
        if (uid == bytes32(0) || att.uid != uid) revert AttestationNotFound(uid);
        if (att.schema != haetaeSchemaUid) revert WrongSchema(att.schema);
        if (att.attester != haetaeAttester) revert WrongAttester(att.attester);
        if (att.recipient == address(0)) revert ZeroRecipient();
        // Reject-at-registration is ratified law: a stored-but-false record is
        // a lie waiting to be read.
        if (!_alive(att)) revert AttestationDead(uid);

        _uids[att.recipient] = uid;
        emit AttestationRegistered(att.recipient, uid);
    }

    /// @inheritdoc IHaetaeDojang
    function attestationUidOf(address subject) external view returns (bytes32) {
        return _uids[subject];
    }

    // -------------------------------------------------------------------------
    // Internal lanes
    // -------------------------------------------------------------------------

    /// @dev Lane 1: the DojangScroll boolean is the law; any error is false.
    function _dojangLane(address subject) internal view returns (bool) {
        try scroll.isVerified(subject, dojangAttesterId) returns (bool ok) {
            return ok;
        } catch {
            return false;
        }
    }

    /// @dev Lane 2: identity was bound at registration (immutable in EAS);
    ///      liveness (revocation/expiry) is re-checked on every read.
    function _haetaeLane(address subject) internal view returns (bool) {
        if (haetaeSchemaUid == bytes32(0) || haetaeAttester == address(0)) return false;
        bytes32 uid = _uids[subject];
        if (uid == bytes32(0)) return false;
        try IEAS(eas).getAttestation(uid) returns (Attestation memory att) {
            return _alive(att);
        } catch {
            return false;
        }
    }

    /// @dev Not revoked, and either non-expiring or not yet expired.
    function _alive(Attestation memory att) internal view returns (bool) {
        return att.revocationTime == 0 && (att.expirationTime == 0 || block.timestamp < att.expirationTime);
    }
}
