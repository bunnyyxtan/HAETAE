// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {HaetaeLicense} from "../src/HaetaeLicense.sol";
import {HaetaePolicy} from "../src/HaetaePolicy.sol";
import {IAgentLicense} from "../src/interfaces/IAgentLicense.sol";
import {IHaetaePolicy} from "../src/interfaces/IHaetaePolicy.sol";
import {MockVerifier} from "./License.t.sol";

contract PolicyTest is Test {
    HaetaeLicense lic;
    MockVerifier ver;
    HaetaePolicy pol;
    address ADMIN = makeAddr("admin");
    address PRINCIPAL = makeAddr("principal");
    address PRINCIPAL2 = makeAddr("principal2");
    address AGENT = makeAddr("agent");
    address VENUE = makeAddr("venue");
    address TOKEN = makeAddr("usdc");
    address GATE = makeAddr("gate");
    uint64 EXPIRY;

    function setUp() public {
        ver = new MockVerifier();
        lic = new HaetaeLicense(ADMIN, ver);
        pol = new HaetaePolicy(lic, ADMIN);
        ver.setVerified(PRINCIPAL, true);
        ver.setVerified(PRINCIPAL2, true);
        EXPIRY = uint64(block.timestamp + 30 days);
        vm.prank(PRINCIPAL);
        lic.mint(AGENT, EXPIRY, 0);
        vm.prank(ADMIN);
        pol.setGate(GATE);
    }

    // --- wiring -------------------------------------------------------------

    function test_Revert_Constructor_ZeroAddress() public {
        vm.expectRevert(HaetaePolicy.ZeroAddress.selector);
        new HaetaePolicy(IAgentLicense(address(0)), ADMIN);
        vm.expectRevert(HaetaePolicy.ZeroAddress.selector);
        new HaetaePolicy(lic, address(0));
    }

    function test_SetGate_OnceOnly() public {
        HaetaePolicy p2 = new HaetaePolicy(lic, ADMIN);
        vm.expectEmit(false, false, false, true);
        emit HaetaePolicy.GateSet(GATE);
        vm.prank(ADMIN);
        p2.setGate(GATE);
        assertEq(p2.gate(), GATE);
        vm.expectRevert(HaetaePolicy.GateAlreadySet.selector);
        vm.prank(ADMIN);
        p2.setGate(makeAddr("gate2"));
    }

    function test_Revert_SetGate_NotAdminOrZero() public {
        HaetaePolicy p2 = new HaetaePolicy(lic, ADMIN);
        vm.expectRevert(HaetaePolicy.NotAdmin.selector);
        p2.setGate(GATE);
        vm.expectRevert(HaetaePolicy.ZeroAddress.selector);
        vm.prank(ADMIN);
        p2.setGate(address(0));
    }

    // --- principal writes ---------------------------------------------------

    function test_SetCap_RecordEvent() public {
        vm.expectEmit(true, true, true, true);
        emit IHaetaePolicy.CapSet(AGENT, PRINCIPAL, TOKEN, 1000);
        vm.prank(PRINCIPAL);
        pol.setCap(AGENT, TOKEN, 1000);
        assertEq(pol.capPerDay(AGENT, TOKEN), 1000);
        assertEq(pol.remainingToday(AGENT, TOKEN), 1000);
    }

    function test_SetVenue_RecordEvent() public {
        vm.expectEmit(true, true, true, true);
        emit IHaetaePolicy.VenueSet(AGENT, PRINCIPAL, VENUE, true);
        vm.prank(PRINCIPAL);
        pol.setVenue(AGENT, VENUE, true);
        assertTrue(pol.isVenueAllowed(AGENT, VENUE));
        vm.prank(PRINCIPAL);
        pol.setVenue(AGENT, VENUE, false);
        assertFalse(pol.isVenueAllowed(AGENT, VENUE));
    }

    function test_Revert_SetCap_NotPrincipal() public {
        vm.expectRevert(IHaetaePolicy.NotPrincipal.selector);
        vm.prank(PRINCIPAL2);
        pol.setCap(AGENT, TOKEN, 1000);
    }

    function test_Revert_SetCap_LicenseNotActive() public {
        vm.expectRevert(IHaetaePolicy.LicenseNotActive.selector);
        vm.prank(PRINCIPAL);
        pol.setCap(makeAddr("ghostagent"), TOKEN, 1000);
        vm.prank(PRINCIPAL);
        lic.revoke(AGENT);
        vm.expectRevert(IHaetaePolicy.LicenseNotActive.selector);
        vm.prank(PRINCIPAL);
        pol.setCap(AGENT, TOKEN, 1000);
    }

    function test_Revert_SetVenue_NotPrincipalOrInactive() public {
        vm.expectRevert(IHaetaePolicy.NotPrincipal.selector);
        vm.prank(PRINCIPAL2);
        pol.setVenue(AGENT, VENUE, true);
        vm.prank(PRINCIPAL);
        lic.revoke(AGENT);
        vm.expectRevert(IHaetaePolicy.LicenseNotActive.selector);
        vm.prank(PRINCIPAL);
        pol.setVenue(AGENT, VENUE, true);
    }

    function test_SetCap_WhileExpiredActive_Allowed() public {
        // Expiry does not block writes: the gate refuses expired licenses upstream, and a
        // renewal re-mint by the same principal keeps this policy live.
        vm.warp(EXPIRY + 1);
        vm.prank(PRINCIPAL);
        pol.setCap(AGENT, TOKEN, 777);
        assertEq(pol.capPerDay(AGENT, TOKEN), 777);
    }

    // --- gate write ---------------------------------------------------------

    function test_Revert_RecordSpend_NotGate() public {
        vm.expectRevert(IHaetaePolicy.NotGate.selector);
        pol.recordSpend(AGENT, TOKEN, 1);
    }

    function test_RecordSpend_AccumulatesEvent() public {
        vm.prank(PRINCIPAL);
        pol.setCap(AGENT, TOKEN, 1000);
        uint256 day = block.timestamp / 1 days;
        vm.expectEmit(true, true, true, true);
        emit IHaetaePolicy.SpendRecorded(AGENT, TOKEN, day, 400, 400);
        vm.prank(GATE);
        pol.recordSpend(AGENT, TOKEN, 400);
        vm.prank(GATE);
        pol.recordSpend(AGENT, TOKEN, 600);
        assertEq(pol.spentToday(AGENT, TOKEN), 1000);
        assertEq(pol.remainingToday(AGENT, TOKEN), 0);
        assertEq(pol.spentOn(AGENT, TOKEN, day), 1000);
    }

    function test_Revert_RecordSpend_ExceedsRemaining() public {
        vm.prank(PRINCIPAL);
        pol.setCap(AGENT, TOKEN, 1000);
        vm.expectRevert(IHaetaePolicy.SpendExceedsRemaining.selector);
        vm.prank(GATE);
        pol.recordSpend(AGENT, TOKEN, 1001);
        vm.prank(GATE);
        pol.recordSpend(AGENT, TOKEN, 1000);
        vm.expectRevert(IHaetaePolicy.SpendExceedsRemaining.selector);
        vm.prank(GATE);
        pol.recordSpend(AGENT, TOKEN, 1);
    }

    function test_Revert_RecordSpend_DeadPolicy() public {
        // Structural backstop: a ghost's remaining is 0, so nothing can be recorded.
        vm.prank(PRINCIPAL);
        pol.setCap(AGENT, TOKEN, 1000);
        vm.prank(PRINCIPAL);
        lic.revoke(AGENT);
        vm.expectRevert(IHaetaePolicy.SpendExceedsRemaining.selector);
        vm.prank(GATE);
        pol.recordSpend(AGENT, TOKEN, 1);
    }

    function test_RecordSpend_ZeroAmount() public {
        vm.prank(PRINCIPAL);
        pol.setCap(AGENT, TOKEN, 1000);
        vm.prank(GATE);
        pol.recordSpend(AGENT, TOKEN, 0);
        assertEq(pol.spentToday(AGENT, TOKEN), 0);
    }

    // --- dead-on-read (S03 ruling) -------------------------------------------

    function test_Views_NeverLicensed_Dead() public view {
        address ghost = address(0xDEAD);
        assertEq(pol.capPerDay(ghost, TOKEN), 0);
        assertEq(pol.remainingToday(ghost, TOKEN), 0);
        assertFalse(pol.isVenueAllowed(ghost, VENUE));
    }

    function test_Views_Ghost_Dead_SpendFactPersists() public {
        vm.startPrank(PRINCIPAL);
        pol.setCap(AGENT, TOKEN, 1000);
        pol.setVenue(AGENT, VENUE, true);
        vm.stopPrank();
        vm.prank(GATE);
        pol.recordSpend(AGENT, TOKEN, 300);
        vm.prank(PRINCIPAL);
        lic.revoke(AGENT);
        assertEq(pol.capPerDay(AGENT, TOKEN), 0);
        assertEq(pol.remainingToday(AGENT, TOKEN), 0);
        assertFalse(pol.isVenueAllowed(AGENT, VENUE));
        // The spend is a historical fact; only policy dies with the license.
        assertEq(pol.spentToday(AGENT, TOKEN), 300);
    }

    function test_Views_RemintNewPrincipal_NoInheritance() public {
        // THE ruled condition: a re-minted agent under a new principal must NEVER
        // inherit the old principal's policy silently — and same-day spend survives.
        vm.startPrank(PRINCIPAL);
        pol.setCap(AGENT, TOKEN, 1000);
        pol.setVenue(AGENT, VENUE, true);
        vm.stopPrank();
        vm.prank(GATE);
        pol.recordSpend(AGENT, TOKEN, 300);
        vm.prank(PRINCIPAL);
        lic.revoke(AGENT);
        vm.prank(PRINCIPAL2);
        lic.mint(AGENT, EXPIRY, 0);
        assertEq(pol.capPerDay(AGENT, TOKEN), 0);
        assertEq(pol.remainingToday(AGENT, TOKEN), 0);
        assertFalse(pol.isVenueAllowed(AGENT, VENUE));
        vm.prank(PRINCIPAL2);
        pol.setCap(AGENT, TOKEN, 500);
        // New cap 500 minus the day's already-consumed 300: no same-day reset trick.
        assertEq(pol.remainingToday(AGENT, TOKEN), 200);
        assertFalse(pol.isVenueAllowed(AGENT, VENUE));
    }

    function test_Views_RemintSamePrincipal_PolicySurvives() public {
        vm.startPrank(PRINCIPAL);
        pol.setCap(AGENT, TOKEN, 1000);
        pol.setVenue(AGENT, VENUE, true);
        lic.revoke(AGENT);
        vm.stopPrank();
        assertEq(pol.capPerDay(AGENT, TOKEN), 0);
        vm.prank(PRINCIPAL);
        lic.mint(AGENT, EXPIRY, 0);
        // Renewal by the SAME principal: the stamp matches again, policy is live again.
        assertEq(pol.capPerDay(AGENT, TOKEN), 1000);
        assertTrue(pol.isVenueAllowed(AGENT, VENUE));
    }

    function test_Views_ExpiredActive_StillLive() public {
        vm.prank(PRINCIPAL);
        pol.setCap(AGENT, TOKEN, 1000);
        vm.warp(EXPIRY + 1);
        // Documented: expiry is the gate's verdict (LicenseExpired), not a policy death.
        assertEq(pol.capPerDay(AGENT, TOKEN), 1000);
    }

    function test_Remaining_SaturatesWhenCapLowered() public {
        vm.prank(PRINCIPAL);
        pol.setCap(AGENT, TOKEN, 1000);
        vm.prank(GATE);
        pol.recordSpend(AGENT, TOKEN, 800);
        vm.prank(PRINCIPAL);
        pol.setCap(AGENT, TOKEN, 500);
        assertEq(pol.remainingToday(AGENT, TOKEN), 0);
        assertEq(pol.spentToday(AGENT, TOKEN), 800);
    }

    // --- day boundary ---------------------------------------------------------

    function test_DayBoundary_ResetAtUtcMidnight() public {
        uint256 t0 = 20_000 days + 12 hours;
        vm.warp(t0);
        // License from setUp has expired by t0; policy liveness ignores expiry (Active).
        vm.prank(PRINCIPAL);
        pol.setCap(AGENT, TOKEN, 1000);
        vm.prank(GATE);
        pol.recordSpend(AGENT, TOKEN, 900);
        uint256 day0 = t0 / 1 days;
        vm.warp((day0 + 1) * 1 days - 1);
        assertEq(pol.spentToday(AGENT, TOKEN), 900);
        assertEq(pol.remainingToday(AGENT, TOKEN), 100);
        vm.warp((day0 + 1) * 1 days);
        assertEq(pol.currentDay(), day0 + 1);
        assertEq(pol.spentToday(AGENT, TOKEN), 0);
        assertEq(pol.remainingToday(AGENT, TOKEN), 1000);
        assertEq(pol.spentOn(AGENT, TOKEN, day0), 900);
    }

    function testFuzz_CurrentDay_IsEpochDay(uint64 ts) public {
        vm.assume(ts > block.timestamp);
        vm.warp(ts);
        assertEq(pol.currentDay(), uint256(ts) / 1 days);
    }
}
