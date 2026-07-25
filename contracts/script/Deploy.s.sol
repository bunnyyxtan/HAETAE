// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {HaetaeLicense} from "../src/HaetaeLicense.sol";
import {IVerifiedAddress} from "../src/interfaces/IVerifiedAddress.sol";
import {HaetaeDojang, IDojangScrollLike} from "../src/adapters/HaetaeDojang.sol";
import {HaetaePolicy} from "../src/HaetaePolicy.sol";
import {HaetaeGate} from "../src/HaetaeGate.sol";
import {SentinelAuthority} from "../src/sentinel/SentinelAuthority.sol";
import {ReferenceVault} from "../src/examples/ReferenceVault.sol";
import {SandboxVerifier} from "../src/examples/SandboxVerifier.sol";
import {TestUSDC} from "../src/examples/TestUSDC.sol";

/// @notice Deploys the full HAETAE spine on GIWA Sepolia (chain 91342) in wiring order:
///         SandboxVerifier → TestUSDC → HaetaeLicense → HaetaePolicy → HaetaeGate →
///         policy.setGate(gate) → SentinelAuthority + SENTINEL_ROLE grant + watcher →
///         ReferenceVault → gate caller-allowlist → stage funding (1M tUSDC to the vault).
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

    /// @notice tUSDC minted to the ReferenceVault so the stage has funds to move.
    uint256 internal constant STAGE_FUNDING = 1_000_000e6;

    /// @notice EAS predeploy on GIWA Sepolia (OP-stack canonical slot).
    address internal constant EAS_PREDEPLOY = 0x4200000000000000000000000000000000000021;

    /// @notice GIWA's live DojangScroll proxy (verified on-chain, LOG S10).
    address internal constant DOJANG_SCROLL = 0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9;

    /// @notice Upbit Korea attester-id lane on DojangScroll (RULING 2 constant).
    bytes32 internal constant UPBIT_KOREA = keccak256("dojang.dojangattesterids.upbitkorea");

    function run() external {
        if (block.chainid != GIWA_SEPOLIA) revert WrongChain();

        uint256 deployerPk = vm.envUint("DEPLOYER_PK");
        address deployer = vm.addr(deployerPk);
        address watcher = vm.envAddress("SENTINEL_ADDR");
        // IS_SANDBOX=true keeps the always-true SandboxVerifier on the license gate
        // (demo window only); default is the real dual-lane adapter.
        bool isSandbox = vm.envOr("IS_SANDBOX", false);
        // HAETAE lane bindings: schema UID registered in the step-3 ceremony,
        // attester is the fresh dedicated key (never the deployer — key law).
        // envOr so a demo-mode run cannot fail on missing lane-2 env; zero
        // values simply leave the adapter's HAETAE lane disabled.
        bytes32 haetaeSchemaUid = vm.envOr("HAETAE_SCHEMA_UID", bytes32(0));
        address haetaeAttester = vm.envOr("HAETAE_ATTESTER_ADDR", address(0));
        if (!isSandbox && (haetaeSchemaUid == bytes32(0) || haetaeAttester == address(0))) {
            revert("live deploy requires HAETAE_SCHEMA_UID and HAETAE_ATTESTER_ADDR");
        }

        vm.startBroadcast(deployerPk);

        SandboxVerifier verifier = new SandboxVerifier();
        TestUSDC usdc = new TestUSDC();
        HaetaeDojang dojang = new HaetaeDojang(
            IDojangScrollLike(DOJANG_SCROLL), UPBIT_KOREA, EAS_PREDEPLOY, haetaeSchemaUid, haetaeAttester
        );
        IVerifiedAddress licenseVerifier = isSandbox ? IVerifiedAddress(verifier) : IVerifiedAddress(dojang);
        HaetaeLicense license = new HaetaeLicense(deployer, licenseVerifier);
        HaetaePolicy policy = new HaetaePolicy(license, deployer);
        HaetaeGate gate = new HaetaeGate(license, policy, deployer);
        policy.setGate(address(gate));
        SentinelAuthority sentinel = new SentinelAuthority(license, deployer);
        license.grantRole(license.SENTINEL_ROLE(), address(sentinel));
        sentinel.setWatcher(watcher, true);
        ReferenceVault vault = new ReferenceVault(gate);
        gate.setCaller(address(vault), true);
        usdc.mint(address(vault), STAGE_FUNDING);

        vm.stopBroadcast();

        // Public record only — addresses, never keys.
        console2.log("SandboxVerifier     ", address(verifier));
        console2.log("HaetaeDojang     ", address(dojang));
        console2.log("license verifier ", address(licenseVerifier));
        console2.log("TestUSDC         ", address(usdc));
        console2.log("HaetaeLicense    ", address(license));
        console2.log("HaetaePolicy     ", address(policy));
        console2.log("HaetaeGate       ", address(gate));
        console2.log("SentinelAuthority", address(sentinel));
        console2.log("ReferenceVault        ", address(vault));
        console2.log("watcher (wired)  ", watcher);
    }
}
