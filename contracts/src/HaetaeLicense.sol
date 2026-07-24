// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721Enumerable, ERC721} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IAgentLicense} from "./interfaces/IAgentLicense.sol";
import {IVerifiedAddress} from "./interfaces/IVerifiedAddress.sol";

/// @title HaetaeLicense — soulbound agent license registry
/// @notice Implements IAgentLicense as an ERC-721 with reverting transfers (SBT model).
///         Mint is permissionless but verification-gated: the principal must hold a valid
///         Dojang Verified Address attestation. Revocation is one-way and takes effect in
///         the same block. Reference implementation for standard/ERC-agent-license.md.
contract HaetaeLicense is IAgentLicense, ERC721Enumerable, AccessControl {
    // -------------------------------------------------------------------------
    // Constants & immutables
    // -------------------------------------------------------------------------

    /// @notice Role that grants delegated revocation authority to the Sentinel.
    ///         Holders may revoke any agent's license without principal consent.
    bytes32 public constant SENTINEL_ROLE = keccak256("SENTINEL_ROLE");

    /// @notice Isolation seam to the Dojang/EAS verification stack (Phase 2 wires the real impl).
    IVerifiedAddress public immutable verifier;

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    uint256 private _nextId;

    /// @dev Maps agent address → current licenseId. Remapped on re-mint after revoke/expiry.
    mapping(address => uint256) private _agentId;

    /// @dev Full license record keyed by licenseId. Old records persist for accountability.
    mapping(uint256 => License) private _licenses;

    /// @dev Tracks whether an agent has ever been mapped (distinguishes None from zero init).
    mapping(address => bool) private _everMapped;

    // -------------------------------------------------------------------------
    // Additional errors (implementation-only; IAgentLicense errors inherited)
    // -------------------------------------------------------------------------

    /// @notice Caller is not a Dojang-verified address; cannot be a principal.
    error NotVerified(address principal);

    /// @notice agent or admin address is the zero address.
    error ZeroAddress();

    /// @notice Expiry must be strictly in the future.
    error InvalidExpiry();

    /// @notice Token transfers are permanently disabled; this is a soulbound token.
    error TransfersDisabled();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @notice Deploy the registry.
    /// @param admin    Address granted DEFAULT_ADMIN_ROLE (should be a multisig in production).
    /// @param verifier_ IVerifiedAddress implementation used to gate mint.
    constructor(address admin, IVerifiedAddress verifier_) ERC721("HAETAE Agent License", "HAETAE") {
        if (admin == address(0) || address(verifier_) == address(0)) revert ZeroAddress();
        verifier = verifier_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // -------------------------------------------------------------------------
    // Core functions
    // -------------------------------------------------------------------------

    /// @notice Mint a new license. msg.sender becomes the principal and receives the SBT.
    ///         Permissionless but gated: principal must be Dojang-verified.
    ///         Re-mint after revoke or expiry is allowed; produces a new id, remaps the agent.
    /// @param agent  Agent address to license. Must be non-zero.
    /// @param expiry Unix timestamp; must be strictly greater than block.timestamp.
    /// @param scope  Opaque scope tag stored verbatim (zero is valid).
    /// @return licenseId The newly minted token id.
    function mint(address agent, uint64 expiry, bytes32 scope) external returns (uint256 licenseId) {
        if (!verifier.isVerified(msg.sender)) revert NotVerified(msg.sender);
        if (agent == address(0)) revert ZeroAddress();
        if (expiry <= block.timestamp) revert InvalidExpiry();
        if (isLicensed(agent)) revert AlreadyLicensed(agent);

        licenseId = ++_nextId;

        // Effects before interaction: all state written before _safeMint callback (CEI).
        _licenses[licenseId] =
            License({principal: msg.sender, agent: agent, expiry: expiry, scope: scope, status: Status.Active});
        _agentId[agent] = licenseId;
        _everMapped[agent] = true;

        // Licensed is emitted before _safeMint so the standard's event always precedes
        // any receiver-callback side effects in the log stream (indexer determinism).
        emit Licensed(licenseId, msg.sender, agent, expiry, scope);
        // _safeMint triggers ERC721Receiver on msg.sender after all state is final.
        _safeMint(msg.sender, licenseId);
    }

    /// @notice Revoke an agent's license. Caller must be the principal or a SENTINEL_ROLE holder.
    ///         Takes effect immediately: isLicensed returns false in the same block.
    ///         One-way: a revoked license id can never return to Active.
    /// @param agent Agent whose license to revoke.
    function revoke(address agent) external override {
        if (!_everMapped[agent]) revert NotLicensed();
        uint256 licenseId = _agentId[agent];
        License storage lic = _licenses[licenseId];
        if (lic.status == Status.Revoked) revert AlreadyRevoked();
        if (msg.sender != lic.principal && !hasRole(SENTINEL_ROLE, msg.sender)) revert NotAuthorized();

        lic.status = Status.Revoked;
        emit Revoked(licenseId, agent, msg.sender);
    }

    // -------------------------------------------------------------------------
    // IAgentLicense views
    // -------------------------------------------------------------------------

    /// @notice Returns true iff a record exists, status == Active, and block.timestamp < expiry.
    function isLicensed(address agent) public view override returns (bool) {
        if (!_everMapped[agent]) return false;
        License storage lic = _licenses[_agentId[agent]];
        return lic.status == Status.Active && block.timestamp < lic.expiry;
    }

    /// @notice Returns the agent's current license record. Readable even after revoke/expiry.
    ///         Reverts NotLicensed() only if the agent has never been mapped.
    function licenseOf(address agent) external view override returns (License memory) {
        if (!_everMapped[agent]) revert NotLicensed();
        return _licenses[_agentId[agent]];
    }

    /// @notice Returns the raw license record for a token id. Zero-value struct
    ///         (status == None) for ids never minted; never reverts. Superseded
    ///         records remain readable by id forever — every verdict on the record.
    function licenseById(uint256 id) external view override returns (License memory) {
        return _licenses[id];
    }

    // -------------------------------------------------------------------------
    // SBT enforcement
    // -------------------------------------------------------------------------

    /// @dev Block all transfers. Mints have from == address(0) and pass through.
    ///      Burns are also blocked (no burn path this phase).
    function _update(address to, uint256 tokenId, address auth) internal override(ERC721Enumerable) returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0)) revert TransfersDisabled();
        return super._update(to, tokenId, auth);
    }

    /// @dev Approvals create a transfer precondition; disabled for the same reason.
    function approve(address, uint256) public pure override(ERC721, IERC721) {
        revert TransfersDisabled();
    }

    /// @dev Operator approvals create a transfer precondition; disabled for the same reason.
    function setApprovalForAll(address, bool) public pure override(ERC721, IERC721) {
        revert TransfersDisabled();
    }

    // -------------------------------------------------------------------------
    // Interface support
    // -------------------------------------------------------------------------

    /// @notice Supports ERC-721 (incl. Enumerable) and AccessControl interfaces.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
