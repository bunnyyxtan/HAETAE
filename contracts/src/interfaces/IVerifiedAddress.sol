// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IVerifiedAddress — isolation seam between HaetaeLicense and the Dojang/EAS stack
/// @notice Implementations resolve whether an address holds a valid KYC-backed Verified Address
///         attestation. The real implementation (Phase 2) queries EAS on GIWA Sepolia.
///         Only one implementation is sanctioned (ARCHITECTURE.md §5); do not add others.
interface IVerifiedAddress {
    /// @notice Returns true if `subject` holds a valid Verified Address attestation.
    ///         Implementations must be read-only and non-reverting for any input.
    /// @param subject The address to check.
    function isVerified(address subject) external view returns (bool);
}
