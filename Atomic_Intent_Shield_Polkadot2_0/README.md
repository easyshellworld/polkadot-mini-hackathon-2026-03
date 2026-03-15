# Atomic Intent Shield

Privacy-preserving intent trading on Revive-compatible EVM infrastructure, aligned with Polkadot 2.0 scaling goals.

## Summary

Atomic Intent Shield lets users submit private intents (instead of public orders), generate ZK proofs client-side, and settle matched trades atomically through smart contracts.

Core properties:
- MEV resistance (reduced front-running surface)
- Private strategy protection via ZK proofs
- Off-chain solver matching
- Revive-compatible EVM deployment path for Ethereum tooling migration

Track: Revive Migration Challenge

## Video Demo:
https://youtu.be/jxDrvLw5NFU

## Judge Quick Start

1. Configure env files:
   - `contracts/solidity/.env`
   - `frontend/.env.revive` (or `.env`)
   - `.env.revive.solver` (optional)
2. Deploy contracts:
   ```bash
   bash deploy/deploy_revive_solidity.sh
   ```
3. Start services:
   ```bash
   docker compose up -d --build solver frontend
   ```
4. Open UI:
   - `http://localhost:5173`

## Revive Deployment Info

The project currently targets Polkadot Hub Testnet EVM constants in source:

- Network: `Polkadot Hub Testnet (Revive-compatible EVM path)`
- Chain ID: `420420417`
- Chain ID (hex): `0x190f1b41`
- RPC URL: `https://services.polkadothub-rpc.com/testnet`
- Explorer: `https://blockscout-testnet.polkadot.io`
- Live frontend: `https://ais-polkadot.shieldtrade.io/`
- Live API (via frontend reverse proxy): `https://ais-polkadot.shieldtrade.io/api`

Verified deployed contracts (from live site + Blockscout):

| Item | Value |
|---|---|
| `IntentVerifierMock` | `0xC5F6dFF773a7A30a0c946eD712BCb5B83D6DCEeC` |
| `DarkPool` | `0xDE227ca9bB69B3149DC043e74889306230497604` |
| `IntentVerifierMock` deploy tx | `0x71cb29dc30dcaedc27b3e95a8c2eb36fe1dde1d2259dc0065727a9a7acfc9904` |
| `DarkPool` deploy tx | `0xb2317706efc637cf37b76b11305af3537ada9364359191c7f3d231a447c7dbd3` |
| Sample settlement tx | `0x29d24a5ad295b8cecf1abc81d2eb2b430d8cb710db49386ca2ff20362e7e8e42` |
| Explorer tx URL (sample) | `https://blockscout-testnet.polkadot.io/tx/0x29d24a5ad295b8cecf1abc81d2eb2b430d8cb710db49386ca2ff20362e7e8e42` |
| Explorer address URL (DarkPool) | `https://blockscout-testnet.polkadot.io/address/0xDE227ca9bB69B3149DC043e74889306230497604` |

Live demo token contracts:

| Token | Address |
|---|---|
| `mWETH` | `0x6cA867298021f051D1b439b381bd77a3f2EB0dce` |
| `mUSDC` | `0x03800435eA3AF072F9528Ac4F038f5c3D3957679` |

Deployment command:

```bash
cd contracts/solidity
npm install
npm run deploy:revive
```

Or use the helper script:

```bash
bash deploy/deploy_revive_solidity.sh
```

The helper writes:
- `frontend/.env.revive` with `VITE_DARK_POOL_ADDRESS` and `VITE_VERIFIER_ADDRESS`
- `.env.revive.solver` with `DARK_POOL_ADDRESS` and `VERIFIER_ADDRESS`
- `/tmp/polkashield-revive-deploy.log` deployment output

## Architecture

Flow:

`User -> Frontend -> ZK Proof -> Solver -> Settlement Contract -> Revive-compatible network`

Main components:
- Frontend: React + Vite + TypeScript
- Contracts: Solidity + Hardhat (Revive migration path)
- Solver: Rust
- ZK: Circom + snarkjs
- Infra: Docker Compose + Redis

## Repository Structure

```text
Atomic_Intent_Shield_Polkadot2_0/
├── circuits/
├── contracts/
│   ├── dark_pool/
│   ├── groth16_verifier/
│   ├── intent_verifier/
│   └── solidity/
├── deploy/
├── frontend/
├── solver/
├── docker-compose.yml
├── Makefile
└── CHANGELOG.md
```

## Local Run

Prerequisites:
- Node.js 18+
- Rust stable
- Docker + Docker Compose

Start full stack:

```bash
docker compose up -d --build
```

Frontend dev mode:

```bash
cd frontend
npm install
npm run dev
```

## Testing

Solidity tests:

```bash
cd contracts/solidity
npm test
```

## Demo Evidence Checklist

For submission/demo packaging, capture:
- deployment log (`/tmp/polkashield-revive-deploy.log`)
- deployed contract addresses
- at least one intent submit tx hash
- explorer tx page URL
- frontend screenshot showing intent lifecycle

## License

This project is licensed under the AIS Non-Commercial Source-Available License v1.0.

- Open source available for noncommercial use
- Commercial use is not permitted without a separate commercial license from the copyright holder

See [LICENSE](LICENSE) for details.
## Team

ShieldTrade: `info@shieldtrade.io`
