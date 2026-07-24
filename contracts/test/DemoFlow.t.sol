// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, stdError} from "forge-std/Test.sol";
import {HaetaeLicense} from "../src/HaetaeLicense.sol";
import {HaetaePolicy} from "../src/HaetaePolicy.sol";
import {HaetaeGate} from "../src/HaetaeGate.sol";
import {SentinelAuthority} from "../src/sentinel/SentinelAuthority.sol";
import {DemoVault} from "../src/examples/DemoVault.sol";
import {IAgentLicense} from "../src/interfaces/IAgentLicense.sol";
import {IHaetaePolicy} from "../src/interfaces/IHaetaePolicy.sol";
import {IHaetaeGate} from "../src/interfaces/IHaetaeGate.sol";
import {MockVerifier} from "./License.t.sol";

// Test doubles — R1.1: they live ONLY in test files.
contract MiniUSDC {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount; // checked math reverts on insufficient balance
        balanceOf[to] += amount;
        return true;
    }
}

// Reverts with empty data so the vault's zero-selector degenerate branch is honest, not dead.
contract RevertingGate {
    function check(address, address, address, uint256) external pure {
        revert();
    }
}

contract DemoFlowTest is Test {
    HaetaeLicense lic;
    MockVerifier ver;
    HaetaePolicy pol;
    HaetaeGate gate;
    SentinelAuthority auth;
    DemoVault vault;
    MiniUSDC usdc;
    address ADMIN = makeAddr("admin");
    address PRINCIPAL = makeAddr("principal");
    address PRINCIPAL2 = makeAddr("principal2");
    address AGENT = makeAddr("agent");
    address AGENT2 = makeAddr("agent2");
    address VENUE_A = makeAddr("venueA");
    address VENUE_B = makeAddr("venueB");
    address WATCHER = makeAddr("watcher");
    bytes32 constant REASON = keccak256("prompt-injection: exfiltration attempt");
    uint64 EXPIRY;

    function setUp() public {
        ver = new MockVerifier();
        lic = new HaetaeLicense(ADMIN, ver);
        pol = new HaetaePolicy(lic, ADMIN);
        gate = new HaetaeGate(lic, pol, ADMIN);
        auth = new SentinelAuthority(lic, ADMIN);
        vault = new DemoVault(gate);
        usdc = new MiniUSDC();
        bytes32 role = lic.SENTINEL_ROLE(); // evaluate before prank (S02 rule)
        vm.startPrank(ADMIN);
        pol.setGate(address(gate));
        gate.setCaller(address(vault), true);
        lic.grantRole(role, address(auth));
        auth.setWatcher(WATCHER, true);
        vm.stopPrank();
        ver.setVerified(PRINCIPAL, true);
        ver.setVerified(PRINCIPAL2, true);
        usdc.mint(address(vault), 10_000e6);
        EXPIRY = uint64(block.timestamp + 30 days);
        vm.prank(PRINCIPAL);
        lic.mint(AGENT, EXPIRY, 0);
        vm.startPrank(PRINCIPAL);
        pol.setCap(AGENT, address(usdc), 1000e6);
        pol.setVenue(AGENT, VENUE_A, true);
        vm.stopPrank();
    }

    // --- vault units ----------------------------------------------------------

    function test_Revert_Constructor_ZeroGate() public {
        vm.expectRevert(DemoVault.ZeroAddress.selector);
        new DemoVault(IHaetaeGate(address(0)));
    }

    function test_Execute_Happy_MovesFundsAndRecords() public {
        vm.expectEmit(true, true, true, true);
        emit DemoVault.TradeExecuted(AGENT, VENUE_A, address(usdc), 600e6);
        vm.prank(AGENT);
        vault.execute(VENUE_A, address(usdc), 600e6);
        assertEq(usdc.balanceOf(address(vault)), 9400e6);
        assertEq(usdc.balanceOf(VENUE_A), 600e6);
        assertEq(pol.spentToday(AGENT, address(usdc)), 600e6);
    }

    function test_Execute_RefusedVerdicts_SelectorsSurfaced_NoStateChange() public {
        // NotLicensed: AGENT2 holds no license.
        vm.expectEmit(true, true, true, true);
        emit DemoVault.TradeRefused(AGENT2, VENUE_A, address(usdc), 100e6, IHaetaeGate.NotLicensed.selector);
        vm.prank(AGENT2);
        vault.execute(VENUE_A, address(usdc), 100e6);
        // VenueNotAllowed: venue B was never allowed.
        vm.expectEmit(true, true, true, true);
        emit DemoVault.TradeRefused(AGENT, VENUE_B, address(usdc), 100e6, IHaetaeGate.VenueNotAllowed.selector);
        vm.prank(AGENT);
        vault.execute(VENUE_B, address(usdc), 100e6);
        // CapExceeded: over the 1000e6 daily cap.
        vm.expectEmit(true, true, true, true);
        emit DemoVault.TradeRefused(AGENT, VENUE_A, address(usdc), 1100e6, IHaetaeGate.CapExceeded.selector);
        vm.prank(AGENT);
        vault.execute(VENUE_A, address(usdc), 1100e6);
        // LicenseExpired: warp to the boundary.
        vm.warp(EXPIRY);
        vm.expectEmit(true, true, true, true);
        emit DemoVault.TradeRefused(AGENT, VENUE_A, address(usdc), 100e6, IHaetaeGate.LicenseExpired.selector);
        vm.prank(AGENT);
        vault.execute(VENUE_A, address(usdc), 100e6);
        // Refusals moved nothing and recorded nothing.
        assertEq(usdc.balanceOf(address(vault)), 10_000e6);
        assertEq(usdc.balanceOf(VENUE_A), 0);
        assertEq(usdc.balanceOf(VENUE_B), 0);
        assertEq(pol.spentToday(AGENT, address(usdc)), 0);
    }

    function test_Execute_InsufficientVaultBalance_WholeTxReverts() public {
        // Passing check records spend; a failing transfer must roll ALL of it back.
        vm.prank(PRINCIPAL);
        pol.setCap(AGENT, address(usdc), 50_000e6);
        vm.expectRevert(stdError.arithmeticError);
        vm.prank(AGENT);
        vault.execute(VENUE_A, address(usdc), 20_000e6);
        assertEq(pol.spentToday(AGENT, address(usdc)), 0, "no spend without a trade");
    }

    function test_Execute_EmptyRevertData_ZeroSelector() public {
        DemoVault v2 = new DemoVault(IHaetaeGate(address(new RevertingGate())));
        vm.expectEmit(true, true, true, true);
        emit DemoVault.TradeRefused(AGENT, VENUE_A, address(usdc), 1, bytes4(0));
        vm.prank(AGENT);
        v2.execute(VENUE_A, address(usdc), 1);
    }

    // --- the demo, beat for beat ------------------------------------------------

    function test_DemoLoop_BeatForBeat() public {
        uint256 t0 = 20_100 days;
        vm.warp(t0);
        uint64 exp2 = uint64(t0 + 30 days);
        uint256 day0 = t0 / 1 days;

        // Beat 1: mint — the agent gets its license.
        vm.expectEmit(true, true, true, true);
        emit IAgentLicense.Licensed(2, PRINCIPAL2, AGENT2, exp2, bytes32("trade"));
        vm.prank(PRINCIPAL2);
        lic.mint(AGENT2, exp2, bytes32("trade"));

        // Beat 2: policy set — the license gets its terms.
        vm.expectEmit(true, true, true, true);
        emit IHaetaePolicy.CapSet(AGENT2, PRINCIPAL2, address(usdc), 1000e6);
        vm.prank(PRINCIPAL2);
        pol.setCap(AGENT2, address(usdc), 1000e6);
        vm.expectEmit(true, true, true, true);
        emit IHaetaePolicy.VenueSet(AGENT2, PRINCIPAL2, VENUE_A, true);
        vm.prank(PRINCIPAL2);
        pol.setVenue(AGENT2, VENUE_A, true);

        // Beat 3: legal trade passes — spend recorded and funds move, atomically.
        vm.expectEmit(true, true, true, true);
        emit IHaetaePolicy.SpendRecorded(AGENT2, address(usdc), day0, 600e6, 600e6);
        vm.expectEmit(true, true, true, true);
        emit IHaetaeGate.CheckPassed(AGENT2, VENUE_A, address(usdc), 600e6, address(vault));
        vm.expectEmit(true, true, true, true);
        emit DemoVault.TradeExecuted(AGENT2, VENUE_A, address(usdc), 600e6);
        vm.prank(AGENT2);
        vault.execute(VENUE_A, address(usdc), 600e6);
        assertEq(usdc.balanceOf(VENUE_A), 600e6);

        // Beat 4: over-cap refused — 600 + 600 breaches the 1000 cap.
        vm.expectEmit(true, true, true, true);
        emit DemoVault.TradeRefused(AGENT2, VENUE_A, address(usdc), 600e6, IHaetaeGate.CapExceeded.selector);
        vm.prank(AGENT2);
        vault.execute(VENUE_A, address(usdc), 600e6);
        assertEq(pol.spentToday(AGENT2, address(usdc)), 600e6);

        // Beat 5: wrong venue refused.
        vm.expectEmit(true, true, true, true);
        emit DemoVault.TradeRefused(AGENT2, VENUE_B, address(usdc), 100e6, IHaetaeGate.VenueNotAllowed.selector);
        vm.prank(AGENT2);
        vault.execute(VENUE_B, address(usdc), 100e6);

        // Beat 6: the sentinel flags — license dies with the reason on the record.
        vm.expectEmit(true, true, true, true);
        emit IAgentLicense.Revoked(2, AGENT2, address(auth));
        vm.expectEmit(true, true, false, true);
        emit SentinelAuthority.SentinelVerdict(AGENT2, WATCHER, REASON);
        vm.prank(WATCHER);
        auth.flag(AGENT2, REASON);
        assertFalse(lic.isLicensed(AGENT2));

        // Beat 7: the SAME intent that passed in beat 3 is now refused NotLicensed.
        vm.expectEmit(true, true, true, true);
        emit DemoVault.TradeRefused(AGENT2, VENUE_A, address(usdc), 600e6, IHaetaeGate.NotLicensed.selector);
        vm.prank(AGENT2);
        vault.execute(VENUE_A, address(usdc), 600e6);

        // Beat 8: ghost stays ghost — even after the day cap would have reset.
        vm.warp(t0 + 2 days);
        vm.expectEmit(true, true, true, true);
        emit DemoVault.TradeRefused(AGENT2, VENUE_A, address(usdc), 600e6, IHaetaeGate.NotLicensed.selector);
        vm.prank(AGENT2);
        vault.execute(VENUE_A, address(usdc), 600e6);
        assertEq(pol.remainingToday(AGENT2, address(usdc)), 0);
        assertFalse(pol.isVenueAllowed(AGENT2, VENUE_A));
        assertEq(usdc.balanceOf(VENUE_A), 600e6, "nothing moved after the revoke");
    }

    // --- ruled coda: re-mint starts a fresh regime --------------------------------

    function test_RemintNewPrincipal_FreshRegime() public {
        vm.prank(PRINCIPAL);
        lic.revoke(AGENT);
        vm.prank(PRINCIPAL2);
        lic.mint(AGENT, EXPIRY, 0);
        // No inheritance: old principal's venue allowance is dead for the new license.
        vm.expectEmit(true, true, true, true);
        emit DemoVault.TradeRefused(AGENT, VENUE_A, address(usdc), 100e6, IHaetaeGate.VenueNotAllowed.selector);
        vm.prank(AGENT);
        vault.execute(VENUE_A, address(usdc), 100e6);
        // The new principal writes its own terms; the rail opens under the new regime.
        vm.startPrank(PRINCIPAL2);
        pol.setCap(AGENT, address(usdc), 500e6);
        pol.setVenue(AGENT, VENUE_A, true);
        vm.stopPrank();
        vm.expectEmit(true, true, true, true);
        emit DemoVault.TradeExecuted(AGENT, VENUE_A, address(usdc), 100e6);
        vm.prank(AGENT);
        vault.execute(VENUE_A, address(usdc), 100e6);
        assertEq(usdc.balanceOf(VENUE_A), 100e6);
    }
}
