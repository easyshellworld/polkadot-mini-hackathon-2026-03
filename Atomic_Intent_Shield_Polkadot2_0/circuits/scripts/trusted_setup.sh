#!/bin/bash
set -e

# ============================================================
# PolkaShield — Trusted Setup Script
# Performs Powers of Tau ceremony + Phase 2 for both circuits
# ============================================================

CIRCUIT_NAME=${1:-intent_circuit}
BUILD_DIR="./build"
PTAU_FILE="$BUILD_DIR/pot15_final.ptau"

echo "=== PolkaShield Trusted Setup ==="
echo "Circuit: $CIRCUIT_NAME"
echo ""

mkdir -p "$BUILD_DIR"

# Step 1: Compile the circuit
echo "[1/7] Compiling $CIRCUIT_NAME.circom..."
circom "$CIRCUIT_NAME.circom" \
    --r1cs \
    --wasm \
    --sym \
    --output "$BUILD_DIR"

echo "  Constraints info:"
npx snarkjs r1cs info "$BUILD_DIR/$CIRCUIT_NAME.r1cs"

# Step 2: Powers of Tau (Phase 1) — reuse if exists
if [ ! -f "$PTAU_FILE" ]; then
    echo ""
    echo "[2/7] Starting Powers of Tau ceremony (2^15)..."
    npx snarkjs powersoftau new bn128 15 "$BUILD_DIR/pot15_0.ptau" -v
    
    echo "  Contributing to ceremony..."
    npx snarkjs powersoftau contribute \
        "$BUILD_DIR/pot15_0.ptau" \
        "$BUILD_DIR/pot15_1.ptau" \
        --name="PolkaShield Phase 1" \
        -v -e="polkashield-random-entropy-$(date +%s)"
    
    echo "  Preparing Phase 2..."
    npx snarkjs powersoftau prepare phase2 \
        "$BUILD_DIR/pot15_1.ptau" \
        "$PTAU_FILE" \
        -v
    
    # Cleanup intermediate files
    rm -f "$BUILD_DIR/pot15_0.ptau" "$BUILD_DIR/pot15_1.ptau"
else
    echo ""
    echo "[2/7] Reusing existing Powers of Tau file"
fi

# Step 3: Setup Groth16 (Phase 2)
echo ""
echo "[3/7] Setting up Groth16 (Phase 2)..."
npx snarkjs groth16 setup \
    "$BUILD_DIR/$CIRCUIT_NAME.r1cs" \
    "$PTAU_FILE" \
    "$BUILD_DIR/${CIRCUIT_NAME}_0.zkey"

# Step 4: Contribute to Phase 2
echo ""
echo "[4/7] Contributing to Phase 2..."
npx snarkjs zkey contribute \
    "$BUILD_DIR/${CIRCUIT_NAME}_0.zkey" \
    "$BUILD_DIR/${CIRCUIT_NAME}_final.zkey" \
    --name="PolkaShield Phase 2" \
    -v -e="polkashield-phase2-$(date +%s)"

# Step 5: Verify the final zkey
echo ""
echo "[5/7] Verifying final zkey..."
npx snarkjs zkey verify \
    "$BUILD_DIR/$CIRCUIT_NAME.r1cs" \
    "$PTAU_FILE" \
    "$BUILD_DIR/${CIRCUIT_NAME}_final.zkey"

# Step 6: Export verification key
echo ""
echo "[6/7] Exporting verification key..."
npx snarkjs zkey export verificationkey \
    "$BUILD_DIR/${CIRCUIT_NAME}_final.zkey" \
    "$BUILD_DIR/${CIRCUIT_NAME}_vk.json"

# Step 7: Export Solidity/ink! verifier (reference)
echo ""
echo "[7/7] Exporting Solidity verifier (for reference)..."
npx snarkjs zkey export solidityverifier \
    "$BUILD_DIR/${CIRCUIT_NAME}_final.zkey" \
    "$BUILD_DIR/${CIRCUIT_NAME}_verifier.sol"

# Cleanup intermediate zkey
rm -f "$BUILD_DIR/${CIRCUIT_NAME}_0.zkey"

echo ""
echo "=== Setup Complete ==="
echo "  R1CS:             $BUILD_DIR/$CIRCUIT_NAME.r1cs"
echo "  WASM:             $BUILD_DIR/${CIRCUIT_NAME}_js/${CIRCUIT_NAME}.wasm"
echo "  Final zkey:       $BUILD_DIR/${CIRCUIT_NAME}_final.zkey"
echo "  Verification key: $BUILD_DIR/${CIRCUIT_NAME}_vk.json"
echo "  Solidity verifier:$BUILD_DIR/${CIRCUIT_NAME}_verifier.sol"
echo ""
echo "To generate a proof, run:"
echo "  npx snarkjs groth16 fullprove input.json $BUILD_DIR/${CIRCUIT_NAME}_js/${CIRCUIT_NAME}.wasm $BUILD_DIR/${CIRCUIT_NAME}_final.zkey proof.json public.json"
