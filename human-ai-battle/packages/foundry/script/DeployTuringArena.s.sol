// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import "../contracts/TuringArena.sol";

contract DeployTuringArena is ScaffoldETHDeploy {
    function run() external ScaffoldEthDeployerRunner {
        // Deploy TuringArena with deployer as treasury and operator
        // Local dev: deployer acts as operator
        // Production: use chat-server's operator key (set via OPERATOR_ADDRESS env or setOperator later)
        address operatorAddress = vm.envOr("OPERATOR_ADDRESS", deployer);
        TuringArena arena = new TuringArena(deployer, operatorAddress);
        deployments.push(Deployment({ name: "TuringArena", addr: address(arena) }));
    }
}
