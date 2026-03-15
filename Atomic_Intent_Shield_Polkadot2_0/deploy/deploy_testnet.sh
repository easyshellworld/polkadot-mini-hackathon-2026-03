#!/bin/bash
set -e

# ============================================================
# PolkaShield — Testnet Deployment Script
# Deploys contracts to Aleph Zero Testnet or Astar Shibuya
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CONTRACT_DIR="$ROOT_DIR/contracts"

# Network selection
NETWORK="${1:-aleph-testnet}"

case "$NETWORK" in
    aleph-testnet)
        RPC_URL="wss://ws.test.azero.dev"
        echo "Deploying to Aleph Zero Testnet"
        ;;
    shibuya)
        RPC_URL="wss://rpc.shibuya.astar.network"
        echo "Deploying to Astar Shibuya Testnet"
        ;;
    *)
        echo "Usage: $0 [aleph-testnet|shibuya]"
        exit 1
        ;;
esac

# Deployer account — MUST set SOLVER_MNEMONIC env var
if [ -z "$SOLVER_MNEMONIC" ]; then
    echo "Error: SOLVER_MNEMONIC environment variable is required for testnet deployment"
    echo "Set it to your deployer account's mnemonic phrase"
    exit 1
fi

SURI="$SOLVER_MNEMONIC"

echo "RPC: $RPC_URL"
echo ""

# Build contracts
echo "[1/4] Building contracts..."
cd "$CONTRACT_DIR"
cargo contract build --release

# Deploy Groth16 Verifier
echo ""
echo "[2/4] Deploying Groth16 Verifier..."
cargo contract instantiate \
    --manifest-path groth16_verifier/Cargo.toml \
    --constructor new \
    --suri "$SURI" \
    --url "$RPC_URL" \
    --skip-confirm

echo ""
echo "!! IMPORTANT: Copy the Groth16 contract address from above"
read -rp "Enter Groth16 Verifier address: " GROTH16_ADDR

# Deploy Intent Verifier
echo ""
echo "[3/4] Deploying Intent Verifier..."
cargo contract instantiate \
    --manifest-path intent_verifier/Cargo.toml \
    --constructor new \
    --args "$GROTH16_ADDR" \
    --suri "$SURI" \
    --url "$RPC_URL" \
    --skip-confirm

echo ""
read -rp "Enter Intent Verifier address: " VERIFIER_ADDR

# Deploy DarkPool
echo ""
echo "[4/4] Deploying DarkPool..."
read -rp "Enter fee recipient address: " FEE_RECIPIENT
cargo contract instantiate \
    --manifest-path dark_pool/Cargo.toml \
    --constructor new \
    --args "$VERIFIER_ADDR" "$FEE_RECIPIENT" 30 \
    --suri "$SURI" \
    --url "$RPC_URL" \
    --skip-confirm

echo ""
read -rp "Enter DarkPool address: " POOL_ADDR

# Save addresses
DEPLOY_FILE="$ROOT_DIR/.env.$NETWORK"
cat > "$DEPLOY_FILE" << EOF
# PolkaShield — $NETWORK Deployment ($(date))
SUBSTRATE_RPC_URL=$RPC_URL

DARK_POOL_CONTRACT=$POOL_ADDR
INTENT_VERIFIER_CONTRACT=$VERIFIER_ADDR
GROTH16_VERIFIER_CONTRACT=$GROTH16_ADDR

VITE_DARK_POOL_CONTRACT=$POOL_ADDR
VITE_SUBSTRATE_RPC_URL=$RPC_URL
EOF

echo ""
echo "=== Testnet Deployment Complete ==="
echo "Addresses saved to $DEPLOY_FILE"
