#!/bin/bash
set -e

# ============================================================
# PolkaShield — Local Deployment Script
# Deploys contracts to substrate-contracts-node
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CONTRACT_DIR="$ROOT_DIR/contracts"

RPC_URL="${SUBSTRATE_RPC_URL:-ws://127.0.0.1:9944}"
SURI="${SOLVER_MNEMONIC:-//Alice}"

echo "=== PolkaShield Local Deployment ==="
echo "RPC: $RPC_URL"
echo "Deployer: $SURI"
echo ""

# Check prerequisites
if ! command -v cargo-contract &> /dev/null; then
    echo "Error: cargo-contract not found. Install with: cargo install cargo-contract"
    exit 1
fi

# Build contracts
echo "[1/4] Building contracts..."
cd "$CONTRACT_DIR"
cargo contract build --release

# Deploy Groth16 Verifier
echo ""
echo "[2/4] Deploying Groth16 Verifier..."
GROTH16_RESULT=$(cargo contract instantiate \
    --manifest-path groth16_verifier/Cargo.toml \
    --constructor new \
    --suri "$SURI" \
    --url "$RPC_URL" \
    --skip-confirm \
    --output-json 2>&1) || true

GROTH16_ADDR=$(echo "$GROTH16_RESULT" | grep -o '"contract": "[^"]*"' | head -1 | cut -d'"' -f4)
echo "  Groth16 Verifier: $GROTH16_ADDR"

# Deploy Intent Verifier (depends on Groth16)
echo ""
echo "[3/4] Deploying Intent Verifier..."
VERIFIER_RESULT=$(cargo contract instantiate \
    --manifest-path intent_verifier/Cargo.toml \
    --constructor new \
    --args "$GROTH16_ADDR" \
    --suri "$SURI" \
    --url "$RPC_URL" \
    --skip-confirm \
    --output-json 2>&1) || true

VERIFIER_ADDR=$(echo "$VERIFIER_RESULT" | grep -o '"contract": "[^"]*"' | head -1 | cut -d'"' -f4)
echo "  Intent Verifier: $VERIFIER_ADDR"

# Deploy DarkPool (depends on Intent Verifier)
echo ""
echo "[4/4] Deploying DarkPool..."
FEE_RECIPIENT="${FEE_RECIPIENT:-$SURI}"
POOL_RESULT=$(cargo contract instantiate \
    --manifest-path dark_pool/Cargo.toml \
    --constructor new \
    --args "$VERIFIER_ADDR" "$FEE_RECIPIENT" 30 \
    --suri "$SURI" \
    --url "$RPC_URL" \
    --skip-confirm \
    --output-json 2>&1) || true

POOL_ADDR=$(echo "$POOL_RESULT" | grep -o '"contract": "[^"]*"' | head -1 | cut -d'"' -f4)
echo "  DarkPool: $POOL_ADDR"

# Save addresses
echo ""
echo "=== Deployment Complete ==="
DEPLOY_FILE="$ROOT_DIR/.env.local"
cat > "$DEPLOY_FILE" << EOF
# PolkaShield — Deployed Contract Addresses ($(date))
DARK_POOL_CONTRACT=$POOL_ADDR
INTENT_VERIFIER_CONTRACT=$VERIFIER_ADDR
GROTH16_VERIFIER_CONTRACT=$GROTH16_ADDR

VITE_DARK_POOL_CONTRACT=$POOL_ADDR
VITE_INTENT_VERIFIER_CONTRACT=$VERIFIER_ADDR
EOF

echo "Addresses saved to $DEPLOY_FILE"
echo ""
echo "DarkPool:         $POOL_ADDR"
echo "Intent Verifier:  $VERIFIER_ADDR"
echo "Groth16 Verifier: $GROTH16_ADDR"
