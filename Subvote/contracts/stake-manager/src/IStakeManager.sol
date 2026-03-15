// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IStakeManager {
    event StakeDeposited(address indexed account, uint256 amount, uint256 newBalance);

    function stake(uint256 amount) external;

    function getStakeOf(address account) external view returns (uint256);
}
