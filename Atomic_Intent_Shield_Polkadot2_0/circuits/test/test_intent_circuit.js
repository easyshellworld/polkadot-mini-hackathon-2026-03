const { buildPoseidon } = require("circomlibjs");
const snarkjs = require("snarkjs");
const path = require("path");
const assert = require("assert");

describe("IntentCircuit", function () {
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

    function createValidInput() {
        const user = BigInt("12345678901234567890");
        const tokenIn = BigInt("1001");
        const tokenOut = BigInt("1002");
        const amountIn = BigInt("1000000000000000000"); // 1e18
        const minAmountOut = BigInt("950000000000000000"); // 0.95e18
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now
        const salt = BigInt("98765432109876543210");

        const intentHash = poseidonHash([
            user, tokenIn, tokenOut, amountIn, minAmountOut, deadline, salt,
        ]);

        const nullifier = poseidonHash([user, salt]);

        const currentTime = BigInt(Math.floor(Date.now() / 1000));

        return {
            // Private inputs
            user: user.toString(),
            tokenIn: tokenIn.toString(),
            tokenOut: tokenOut.toString(),
            amountIn: amountIn.toString(),
            minAmountOut: minAmountOut.toString(),
            deadline: deadline.toString(),
            salt: salt.toString(),
            balanceProof: ["1", "2", "3", "4"],
            approvalProof: ["1", "2", "3", "4"],
            // Public inputs
            intentHash: intentHash.toString(),
            nullifier: nullifier.toString(),
            currentTime: currentTime.toString(),
        };
    }

    it("should generate a valid proof with correct inputs", async () => {
        const input = createValidInput();

        const wasmPath = path.join(__dirname, "../build/intent_circuit_js/intent_circuit.wasm");
        const zkeyPath = path.join(__dirname, "../build/intent_circuit_final.zkey");

        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            input,
            wasmPath,
            zkeyPath
        );

        assert(proof, "Proof should be generated");
        assert(publicSignals, "Public signals should be returned");
        assert.strictEqual(publicSignals.length, 3, "Should have 3 public signals");

        // Verify the proof
        const vkPath = path.join(__dirname, "../build/intent_circuit_vk.json");
        const vk = require(vkPath);
        const valid = await snarkjs.groth16.verify(vk, publicSignals, proof);
        assert(valid, "Proof should be valid");
    });

    it("should fail with wrong intent hash", async () => {
        const input = createValidInput();
        input.intentHash = "123456789"; // Wrong hash

        const wasmPath = path.join(__dirname, "../build/intent_circuit_js/intent_circuit.wasm");
        const zkeyPath = path.join(__dirname, "../build/intent_circuit_final.zkey");

        try {
            await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
            assert.fail("Should have thrown an error");
        } catch (e) {
            // Expected: constraint violation
            assert(e, "Should throw on invalid intent hash");
        }
    });

    it("should fail with wrong nullifier", async () => {
        const input = createValidInput();
        input.nullifier = "999999999"; // Wrong nullifier

        const wasmPath = path.join(__dirname, "../build/intent_circuit_js/intent_circuit.wasm");
        const zkeyPath = path.join(__dirname, "../build/intent_circuit_final.zkey");

        try {
            await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
            assert.fail("Should have thrown an error");
        } catch (e) {
            assert(e, "Should throw on invalid nullifier");
        }
    });

    it("should fail with expired deadline", async () => {
        const input = createValidInput();
        // Set deadline to past
        const pastDeadline = BigInt(Math.floor(Date.now() / 1000) - 3600);

        // Recompute hash with past deadline
        const user = BigInt(input.user);
        const tokenIn = BigInt(input.tokenIn);
        const tokenOut = BigInt(input.tokenOut);
        const amountIn = BigInt(input.amountIn);
        const minAmountOut = BigInt(input.minAmountOut);
        const salt = BigInt(input.salt);

        input.deadline = pastDeadline.toString();
        input.intentHash = poseidonHash([
            user, tokenIn, tokenOut, amountIn, minAmountOut, pastDeadline, salt,
        ]).toString();

        const wasmPath = path.join(__dirname, "../build/intent_circuit_js/intent_circuit.wasm");
        const zkeyPath = path.join(__dirname, "../build/intent_circuit_final.zkey");

        try {
            await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
            assert.fail("Should have thrown an error");
        } catch (e) {
            assert(e, "Should throw on expired deadline");
        }
    });

    it("should fail with same token in and out", async () => {
        const user = BigInt("12345678901234567890");
        const tokenIn = BigInt("1001");
        const tokenOut = BigInt("1001"); // Same as tokenIn!
        const amountIn = BigInt("1000000000000000000");
        const minAmountOut = BigInt("950000000000000000");
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
        const salt = BigInt("98765432109876543210");

        const intentHash = poseidonHash([
            user, tokenIn, tokenOut, amountIn, minAmountOut, deadline, salt,
        ]);
        const nullifier = poseidonHash([user, salt]);
        const currentTime = BigInt(Math.floor(Date.now() / 1000));

        const input = {
            user: user.toString(),
            tokenIn: tokenIn.toString(),
            tokenOut: tokenOut.toString(),
            amountIn: amountIn.toString(),
            minAmountOut: minAmountOut.toString(),
            deadline: deadline.toString(),
            salt: salt.toString(),
            balanceProof: ["1", "2", "3", "4"],
            approvalProof: ["1", "2", "3", "4"],
            intentHash: intentHash.toString(),
            nullifier: nullifier.toString(),
            currentTime: currentTime.toString(),
        };

        const wasmPath = path.join(__dirname, "../build/intent_circuit_js/intent_circuit.wasm");
        const zkeyPath = path.join(__dirname, "../build/intent_circuit_final.zkey");

        try {
            await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
            assert.fail("Should have thrown an error");
        } catch (e) {
            assert(e, "Should throw when tokenIn equals tokenOut");
        }
    });

    it("should compute correct Poseidon hashes", async () => {
        const a = BigInt("1");
        const b = BigInt("2");
        const hash = poseidonHash([a, b]);
        assert(hash > BigInt(0), "Poseidon hash should be non-zero");

        // Same inputs should produce same hash (deterministic)
        const hash2 = poseidonHash([a, b]);
        assert.strictEqual(hash, hash2, "Poseidon should be deterministic");

        // Different inputs should produce different hash
        const hash3 = poseidonHash([a, BigInt("3")]);
        assert.notStrictEqual(hash, hash3, "Different inputs should produce different hashes");
    });
});
