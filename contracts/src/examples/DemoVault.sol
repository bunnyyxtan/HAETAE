// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IHaetaeGate} from "../interfaces/IHaetaeGate.sol";

/// @title DemoVault — the theater stage: one gated action, every outcome on the record
/// @notice Deliberately thin. The vault shows the rail working — it is not a product:
///         no owner, no withdraw, no strategy. It holds test USDC, and execute() either
///         moves funds to a venue past the gate or emits the refusal verdict. Defense
///         chain: unknown venues die at VenueNotAllowed, unknown tokens at CapExceeded
///         (no cap configured = zero allowance), so the vault itself needs no allowlists.
contract DemoVault {
    using SafeERC20 for IERC20;

    /// @notice The checkpoint every execute() passes or dies at.
    IHaetaeGate public immutable gate;

    /// @notice Emitted when the gate passed and funds moved.
    /// @param agent  Agent that traded (msg.sender).
    /// @param venue  Venue that received the funds.
    /// @param token  Token moved.
    /// @param amount Amount moved.
    event TradeExecuted(address indexed agent, address indexed venue, address indexed token, uint256 amount);

    /// @notice Emitted when the gate refused. The trade does not revert — the refusal IS
    ///         the demo's product, surfaced with the gate's verdict selector.
    /// @param agent    Agent that attempted the trade (msg.sender).
    /// @param venue    Venue the trade targeted.
    /// @param token    Token requested.
    /// @param amount   Amount requested.
    /// @param selector Verdict: the 4-byte custom-error selector the gate reverted with
    ///        (zero if the revert carried no data, which no HaetaeGate verdict does).
    event TradeRefused(
        address indexed agent, address indexed venue, address indexed token, uint256 amount, bytes4 selector
    );

    /// @notice Constructor gate argument is the zero address.
    error ZeroAddress();

    /// @notice Deploy the stage, permanently pointed at its checkpoint.
    /// @param gate_ The HaetaeGate this vault submits every trade to.
    constructor(IHaetaeGate gate_) {
        if (address(gate_) == address(0)) revert ZeroAddress();
        gate = gate_;
    }

    /// @notice Execute a trade as the calling agent. msg.sender IS the agent: the
    ///         transaction signature is the agent's signing act (S03 ruling). Upgrade
    ///         path, deferred with the AA phase: EIP-712 signed intents submitted by
    ///         relayers. On a passing check the spend is already recorded, so a transfer
    ///         failure reverts the whole transaction — no spend without a trade.
    /// @param venue  Venue to send funds to.
    /// @param token  Token to move from the vault.
    /// @param amount Amount to move.
    function execute(address venue, address token, uint256 amount) external {
        try gate.check(msg.sender, venue, token, amount) {
            IERC20(token).safeTransfer(venue, amount);
            emit TradeExecuted(msg.sender, venue, token, amount);
        } catch (bytes memory reason) {
            bytes4 selector;
            if (reason.length >= 4) {
                // First word of the revert payload; ABI decoding zero-pads it, and the
                // bytes4 truncation keeps exactly the selector.
                assembly ("memory-safe") {
                    selector := mload(add(reason, 0x20))
                }
            }
            emit TradeRefused(msg.sender, venue, token, amount, selector);
        }
    }
}
