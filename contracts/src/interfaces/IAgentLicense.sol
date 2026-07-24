// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IAgentLicense — minimal interface for the HAETAE Agent License registry
/// @notice Any dApp or enforcement layer that needs to verify agent authority reads this surface.
///         The standard is defined in standard/ERC-agent-license.md; this file mirrors it exactly.
interface IAgentLicense {
    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    /// @notice Lifecycle states of a license record. Transitions are one-way:
    ///         None → Active (on mint) and Active → Revoked (on revoke).
    ///         Revoked is terminal; re-licensing an agent requires a new mint.
    enum Status {
        None, // agent has never been mapped to a license record
        Active, // license exists and has not been explicitly revoked
        Revoked // permanently revoked; cannot return to Active

    }

    /// @notice The full license record stored per agent.
    /// @param principal Human principal who holds the SBT and answers for the agent.
    /// @param agent     Agent address bound by this license.
    /// @param expiry    Unix timestamp after which isLicensed returns false.
    /// @param scope     Opaque tag; semantics are caller-defined (stored verbatim).
    /// @param status    Current lifecycle state.
    struct License {
        address principal;
        address agent;
        uint64 expiry;
        bytes32 scope;
        Status status;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /// @notice Emitted when a new license is minted.
    /// @param licenseId Unique sequential id for this license token.
    /// @param principal Human principal who holds the SBT.
    /// @param agent     Agent address being licensed.
    /// @param expiry    Unix expiry timestamp.
    /// @param scope     Opaque scope tag.
    event Licensed(
        uint256 indexed licenseId, address indexed principal, address indexed agent, uint64 expiry, bytes32 scope
    );

    /// @notice Emitted when a license is revoked. Revocation is permanent.
    /// @param licenseId Id of the revoked license.
    /// @param agent     Agent whose license was revoked.
    /// @param revoker   Address that performed the revocation (principal or sentinel).
    event Revoked(uint256 indexed licenseId, address indexed agent, address indexed revoker);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    /// @notice Agent has no license record, or a required license is absent.
    error NotLicensed();

    /// @notice Caller lacks revocation authority (not the principal, not a sentinel).
    error NotAuthorized();

    /// @notice Agent currently holds an active, unexpired license.
    /// @param agent The agent that is already licensed.
    error AlreadyLicensed(address agent);

    /// @notice License is already in the Revoked state.
    error AlreadyRevoked();

    // -------------------------------------------------------------------------
    // Functions
    // -------------------------------------------------------------------------

    /// @notice Primary enforcement predicate. Returns true iff: a record exists for
    ///         `agent` AND status == Active AND block.timestamp < expiry.
    ///         All three conditions must hold. Never reverts.
    /// @param agent The agent address to query.
    function isLicensed(address agent) external view returns (bool);

    /// @notice Returns the agent's current license record. Revoked and expired records
    ///         remain readable — history is part of accountability.
    ///         Reverts NotLicensed() only when the agent has NEVER had a license (Status.None).
    /// @param agent The agent address to query.
    function licenseOf(address agent) external view returns (License memory);

    /// @notice Returns the raw license record for a token id. Returns a zero-value struct
    ///         (status == None) for ids that have never been minted; MUST NOT revert.
    ///         Superseded records (agent since re-licensed under a new id) remain readable
    ///         by id forever — id-level history is part of the accountability record.
    /// @param id The license token id to query.
    function licenseById(uint256 id) external view returns (License memory);

    /// @notice Revoke an agent's license. Authorized for the license's principal or a
    ///         sentinel-role holder. Takes effect immediately in the same block.
    ///         Reverts NotLicensed() if no record exists.
    ///         Reverts AlreadyRevoked() if status is already Revoked.
    ///         Reverts NotAuthorized() if caller is neither principal nor sentinel.
    /// @param agent The agent whose license is being revoked.
    function revoke(address agent) external;
}
