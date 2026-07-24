// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Attestation} from "eas-contracts/Common.sol";
import {HaetaeDojang, IHaetaeDojang, IDojangScrollLike} from "../src/adapters/HaetaeDojang.sol";
import {HaetaeLicense} from "../src/HaetaeLicense.sol";

// Test doubles — R1.1: they live ONLY in test files. MockDojangEAS exposes the
// SAME getAttestation(bytes32) -> Attestation ABI the live adapter calls on the
// real EAS predeploy; no test-only shortcuts exist in src/.
contract MockDojangEAS {
    mapping(bytes32 => Attestation) private _atts;
    uint256 private _n;

    function attest(bytes32 schema, address attester, address recipient, uint64 expirationTime)
        external
        returns (bytes32 uid)
    {
        uid = keccak256(abi.encode(++_n, schema, recipient));
        _atts[uid] = Attestation({
            uid: uid,
            schema: schema,
            time: uint64(block.timestamp),
            expirationTime: expirationTime,
            revocationTime: 0,
            refUID: bytes32(0),
            recipient: recipient,
            attester: attester,
            revocable: true,
            data: ""
        });
    }

    function revoke(bytes32 uid) external {
        _atts[uid].revocationTime = uint64(block.timestamp);
    }

    function getAttestation(bytes32 uid) external view returns (Attestation memory) {
        return _atts[uid]; // empty struct for unknown uids, like the real EAS
    }
}

contract MockScroll {
    mapping(address => mapping(bytes32 => bool)) private _v;

    function set(address addr, bytes32 attesterId, bool ok) external {
        _v[addr][attesterId] = ok;
    }

    function isVerified(address addr, bytes32 attesterId) external view returns (bool) {
        return _v[addr][attesterId];
    }
}

contract RevertingScroll {
    function isVerified(address, bytes32) external pure returns (bool) {
        revert();
    }
}

contract RevertingEAS {
    function getAttestation(bytes32) external pure returns (Attestation memory) {
        revert();
    }
}

contract DojangTest is Test {
    bytes32 constant UPBIT = keccak256("dojang.dojangattesterids.upbitkorea");
    bytes32 constant SCHEMA = keccak256("haetae: bool isVerifiedPrincipal");
    MockScroll scroll;
    MockDojangEAS eas;
    HaetaeDojang dj; // both lanes live
    address ATTESTER = makeAddr("attester");
    address PRINCIPAL = makeAddr("principal");
    address AGENT = makeAddr("agent");
    address ADMIN = makeAddr("admin");

    function setUp() public {
        scroll = new MockScroll();
        eas = new MockDojangEAS();
        dj = new HaetaeDojang(IDojangScrollLike(address(scroll)), UPBIT, address(eas), SCHEMA, ATTESTER);
    }

    // --- construction ---------------------------------------------------------

    function test_Revert_Constructor_ZeroScrollOrEas() public {
        vm.expectRevert(HaetaeDojang.ZeroAddress.selector);
        new HaetaeDojang(IDojangScrollLike(address(0)), UPBIT, address(eas), 0, address(0));
        vm.expectRevert(HaetaeDojang.ZeroAddress.selector);
        new HaetaeDojang(IDojangScrollLike(address(scroll)), UPBIT, address(0), 0, address(0));
    }

    // --- lane 1: DojangScroll ---------------------------------------------------

    function test_Lane1_VerifiedTrue_UnverifiedFalse_WrongAttesterIdFalse() public {
        assertFalse(dj.isVerified(PRINCIPAL));
        scroll.set(PRINCIPAL, keccak256("someone.else"), true); // wrong attester id
        assertFalse(dj.isVerified(PRINCIPAL));
        scroll.set(PRINCIPAL, UPBIT, true);
        assertTrue(dj.isVerified(PRINCIPAL));
    }

    function test_Lane1_ScrollReverts_FailsClosed() public {
        HaetaeDojang d2 =
            new HaetaeDojang(IDojangScrollLike(address(new RevertingScroll())), UPBIT, address(eas), SCHEMA, ATTESTER);
        assertFalse(d2.isVerified(PRINCIPAL));
        // lane 2 still works past a broken lane 1
        bytes32 uid = eas.attest(SCHEMA, ATTESTER, PRINCIPAL, 0);
        d2.registerAttestation(uid);
        assertTrue(d2.isVerified(PRINCIPAL));
    }

    // --- lane 2: disabled configurations ----------------------------------------

    function test_Lane2Disabled_RegisterReverts_BothZeroVariants() public {
        HaetaeDojang offA =
            new HaetaeDojang(IDojangScrollLike(address(scroll)), UPBIT, address(eas), bytes32(0), ATTESTER);
        HaetaeDojang offB =
            new HaetaeDojang(IDojangScrollLike(address(scroll)), UPBIT, address(eas), SCHEMA, address(0));
        bytes32 uid = eas.attest(SCHEMA, ATTESTER, PRINCIPAL, 0);
        vm.expectRevert(IHaetaeDojang.LaneDisabled.selector);
        offA.registerAttestation(uid);
        vm.expectRevert(IHaetaeDojang.LaneDisabled.selector);
        offB.registerAttestation(uid);
        assertFalse(offA.isVerified(PRINCIPAL));
        assertFalse(offB.isVerified(PRINCIPAL));
    }

    // --- lane 2: registration error surface --------------------------------------

    function test_Register_Happy_EventUidLookupVerdict() public {
        bytes32 uid = eas.attest(SCHEMA, ATTESTER, PRINCIPAL, 0);
        vm.expectEmit(true, true, false, true);
        emit IHaetaeDojang.AttestationRegistered(PRINCIPAL, uid);
        dj.registerAttestation(uid);
        assertEq(dj.attestationUidOf(PRINCIPAL), uid);
        assertTrue(dj.isVerified(PRINCIPAL));
    }

    function test_Revert_Register_UnknownAndZeroUid() public {
        vm.expectRevert(abi.encodeWithSelector(IHaetaeDojang.AttestationNotFound.selector, bytes32(0)));
        dj.registerAttestation(bytes32(0));
        bytes32 ghost = keccak256("ghost");
        vm.expectRevert(abi.encodeWithSelector(IHaetaeDojang.AttestationNotFound.selector, ghost));
        dj.registerAttestation(ghost);
    }

    function test_Revert_Register_WrongSchema() public {
        bytes32 bad = keccak256("other schema");
        bytes32 uid = eas.attest(bad, ATTESTER, PRINCIPAL, 0);
        vm.expectRevert(abi.encodeWithSelector(IHaetaeDojang.WrongSchema.selector, bad));
        dj.registerAttestation(uid);
    }

    function test_Revert_Register_WrongAttester() public {
        address rogue = makeAddr("rogue");
        bytes32 uid = eas.attest(SCHEMA, rogue, PRINCIPAL, 0);
        vm.expectRevert(abi.encodeWithSelector(IHaetaeDojang.WrongAttester.selector, rogue));
        dj.registerAttestation(uid);
    }

    function test_Revert_Register_ZeroRecipient() public {
        bytes32 uid = eas.attest(SCHEMA, ATTESTER, address(0), 0);
        vm.expectRevert(IHaetaeDojang.ZeroRecipient.selector);
        dj.registerAttestation(uid);
    }

    function test_Revert_Register_DeadAtRegistration_RevokedAndExpired() public {
        bytes32 uid = eas.attest(SCHEMA, ATTESTER, PRINCIPAL, 0);
        eas.revoke(uid);
        vm.expectRevert(abi.encodeWithSelector(IHaetaeDojang.AttestationDead.selector, uid));
        dj.registerAttestation(uid);
        bytes32 uid2 = eas.attest(SCHEMA, ATTESTER, PRINCIPAL, uint64(block.timestamp + 1 days));
        vm.warp(block.timestamp + 1 days); // boundary: expirationTime <= now is dead
        vm.expectRevert(abi.encodeWithSelector(IHaetaeDojang.AttestationDead.selector, uid2));
        dj.registerAttestation(uid2);
    }

    // --- lane 2: read-time liveness ----------------------------------------------

    function test_Lane2_RevokedAfterRegistration_FalseNextRead() public {
        bytes32 uid = eas.attest(SCHEMA, ATTESTER, PRINCIPAL, 0);
        dj.registerAttestation(uid);
        assertTrue(dj.isVerified(PRINCIPAL));
        eas.revoke(uid);
        assertFalse(dj.isVerified(PRINCIPAL), "revocation must land within one read");
    }

    function test_Lane2_ExpiryBoundary() public {
        uint64 exp = uint64(block.timestamp + 1 days);
        bytes32 uid = eas.attest(SCHEMA, ATTESTER, PRINCIPAL, exp);
        dj.registerAttestation(uid);
        assertTrue(dj.isVerified(PRINCIPAL));
        vm.warp(exp); // at the boundary: expired
        assertFalse(dj.isVerified(PRINCIPAL));
    }

    function test_Lane2_EasReverts_FailsClosed() public {
        HaetaeDojang d2 =
            new HaetaeDojang(IDojangScrollLike(address(scroll)), UPBIT, address(new RevertingEAS()), SCHEMA, ATTESTER);
        assertFalse(d2.isVerified(PRINCIPAL)); // no revert, no true
    }

    function test_Reregister_OverwritesUid() public {
        bytes32 a = eas.attest(SCHEMA, ATTESTER, PRINCIPAL, 0);
        dj.registerAttestation(a);
        eas.revoke(a);
        assertFalse(dj.isVerified(PRINCIPAL));
        bytes32 b = eas.attest(SCHEMA, ATTESTER, PRINCIPAL, 0);
        dj.registerAttestation(b);
        assertEq(dj.attestationUidOf(PRINCIPAL), b);
        assertTrue(dj.isVerified(PRINCIPAL));
    }

    // --- OR verdict + purity --------------------------------------------------------

    function test_EitherLaneAloneSuffices_BothFalseIsFalse() public {
        assertFalse(dj.isVerified(PRINCIPAL)); // both false
        scroll.set(PRINCIPAL, UPBIT, true); // lane 1 only
        assertTrue(dj.isVerified(PRINCIPAL));
        scroll.set(PRINCIPAL, UPBIT, false);
        bytes32 uid = eas.attest(SCHEMA, ATTESTER, PRINCIPAL, 0); // lane 2 only
        dj.registerAttestation(uid);
        assertTrue(dj.isVerified(PRINCIPAL));
    }

    function testFuzz_IsVerified_NeverReverts(address subject) public view {
        dj.isVerified(subject); // view + fail-closed lanes: must never revert
    }

    // --- integration: adapter gates HaetaeLicense.mint -----------------------------

    function test_Mint_GatedByAdapter_EachLane() public {
        HaetaeLicense lic = new HaetaeLicense(ADMIN, dj);
        uint64 expiry = uint64(block.timestamp + 30 days);
        vm.expectRevert(abi.encodeWithSelector(HaetaeLicense.NotVerified.selector, PRINCIPAL));
        vm.prank(PRINCIPAL);
        lic.mint(AGENT, expiry, 0);
        // lane 1 opens the gate
        scroll.set(PRINCIPAL, UPBIT, true);
        vm.prank(PRINCIPAL);
        lic.mint(AGENT, expiry, 0);
        assertTrue(lic.isLicensed(AGENT));
        // lane 2 opens it for a second principal
        address p2 = makeAddr("principal2");
        address a2 = makeAddr("agent2");
        bytes32 uid = eas.attest(SCHEMA, ATTESTER, p2, 0);
        dj.registerAttestation(uid);
        vm.prank(p2);
        lic.mint(a2, expiry, 0);
        assertTrue(lic.isLicensed(a2));
    }
}
