const { buildPoseidon } = require("circomlibjs");
const snarkjs = require("snarkjs");
const path = require("path");
const assert = require("assert");

describe("SettlementCircuit", function () {
    this.timeout(60000);

    let poseidon;
    let F;

    before(async () => {
        poseidon = await buildPoseidon();
        F = poseidon.F;
    });

    function poseidonHash(inputs) {
        return F.toObject(poseidon(inputs));
    }

    function createValidSettlement() {
        const userA = BigInt("111111111111111111");
        const tokenInA = BigInt("1001"); // Token A
        const tokenOutA = BigInt("1002"); // Token B
        const amountInA = BigInt("1000000000000000000"); // 1e18
        const minAmountOutA = BigInt("950000000000000000"); // 0.95e18
        const deadlineA = BigInt(Math.floor(Date.now() / 1000) + 3600);
        const saltA = BigInt("999999999");

        const userB = BigInt("222222222222222222");
        const tokenInB = BigInt("1002"); // Token B (complementary)
        const tokenOutB = BigInt("1001"); // Token A (complementary)
        const amountInB = BigInt("960000000000000000"); // 0.96e18
        const minAmountOutB = BigInt("900000000000000000"); // 0.9e18
        const deadlineB = BigInt(Math.floor(Date.now() / 1000) + 3600);
        const saltB = BigInt("888888888");

        const intentHashA = poseidonHash([
            userA, tokenInA, tokenOutA, amountInA, minAmountOutA, deadlineA, saltA,
        ]);
        const intentHashB = poseidonHash([
            userB, tokenInB, tokenOutB, amountInB, minAmountOutB, deadlineB, saltB,
        ]);

        const nullifierA = poseidonHash([userA, saltA]);
        const nullifierB = poseidonHash([userB, saltB]);

        // Settlement: A receives 0.96e18 of tokenB, B receives 0.95e18 of tokenA
        const settlementAmountA = BigInt("960000000000000000");
        const settlementAmountB = BigInt("950000000000000000");

        const currentTime = BigInt(Math.floor(Date.now() / 1000));

        return {
            // Intent A
            userA: userA.toString(),
            tokenInA: tokenInA.toString(),
            tokenOutA: tokenOutA.toString(),
            amountInA: amountInA.toString(),
            minAmountOutA: minAmountOutA.toString(),
            deadlineA: deadlineA.toString(),
            saltA: saltA.toString(),
            // Intent B
            userB: userB.toString(),
            tokenInB: tokenInB.toString(),
            tokenOutB: tokenOutB.toString(),
            amountInB: amountInB.toString(),
            minAmountOutB: minAmountOutB.toString(),
            deadlineB: deadlineB.toString(),
            saltB: saltB.toString(),
            // Public
            intentHashA: intentHashA.toString(),
            intentHashB: intentHashB.toString(),
            nullifierA: nullifierA.toString(),
            nullifierB: nullifierB.toString(),
            settlementAmountA: settlementAmountA.toString(),
            settlementAmountB: settlementAmountB.toString(),
            currentTime: currentTime.toString(),
        };
    }

    it("should generate a valid settlement proof", async () => {
        const input = createValidSettlement();

        const wasmPath = path.join(__dirname, "../build/settlement_circuit_js/settlement_circuit.wasm");
        const zkeyPath = path.join(__dirname, "../build/settlement_circuit_final.zkey");

        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            input,
            wasmPath,
            zkeyPath
        );

        assert(proof, "Proof should be generated");
        assert(publicSignals, "Public signals should be returned");
        assert.strictEqual(publicSignals.length, 7, "Should have 7 public signals");

        // Verify
        const vkPath = path.join(__dirname, "../build/settlement_circuit_vk.json");
        const vk = require(vkPath);
        const valid = await snarkjs.groth16.verify(vk, publicSignals, proof);
        assert(valid, "Settlement proof should be valid");
    });

    it("should fail with non-complementary token pairs", async () => {
        const input = createValidSettlement();
        // Break complementarity: B trades same direction as A
        const userB = BigInt(input.userB);
        const tokenInB = BigInt("1001"); // Same as A's tokenIn — not complementary
        const tokenOutB = BigInt("1002");
        const amountInB = BigInt(input.amountInB);
        const minAmountOutB = BigInt(input.minAmountOutB);
        const deadlineB = BigInt(input.deadlineB);
        const saltB = BigInt(input.saltB);

        input.tokenInB = tokenInB.toString();
        input.tokenOutB = tokenOutB.toString();
        input.intentHashB = poseidonHash([
            userB, tokenInB, tokenOutB, amountInB, minAmountOutB, deadlineB, saltB,
        ]).toString();

        const wasmPath = path.join(__dirname, "../build/settlement_circuit_js/settlement_circuit.wasm");
        const zkeyPath = path.join(__dirname, "../build/settlement_circuit_final.zkey");

        try {
            await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
            assert.fail("Should have thrown an error");
        } catch (e) {
            assert(e, "Should throw on non-complementary pairs");
        }
    });

    it("should fail when settlement amount below minimum", async () => {
        const input = createValidSettlement();
        // Set settlement too low for A
        input.settlementAmountA = "1"; // Way below minAmountOutA

        const wasmPath = path.join(__dirname, "../build/settlement_circuit_js/settlement_circuit.wasm");
        const zkeyPath = path.join(__dirname, "../build/settlement_circuit_final.zkey");

        try {
            await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
            assert.fail("Should have thrown an error");
        } catch (e) {
            assert(e, "Should throw when settlement below minimum");
        }
    });

    it("should fail when settlement exceeds offered amount", async () => {
        const input = createValidSettlement();
        // A receives more than B offers
        input.settlementAmountA = "9999999999999999999999";

        const wasmPath = path.join(__dirname, "../build/settlement_circuit_js/settlement_circuit.wasm");
        const zkeyPath = path.join(__dirname, "../build/settlement_circuit_final.zkey");

        try {
            await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
            assert.fail("Should have thrown an error");
        } catch (e) {
            assert(e, "Should throw when settlement exceeds offer");
        }
    });

    it("should fail when same user on both sides", async () => {
        const input = createValidSettlement();
        // Same user for both intents
        const user = BigInt(input.userA);
        const tokenInB = BigInt(input.tokenInB);
        const tokenOutB = BigInt(input.tokenOutB);
        const amountInB = BigInt(input.amountInB);
        const minAmountOutB = BigInt(input.minAmountOutB);
        const deadlineB = BigInt(input.deadlineB);
        const saltB = BigInt(input.saltB);

        input.userB = input.userA;
        input.intentHashB = poseidonHash([
            user, tokenInB, tokenOutB, amountInB, minAmountOutB, deadlineB, saltB,
        ]).toString();
        input.nullifierB = poseidonHash([user, saltB]).toString();

        const wasmPath = path.join(__dirname, "../build/settlement_circuit_js/settlement_circuit.wasm");
        const zkeyPath = path.join(__dirname, "../build/settlement_circuit_final.zkey");

        try {
            await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
            assert.fail("Should have thrown an error");
        } catch (e) {
            assert(e, "Should throw when same user on both sides");
        }
    });
});
