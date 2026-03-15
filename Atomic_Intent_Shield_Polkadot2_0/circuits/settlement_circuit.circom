pragma circom 2.0.0;

include "./node_modules/circomlib/circuits/poseidon.circom";
include "./node_modules/circomlib/circuits/comparators.circom";

/// Settlement Circuit for PolkaShield (Polkadot ZK Dark Pool)
///
/// This circuit proves that a matched pair of intents forms a valid settlement:
/// 1. Both intents are valid (hashes match)
/// 2. Token pairs are complementary (A→B matched with B→A)
/// 3. Amounts satisfy both parties' constraints
/// 4. Settlement amounts are fair (within slippage tolerance)
/// 5. Nullifiers are correctly derived
///
/// Private Inputs:
/// - Intent A parameters (userA, tokenInA, tokenOutA, amountInA, minAmountOutA, deadlineA, saltA)
/// - Intent B parameters (userB, tokenInB, tokenOutB, amountInB, minAmountOutB, deadlineB, saltB)
///
/// Public Inputs:
/// - intentHashA: Hash commitment of intent A
/// - intentHashB: Hash commitment of intent B
/// - nullifierA: Nullifier for intent A
/// - nullifierB: Nullifier for intent B
/// - settlementAmountA: Actual amount A receives
/// - settlementAmountB: Actual amount B receives
/// - currentTime: Current unix timestamp

template SettlementCircuit() {
    // ===== Intent A private inputs =====
    signal input userA;
    signal input tokenInA;
    signal input tokenOutA;
    signal input amountInA;
    signal input minAmountOutA;
    signal input deadlineA;
    signal input saltA;

    // ===== Intent B private inputs =====
    signal input userB;
    signal input tokenInB;
    signal input tokenOutB;
    signal input amountInB;
    signal input minAmountOutB;
    signal input deadlineB;
    signal input saltB;

    // ===== Public inputs =====
    signal input intentHashA;
    signal input intentHashB;
    signal input nullifierA;
    signal input nullifierB;
    signal input settlementAmountA;
    signal input settlementAmountB;
    signal input currentTime;

    // ===== 1. Verify intent A hash =====
    component hasherA = Poseidon(7);
    hasherA.inputs[0] <== userA;
    hasherA.inputs[1] <== tokenInA;
    hasherA.inputs[2] <== tokenOutA;
    hasherA.inputs[3] <== amountInA;
    hasherA.inputs[4] <== minAmountOutA;
    hasherA.inputs[5] <== deadlineA;
    hasherA.inputs[6] <== saltA;
    hasherA.out === intentHashA;

    // ===== 2. Verify intent B hash =====
    component hasherB = Poseidon(7);
    hasherB.inputs[0] <== userB;
    hasherB.inputs[1] <== tokenInB;
    hasherB.inputs[2] <== tokenOutB;
    hasherB.inputs[3] <== amountInB;
    hasherB.inputs[4] <== minAmountOutB;
    hasherB.inputs[5] <== deadlineB;
    hasherB.inputs[6] <== saltB;
    hasherB.out === intentHashB;

    // ===== 3. Verify nullifier A =====
    component nullHasherA = Poseidon(2);
    nullHasherA.inputs[0] <== userA;
    nullHasherA.inputs[1] <== saltA;
    nullHasherA.out === nullifierA;

    // ===== 4. Verify nullifier B =====
    component nullHasherB = Poseidon(2);
    nullHasherB.inputs[0] <== userB;
    nullHasherB.inputs[1] <== saltB;
    nullHasherB.out === nullifierB;

    // ===== 5. Verify token pairs are complementary =====
    // A's input token must equal B's output token
    component tokenMatch1 = IsEqual();
    tokenMatch1.in[0] <== tokenInA;
    tokenMatch1.in[1] <== tokenOutB;
    tokenMatch1.out === 1;

    // A's output token must equal B's input token
    component tokenMatch2 = IsEqual();
    tokenMatch2.in[0] <== tokenOutA;
    tokenMatch2.in[1] <== tokenInB;
    tokenMatch2.out === 1;

    // ===== 6. Verify deadlines not expired =====
    component deadlineCheckA = LessThan(64);
    deadlineCheckA.in[0] <== currentTime;
    deadlineCheckA.in[1] <== deadlineA;
    deadlineCheckA.out === 1;

    component deadlineCheckB = LessThan(64);
    deadlineCheckB.in[0] <== currentTime;
    deadlineCheckB.in[1] <== deadlineB;
    deadlineCheckB.out === 1;

    // ===== 7. Verify settlement amounts satisfy minimum constraints =====
    // settlementAmountA >= minAmountOutA (A gets at least their minimum)
    component settleCheckA = GreaterEqThan(252);
    settleCheckA.in[0] <== settlementAmountA;
    settleCheckA.in[1] <== minAmountOutA;
    settleCheckA.out === 1;

    // settlementAmountB >= minAmountOutB (B gets at least their minimum)
    component settleCheckB = GreaterEqThan(252);
    settleCheckB.in[0] <== settlementAmountB;
    settleCheckB.in[1] <== minAmountOutB;
    settleCheckB.out === 1;

    // ===== 8. Verify settlement amounts don't exceed offered amounts =====
    // settlementAmountA <= amountInB (A can't receive more than B offers)
    component maxCheckA = LessEqThan(252);
    maxCheckA.in[0] <== settlementAmountA;
    maxCheckA.in[1] <== amountInB;
    maxCheckA.out === 1;

    // settlementAmountB <= amountInA (B can't receive more than A offers)
    component maxCheckB = LessEqThan(252);
    maxCheckB.in[0] <== settlementAmountB;
    maxCheckB.in[1] <== amountInA;
    maxCheckB.out === 1;

    // ===== 9. Verify settlement amounts are positive =====
    component settlePositiveA = GreaterThan(252);
    settlePositiveA.in[0] <== settlementAmountA;
    settlePositiveA.in[1] <== 0;
    settlePositiveA.out === 1;

    component settlePositiveB = GreaterThan(252);
    settlePositiveB.in[0] <== settlementAmountB;
    settlePositiveB.in[1] <== 0;
    settlePositiveB.out === 1;

    // ===== 10. Verify users are different =====
    component usersDifferent = IsEqual();
    usersDifferent.in[0] <== userA;
    usersDifferent.in[1] <== userB;
    usersDifferent.out === 0;
}

component main {public [intentHashA, intentHashB, nullifierA, nullifierB, settlementAmountA, settlementAmountB, currentTime]} = SettlementCircuit();
