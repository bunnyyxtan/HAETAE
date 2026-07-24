// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IHaetaePolicy — per-agent trade policy: daily caps, venue allowlist, spend accounting
/// @notice Implementation-law surface for the HAETAE spine (Session 03). NOT part of the
///         ERC draft: only IAgentLicense is standard surface. Names lock on merge.
///
///         Liveness rule (human-ruled, S03): every policy record is stamped with the
///         principal who wrote it. A record is dead-on-read — reported as absent — unless
///         the agent's CURRENT license is Active AND its principal equals the stamp. A
///         re-minted agent under a new principal therefore never inherits the old
///         principal's policy. Expiry does not kill policy reads: the Gate refuses expired
///         licenses upstream (LicenseExpired) before policy is ever consulted.
///
///         Day rule: a "day" is the UTC epoch-day, block.timestamp / 86400. Caps reset
///         discretely at 00:00 UTC — this is NOT a rolling 24h window. A spend accounts
///         wholly to the epoch-day of the block that records it.
interface IHaetaePolicy {
    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /// @notice Emitted when a principal sets an agent's daily cap for a token.
    /// @param agent     Agent whose policy changed.
    /// @param principal Principal who wrote the record (the stamp).
    /// @param token     Token the cap applies to.
    /// @param capPerDay Maximum amount spendable per UTC epoch-day (0 = shut off).
    event CapSet(address indexed agent, address indexed principal, address indexed token, uint256 capPerDay);

    /// @notice Emitted when a principal allows or disallows a venue for an agent.
    /// @param agent     Agent whose policy changed.
    /// @param principal Principal who wrote the record (the stamp).
    /// @param venue     Venue address being allowed or disallowed.
    /// @param allowed   New allowance state.
    event VenueSet(address indexed agent, address indexed principal, address indexed venue, bool allowed);

    /// @notice Emitted when the gate records a passed check's spend.
    /// @param agent      Agent that spent.
    /// @param token      Token spent.
    /// @param day        UTC epoch-day the spend accounts to.
    /// @param amount     Amount recorded by this check.
    /// @param spentToday Cumulative recorded spend for (agent, token, day) after this record.
    event SpendRecorded(
        address indexed agent, address indexed token, uint256 indexed day, uint256 amount, uint256 spentToday
    );

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    /// @notice The agent has no Active license record (never licensed, or revoked).
    error LicenseNotActive();

    /// @notice Caller is not the principal of the agent's current license.
    error NotPrincipal();

    /// @notice recordSpend caller is not the authorized gate.
    error NotGate();

    /// @notice Recording this amount would exceed today's remaining allowance. Structural
    ///         backstop: unreachable through a correct gate, which refuses CapExceeded first.
    error SpendExceedsRemaining();

    // -------------------------------------------------------------------------
    // Principal writes
    // -------------------------------------------------------------------------

    /// @notice Set the agent's daily cap for a token. Caller must be the principal of the
    ///         agent's current Active license; the record is stamped with that principal.
    /// @param agent     Agent the cap applies to.
    /// @param token     Token the cap applies to.
    /// @param capPerDay_ Maximum amount per UTC epoch-day. Zero shuts the token off.
    function setCap(address agent, address token, uint256 capPerDay_) external;

    /// @notice Allow or disallow a venue for an agent. Same authorization and stamping
    ///         rules as setCap.
    /// @param agent   Agent the rule applies to.
    /// @param venue   Venue address.
    /// @param allowed True to allow, false to disallow.
    function setVenue(address agent, address venue, bool allowed) external;

    // -------------------------------------------------------------------------
    // Gate write
    // -------------------------------------------------------------------------

    /// @notice Record a passed check's spend against (agent, token, today). Gate-only:
    ///         a permissionless recorder would let anyone burn an agent's daily cap.
    ///         Reverts SpendExceedsRemaining() if amount exceeds remainingToday — the
    ///         accounting owner enforces the cap invariant structurally, not just the gate.
    /// @param agent  Agent that spent.
    /// @param token  Token spent.
    /// @param amount Amount to record.
    function recordSpend(address agent, address token, uint256 amount) external;

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// @notice The agent's live daily cap for a token; 0 if no live record (dead-on-read).
    /// @param agent Agent to query.
    /// @param token Token to query.
    function capPerDay(address agent, address token) external view returns (uint256);

    /// @notice Amount still spendable today: live cap minus spentToday, saturating at 0
    ///         (a cap lowered below the day's recorded spend reads as 0, never underflows).
    /// @param agent Agent to query.
    /// @param token Token to query.
    function remainingToday(address agent, address token) external view returns (uint256);

    /// @notice Recorded spend for (agent, token) on the current UTC epoch-day. Spend is a
    ///         historical fact keyed by agent — it survives revoke and re-mint, so a
    ///         same-day re-license can never reset an already-consumed allowance.
    /// @param agent Agent to query.
    /// @param token Token to query.
    function spentToday(address agent, address token) external view returns (uint256);

    /// @notice Recorded spend for (agent, token) on an arbitrary UTC epoch-day.
    /// @param agent Agent to query.
    /// @param token Token to query.
    /// @param day   UTC epoch-day (block.timestamp / 86400 at spend time).
    function spentOn(address agent, address token, uint256 day) external view returns (uint256);

    /// @notice True iff the venue has a live, allowed record for the agent (dead-on-read
    ///         rules apply: ghost license or stamp mismatch reads as false).
    /// @param agent Agent to query.
    /// @param venue Venue to query.
    function isVenueAllowed(address agent, address venue) external view returns (bool);

    /// @notice The current UTC epoch-day: block.timestamp / 86400.
    function currentDay() external view returns (uint256);
}
