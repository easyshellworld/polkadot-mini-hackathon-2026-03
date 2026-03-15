# ============================================================
# Atomic Intent for Polkadot — Makefile
# ============================================================

.PHONY: all build test clean dev deploy help

# Default target
all: build

# ============================================================
# Build
# ============================================================

build: build-contracts build-solidity build-solver build-frontend build-circuits ## Build all components

build-contracts: ## Build ink! smart contracts
	@echo "=== Building ink! contracts ==="
	cd contracts && cargo contract build --release

build-solidity: ## Build Solidity contracts (Track 1 migration)
	@echo "=== Building Solidity contracts ==="
	cd contracts/solidity && npm ci && npm run build

build-solver: ## Build solver
	@echo "=== Building Solver ==="
	cd solver && cargo build --release

build-frontend: ## Build frontend
	@echo "=== Building Frontend ==="
	cd frontend && npm ci && npm run build

build-circuits: ## Compile ZK circuits
	@echo "=== Building Circuits ==="
	cd circuits && npm ci
	cd circuits && bash scripts/trusted_setup.sh intent_circuit
	cd circuits && bash scripts/trusted_setup.sh settlement_circuit

# ============================================================
# Test
# ============================================================

test: test-contracts test-solidity test-solver test-circuits ## Run all tests

test-contracts: ## Test ink! contracts
	@echo "=== Testing Contracts ==="
	cd contracts && cargo test

test-solidity: ## Test Solidity contracts (Track 1 migration)
	@echo "=== Testing Solidity Contracts ==="
	cd contracts/solidity && npm test

test-solver: ## Test solver
	@echo "=== Testing Solver ==="
	cd solver && cargo test

test-circuits: ## Test ZK circuits (requires build-circuits first)
	@echo "=== Testing Circuits ==="
	cd circuits && npm test

test-frontend: ## Test frontend
	@echo "=== Testing Frontend ==="
	cd frontend && npm test

# ============================================================
# Development
# ============================================================

dev: ## Start all services in development mode
	docker compose up --build

dev-node: ## Start local Substrate node only
	docker compose up substrate-node

dev-solver: ## Start solver in dev mode (hot reload)
	cd solver && cargo watch -x run

dev-frontend: ## Start frontend dev server
	cd frontend && npm run dev

dev-redis: ## Start Redis only
	docker compose up redis

# ============================================================
# Deploy
# ============================================================

deploy-contracts: ## Deploy contracts to local node
	@echo "=== Deploying Contracts ==="
	cd deploy && bash deploy_local.sh

deploy-testnet: ## Deploy contracts to testnet
	@echo "=== Deploying to Testnet ==="
	cd deploy && bash deploy_testnet.sh

deploy-revive: ## Deploy Solidity contracts to Revive-compatible network
	@echo "=== Deploying Solidity contracts to Revive ==="
	cd contracts/solidity && npm run deploy:revive

deploy-revive-script: ## Deploy Solidity contracts and generate frontend/solver env artifacts
	@echo "=== Running Revive deployment helper script ==="
	bash deploy/deploy_revive_solidity.sh

# ============================================================
# Docker
# ============================================================

docker-build: ## Build all Docker images
	docker compose build

docker-up: ## Start all containers
	docker compose up -d

docker-down: ## Stop all containers
	docker compose down

docker-logs: ## View container logs
	docker compose logs -f

docker-clean: ## Remove containers and volumes
	docker compose down -v --remove-orphans

# ============================================================
# Utilities
# ============================================================

clean: ## Clean all build artifacts
	cd contracts && cargo clean
	cd solver && cargo clean
	cd frontend && rm -rf node_modules dist
	cd circuits && rm -rf node_modules build

fmt: ## Format all code
	cd contracts && cargo fmt
	cd solver && cargo fmt
	cd frontend && npx prettier --write "src/**/*.{ts,tsx}"

lint: ## Lint all code
	cd contracts && cargo clippy -- -D warnings
	cd solver && cargo clippy -- -D warnings
	cd frontend && npx eslint src/

setup: ## Initial project setup
	@echo "=== Setting up PolkaShield ==="
	@echo "Installing Rust toolchain..."
	rustup target add wasm32-unknown-unknown
	cargo install cargo-contract
	cargo install cargo-watch
	@echo "Installing Node dependencies..."
	cd frontend && npm install
	cd circuits && npm install
	@echo "Installing circom..."
	@which circom > /dev/null 2>&1 || echo "Please install circom: https://docs.circom.io/getting-started/installation/"
	@echo "=== Setup Complete ==="

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
