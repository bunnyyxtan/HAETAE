// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {HaetaeLicense} from "../src/HaetaeLicense.sol";
import {HaetaePolicy} from "../src/HaetaePolicy.sol";
import {HaetaeGate} from "../src/HaetaeGate.sol";
import {IAgentLicense} from "../src/interfaces/IAgentLicense.sol";
import {IHaetaePolicy} from "../src/interfaces/IHaetaePolicy.sol";
import {IHaetaeGate} from "../src/interfaces/IHaetaeGate.sol";
import {MockVerifier} from "./License.t.sol";

contract GateTest is Test {
    HaetaeLicense lic;
    MockVerifier ver;
    HaetaePolicy pol;
    HaetaeGate gate;
    address ADMIN = makeAddr("admin");
    address PRINCIPAL = makeAddr("principal");
    address PRINCIPAL2 = makeAddr("principal2");
    address AGENT = makeAddr("agent");
    address VENUE = makeAddr("venue");
    address TOKEN = makeAddr("usdc");
    address VAULT = makeAddr("vault");
    uint64 EXPIRY;

    function setUp() public {
        ver = new MockVerifier();
        lic = new HaetaeLicense(ADMIN, ver);
        pol = new HaetaePolicy(lic, ADMIN);
        gate = new HaetaeGate(lic, pol, ADMIN);
        vm.startPrank(ADMIN);
        pol.setGate(address(gate));
        gate.setCaller(VAULT, true);
        vm.stopPrank();
        ver.setVerified(PRINCIPAL, true);
        ver.setVerified(PRINCIPAL2, true);
        EXPIRY = uint64(block.timestamp + 30 days);
        vm.prank(PRINCIPAL);
        lic.mint(AGENT, EXPIRY, 0);
        vm.startPrank(PRINCIPAL);
        pol.setCap(AGENT, TOKEN, 1000);
        pol.setVenue(AGENT, VENUE, true);
        vm.stopPrank();
    }

    // --- wiring -------------------------------------------------------------

    function test_Revert_Constructor_ZeroAddress() public {
        vm.expectRevert(HaetaeGate.ZeroAddress.selector);
        new HaetaeGate(IAgentLicense(address(0)), pol, ADMIN);
        vm.expectRevert(HaetaeGate.ZeroAddress.selector);
        new HaetaeGate(lic, IHaetaePolicy(address(0)), ADMIN);
        vm.expectRevert(HaetaeGate.ZeroAddress.selector);
        new HaetaeGate(lic, pol, address(0));
    }

    function test_SetCaller_Event() public {
        address v2 = makeAddr("vault2");
        vm.expectEmit(true, false, false, true);
        emit HaetaeGate.CallerSet(v2, true);
        vm.prank(ADMIN);
        gate.setCaller(v2, true);
        assertTrue(gate.authorizedCallers(v2));
        vm.prank(ADMIN);
        gate.setCaller(v2, false);
        assertFalse(gate.authorizedCallers(v2));
    }

    function test_Revert_SetCaller_NotAdminOrZero() public {
        vm.expectRevert(HaetaeGate.NotAdmin.selector);
        gate.setCaller(VAULT, false);
        vm.expectRevert(HaetaeGate.ZeroAddress.selector);
        vm.prank(ADMIN);
        gate.setCaller(address(0), true);
    }

    // --- verdicts, in order ---------------------------------------------------

    function test_Revert_Check_NotAuthorizedCaller_BeforeAnyVerdict() public {
        vm.expectRevert(IHaetaeGate.NotAuthorizedCaller.selector);
        gate.check(AGENT, VENUE, TOKEN, 1);
        // Caller gate precedes every verdict, even for an unlicensed agent.
        vm.expectRevert(IHaetaeGate.NotAuthorizedCaller.selector);
        gate.check(makeAddr("ghostagent"), VENUE, TOKEN, 1);
    }

    function test_Revert_Check_NotLicensed_NeverAndRevoked() public {
        vm.expectRevert(IHaetaeGate.NotLicensed.selector);
        vm.prank(VAULT);
        gate.check(makeAddr("ghostagent"), VENUE, TOKEN, 1);
        vm.prank(PRINCIPAL);
        lic.revoke(AGENT);
        vm.expectRevert(IHaetaeGate.NotLicensed.selector);
        vm.prank(VAULT);
        gate.check(AGENT, VENUE, TOKEN, 1);
    }

    function test_Revert_Check_LicenseExpired_ExactBoundary() public {
        vm.warp(EXPIRY - 1);
        vm.prank(VAULT);
        gate.check(AGENT, VENUE, TOKEN, 1); // valid strictly before expiry
        vm.warp(EXPIRY);
        vm.expectRevert(IHaetaeGate.LicenseExpired.selector);
        vm.prank(VAULT);
        gate.check(AGENT, VENUE, TOKEN, 1);
    }

    function test_Revert_Check_VenueNotAllowed() public {
        vm.expectRevert(IHaetaeGate.VenueNotAllowed.selector);
        vm.prank(VAULT);
        gate.check(AGENT, makeAddr("venueB"), TOKEN, 1);
        vm.prank(PRINCIPAL);
        pol.setVenue(AGENT, VENUE, false);
        vm.expectRevert(IHaetaeGate.VenueNotAllowed.selector);
        vm.prank(VAULT);
        gate.check(AGENT, VENUE, TOKEN, 1);
    }

    function test_Revert_Check_CapExceeded() public {
        vm.expectRevert(IHaetaeGate.CapExceeded.selector);
        vm.prank(VAULT);
        gate.check(AGENT, VENUE, TOKEN, 1001);
        vm.prank(VAULT);
        gate.check(AGENT, VENUE, TOKEN, 1000);
        vm.expectRevert(IHaetaeGate.CapExceeded.selector);
        vm.prank(VAULT);
        gate.check(AGENT, VENUE, TOKEN, 1);
        // A token with no cap configured has zero allowance: default-deny.
        vm.expectRevert(IHaetaeGate.CapExceeded.selector);
        vm.prank(VAULT);
        gate.check(AGENT, VENUE, makeAddr("weth"), 1);
    }

    function test_Check_VerdictPrecedence() public {
        // Live license, dead venue, over-cap: venue verdict wins over cap.
        vm.expectRevert(IHaetaeGate.VenueNotAllowed.selector);
        vm.prank(VAULT);
        gate.check(AGENT, makeAddr("venueB"), TOKEN, 5000);
        // Expired license beats venue and cap.
        vm.warp(EXPIRY);
        vm.expectRevert(IHaetaeGate.LicenseExpired.selector);
        vm.prank(VAULT);
        gate.check(AGENT, makeAddr("venueB"), TOKEN, 5000);
        // Revoked beats everything.
        vm.prank(PRINCIPAL);
        lic.revoke(AGENT);
        vm.expectRevert(IHaetaeGate.NotLicensed.selector);
        vm.prank(VAULT);
        gate.check(AGENT, makeAddr("venueB"), TOKEN, 5000);
    }

    // --- passing checks ---------------------------------------------------------

    function test_Check_Pass_RecordsAtomicallyAndEmits() public {
        uint256 day = block.timestamp / 1 days;
        vm.expectEmit(true, true, true, true);
        emit IHaetaePolicy.SpendRecorded(AGENT, TOKEN, day, 600, 600);
        vm.expectEmit(true, true, true, true);
        emit IHaetaeGate.CheckPassed(AGENT, VENUE, TOKEN, 600, VAULT);
        vm.prank(VAULT);
        gate.check(AGENT, VENUE, TOKEN, 600);
        assertEq(pol.spentToday(AGENT, TOKEN), 600);
        assertEq(pol.remainingToday(AGENT, TOKEN), 400);
        // Exactly the remaining amount passes: cap is inclusive.
        vm.prank(VAULT);
        gate.check(AGENT, VENUE, TOKEN, 400);
        assertEq(pol.remainingToday(AGENT, TOKEN), 0);
    }

    function test_Check_ZeroAmount_Passes() public {
        vm.prank(VAULT);
        gate.check(AGENT, VENUE, TOKEN, 0);
        assertEq(pol.spentToday(AGENT, TOKEN), 0);
    }

    function test_Check_DayRollover_CapResets() public {
        vm.prank(VAULT);
        gate.check(AGENT, VENUE, TOKEN, 1000);
        vm.warp((block.timestamp / 1 days + 1) * 1 days);
        vm.prank(VAULT);
        gate.check(AGENT, VENUE, TOKEN, 1000);
        assertEq(pol.spentToday(AGENT, TOKEN), 1000);
    }

    function test_Check_RemintNewPrincipal_DiesAtVenue() public {
        vm.prank(PRINCIPAL);
        lic.revoke(AGENT);
        vm.prank(PRINCIPAL2);
        lic.mint(AGENT, EXPIRY, 0);
        // Old principal's venue allowance is stamp-dead: no inheritance (S03 ruling).
        vm.expectRevert(IHaetaeGate.VenueNotAllowed.selector);
        vm.prank(VAULT);
        gate.check(AGENT, VENUE, TOKEN, 1);
    }

    function testFuzz_StaticCap_NeverExceeded(uint256[6] memory amounts) public {
        for (uint256 i; i < amounts.length; i++) {
            uint256 amt = amounts[i] % 1500;
            vm.prank(VAULT);
            try gate.check(AGENT, VENUE, TOKEN, amt) {} catch {}
            assertLe(pol.spentToday(AGENT, TOKEN), 1000);
        }
    }
}
