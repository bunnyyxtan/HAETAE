// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {HaetaeLicense} from "../src/HaetaeLicense.sol";
import {SentinelAuthority} from "../src/sentinel/SentinelAuthority.sol";
import {DemoVault} from "../src/examples/DemoVault.sol";
import {IAgentLicense} from "../src/interfaces/IAgentLicense.sol";
import {IHaetaePolicy} from "../src/interfaces/IHaetaePolicy.sol";

/// @notice Plays the full demo beat arc against a FRESH rehearsal agent (Session 06,
///         standing ruling: live demos re-run beats through DemoVault via the seed
///         script path — fresh agent, fresh day budget — the seeded cast HT-0001..0005
///         is the museum exhibit and is never touched). One run = one licensed agent
///         walked through the whole story:
///         R1 legal trade → R2 cap refusal → R3 venue refusal (the injection beat) →
///         R4 sentinel flag + revoke → R5 ghost refusal.
///
///         Freshness: REHEARSAL_AGENT_PK is keccak-derived new for every run (S04
///         standing rule: never anvil defaults, never keys in files/logs/chat/argv —
///         env only). A fresh agent means a fresh UTC day budget, so R1/R2 land
///         deterministically regardless of what earlier rehearsals spent.
///
///         Idempotency: guards mirror Seed.s.sol. Re-running with the SAME key is
///         safe — mint is skipped for an existing record, and the beat section is
///         anchored on the rehearsal agent's status (once Revoked, beats skip).
///
///         Museum safety is ENFORCED, not assumed: before any broadcast the script
///         reverts if the rehearsal key derives a core cast address (CastCollision)
///         or an address holding any non-"rehearsal"-scoped license (MuseumAgent).
///         Beyond the guard, every write is keyed to the rehearsal agent's address;
///         the seeded cast, its policy records, and its day budgets are never
///         referenced.
///
///         Environment: DEPLOYER_PK, PRINCIPAL_PK, SENTINEL_PK, REHEARSAL_AGENT_PK
///         (secrets; in-memory only, never logged) and public addresses LICENSE_ADDR,
///         POLICY_ADDR, SENTINEL_AUTH_ADDR, VAULT_ADDR, USDC_ADDR.
///
/// @dev Cast lives in script-contract state variables for the same stack-depth reason
///      documented on Seed.s.sol.
contract Rehearsal is Script {
    /// @notice Reverts if the script is invoked on the wrong chain.
    error WrongChain();

    /// @notice Final state check failed: the rehearsal agent is not Revoked.
    error RehearsalIncomplete();

    /// @notice REHEARSAL_AGENT_PK resolved to a core cast address (principal /
    ///         sentinel / deployer) — refusing to run.
    error CastCollision();

    /// @notice REHEARSAL_AGENT_PK resolved to an address holding a non-rehearsal
    ///         license (the museum cast, the tester's ghost, or any other agent) —
    ///         refusing to run.
    error MuseumAgent();

    uint256 internal constant GIWA_SEPOLIA = 91342;

    /// @dev Gas treasury thresholds, sized as in Seed.s.sol.
    uint256 internal constant GAS_LOW_WATER = 0.002 ether;
    uint256 internal constant GAS_TOP_UP = 0.003 ether;

    /// @dev Rehearsal policy: small cap so the whole arc spends little vault tUSDC.
    ///      R1 300 leaves 1_700 remaining, so R2's 1_900 refuses on cap — the refusal
    ///      is provoked by arithmetic, not by luck.
    uint256 internal constant REHEARSAL_CAP = 2_000e6;

    /// @dev keccak256 fingerprint of the sentinel's off-chain reason document.
    ///      Preimage is public demo material: "HAETAE demo S06 rehearsal: scripted
    ///      sentinel verdict on the rehearsal agent; reason doc r1".
    bytes32 internal constant REASON_HASH =
        keccak256("HAETAE demo S06 rehearsal: scripted sentinel verdict on the rehearsal agent; reason doc r1");

    // --- Signing keys (secrets; in-memory only, never logged) --------------------
    uint256 internal deployerPk;
    uint256 internal principalPk;
    uint256 internal sentinelPk;
    uint256 internal rehearsalAgentPk;

    // --- Deployed spine -----------------------------------------------------------
    HaetaeLicense internal license;
    IHaetaePolicy internal policy;
    SentinelAuthority internal sentinelAuth;
    DemoVault internal vault;
    address internal usdc;

    // --- The rehearsal cast --------------------------------------------------------
    address internal principal;
    address internal sentinel;
    address internal deployer;
    address internal rehearsalAgent;

    // --- Venues (the seeded keyless sinks; same tag derivation as Seed.s.sol). -----
    address internal dexAlpha;
    address internal attackerSink;

    function run() external {
        if (block.chainid != GIWA_SEPOLIA) revert WrongChain();
        _load();
        _guardMuseum();
        _phaseGas();
        _phaseLicenseAndPolicy();
        _phaseBeats();
        _assertFinalState();
    }

    /// @dev Load keys, spine addresses, and the cast into state.
    function _load() internal {
        deployerPk = vm.envUint("DEPLOYER_PK");
        principalPk = vm.envUint("PRINCIPAL_PK");
        sentinelPk = vm.envUint("SENTINEL_PK");
        rehearsalAgentPk = vm.envUint("REHEARSAL_AGENT_PK");

        license = HaetaeLicense(vm.envAddress("LICENSE_ADDR"));
        policy = IHaetaePolicy(vm.envAddress("POLICY_ADDR"));
        sentinelAuth = SentinelAuthority(vm.envAddress("SENTINEL_AUTH_ADDR"));
        vault = DemoVault(vm.envAddress("VAULT_ADDR"));
        usdc = vm.envAddress("USDC_ADDR");

        principal = vm.addr(principalPk);
        sentinel = vm.addr(sentinelPk);
        deployer = vm.addr(deployerPk);
        rehearsalAgent = vm.addr(rehearsalAgentPk);

        dexAlpha = _tagAddr("haetae.demo.venue.dex-alpha");
        attackerSink = _tagAddr("haetae.demo.venue.attacker-sink");

        console2.log("rehearsal agent:", rehearsalAgent);
    }

    /// @dev Standing ruling (S06): the seeded cast is the museum exhibit — this
    ///      script must be UNABLE to touch it, even if REHEARSAL_AGENT_PK is
    ///      mis-set to a cast key (the cast keys live in the same environment).
    ///      Two gates, checked before any broadcast:
    ///      1. the rehearsal key must not derive a core cast address;
    ///      2. a pre-existing license on the derived address must carry the
    ///         "rehearsal" scope — which permits idempotent re-runs of a prior
    ///         rehearsal agent and nothing else.
    function _guardMuseum() internal view {
        if (rehearsalAgent == principal || rehearsalAgent == sentinel || rehearsalAgent == deployer) {
            revert CastCollision();
        }
        try license.licenseOf(rehearsalAgent) returns (IAgentLicense.License memory lic) {
            if (lic.scope != "rehearsal") revert MuseumAgent();
        } catch {
            // no record — a fresh agent, the intended case
        }
    }

    /// @dev Phase 0: gas treasury — deployer tops up the acting EOAs.
    function _phaseGas() internal {
        vm.startBroadcast(deployerPk);
        _topUp(principal);
        _topUp(sentinel);
        _topUp(rehearsalAgent);
        vm.stopBroadcast();
    }

    /// @dev Phase 1: license + policy for the rehearsal agent, written by the
    ///      principal. Scope "rehearsal" keeps the row self-describing in the console.
    function _phaseLicenseAndPolicy() internal {
        uint64 expiry = uint64(block.timestamp + 30 days);
        vm.startBroadcast(principalPk);
        if (_statusOf(rehearsalAgent) == IAgentLicense.Status.None) {
            uint256 id = license.mint(rehearsalAgent, expiry, "rehearsal");
            console2.log("minted rehearsal agent, licenseId", id);
        } else {
            console2.log("mint skipped (record exists)");
        }
        if (_statusOf(rehearsalAgent) == IAgentLicense.Status.Active) {
            if (policy.capPerDay(rehearsalAgent, usdc) != REHEARSAL_CAP) {
                policy.setCap(rehearsalAgent, usdc, REHEARSAL_CAP);
            }
            if (!policy.isVenueAllowed(rehearsalAgent, dexAlpha)) {
                policy.setVenue(rehearsalAgent, dexAlpha, true);
            }
        }
        vm.stopBroadcast();
    }

    /// @dev Phase 2: the beats, anchored on the rehearsal agent's status.
    function _phaseBeats() internal {
        if (_statusOf(rehearsalAgent) == IAgentLicense.Status.Revoked) {
            console2.log("beats already played (agent Revoked); skipping");
            return;
        }

        console2.log("R1 legal trade: rehearsal agent -> dex-alpha, 300 tUSDC");
        vm.startBroadcast(rehearsalAgentPk);
        vault.execute(dexAlpha, usdc, 300e6);
        vm.stopBroadcast();

        console2.log("R2 cap refusal: rehearsal agent -> dex-alpha, 1900 tUSDC (cap 2000)");
        vm.startBroadcast(rehearsalAgentPk);
        vault.execute(dexAlpha, usdc, 1_900e6);
        vm.stopBroadcast();

        console2.log("R3 venue refusal (injection): rehearsal agent -> attacker-sink, 100 tUSDC");
        vm.startBroadcast(rehearsalAgentPk);
        vault.execute(attackerSink, usdc, 100e6);
        vm.stopBroadcast();

        console2.log("R4 sentinel verdict: flag rehearsal agent, revoke its license");
        vm.startBroadcast(sentinelPk);
        sentinelAuth.flag(rehearsalAgent, REASON_HASH);
        vm.stopBroadcast();

        console2.log("R5 ghost refusal: revoked rehearsal agent -> dex-alpha, 50 tUSDC");
        vm.startBroadcast(rehearsalAgentPk);
        vault.execute(dexAlpha, usdc, 50e6);
        vm.stopBroadcast();
    }

    /// @dev Final state: the rehearsal agent must end Revoked.
    function _assertFinalState() internal view {
        if (_statusOf(rehearsalAgent) != IAgentLicense.Status.Revoked) revert RehearsalIncomplete();
        console2.log("rehearsal complete: agent Revoked", rehearsalAgent);
    }

    /// @dev Deterministic keyless venue address (same derivation as Seed.s.sol).
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

    /// @dev Current status, treating never-mapped (licenseOf reverts) as None.
    function _statusOf(address agent) internal view returns (IAgentLicense.Status) {
        try license.licenseOf(agent) returns (IAgentLicense.License memory lic) {
            return lic.status;
        } catch {
            return IAgentLicense.Status.None;
        }
    }
}
