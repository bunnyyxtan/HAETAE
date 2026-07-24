// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IHaetaeGate — the pre-trade checkpoint: one call, one verdict
/// @notice Implementation-law surface for the HAETAE spine (Session 03). NOT part of the
///         ERC draft. Vaults call check() before moving funds; a passing check records the
///         spend in the same call — verdict and accounting are atomic, no TOCTOU gap.
interface IHaetaeGate {
    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /// @notice Emitted on every passing check, after the spend is recorded.
    /// @param agent  Agent the check was performed for.
    /// @param venue  Venue the trade targets.
    /// @param token  Token being spent.
    /// @param amount Amount admitted and recorded.
    /// @param caller Authorized caller (vault) that requested the check.
    event CheckPassed(
        address indexed agent, address indexed venue, address indexed token, uint256 amount, address caller
    );

    // -------------------------------------------------------------------------
    // Errors — one custom error per verdict, in check's evaluation order
    // -------------------------------------------------------------------------

    /// @notice Caller is not an authorized checkpoint user. Checks record spend, so a
    ///         permissionless check would let anyone exhaust an agent's daily cap.
    error NotAuthorizedCaller();

    /// @notice Verdict 1: the agent has no Active license (never licensed, or revoked).
    ///         Same selector as IAgentLicense.NotLicensed() — intentionally: one meaning.
    error NotLicensed();

    /// @notice Verdict 2: the license is Active but its expiry has passed.
    error LicenseExpired();

    /// @notice Verdict 3: the venue has no live allowance for this agent.
    error VenueNotAllowed();

    /// @notice Verdict 4: amount exceeds today's remaining allowance for this token.
    error CapExceeded();

    // -------------------------------------------------------------------------
    // The checkpoint
    // -------------------------------------------------------------------------

    /// @notice Pre-trade check. Reverts with exactly one verdict error, evaluated in order:
    ///         NotLicensed → LicenseExpired → VenueNotAllowed → CapExceeded. On pass,
    ///         records amount against (agent, token, today) and emits CheckPassed — the
    ///         caller needs no second call, and no state can change between verdict and
    ///         accounting. A zero amount passes the same license and venue verdicts and
    ///         records nothing of substance.
    /// @param agent  Agent to check. Authorized callers assert this identity truthfully.
    /// @param venue  Venue the trade targets.
    /// @param token  Token being spent.
    /// @param amount Amount the caller intends to move.
    function check(address agent, address venue, address token, uint256 amount) external;
}
