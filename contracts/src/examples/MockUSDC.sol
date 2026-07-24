// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC — worthless 6-decimal test token for the GIWA Sepolia demo
/// @notice Exists so the DemoVault has something to move on stage (Session 04 order:
///         do not depend on third-party testnet tokens). Open mint by design: anyone
///         may mint any amount, so the token is worthless by construction and must
///         never be treated as having value. Not part of the spine's trust surface —
///         the gate caps SPEND per (agent, token, day) regardless of token supply.
contract MockUSDC is ERC20 {
    constructor() ERC20("HAETAE Test USDC", "tUSDC") {}

    /// @notice USDC-style 6 decimals.
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint `amount` (6-decimal units) to `to`. Unrestricted on purpose.
    /// @param to     Recipient.
    /// @param amount Amount to mint.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
