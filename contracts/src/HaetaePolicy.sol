// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAgentLicense} from "./interfaces/IAgentLicense.sol";
import {IHaetaePolicy} from "./interfaces/IHaetaePolicy.sol";

/// @title HaetaePolicy — the terms of the license: caps, venues, per-day accounting
/// @notice Principals write policy for their licensed agents; the gate is the only spend
///         recorder. Every record carries the writing principal as a stamp and is
///         dead-on-read unless that principal still holds the agent's Active license —
///         a re-minted agent under a new principal starts with no policy (S03 ruling).
///         Days are UTC epoch-days (block.timestamp / 86400); caps reset at the boundary.
contract HaetaePolicy is IHaetaePolicy {
    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    /// @dev Cap record stamped with its writer. amount is the per-day allowance.
    struct CapRecord {
        address principal;
        uint256 amount;
    }

    /// @dev Venue record stamped with its writer.
    struct VenueRecord {
        address principal;
        bool allowed;
    }

    // -------------------------------------------------------------------------
    // Immutables & storage
    // -------------------------------------------------------------------------

    /// @notice License registry policy liveness is judged against.
    IAgentLicense public immutable license;

    /// @notice Deployment admin; its only power is wiring the gate once.
    address public immutable admin;

    /// @notice The sole authorized spend recorder. Set once via setGate.
    address public gate;

    /// @dev agent → token → stamped cap.
    mapping(address => mapping(address => CapRecord)) private _caps;

    /// @dev agent → venue → stamped allowance.
    mapping(address => mapping(address => VenueRecord)) private _venues;

    /// @dev agent → token → epoch-day → recorded spend. Unstamped on purpose: spend is a
    ///      historical fact that must survive revoke/re-mint (no same-day cap reset).
    mapping(address => mapping(address => mapping(uint256 => uint256))) private _spent;

    // -------------------------------------------------------------------------
    // Implementation-only events & errors (wiring; IHaetaePolicy carries the rest)
    // -------------------------------------------------------------------------

    /// @notice Emitted when the gate is wired.
    /// @param gate The authorized spend recorder.
    event GateSet(address gate);

    /// @notice Constructor or setGate argument is the zero address.
    error ZeroAddress();

    /// @notice Caller is not the deployment admin.
    error NotAdmin();

    /// @notice The gate is already wired; it cannot be re-pointed.
    error GateAlreadySet();

    // -------------------------------------------------------------------------
    // Constructor & wiring
    // -------------------------------------------------------------------------

    /// @notice Deploy the policy store.
    /// @param license_ License registry to judge liveness against.
    /// @param admin_   Address allowed to wire the gate once.
    constructor(IAgentLicense license_, address admin_) {
        if (address(license_) == address(0) || admin_ == address(0)) revert ZeroAddress();
        license = license_;
        admin = admin_;
    }

    /// @notice Wire the gate. One-time: the recorder authority is not re-pointable, so a
    ///         compromised admin cannot redirect accounting after deployment wiring.
    /// @param gate_ The HaetaeGate address.
    function setGate(address gate_) external {
        if (msg.sender != admin) revert NotAdmin();
        if (gate != address(0)) revert GateAlreadySet();
        if (gate_ == address(0)) revert ZeroAddress();
        gate = gate_;
        emit GateSet(gate_);
    }

    // -------------------------------------------------------------------------
    // Principal writes
    // -------------------------------------------------------------------------

    /// @inheritdoc IHaetaePolicy
    function setCap(address agent, address token, uint256 capPerDay_) external override {
        _requirePrincipal(agent);
        _caps[agent][token] = CapRecord({principal: msg.sender, amount: capPerDay_});
        emit CapSet(agent, msg.sender, token, capPerDay_);
    }

    /// @inheritdoc IHaetaePolicy
    function setVenue(address agent, address venue, bool allowed) external override {
        _requirePrincipal(agent);
        _venues[agent][venue] = VenueRecord({principal: msg.sender, allowed: allowed});
        emit VenueSet(agent, msg.sender, venue, allowed);
    }

    // -------------------------------------------------------------------------
    // Gate write
    // -------------------------------------------------------------------------

    /// @inheritdoc IHaetaePolicy
    function recordSpend(address agent, address token, uint256 amount) external override {
        if (msg.sender != gate) revert NotGate();
        // Backstop, not the primary check: remainingToday re-derives liveness and stamp,
        // so no spend can ever be recorded against a dead or absent policy record.
        if (amount > remainingToday(agent, token)) revert SpendExceedsRemaining();
        uint256 day = currentDay();
        uint256 total = _spent[agent][token][day] + amount;
        _spent[agent][token][day] = total;
        emit SpendRecorded(agent, token, day, amount, total);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// @inheritdoc IHaetaePolicy
    function capPerDay(address agent, address token) public view override returns (uint256) {
        CapRecord storage rec = _caps[agent][token];
        return _isLive(agent, rec.principal) ? rec.amount : 0;
    }

    /// @inheritdoc IHaetaePolicy
    function remainingToday(address agent, address token) public view override returns (uint256) {
        uint256 cap = capPerDay(agent, token);
        uint256 spent = _spent[agent][token][currentDay()];
        return cap > spent ? cap - spent : 0;
    }

    /// @inheritdoc IHaetaePolicy
    function spentToday(address agent, address token) external view override returns (uint256) {
        return _spent[agent][token][currentDay()];
    }

    /// @inheritdoc IHaetaePolicy
    function spentOn(address agent, address token, uint256 day) external view override returns (uint256) {
        return _spent[agent][token][day];
    }

    /// @inheritdoc IHaetaePolicy
    function isVenueAllowed(address agent, address venue) external view override returns (bool) {
        VenueRecord storage rec = _venues[agent][venue];
        return rec.allowed && _isLive(agent, rec.principal);
    }

    /// @inheritdoc IHaetaePolicy
    function currentDay() public view override returns (uint256) {
        return block.timestamp / 1 days;
    }

    // -------------------------------------------------------------------------
    // Internal liveness
    // -------------------------------------------------------------------------

    /// @dev A record stamped by `stamp` is live iff the agent's current license is Active
    ///      and held by that same principal. Never-licensed agents have no live records.
    function _isLive(address agent, address stamp) internal view returns (bool) {
        if (stamp == address(0)) return false;
        try license.licenseOf(agent) returns (IAgentLicense.License memory lic) {
            return lic.status == IAgentLicense.Status.Active && lic.principal == stamp;
        } catch {
            return false;
        }
    }

    /// @dev Writes require the caller to be the principal of the agent's current Active
    ///      license. Expired-but-Active licenses may still be configured: the gate refuses
    ///      them upstream, and renewal re-mints by the same principal keep the policy.
    function _requirePrincipal(address agent) internal view {
        try license.licenseOf(agent) returns (IAgentLicense.License memory lic) {
            if (lic.status != IAgentLicense.Status.Active) revert LicenseNotActive();
            if (lic.principal != msg.sender) revert NotPrincipal();
        } catch {
            revert LicenseNotActive();
        }
    }
}
