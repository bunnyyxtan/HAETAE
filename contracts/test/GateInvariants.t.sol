// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Subject: HaetaeGate check/record invariants under a hostile handler.
// The campaign composes the REAL HaetaeLicense + HaetaePolicy + HaetaeGate (no mocks)
// and drives mint/revoke/re-mint across a principal pool, cap/venue churn (including
// mid-day lowering), bounded time warps crossing day boundaries, and checks through
// the authorized caller. Invariants, in order:
//   (a) invariant_AdmissionWithinRemaining — no passing check admits more than
//       remainingToday at its own instant;
//   (b) invariant_GhostNeverPasses — revoked/expired/unlicensed agents never pass;
//   (c) invariant_DayBucketsMatchGhostLedger — every spend lands in the epoch-day
//       bucket of its own block.timestamp (parity with an independent ghost ledger).
// Split from Gate.t.sol under the 300-line test budget (S03 ruling: budget law beats
// packaging preference). Gate unit tests remain in Gate.t.sol.

import {Test} from "forge-std/Test.sol";
import {HaetaeLicense} from "../src/HaetaeLicense.sol";
import {HaetaePolicy} from "../src/HaetaePolicy.sol";
import {HaetaeGate} from "../src/HaetaeGate.sol";
import {IAgentLicense} from "../src/interfaces/IAgentLicense.sol";
import {MockVerifier} from "./License.t.sol";

contract GateInvariantTest is Test {
    HaetaeLicense lic;
    MockVerifier ver;
    HaetaePolicy pol;
    HaetaeGate gate;
    address constant ADMIN = address(0xAD);
    address[2] principals = [address(0xBEEF1), address(0xBEEF2)];
    address[3] agents = [address(0xA1), address(0xA2), address(0xA3)];
    address[2] venues = [address(0xE1), address(0xE2)];
    address[2] tokens = [address(0xC1), address(0xC2)];

    bool ghostPassed; // a check passed for a revoked/expired/unlicensed agent
    bool overAdmit; // a check admitted more than remainingToday at its own instant
    mapping(address => mapping(address => uint256)) ghostCapStamp; // agent → token → setter
    mapping(address => mapping(address => uint256)) ghostVenueStamp; // agent → venue → setter
    address[] tA;
    address[] tT;
    uint256[] tD; // tracked (agent, token, day) triples
    mapping(bytes32 => bool) seen;
    mapping(address => mapping(address => mapping(uint256 => uint256))) ghostSpent;

    function setUp() public {
        ver = new MockVerifier();
        lic = new HaetaeLicense(ADMIN, ver);
        pol = new HaetaePolicy(lic, ADMIN);
        gate = new HaetaeGate(lic, pol, ADMIN);
        vm.startPrank(ADMIN);
        pol.setGate(address(gate));
        gate.setCaller(address(this), true); // this handler IS the authorized vault
        vm.stopPrank();
        ver.setVerified(principals[0], true);
        ver.setVerified(principals[1], true);
        bytes4[] memory sel = new bytes4[](6);
        sel[0] = this.h_mint.selector;
        sel[1] = this.h_revoke.selector;
        sel[2] = this.h_setCap.selector;
        sel[3] = this.h_setVenue.selector;
        sel[4] = this.h_warp.selector;
        sel[5] = this.h_check.selector;
        targetSelector(FuzzSelector({addr: address(this), selectors: sel}));
        targetContract(address(this));
    }

    function h_mint(uint256 aSeed, uint256 pSeed, uint64 off) external {
        address agent = agents[aSeed % 3];
        address principal = principals[pSeed % 2];
        if (lic.isLicensed(agent)) return;
        uint64 exp = uint64(block.timestamp + (uint256(off) % 30 days) + 1);
        vm.prank(principal);
        try lic.mint(agent, exp, 0) {
            uint256 pIdx = principal == principals[0] ? 1 : 2;
            // RULED: records stamped by the OTHER principal must be dead after re-mint.
            for (uint256 i; i < 2; i++) {
                uint256 capStamp = ghostCapStamp[agent][tokens[i]];
                if (capStamp != 0 && capStamp != pIdx) {
                    assertEq(pol.capPerDay(agent, tokens[i]), 0, "inherited cap");
                    assertEq(pol.remainingToday(agent, tokens[i]), 0, "inherited remaining");
                }
                uint256 venStamp = ghostVenueStamp[agent][venues[i]];
                if (venStamp != 0 && venStamp != pIdx) {
                    assertFalse(pol.isVenueAllowed(agent, venues[i]), "inherited venue");
                }
            }
        } catch {}
    }

    function h_revoke(uint256 aSeed) external {
        address agent = agents[aSeed % 3];
        address principal;
        try lic.licenseOf(agent) returns (IAgentLicense.License memory l) {
            if (l.status != IAgentLicense.Status.Active) return;
            principal = l.principal;
        } catch {
            return;
        }
        vm.prank(principal);
        try lic.revoke(agent) {} catch {}
    }

    function h_setCap(uint256 aSeed, uint256 tSeed, uint256 pSeed, uint256 cap) external {
        address agent = agents[aSeed % 3];
        address token = tokens[tSeed % 2];
        address principal = principals[pSeed % 2];
        vm.prank(principal);
        try pol.setCap(agent, token, cap % 5000) {
            ghostCapStamp[agent][token] = principal == principals[0] ? 1 : 2;
        } catch {}
    }

    function h_setVenue(uint256 aSeed, uint256 vSeed, uint256 pSeed, bool allowed) external {
        address agent = agents[aSeed % 3];
        address venue = venues[vSeed % 2];
        address principal = principals[pSeed % 2];
        vm.prank(principal);
        try pol.setVenue(agent, venue, allowed) {
            ghostVenueStamp[agent][venue] = principal == principals[0] ? 1 : 2;
        } catch {}
    }

    function h_warp(uint256 sec) external {
        vm.warp(block.timestamp + (sec % 2 days) + 1);
    }

    function h_check(uint256 aSeed, uint256 vSeed, uint256 tSeed, uint256 amount) external {
        address agent = agents[aSeed % 3];
        address token = tokens[tSeed % 2];
        amount = amount % 3000;
        bool wasLicensed = lic.isLicensed(agent);
        uint256 remBefore = pol.remainingToday(agent, token);
        uint256 day = pol.currentDay();
        try gate.check(agent, venues[vSeed % 2], token, amount) {
            if (!wasLicensed) ghostPassed = true;
            if (amount > remBefore) overAdmit = true;
            ghostSpent[agent][token][day] += amount;
            bytes32 key = keccak256(abi.encode(agent, token, day));
            if (!seen[key]) {
                seen[key] = true;
                tA.push(agent);
                tT.push(token);
                tD.push(day);
            }
        } catch {}
    }

    /// @notice INVARIANT (b): the gate NEVER passes a revoked, expired, or absent license.
    function invariant_GhostNeverPasses() public view {
        assertFalse(ghostPassed, "ghost passed the gate");
    }

    /// @notice INVARIANT (a): no passing check ever admits more than remainingToday at its
    ///         own instant — with (c), recorded spend can never exceed an unchanged cap.
    function invariant_AdmissionWithinRemaining() public view {
        assertFalse(overAdmit, "admission exceeded remaining");
    }

    /// @notice INVARIANT (c): every spend landed in the epoch-day bucket of its own
    ///         block.timestamp — the ledger matches an independently kept ghost ledger.
    function invariant_DayBucketsMatchGhostLedger() public view {
        for (uint256 i; i < tA.length; i++) {
            assertEq(pol.spentOn(tA[i], tT[i], tD[i]), ghostSpent[tA[i]][tT[i]][tD[i]], "day bucket drift");
        }
    }
}
