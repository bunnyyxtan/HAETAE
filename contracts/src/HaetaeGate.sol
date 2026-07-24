// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAgentLicense} from "./interfaces/IAgentLicense.sol";
import {IHaetaePolicy} from "./interfaces/IHaetaePolicy.sol";
import {IHaetaeGate} from "./interfaces/IHaetaeGate.sol";

/// @title HaetaeGate — the checkpoint every trade passes or dies at
/// @notice One external call, four ordered verdicts, each its own custom error. A passing
///         check records the spend before returning: verdict and accounting happen in one
///         call frame, so nothing can interleave between them (no TOCTOU gap). Callers are
///         admin-allowlisted because checks consume cap — permissionless checking would be
///         a griefing vector, not openness.
contract HaetaeGate is IHaetaeGate {
    // -------------------------------------------------------------------------
    // Immutables & storage
    // -------------------------------------------------------------------------

    /// @notice License registry consulted for verdicts 1 and 2.
    IAgentLicense public immutable license;

    /// @notice Policy store consulted for verdicts 3 and 4 and ordered to record spend.
    IHaetaePolicy public immutable policy;

    /// @notice Deployment admin; its only power is managing the caller allowlist.
    address public immutable admin;

    /// @notice Vaults and enforcement layers allowed to call check().
    mapping(address => bool) public authorizedCallers;

    // -------------------------------------------------------------------------
    // Implementation-only events & errors (wiring; IHaetaeGate carries the verdicts)
    // -------------------------------------------------------------------------

    /// @notice Emitted when a caller is allowed or disallowed.
    /// @param caller     The caller whose authorization changed.
    /// @param authorized New authorization state.
    event CallerSet(address indexed caller, bool authorized);

    /// @notice Constructor or setCaller argument is the zero address.
    error ZeroAddress();

    /// @notice Caller is not the deployment admin.
    error NotAdmin();

    // -------------------------------------------------------------------------
    // Constructor & wiring
    // -------------------------------------------------------------------------

    /// @notice Deploy the checkpoint.
    /// @param license_ License registry for verdicts 1–2.
    /// @param policy_  Policy store for verdicts 3–4 and spend recording.
    /// @param admin_   Address allowed to manage the caller allowlist.
    constructor(IAgentLicense license_, IHaetaePolicy policy_, address admin_) {
        if (address(license_) == address(0) || address(policy_) == address(0) || admin_ == address(0)) {
            revert ZeroAddress();
        }
        license = license_;
        policy = policy_;
        admin = admin_;
    }

    /// @notice Allow or disallow a check() caller.
    /// @param caller     Vault or enforcement layer address.
    /// @param authorized True to allow, false to disallow.
    function setCaller(address caller, bool authorized) external {
        if (msg.sender != admin) revert NotAdmin();
        if (caller == address(0)) revert ZeroAddress();
        authorizedCallers[caller] = authorized;
        emit CallerSet(caller, authorized);
    }

    // -------------------------------------------------------------------------
    // The checkpoint
    // -------------------------------------------------------------------------

    /// @inheritdoc IHaetaeGate
    function check(address agent, address venue, address token, uint256 amount) external override {
        if (!authorizedCallers[msg.sender]) revert NotAuthorizedCaller();

        // Verdicts 1–2: the license. licenseOf reverts only for never-licensed agents;
        // that revert and the Revoked status share one verdict: NotLicensed.
        try license.licenseOf(agent) returns (IAgentLicense.License memory lic) {
            if (lic.status != IAgentLicense.Status.Active) revert NotLicensed();
            // Same boundary as HaetaeLicense.isLicensed: valid strictly before expiry.
            if (block.timestamp >= lic.expiry) revert LicenseExpired();
        } catch {
            revert NotLicensed();
        }

        // Verdict 3: the venue. Dead-on-read policy records report false here, so a
        // stamp-mismatched (re-minted) agent fails at the venue verdict, never spends.
        if (!policy.isVenueAllowed(agent, venue)) revert VenueNotAllowed();

        // Verdict 4: the cap.
        if (amount > policy.remainingToday(agent, token)) revert CapExceeded();

        // Record in the same call frame — atomic with the verdicts above. Policy re-guards
        // the cap structurally; through this gate that backstop cannot fire.
        policy.recordSpend(agent, token, amount);
        emit CheckPassed(agent, venue, token, amount, msg.sender);
    }
}
