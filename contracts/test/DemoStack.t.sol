// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Subject: src/examples/DemoVerifier.sol + src/examples/MockUSDC.sol — the two
// deploy-support contracts promoted to src/ by the Session 04 order (Stage A).

import {Test} from "forge-std/Test.sol";
import {DemoVerifier} from "../src/examples/DemoVerifier.sol";
import {MockUSDC} from "../src/examples/MockUSDC.sol";

contract DemoStackTest is Test {
    DemoVerifier ver;
    MockUSDC usdc;
    address ALICE = makeAddr("alice");
    address BOB = makeAddr("bob");

    function setUp() public {
        ver = new DemoVerifier();
        usdc = new MockUSDC();
    }

    // --- DemoVerifier: the whole point is that it never says no ---------------

    function test_Verifier_AlwaysTrue(address subject) public view {
        assertTrue(ver.isVerified(subject));
    }

    // --- MockUSDC: USDC-shaped, worthless by construction ----------------------

    function test_USDC_SixDecimals() public view {
        assertEq(usdc.decimals(), 6);
    }

    function test_USDC_Metadata() public view {
        assertEq(usdc.name(), "HAETAE Test USDC");
        assertEq(usdc.symbol(), "tUSDC");
    }

    function test_USDC_OpenMint_AnyCaller(address minter) public {
        vm.assume(minter != address(0));
        vm.prank(minter);
        usdc.mint(ALICE, 1_000e6);
        assertEq(usdc.balanceOf(ALICE), 1_000e6);
    }

    function test_USDC_TransferMoves() public {
        usdc.mint(ALICE, 500e6);
        vm.prank(ALICE);
        usdc.transfer(BOB, 200e6);
        assertEq(usdc.balanceOf(ALICE), 300e6);
        assertEq(usdc.balanceOf(BOB), 200e6);
    }
}
