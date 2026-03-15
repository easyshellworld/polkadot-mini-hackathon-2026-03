#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# DotDuel Arena Rebuild & Deploy for dev002
# ═══════════════════════════════════════════════════════════════

# Step 1: SSH into dev002
ssh hayden@192.168.16.205 << 'REMOTE'

# Step 2: Navigate to project
cd ~/dotduel/Polkadot-DotDuel_v2

# Step 3: Pull latest code with Arena feature
git pull origin polkadot2.0

# Step 4: Update .env with new contract addresses
cat > .env << 'EOF'
# ── Port Configuration ────────────────────────────────────────
FRONTEND_PORT=3400
DEV_PORT=3401
BACKEND_PORT=3402

# ── Blockchain / Contract ─────────────────────────────────────
VITE_RPC_URL=https://eth-rpc-testnet.polkadot.io/
VITE_CONTRACT_ADDRESS=0xd74a7c5beBC6aD20BAd1c8C32CA74dc5dE7C1C63
VITE_TOURNAMENT_ADDRESS=0x4C0C80e40449896251ef768ED2916B3fE1BA48F0
VITE_ARENA_ADDRESS=0x57C8dA5B4183E54d4Ad972bF4b53B74fB3627CEF
VITE_USE_TESTNET=true

# ── Backend ───────────────────────────────────────────────────
RPC_URL=https://eth-rpc-testnet.polkadot.io/
CONTRACT_ADDRESS=0xd74a7c5beBC6aD20BAd1c8C32CA74dc5dE7C1C63
TOURNAMENT_ADDRESS=0x4C0C80e40449896251ef768ED2916B3fE1BA48F0
ARENA_ADDRESS=0x57C8dA5B4183E54d4Ad972bF4b53B74fB3627CEF
DEPLOYER_PRIVATE_KEY=
DATABASE_URL=
EOF

# Step 5: Rebuild Docker containers (takes 2-3 minutes)
./start.sh --rebuild

# Step 6: Verify everything is running
docker compose ps

# Done!
REMOTE
