// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IVerifiedAddress} from "../interfaces/IVerifiedAddress.sol";

/// @title DemoVerifier — Phase-2 stand-in verifier: every address passes
/// @notice Test-double promoted to a deployable contract by the Session 04 order so the
///         spine can go live on GIWA Sepolia before the Dojang/EAS integration lands.
///         REPLACED BY THE DOJANG ADAPTER IN A LATER PHASE. This contract carries no
///         verification semantics whatsoever: with it wired, HaetaeLicense.mint is
///         effectively permissionless. Acceptable for the testnet demo window only;
///         it must never gate anything of value. IVerifiedAddress names the EAS-backed
///         implementation as the sanctioned one — this stand-in is order-authorized
///         (Session 04, Stage A) as the explicit temporary exception.
contract DemoVerifier is IVerifiedAddress {
    /// @inheritdoc IVerifiedAddress
    function isVerified(address) external pure returns (bool) {
        return true;
    }
}
