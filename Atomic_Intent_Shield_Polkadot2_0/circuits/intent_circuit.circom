pragma circom 2.0.0;

include "./node_modules/circomlib/circuits/poseidon.circom";
include "./node_modules/circomlib/circuits/comparators.circom";
include "./node_modules/circomlib/circuits/mux1.circom";

/// Intent Circuit for PolkaShield (Polkadot ZK Dark Pool)
///
/// Identical to StarkShield's intent circuit — ZK proofs are chain-agnostic.
///
/// This circuit proves that:
/// 1. The intent parameters match the public commitment (Poseidon hash)
/// 2. The nullifier is correctly derived (prevents double-spending)
/// 3. The trade deadline has not expired
/// 4. The amounts are valid (> 0)
/// 5. Token in ≠ Token out
/// 6. Balance proof is non-zero (simplified)
/// 7. Approval proof is non-zero (simplified)
///
/// Private Inputs:
/// - user: User's public key (encoded as field element from Substrate AccountId)
/// - tokenIn: Input token address (encoded)
/// - tokenOut: Output token address (encoded)
/// - amountIn: Amount to trade
/// - minAmountOut: Minimum acceptable output
/// - deadline: Unix timestamp when intent expires
/// - salt: Random salt for uniqueness
/// - balanceProof[4]: Merkle proof of token balance
/// - approvalProof[4]: Merkle proof of contract approval
///
/// Public Inputs:
/// - intentHash: Poseidon(user, tokenIn, tokenOut, amountIn, minAmountOut, deadline, salt)
/// - nullifier: Poseidon(user, salt)
/// - currentTime: Current unix timestamp

template IntentCircuit() {
    // Private inputs
    signal input user;
    signal input tokenIn;
    signal input tokenOut;
    signal input amountIn;
    signal input minAmountOut;
    signal input deadline;
    signal input salt;
    signal input balanceProof[4];
    signal input approvalProof[4];

    // Public inputs
    signal input intentHash;
    signal input nullifier;
    signal input currentTime;

    // 1. Verify intent hash is correct
    // intentHash = Poseidon(user, tokenIn, tokenOut, amountIn, minAmountOut, deadline, salt)
    component hasher = Poseidon(7);
    hasher.inputs[0] <== user;
    hasher.inputs[1] <== tokenIn;
    hasher.inputs[2] <== tokenOut;
    hasher.inputs[3] <== amountIn;
    hasher.inputs[4] <== minAmountOut;
    hasher.inputs[5] <== deadline;
    hasher.inputs[6] <== salt;

    // Constraint: Computed hash must match public intentHash
    hasher.out === intentHash;

    // 2. Verify nullifier is correct
    // nullifier = Poseidon(user, salt)
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== user;
    nullifierHasher.inputs[1] <== salt;

    // Constraint: Computed nullifier must match public nullifier
    nullifierHasher.out === nullifier;

    // 3. Verify deadline has not expired
    component timeCheck = LessThan(64);
    timeCheck.in[0] <== currentTime;
    timeCheck.in[1] <== deadline;

    // Constraint: currentTime must be less than deadline
    timeCheck.out === 1;

    // 4. Verify amountIn > 0
    component amountCheck = GreaterThan(252);
    amountCheck.in[0] <== amountIn;
    amountCheck.in[1] <== 0;

    // Constraint: amountIn must be greater than 0
    amountCheck.out === 1;

    // 5. Verify minAmountOut > 0
    component minAmountCheck = GreaterThan(252);
    minAmountCheck.in[0] <== minAmountOut;
    minAmountCheck.in[1] <== 0;

    // Constraint: minAmountOut must be greater than 0
    minAmountCheck.out === 1;

    // 6. Verify balance proof (simplified — production uses full Merkle proof)
    signal balanceSum;
    balanceSum <== balanceProof[0] + balanceProof[1] + balanceProof[2] + balanceProof[3];

    component balanceValid = GreaterThan(252);
    balanceValid.in[0] <== balanceSum;
    balanceValid.in[1] <== 0;
    balanceValid.out === 1;

    // 7. Verify approval proof (simplified)
    signal approvalSum;
    approvalSum <== approvalProof[0] + approvalProof[1] + approvalProof[2] + approvalProof[3];

    component approvalValid = GreaterThan(252);
    approvalValid.in[0] <== approvalSum;
    approvalValid.in[1] <== 0;
    approvalValid.out === 1;

    // 8. Verify tokens are different
    component tokensDifferent = IsEqual();
    tokensDifferent.in[0] <== tokenIn;
    tokensDifferent.in[1] <== tokenOut;

    // Constraint: tokenIn must NOT equal tokenOut
    tokensDifferent.out === 0;
}

component main {public [intentHash, nullifier, currentTime]} = IntentCircuit();
