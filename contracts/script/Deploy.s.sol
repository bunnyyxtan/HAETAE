// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {HaetaeLicense} from "../src/HaetaeLicense.sol";
import {HaetaePolicy} from "../src/HaetaePolicy.sol";
import {HaetaeGate} from "../src/HaetaeGate.sol";
import {SentinelAuthority} from "../src/sentinel/SentinelAuthority.sol";
import {DemoVault} from "../src/examples/DemoVault.sol";
import {DemoVerifier} from "../src/examples/DemoVerifier.sol";
import {MockUSDC} from "../src/examples/MockUSDC.sol";

/// @notice Deploys the full HAETAE spine on GIWA Sepolia (chain 91342) in wiring order:
///         DemoVerifier → MockUSDC → HaetaeLicense → HaetaePolicy → HaetaeGate →
///         policy.setGate(gate) → SentinelAuthority + SENTINEL_ROLE grant + watcher →
///         DemoVault → gate caller-allowlist → stage funding (1M tUSDC to the vault).
///
///         On-chain authorization: the Session 04 written order (recorded in LOG S04) —
///         GIWA Sepolia testnet ONLY; no other chain exists for this project.
///         The deployer key is admin on every wiring seam (license roles, policy gate
///         wiring, gate allowlist, watcher set); production would place a multisig
///         there — out of demo scope by order.
///
///         Environment: DEPLOYER_PK (secret; read in-memory, never logged) and
///         SENTINEL_ADDR (public watcher address, wired into SentinelAuthority).
contract Deploy is Script {
    /// @notice Reverts if the script is invoked on the wrong chain.
    error WrongChain();

    /// @notice The only chain this project deploys to.
    uint256 internal constant GIWA_SEPOLIA = 91342;

    /// @notice tUSDC minted to the DemoVault so the stage has funds to move.
    uint256 internal constant STAGE_FUNDING = 1_000_000e6;

    function run() external {
        if (block.chainid != GIWA_SEPOLIA) revert WrongChain();

        uint256 deployerPk = vm.envUint("DEPLOYER_PK");
        address deployer = vm.addr(deployerPk);
        address watcher = vm.envAddress("SENTINEL_ADDR");

        vm.startBroadcast(deployerPk);

        DemoVerifier verifier = new DemoVerifier();
        MockUSDC usdc = new MockUSDC();
        HaetaeLicense license = new HaetaeLicense(deployer, verifier);
        HaetaePolicy policy = new HaetaePolicy(license, deployer);
        HaetaeGate gate = new HaetaeGate(license, policy, deployer);
        policy.setGate(address(gate));
        SentinelAuthority sentinel = new SentinelAuthority(license, deployer);
        license.grantRole(license.SENTINEL_ROLE(), address(sentinel));
        sentinel.setWatcher(watcher, true);
        DemoVault vault = new DemoVault(gate);
        gate.setCaller(address(vault), true);
        usdc.mint(address(vault), STAGE_FUNDING);

        vm.stopBroadcast();

        // Public record only — addresses, never keys.
        console2.log("DemoVerifier     ", address(verifier));
        console2.log("MockUSDC         ", address(usdc));
        console2.log("HaetaeLicense    ", address(license));
        console2.log("HaetaePolicy     ", address(policy));
        console2.log("HaetaeGate       ", address(gate));
        console2.log("SentinelAuthority", address(sentinel));
        console2.log("DemoVault        ", address(vault));
        console2.log("watcher (wired)  ", watcher);
    }
}
