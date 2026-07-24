// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {HaetaeLicense} from "../src/HaetaeLicense.sol";
import {SentinelAuthority} from "../src/sentinel/SentinelAuthority.sol";
import {DemoVault} from "../src/examples/DemoVault.sol";
import {IAgentLicense} from "../src/interfaces/IAgentLicense.sol";
import {IHaetaePolicy} from "../src/interfaces/IHaetaePolicy.sol";

/// @notice Seeds the live demo cast and plays the beat sequence (Session 04, Stage A):
///         mint treasury-keeper (#1), swap-runner (#2), yield-scout (#3), grant-scribe
///         (#4) under the demo principal; write caps/venues per the demo story; then:
///         B1 legal trade → B2 cap refusal → B3 venue refusal (the injection beat) →
///         B4 sentinel flag + revoke on yield-scout → B5 ghost refusal.
///
///         Idempotency: every phase is guarded on current chain state. Mints are
///         skipped for agents that already have a record (a revoked yield-scout is the
///         intended end state and is never re-minted). Policy writes are skipped when
///         live values already match. The beats are anchored on yield-scout's status:
///         once Revoked, the whole beat section is skipped. Rough edge, documented:
///         many full re-runs inside one UTC day can exhaust swap-runner's cap and turn
///         B1 into a refusal until the midnight reset — do not loop the seed.
///
///         Cast/venue addresses for display-only roles are keccak-derived and keyless
///         (nobody holds their keys): treasury-keeper and grant-scribe only appear in
///         the registry this session; venues only receive tUSDC.
///
///         Environment: DEPLOYER_PK, PRINCIPAL_PK, SWAP_RUNNER_PK, YIELD_SCOUT_PK,
///         SENTINEL_PK (secrets; in-memory only, never logged) and public addresses
///         LICENSE_ADDR, POLICY_ADDR, SENTINEL_AUTH_ADDR, VAULT_ADDR, USDC_ADDR.
///
/// @dev The cast lives in script-contract state variables (a Script is simulated,
///      never deployed) rather than locals: run() with seventeen locals is stack-too-
///      deep under the project's plain (non-via-IR) codegen, and switching the whole
///      build profile to via-IR for one script is not worth the budget churn.
contract Seed is Script {
    /// @notice Reverts if the script is invoked on the wrong chain.
    error WrongChain();

    /// @notice Final state check failed: yield-scout is not Revoked at id 3.
    error SeedIncomplete();

    uint256 internal constant GIWA_SEPOLIA = 91342;

    /// @dev Gas treasury thresholds: top up actor EOAs from the deployer when low.
    ///      GIWA Sepolia gas runs well under a gwei; GAS_TOP_UP is sized so a single
    ///      faucet claim on the deployer (~0.014 ETH observed) funds all four actors
    ///      with margin, while still covering an actor's measured demo burn
    ///      (~0.0002 ETH) many times over.
    uint256 internal constant GAS_LOW_WATER = 0.002 ether;
    uint256 internal constant GAS_TOP_UP = 0.003 ether;

    /// @dev keccak256 fingerprint of the sentinel's off-chain reason document. The
    ///      preimage is public demo material, recorded in the session LOG:
    ///      "HAETAE demo S04: prompt-injection exfiltration attempt on yield-scout;
    ///      reason doc r1".
    bytes32 internal constant REASON_HASH =
        keccak256("HAETAE demo S04: prompt-injection exfiltration attempt on yield-scout; reason doc r1");

    // --- Signing keys (secrets; in-memory only, never logged) --------------------
    uint256 internal deployerPk;
    uint256 internal principalPk;
    uint256 internal swapRunnerPk;
    uint256 internal yieldScoutPk;
    uint256 internal sentinelPk;

    // --- Deployed spine -----------------------------------------------------------
    HaetaeLicense internal license;
    IHaetaePolicy internal policy;
    SentinelAuthority internal sentinelAuth;
    DemoVault internal vault;
    address internal usdc;

    // --- The cast. Mint order is law: yield-scout must land on licenseId 3. -------
    address internal principal;
    address internal sentinel;
    address internal treasuryKeeper;
    address internal swapRunner;
    address internal yieldScout;
    address internal grantScribe;

    // --- The venues (keyless sinks; they only ever receive tUSDC). ----------------
    address internal dexAlpha;
    address internal yieldFarm;
    address internal treasuryDesk;
    address internal grantsDesk;
    address internal attackerSink;

    function run() external {
        if (block.chainid != GIWA_SEPOLIA) revert WrongChain();
        _load();
        _phaseGas();
        _phaseLicensesAndPolicy();
        _phaseBeats();
        _assertFinalState();
    }

    /// @dev Load keys, spine addresses, and the deterministic cast into state.
    function _load() internal {
        deployerPk = vm.envUint("DEPLOYER_PK");
        principalPk = vm.envUint("PRINCIPAL_PK");
        swapRunnerPk = vm.envUint("SWAP_RUNNER_PK");
        yieldScoutPk = vm.envUint("YIELD_SCOUT_PK");
        sentinelPk = vm.envUint("SENTINEL_PK");

        license = HaetaeLicense(vm.envAddress("LICENSE_ADDR"));
        policy = IHaetaePolicy(vm.envAddress("POLICY_ADDR"));
        sentinelAuth = SentinelAuthority(vm.envAddress("SENTINEL_AUTH_ADDR"));
        vault = DemoVault(vm.envAddress("VAULT_ADDR"));
        usdc = vm.envAddress("USDC_ADDR");

        principal = vm.addr(principalPk);
        sentinel = vm.addr(sentinelPk);
        swapRunner = vm.addr(swapRunnerPk);
        yieldScout = vm.addr(yieldScoutPk);
        treasuryKeeper = _tagAddr("haetae.demo.cast.treasury-keeper");
        grantScribe = _tagAddr("haetae.demo.cast.grant-scribe");

        dexAlpha = _tagAddr("haetae.demo.venue.dex-alpha");
        yieldFarm = _tagAddr("haetae.demo.venue.yield-farm");
        treasuryDesk = _tagAddr("haetae.demo.venue.treasury-desk");
        grantsDesk = _tagAddr("haetae.demo.venue.grants-desk");
        attackerSink = _tagAddr("haetae.demo.venue.attacker-sink");
    }

    /// @dev Phase 0: gas treasury — deployer tops up the acting EOAs.
    function _phaseGas() internal {
        vm.startBroadcast(deployerPk);
        _topUp(principal);
        _topUp(swapRunner);
        _topUp(yieldScout);
        _topUp(sentinel);
        vm.stopBroadcast();
    }

    /// @dev Phase 1: licenses + policy, written by the principal.
    function _phaseLicensesAndPolicy() internal {
        uint64 expiry = uint64(block.timestamp + 90 days);
        vm.startBroadcast(principalPk);
        _mintIfAbsent(treasuryKeeper, expiry, "treasury", "treasury-keeper");
        _mintIfAbsent(swapRunner, expiry, "swap", "swap-runner");
        _mintIfAbsent(yieldScout, expiry, "yield", "yield-scout");
        _mintIfAbsent(grantScribe, expiry, "grants", "grant-scribe");

        _configure(treasuryKeeper, 10_000e6, treasuryDesk);
        _configure(swapRunner, 5_000e6, dexAlpha);
        _configure(yieldScout, 2_500e6, yieldFarm);
        _configure(grantScribe, 1_000e6, grantsDesk);
        vm.stopBroadcast();
    }

    /// @dev Phase 2: the beats, anchored on yield-scout's status.
    function _phaseBeats() internal {
        if (_statusOf(yieldScout) == IAgentLicense.Status.Revoked) {
            console2.log("beats already played (yield-scout Revoked); skipping");
            return;
        }

        console2.log("B1 legal trade: swap-runner -> dex-alpha, 1200 tUSDC");
        vm.startBroadcast(swapRunnerPk);
        vault.execute(dexAlpha, usdc, 1_200e6);
        vm.stopBroadcast();

        console2.log("B2 cap refusal: swap-runner -> dex-alpha, 4500 tUSDC (cap 5000)");
        vm.startBroadcast(swapRunnerPk);
        vault.execute(dexAlpha, usdc, 4_500e6);
        vm.stopBroadcast();

        console2.log("B3 venue refusal (injection): yield-scout -> attacker-sink, 800 tUSDC");
        vm.startBroadcast(yieldScoutPk);
        vault.execute(attackerSink, usdc, 800e6);
        vm.stopBroadcast();

        console2.log("B4 sentinel verdict: flag yield-scout, revoke license 3");
        vm.startBroadcast(sentinelPk);
        sentinelAuth.flag(yieldScout, REASON_HASH);
        vm.stopBroadcast();

        console2.log("B5 ghost refusal: revoked yield-scout -> yield-farm, 100 tUSDC");
        vm.startBroadcast(yieldScoutPk);
        vault.execute(yieldFarm, usdc, 100e6);
        vm.stopBroadcast();
    }

    /// @dev Final state: the gate evidence read.
    function _assertFinalState() internal view {
        IAgentLicense.License memory rec = license.licenseById(3);
        if (rec.status != IAgentLicense.Status.Revoked || rec.agent != yieldScout) revert SeedIncomplete();
        console2.log("licenseById(3).agent  (yield-scout):", rec.agent);
        console2.log("licenseById(3).status (2 = Revoked):", uint8(rec.status));
    }

    /// @dev Deterministic keyless address for display-only cast members and venues.
    function _tagAddr(string memory tag) internal pure returns (address) {
        return address(uint160(uint256(keccak256(bytes(tag)))));
    }

    /// @dev Top up an actor EOA from the active (deployer) broadcast when it runs low.
    function _topUp(address actor) internal {
        if (actor.balance < GAS_LOW_WATER) {
            (bool ok,) = payable(actor).call{value: GAS_TOP_UP}("");
            require(ok, "top-up failed");
        }
    }

    /// @dev Mint under the active (principal) broadcast unless the agent already has a
    ///      record. Never re-mints: a Revoked record is the demo's intended end state.
    function _mintIfAbsent(address agent, uint64 expiry, bytes32 scope, string memory name) internal {
        if (_statusOf(agent) != IAgentLicense.Status.None) {
            console2.log("mint skipped (record exists):", name);
            return;
        }
        uint256 id = license.mint(agent, expiry, scope);
        console2.log("minted", name, "licenseId", id);
    }

    /// @dev Write cap and venue under the active (principal) broadcast, skipping values
    ///      that already match live state. Only Active licenses accept policy writes.
    function _configure(address agent, uint256 cap, address venue) internal {
        if (_statusOf(agent) != IAgentLicense.Status.Active) return;
        if (policy.capPerDay(agent, usdc) != cap) policy.setCap(agent, usdc, cap);
        if (!policy.isVenueAllowed(agent, venue)) policy.setVenue(agent, venue, true);
    }

    /// @dev Current status, treating never-mapped (licenseOf reverts) as None.
    function _statusOf(address agent) internal view returns (IAgentLicense.Status) {
        try license.licenseOf(agent) returns (IAgentLicense.License memory lic) {
            return lic.status;
        } catch {
            return IAgentLicense.Status.None;
        }
    }
}
