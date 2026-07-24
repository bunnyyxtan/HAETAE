// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {HaetaeLicense} from "../src/HaetaeLicense.sol";
import {SentinelAuthority} from "../src/sentinel/SentinelAuthority.sol";
import {IAgentLicense} from "../src/interfaces/IAgentLicense.sol";
import {MockVerifier} from "./License.t.sol";

contract SentinelTest is Test {
    HaetaeLicense lic;
    MockVerifier ver;
    SentinelAuthority auth;
    address ADMIN = makeAddr("admin");
    address PRINCIPAL = makeAddr("principal");
    address AGENT = makeAddr("agent");
    address WATCHER = makeAddr("watcher");
    bytes32 constant REASON = keccak256("prompt-injection: exfiltration attempt");
    uint64 EXPIRY;

    function setUp() public {
        ver = new MockVerifier();
        lic = new HaetaeLicense(ADMIN, ver);
        auth = new SentinelAuthority(lic, ADMIN);
        ver.setVerified(PRINCIPAL, true);
        EXPIRY = uint64(block.timestamp + 30 days);
        // Evaluate before prank: argument evaluation is an external call (S02 rule).
        bytes32 role = lic.SENTINEL_ROLE();
        vm.prank(ADMIN);
        lic.grantRole(role, address(auth));
        vm.prank(ADMIN);
        auth.setWatcher(WATCHER, true);
        vm.prank(PRINCIPAL);
        lic.mint(AGENT, EXPIRY, 0);
    }

    // --- wiring -------------------------------------------------------------

    function test_Revert_Constructor_ZeroAddress() public {
        vm.expectRevert(SentinelAuthority.ZeroAddress.selector);
        new SentinelAuthority(IAgentLicense(address(0)), ADMIN);
        vm.expectRevert(SentinelAuthority.ZeroAddress.selector);
        new SentinelAuthority(lic, address(0));
    }

    function test_SetWatcher_AddRemoveEvent() public {
        address w2 = makeAddr("watcher2");
        vm.expectEmit(true, false, false, true);
        emit SentinelAuthority.WatcherSet(w2, true);
        vm.prank(ADMIN);
        auth.setWatcher(w2, true);
        assertTrue(auth.isWatcher(w2));
        vm.prank(ADMIN);
        auth.setWatcher(w2, false);
        assertFalse(auth.isWatcher(w2));
    }

    function test_Revert_SetWatcher_NotAdminOrZero() public {
        vm.expectRevert(SentinelAuthority.NotAdmin.selector);
        auth.setWatcher(WATCHER, false);
        vm.expectRevert(SentinelAuthority.ZeroAddress.selector);
        vm.prank(ADMIN);
        auth.setWatcher(address(0), true);
    }

    // --- the verdict ----------------------------------------------------------

    function test_Flag_RevokesAndEmits() public {
        vm.expectEmit(true, true, true, true);
        emit IAgentLicense.Revoked(1, AGENT, address(auth));
        vm.expectEmit(true, true, false, true);
        emit SentinelAuthority.SentinelVerdict(AGENT, WATCHER, REASON);
        vm.prank(WATCHER);
        auth.flag(AGENT, REASON);
        assertFalse(lic.isLicensed(AGENT));
        assertEq(uint8(lic.licenseOf(AGENT).status), uint8(IAgentLicense.Status.Revoked));
    }

    function test_Revert_Flag_NotWatcher() public {
        vm.expectRevert(SentinelAuthority.NotWatcher.selector);
        auth.flag(AGENT, REASON);
        vm.prank(ADMIN);
        auth.setWatcher(WATCHER, false);
        vm.expectRevert(SentinelAuthority.NotWatcher.selector);
        vm.prank(WATCHER);
        auth.flag(AGENT, REASON);
    }

    function test_Revert_Flag_EmptyReason() public {
        vm.expectRevert(SentinelAuthority.EmptyReason.selector);
        vm.prank(WATCHER);
        auth.flag(AGENT, bytes32(0));
    }

    function test_Revert_Flag_BubblesNeverLicensed() public {
        vm.expectRevert(IAgentLicense.NotLicensed.selector);
        vm.prank(WATCHER);
        auth.flag(makeAddr("ghostagent"), REASON);
    }

    function test_Revert_Flag_BubblesAlreadyRevoked() public {
        vm.prank(WATCHER);
        auth.flag(AGENT, REASON);
        vm.expectRevert(IAgentLicense.AlreadyRevoked.selector);
        vm.prank(WATCHER);
        auth.flag(AGENT, REASON);
    }

    function test_Revert_Flag_BubblesNotAuthorized_WithoutRole() public {
        // An authority never granted SENTINEL_ROLE has no teeth; License says so.
        SentinelAuthority toothless = new SentinelAuthority(lic, ADMIN);
        vm.prank(ADMIN);
        toothless.setWatcher(WATCHER, true);
        vm.expectRevert(IAgentLicense.NotAuthorized.selector);
        vm.prank(WATCHER);
        toothless.flag(AGENT, REASON);
    }
}
