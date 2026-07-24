// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAgentLicense} from "../interfaces/IAgentLicense.sol";

/// @title SentinelAuthority — the delegated revoker: watchers flag, licenses die
/// @notice Holds SENTINEL_ROLE on HaetaeLicense (granted at deployment wiring). Admin
///         manages the watcher set; an authorized watcher's flag() revokes the agent's
///         license and fingerprints the reason on-chain. Rate-limiting is a named future
///         item for the live sentinel network (Phase 5), deliberately absent here.
contract SentinelAuthority {
    // -------------------------------------------------------------------------
    // Immutables & storage
    // -------------------------------------------------------------------------

    /// @notice License registry this authority revokes on.
    IAgentLicense public immutable license;

    /// @notice Watcher-set admin (should be a multisig in production).
    address public immutable admin;

    /// @notice Addresses allowed to flag agents. The sentinel service key lives here —
    ///         role separation is law: it can revoke, never spend (RULES R5.1).
    mapping(address => bool) public isWatcher;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /// @notice Emitted when a watcher is added or removed.
    /// @param watcher    The watcher whose authorization changed.
    /// @param authorized New authorization state.
    event WatcherSet(address indexed watcher, bool authorized);

    /// @notice Emitted after a successful flag-and-revoke. The verdict of record.
    /// @param agent      Agent whose license was revoked.
    /// @param watcher    Watcher that flagged.
    /// @param reasonHash keccak256 fingerprint of the off-chain reason document. The
    ///        sentinel service retains the preimage in its replayable action log; the
    ///        chain holds only this commitment. Zero is rejected: an unexplained
    ///        revocation is not an accountable verdict.
    event SentinelVerdict(address indexed agent, address indexed watcher, bytes32 reasonHash);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    /// @notice Constructor or setWatcher argument is the zero address.
    error ZeroAddress();

    /// @notice Caller is not the watcher-set admin.
    error NotAdmin();

    /// @notice Caller is not an authorized watcher.
    error NotWatcher();

    /// @notice reasonHash is zero; every verdict must carry its reason fingerprint.
    error EmptyReason();

    // -------------------------------------------------------------------------
    // Constructor & watcher management
    // -------------------------------------------------------------------------

    /// @notice Deploy the authority. It gains teeth only when the license admin grants it
    ///         SENTINEL_ROLE — without the role, every flag() bubbles NotAuthorized().
    /// @param license_ License registry to revoke on.
    /// @param admin_   Watcher-set admin.
    constructor(IAgentLicense license_, address admin_) {
        if (address(license_) == address(0) || admin_ == address(0)) revert ZeroAddress();
        license = license_;
        admin = admin_;
    }

    /// @notice Add or remove a watcher.
    /// @param watcher    Watcher address.
    /// @param authorized True to add, false to remove.
    function setWatcher(address watcher, bool authorized) external {
        if (msg.sender != admin) revert NotAdmin();
        if (watcher == address(0)) revert ZeroAddress();
        isWatcher[watcher] = authorized;
        emit WatcherSet(watcher, authorized);
    }

    // -------------------------------------------------------------------------
    // The verdict
    // -------------------------------------------------------------------------

    /// @notice Flag an agent: revoke its license and put the reason fingerprint on the
    ///         record. License-side failures (never licensed, already revoked, role not
    ///         granted) bubble unwrapped — this authority adds no verdict of its own on
    ///         failure, and SentinelVerdict is emitted only after the revoke succeeded.
    /// @param agent      Agent to revoke.
    /// @param reasonHash keccak256 of the off-chain reason document (see SentinelVerdict).
    function flag(address agent, bytes32 reasonHash) external {
        if (!isWatcher[msg.sender]) revert NotWatcher();
        if (reasonHash == bytes32(0)) revert EmptyReason();
        license.revoke(agent);
        emit SentinelVerdict(agent, msg.sender, reasonHash);
    }
}
