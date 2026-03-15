#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "=== RTTA Chat Server — Rebuild & Restart ==="

# Load .env if present
if [ -f .env ]; then
  set -a; source .env; set +a
  echo "[*] Loaded .env"
fi

# Stop existing containers
echo "[1/3] Stopping old containers..."
docker compose stop hab-chat-server 2>/dev/null || true
docker compose rm -f hab-chat-server 2>/dev/null || true

# Rebuild image (no cache)
echo "[2/3] Building image..."
docker compose build --no-cache hab-chat-server

# Start services
echo "[3/3] Starting services..."
docker compose up -d

echo ""
echo "=== Done ==="
docker compose ps
echo ""
echo "Logs:  docker compose logs -f hab-chat-server"
echo "Stop:  docker compose down"
