#!/bin/bash
# DotDuel Startup Script
# Deploy to hayden@192.168.16.205 via SSH or run locally on the target machine.
#
# Quick start:
#   ssh hayden@192.168.16.205
#   cd dotduel/Polkadot-DotDuel_v2 && ./start.sh
#
# With rebuild:   ./start.sh --rebuild
# Dev hot-reload: ./start.sh --dev
# Stop services:  ./start.sh --stop

set -e

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ── Port config (all starting from 3400) ─────────────────────────────────────
FRONTEND_PORT=${FRONTEND_PORT:-3400}   # nginx production build
DEV_PORT=${DEV_PORT:-3401}             # Vite hot-reload dev server
BACKEND_PORT=${BACKEND_PORT:-3402}     # Express API server
export FRONTEND_PORT DEV_PORT BACKEND_PORT

# ── Argument parsing ──────────────────────────────────────────────────────────
REBUILD=""
DEV_MODE=""
STOP=""
CLEAN=""

for arg in "$@"; do
    case $arg in
        --rebuild|-r)
            REBUILD="--build"
            echo -e "${YELLOW}🔄 Rebuild mode enabled${NC}"
            ;;
        --dev|-d)
            DEV_MODE="true"
            echo -e "${YELLOW}🛠️  Development mode (hot-reload on port ${DEV_PORT})${NC}"
            ;;
        --stop|-s)
            STOP="true"
            ;;
        --clean|-c)
            CLEAN="true"
            ;;
        --logs|-l)
            echo -e "${CYAN}📝 Tailing logs…${NC}"
            docker compose logs -f
            exit 0
            ;;
        --install-hooks|-i)
            echo -e "${YELLOW}🔧 Installing git post-merge hook…${NC}"
            if [ -d .git ]; then
                mkdir -p .git/hooks
                cat > .git/hooks/post-merge <<'HOOK'
#!/bin/sh
chmod +x start.sh || true
HOOK
                chmod +x .git/hooks/post-merge
                echo -e "${GREEN}✅ .git/hooks/post-merge installed.${NC}"
            else
                echo -e "${RED}❌ Not a git repository.${NC}"
            fi
            exit 0
            ;;
        --help|-h)
            echo ""
            echo "DotDuel — Polkadot Duel Platform Startup Script"
            echo ""
            echo "Usage: ./start.sh [options]"
            echo ""
            echo "Options:"
            echo "  -r, --rebuild        Rebuild Docker images (no cache)"
            echo "  -d, --dev            Start Vite hot-reload dev server on port ${DEV_PORT}"
            echo "  -s, --stop           Stop all containers"
            echo "  -c, --clean          Remove containers + images (keeps .env)"
            echo "  -l, --logs           Tail docker compose logs"
            echo "  -i, --install-hooks  Install git post-merge hook"
            echo "  -h, --help           Show this message"
            echo ""
            echo "Port map:"
            echo "  ${FRONTEND_PORT}  →  nginx (production build)"
            echo "  ${DEV_PORT}  →  Vite dev server (--dev mode only)"
            echo "  ${BACKEND_PORT}  →  Express API backend"
            echo ""
            exit 0
            ;;
    esac
done

# ── Stop ─────────────────────────────────────────────────────────────────────
if [ "$STOP" == "true" ]; then
    echo -e "${YELLOW}🛑 Stopping DotDuel services…${NC}"
    docker compose down
    docker compose --profile dev down 2>/dev/null || true
    echo -e "${GREEN}✅ All services stopped.${NC}"
    exit 0
fi

# ── Clean ─────────────────────────────────────────────────────────────────────
if [ "$CLEAN" == "true" ]; then
    echo -e "${YELLOW}🧹 Cleaning DotDuel Docker resources…${NC}"
    docker compose down 2>/dev/null || true
    docker compose --profile dev down 2>/dev/null || true
    docker rmi dotduel-frontend dotduel-backend dotduel-frontend-dev 2>/dev/null || true
    echo -e "${GREEN}✅ Cleanup done.${NC}"
    exit 0
fi

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║      🎯 DotDuel — Polkadot Duel Platform             ║${NC}"
echo -e "${CYAN}║         Decentralised Betting on Polkadot             ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# ── Prerequisite checks ───────────────────────────────────────────────────────
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found. Install it: https://docs.docker.com/get-docker/${NC}"
    exit 1
fi
if ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose v2 not found. Upgrade Docker Desktop or install the plugin.${NC}"
    exit 1
fi

# ── .env check and setup ──────────────────────────────────────────────────────
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        echo -e "${YELLOW}📝 .env not found — copying from .env.example…${NC}"
        cp .env.example .env
        echo -e "${GREEN}✅ .env created. Edit it with your contract addresses & keys before running.${NC}"
    else
        echo -e "${RED}❌ No .env or .env.example found!${NC}"
        exit 1
    fi
fi

# Source .env so variables are available
set -o allexport
source .env
set +o allexport

# ── Teardown before rebuild ───────────────────────────────────────────────────
echo -e "${YELLOW}🧹 Stopping old containers…${NC}"
docker compose down 2>/dev/null || true
docker compose --profile dev down 2>/dev/null || true

if [ "$REBUILD" != "" ]; then
    echo -e "${YELLOW}🗑️  Removing old images for clean rebuild…${NC}"
    docker rmi dotduel-frontend dotduel-backend 2>/dev/null || true
fi
echo ""

# ── Dev mode: Vite HMR container (uses docker compose profile) ───────────────
if [ "$DEV_MODE" == "true" ]; then
    echo -e "${BLUE}🛠️  Starting DotDuel in dev mode…${NC}"
    docker compose --profile dev up -d $REBUILD backend frontend-dev

    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✅ DotDuel — Dev Mode Running!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${BLUE}🌐 Access:${NC}"
    echo -e "   ${GREEN}Frontend (hot-reload):${NC}  http://localhost:${DEV_PORT}"
    echo -e "   ${GREEN}Backend API:${NC}            http://localhost:${BACKEND_PORT}"
    echo -e "   ${GREEN}Remote (dev002):${NC}        http://192.168.16.205:${DEV_PORT}"
    echo ""
    echo -e "${YELLOW}📝 View logs:${NC} docker compose --profile dev logs -f"
    echo -e "${YELLOW}🛑 Stop:${NC}      ./start.sh --stop"
    echo ""
    exit 0
fi

# ── Production mode ──────────────────────────────────────────────────────────
echo -e "${BLUE}📦 Building & starting DotDuel (production)…${NC}"
echo -e "${BLUE}   Backend API + nginx-served React frontend${NC}"
echo ""

docker compose up -d $REBUILD backend frontend

# ── Health check ─────────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}⏳ Waiting for services to be ready…${NC}"

# Check backend
MAX_RETRIES=30
RETRY_COUNT=0
until curl -sf "http://localhost:${BACKEND_PORT}/health" > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo -e "${YELLOW}⚠️  Backend health check timed out — container may still be starting.${NC}"
        break
    fi
    echo -e "   ${YELLOW}Backend not ready (attempt ${RETRY_COUNT}/${MAX_RETRIES})…${NC}"
    sleep 2
done
if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
    echo -e "   ${GREEN}✅ Backend API ready${NC}"
fi

# Check frontend
RETRY_COUNT=0
until curl -sf "http://localhost:${FRONTEND_PORT}/health" > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo -e "${YELLOW}⚠️  Frontend health check timed out — container may still be starting.${NC}"
        break
    fi
    echo -e "   ${YELLOW}Frontend not ready (attempt ${RETRY_COUNT}/${MAX_RETRIES})…${NC}"
    sleep 2
done
if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
    echo -e "   ${GREEN}✅ Frontend ready${NC}"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ DotDuel is Live!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}📋 Container status:${NC}"
docker compose ps
echo ""
echo -e "${BLUE}🌐 Access:${NC}"
echo -e "   ${GREEN}Frontend (local):${NC}   http://localhost:${FRONTEND_PORT}"
echo -e "   ${GREEN}Frontend (dev002):${NC}  http://192.168.16.205:${FRONTEND_PORT}"
echo -e "   ${GREEN}Backend API:${NC}        http://localhost:${BACKEND_PORT}"
echo -e "   ${GREEN}API (dev002):${NC}       http://192.168.16.205:${BACKEND_PORT}"
echo ""
echo -e "${BLUE}📡 Port map:${NC}"
echo -e "   ${FRONTEND_PORT}  →  nginx (React production build)"
echo -e "   ${DEV_PORT}  →  Vite dev server  (${YELLOW}./start.sh --dev${NC} only)"
echo -e "   ${BACKEND_PORT}  →  Express API backend"
echo ""
echo -e "${YELLOW}📝 View logs:${NC}  docker compose logs -f"
echo -e "${YELLOW}🔄 Rebuild:${NC}   ./start.sh --rebuild"
echo -e "${YELLOW}🛑 Stop:${NC}      ./start.sh --stop"
echo ""

# ── Deployment reminder ───────────────────────────────────────────────────────
if grep -q "VITE_CONTRACT_ADDRESS=0x0000" .env 2>/dev/null; then
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}⚠️  Contracts not yet deployed.${NC}"
    echo -e "${YELLOW}   Update .env with your contract addresses, then:${NC}"
    echo -e "   ${BLUE}./start.sh --rebuild${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
fi
