// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20Minimal} from "./IERC20Minimal.sol";
import {IStakeManager} from "./IStakeManager.sol";

contract StakeManager is IStakeManager {
    error InsufficientStake(address account, uint256 requested, uint256 available);
    error InvalidAmount();
    error TokenTransferFailed();
    error Unauthorized();
    error ZeroAddressAsset();
    error ZeroAddressOperator();
    error ZeroAddressRecipient();

    event OperatorUpdated(address indexed operator, bool enabled);
    event StakeReduced(address indexed account, uint256 amount, uint256 newBalance);

    address public immutable owner;
    IERC20Minimal public immutable stakingAsset;

    mapping(address => bool) public operators;
    mapping(address => uint256) private stakes;

    constructor(address stakingAsset_) {
        if (stakingAsset_ == address(0)) revert ZeroAddressAsset();

        owner = msg.sender;
        stakingAsset = IERC20Minimal(stakingAsset_);
        operators[msg.sender] = true;

        emit OperatorUpdated(msg.sender, true);
    }

    function setOperator(address operator, bool enabled) external {
        if (msg.sender != owner) revert Unauthorized();
        if (operator == address(0)) revert ZeroAddressOperator();

        operators[operator] = enabled;
        emit OperatorUpdated(operator, enabled);
    }

    function stake(uint256 amount) external override {
        if (amount == 0) revert InvalidAmount();

        if (!stakingAsset.transferFrom(msg.sender, address(this), amount)) {
            revert TokenTransferFailed();
        }

        uint256 newBalance = stakes[msg.sender] + amount;
        stakes[msg.sender] = newBalance;

        emit StakeDeposited(msg.sender, amount, newBalance);
    }

    function reduceStake(address account, uint256 amount, address recipient) external {
        if (!operators[msg.sender]) revert Unauthorized();
        if (amount == 0) revert InvalidAmount();
        if (recipient == address(0)) revert ZeroAddressRecipient();

        uint256 currentStake = stakes[account];
        if (currentStake < amount) revert InsufficientStake(account, amount, currentStake);

        uint256 newBalance = currentStake - amount;
        stakes[account] = newBalance;

        if (!stakingAsset.transfer(recipient, amount)) {
            revert TokenTransferFailed();
        }

        emit StakeReduced(account, amount, newBalance);
    }

    function getStakeOf(address account) external view override returns (uint256) {
        return stakes[account];
    }
}
