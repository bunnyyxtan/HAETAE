// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {HaetaeLicense} from "../src/HaetaeLicense.sol";
import {IAgentLicense} from "../src/interfaces/IAgentLicense.sol";
import {IVerifiedAddress} from "../src/interfaces/IVerifiedAddress.sol";

// Test double — R1.1: test doubles live ONLY in test files.
contract MockVerifier is IVerifiedAddress {
    mapping(address => bool) private _v;

    function setVerified(address a, bool ok) external {
        _v[a] = ok;
    }

    function isVerified(address a) external view returns (bool) {
        return _v[a];
    }
}

contract LicenseTest is Test {
    HaetaeLicense lic;
    MockVerifier ver;
    address ADMIN = makeAddr("admin");
    address PRINCIPAL = makeAddr("principal");
    address AGENT = makeAddr("agent");
    address STRANGER = makeAddr("stranger");
    address SENTINEL = makeAddr("sentinel");
    uint64 EXPIRY;

    function setUp() public {
        ver = new MockVerifier();
        lic = new HaetaeLicense(ADMIN, ver);
        EXPIRY = uint64(block.timestamp + 1 days);
        ver.setVerified(PRINCIPAL, true);
        // Evaluate SENTINEL_ROLE before prank: argument evaluation is an external
        // call that would otherwise consume the prank before grantRole is reached.
        bytes32 role = lic.SENTINEL_ROLE();
        vm.prank(ADMIN);
        lic.grantRole(role, SENTINEL);
    }

    function test_Mint_RecordTokenEvent() public {
        vm.expectEmit(true, true, true, true);
        emit IAgentLicense.Licensed(1, PRINCIPAL, AGENT, EXPIRY, bytes32("scope"));
        vm.prank(PRINCIPAL);
        uint256 id = lic.mint(AGENT, EXPIRY, bytes32("scope"));

        assertEq(id, 1);
        assertEq(lic.ownerOf(1), PRINCIPAL);
        assertTrue(lic.isLicensed(AGENT));
        IAgentLicense.License memory r = lic.licenseOf(AGENT);
        assertEq(r.principal, PRINCIPAL);
        assertEq(r.agent, AGENT);
        assertEq(r.expiry, EXPIRY);
        assertEq(r.scope, bytes32("scope"));
        assertEq(uint8(r.status), uint8(IAgentLicense.Status.Active));
    }

    function test_PrincipalRevoke_SameBlock() public {
        vm.prank(PRINCIPAL);
        lic.mint(AGENT, EXPIRY, 0);
        vm.expectEmit(true, true, true, true);
        emit IAgentLicense.Revoked(1, AGENT, PRINCIPAL);
        vm.prank(PRINCIPAL);
        lic.revoke(AGENT);
        assertFalse(lic.isLicensed(AGENT));
        assertEq(uint8(lic.licenseOf(AGENT).status), uint8(IAgentLicense.Status.Revoked));
    }

    function test_SentinelRevoke() public {
        vm.prank(PRINCIPAL);
        lic.mint(AGENT, EXPIRY, 0);
        vm.prank(SENTINEL);
        lic.revoke(AGENT);
        assertFalse(lic.isLicensed(AGENT));
    }

    function test_Expiry_Boundaries() public {
        vm.prank(PRINCIPAL);
        lic.mint(AGENT, EXPIRY, 0);
        vm.warp(EXPIRY - 1);
        assertTrue(lic.isLicensed(AGENT));
        vm.warp(EXPIRY);
        assertFalse(lic.isLicensed(AGENT));
        vm.warp(EXPIRY + 1);
        assertFalse(lic.isLicensed(AGENT));
    }

    function test_Remint_AfterRevoke() public {
        vm.prank(PRINCIPAL);
        lic.mint(AGENT, EXPIRY, 0);
        vm.prank(PRINCIPAL);
        lic.revoke(AGENT);
        vm.prank(PRINCIPAL);
        uint256 id2 = lic.mint(AGENT, EXPIRY + 1 days, bytes32("v2"));
        assertEq(id2, 2);
        assertTrue(lic.isLicensed(AGENT));
        assertEq(lic.licenseOf(AGENT).scope, bytes32("v2"));
        assertEq(uint8(lic.licenseById(1).status), uint8(IAgentLicense.Status.Revoked));
        assertEq(uint8(lic.licenseById(99).status), uint8(IAgentLicense.Status.None));
    }

    function test_Remint_AfterExpiry() public {
        vm.prank(PRINCIPAL);
        lic.mint(AGENT, EXPIRY, 0);
        vm.warp(EXPIRY);
        vm.prank(PRINCIPAL);
        uint256 id2 = lic.mint(AGENT, uint64(block.timestamp + 1 days), 0);
        assertEq(id2, 2);
        assertTrue(lic.isLicensed(AGENT));
    }

    function test_Enumeration() public {
        vm.startPrank(PRINCIPAL);
        lic.mint(AGENT, EXPIRY, 0);
        lic.mint(makeAddr("agent2"), EXPIRY, 0);
        vm.stopPrank();
        assertEq(lic.balanceOf(PRINCIPAL), 2);
        assertEq(lic.tokenOfOwnerByIndex(PRINCIPAL, 0), 1);
        assertEq(lic.tokenOfOwnerByIndex(PRINCIPAL, 1), 2);
    }

    function test_Revert_Mint_Unverified() public {
        vm.expectRevert(abi.encodeWithSelector(HaetaeLicense.NotVerified.selector, STRANGER));
        vm.prank(STRANGER);
        lic.mint(AGENT, EXPIRY, 0);
    }

    function test_Revert_Mint_ZeroAgent() public {
        vm.expectRevert(HaetaeLicense.ZeroAddress.selector);
        vm.prank(PRINCIPAL);
        lic.mint(address(0), EXPIRY, 0);
    }

    function test_Revert_Mint_PastExpiry() public {
        vm.expectRevert(HaetaeLicense.InvalidExpiry.selector);
        vm.prank(PRINCIPAL);
        lic.mint(AGENT, uint64(block.timestamp), 0);
    }

    function test_Revert_Mint_AlreadyLicensed() public {
        vm.prank(PRINCIPAL);
        lic.mint(AGENT, EXPIRY, 0);
        vm.expectRevert(abi.encodeWithSelector(IAgentLicense.AlreadyLicensed.selector, AGENT));
        vm.prank(PRINCIPAL);
        lic.mint(AGENT, EXPIRY, 0);
    }

    function test_Revert_Revoke_Stranger() public {
        vm.prank(PRINCIPAL);
        lic.mint(AGENT, EXPIRY, 0);
        vm.expectRevert(IAgentLicense.NotAuthorized.selector);
        vm.prank(STRANGER);
        lic.revoke(AGENT);
    }

    function test_Revert_Revoke_NeverLicensed() public {
        vm.expectRevert(IAgentLicense.NotLicensed.selector);
        lic.revoke(AGENT);
    }

    function test_Revert_Revoke_AlreadyRevoked() public {
        vm.prank(PRINCIPAL);
        lic.mint(AGENT, EXPIRY, 0);
        vm.prank(PRINCIPAL);
        lic.revoke(AGENT);
        vm.expectRevert(IAgentLicense.AlreadyRevoked.selector);
        vm.prank(PRINCIPAL);
        lic.revoke(AGENT);
    }

    function test_Revert_LicenseOf_NeverLicensed() public {
        vm.expectRevert(IAgentLicense.NotLicensed.selector);
        lic.licenseOf(AGENT);
    }

    function test_Revert_Constructor_ZeroAddress() public {
        vm.expectRevert(HaetaeLicense.ZeroAddress.selector);
        new HaetaeLicense(address(0), ver);
        vm.expectRevert(HaetaeLicense.ZeroAddress.selector);
        new HaetaeLicense(ADMIN, IVerifiedAddress(address(0)));
    }

    function test_Revert_Mint_NonReceiverPrincipal() public {
        ver.setVerified(address(this), true);
        vm.expectRevert(abi.encodeWithSignature("ERC721InvalidReceiver(address)", address(this)));
        lic.mint(AGENT, EXPIRY, 0);
    }

    function test_SupportsInterfaces() public view {
        assertTrue(lic.supportsInterface(0x80ac58cd)); // ERC-721
        assertTrue(lic.supportsInterface(0x780e9d63)); // ERC-721 Enumerable
        assertTrue(lic.supportsInterface(0x7965db0b)); // AccessControl
    }

    function test_Revert_SBT_Transfers() public {
        vm.prank(PRINCIPAL);
        lic.mint(AGENT, EXPIRY, 0);
        vm.expectRevert(HaetaeLicense.TransfersDisabled.selector);
        vm.prank(PRINCIPAL);
        lic.transferFrom(PRINCIPAL, STRANGER, 1);
        vm.expectRevert(HaetaeLicense.TransfersDisabled.selector);
        vm.prank(PRINCIPAL);
        lic.safeTransferFrom(PRINCIPAL, STRANGER, 1);
        vm.expectRevert(HaetaeLicense.TransfersDisabled.selector);
        vm.prank(PRINCIPAL);
        lic.safeTransferFrom(PRINCIPAL, STRANGER, 1, "");
        vm.expectRevert(HaetaeLicense.TransfersDisabled.selector);
        lic.approve(STRANGER, 1);
        vm.expectRevert(HaetaeLicense.TransfersDisabled.selector);
        lic.setApprovalForAll(STRANGER, true);
    }

    function testFuzz_Expiry_ValidIffFuture(uint64 expiry) public {
        vm.assume(expiry > block.timestamp && expiry < type(uint64).max);
        vm.prank(PRINCIPAL);
        uint256 id = lic.mint(AGENT, expiry, 0);
        assertTrue(lic.isLicensed(AGENT));
        vm.warp(expiry);
        assertFalse(lic.isLicensed(AGENT));
        assertEq(lic.licenseOf(AGENT).expiry, expiry);
        assertEq(lic.ownerOf(id), PRINCIPAL);
    }

    function testFuzz_Scope_StoredVerbatim(bytes32 scope) public {
        vm.prank(PRINCIPAL);
        lic.mint(AGENT, EXPIRY, scope);
        assertEq(lic.licenseOf(AGENT).scope, scope);
    }

    function testFuzz_Agent_RoundTrip(address agent) public {
        vm.assume(agent != address(0));
        vm.prank(PRINCIPAL);
        lic.mint(agent, EXPIRY, 0);
        assertEq(lic.licenseOf(agent).agent, agent);
        assertTrue(lic.isLicensed(agent));
    }
}

// Stateful invariant tests — compact handler + invariants in one contract.
contract LicenseInvariantTest is Test {
    HaetaeLicense lic;
    MockVerifier ver;
    address constant P = address(0xBEEF1);

    uint256[] ids; // all minted ids in order
    mapping(uint256 => address) idAgent; // id → agent at mint time
    mapping(address => uint256) agentId; // agent → current id (remapped on re-mint)
    mapping(uint256 => bool) everRevoked; // id → was this id explicitly revoked?

    function setUp() public {
        ver = new MockVerifier();
        lic = new HaetaeLicense(address(0xAD), ver);
        ver.setVerified(P, true);
        bytes4[] memory sel = new bytes4[](3);
        sel[0] = this.h_mint.selector;
        sel[1] = this.h_revoke.selector;
        sel[2] = this.h_transfer.selector;
        targetSelector(FuzzSelector({addr: address(this), selectors: sel}));
        targetContract(address(this));
    }

    function h_mint(address agent, uint64 off) external {
        if (agent == address(0) || lic.isLicensed(agent)) return;
        uint64 exp = uint64(block.timestamp + (uint256(off) % 365 days) + 1);
        vm.prank(P);
        try lic.mint(agent, exp, 0) returns (uint256 id) {
            ids.push(id);
            idAgent[id] = agent;
            agentId[agent] = id;
        } catch {}
    }

    function h_revoke(uint256 seed) external {
        if (ids.length == 0) return;
        uint256 id = ids[seed % ids.length];
        address agent = idAgent[id];
        if (!lic.isLicensed(agent)) return;
        vm.prank(P);
        try lic.revoke(agent) {
            everRevoked[agentId[agent]] = true;
        } catch {}
    }

    /// @dev Every transfer attempt on a minted id must revert; success fails the campaign.
    function h_transfer(uint256 seed, address to) external {
        if (ids.length == 0 || to == address(0)) return;
        uint256 id = ids[seed % ids.length];
        vm.prank(P);
        try lic.transferFrom(P, to, id) {
            fail();
        } catch {}
    }

    /// @notice INVARIANT ONE-WAY: a revoked license id can never return to Active.
    function invariant_OneWay() public view {
        for (uint256 i; i < ids.length; i++) {
            uint256 id = ids[i];
            if (!everRevoked[id]) continue;
            assertEq(uint8(lic.licenseById(id).status), uint8(IAgentLicense.Status.Revoked));
        }
    }

    /// @notice INVARIANT SOULBOUND: ownerOf any minted id never leaves the original principal.
    function invariant_Soulbound() public view {
        for (uint256 i; i < ids.length; i++) {
            assertEq(lic.ownerOf(ids[i]), P, "soulbound violated");
        }
    }
}
