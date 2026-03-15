// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal mock verifier used for Track 1 migration demo.
contract IntentVerifierMock {
    bool public forceResult = true;

    function setForceResult(bool value) external {
        forceResult = value;
    }

    function verifyIntentProof(
        bytes32,
        bytes32,
        bytes calldata,
        bytes calldata
    ) external view returns (bool) {
        return forceResult;
    }
}
