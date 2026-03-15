# DotDuel — Decentralised Prediction & Tournament Protocol

> 1v1 Duels + Bracket Tournaments + Prediction Markets — built on **Polkadot / Revive (EVM)**

[![Polkadot Hackathon 2025](https://img.shields.io/badge/Polkadot%20Hackathon-2025-E6007A?style=flat-square)](https://polkadot.network)
[![Track 3](https://img.shields.io/badge/Track%203-Original%20DApp-blueviolet?style=flat-square)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.0.0-blue?style=flat-square)](#)

---

## Overview

**DotDuel** is a decentralised peer-to-peer prediction protocol with two core products:

1. **1v1 Duels** — Two players stake ETH on a match outcome. A referee or automated oracle settles the result, and the smart contract distributes winnings.
2. **Tournament Brackets** — 4 / 8 / 16-player single-elimination brackets with entry fees and prize pools (60% / 25% / 15% for 1st / 2nd / 3rd).
3. **Prediction Market** — Polymarket-inspired side bets where spectators predict the tournament winner and earn a share of the prediction pool.

All logic — stakes, settlement, and payouts — lives entirely on-chain in Solidity smart contracts.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Transparent Predictions** | Smart contracts auto-execute; code guarantees fairness |
| **Dual Settlement Modes** | Referee mode (manual) & Oracle mode (API auto-settlement) |
| **Tournament Brackets** | Single-elimination brackets with on-chain bracket generation & shuffle |
| **Prediction Market** | Bet on tournament winners; proportional reward distribution |
| **Auto Settlement** | Results settle and prizes distribute instantly on-chain |
| **Low Fees** | 0.5% platform fee (duels), 2.5% entry pool + 5% prediction pool (tournaments) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Smart Contracts** | Solidity 0.8.20, OpenZeppelin 5.x, Hardhat |
| **Frontend** | React 18, TypeScript, Vite 5, Tailwind CSS 3, wagmi 2, @tanstack/react-query 5 |
| **Backend** | Node.js, Express 4, TypeScript, ethers v6 (read-only chain indexer, no DB) |
| **Blockchain** | Polkadot / Revive (EVM-compatible via REVM) — currently on Mantle for dev |
| **Wallet** | MetaMask via wagmi injected connector |

---

## Project Structure

```
DotDuel/
├── contracts/                 # Smart Contracts
│   ├── contracts/
│   │   ├── DuelPlatform.sol         # 1v1 duel contract
│   │   └── TournamentPlatform.sol   # Tournament bracket + prediction market
│   ├── scripts/deploy.ts            # Deployment script (both contracts)
│   ├── test/DuelPlatform.test.ts    # Hardhat test suite
│   └── hardhat.config.ts
├── backend/                   # Express API (chain read-only indexer)
│   └── src/
│       ├── services/
│       │   ├── duelPlatform.ts      # Duel data reader
│       │   ├── tournament.ts        # Tournament data reader
│       │   └── oracle.ts            # Oracle / auto-settlement service
│       └── routes/
│           ├── matches.ts           # /api/matches
│           ├── tournaments.ts       # /api/tournaments
│           ├── users.ts             # /api/users
│           ├── stats.ts             # /api/stats
│           └── oracle.ts            # /api/oracle
├── frontend/                  # React SPA
│   └── src/
│       ├── pages/
│       │   ├── Home.tsx
│       │   ├── CreateMatch.tsx
│       │   ├── MatchList.tsx / MatchDetail.tsx / MyMatches.tsx
│       │   ├── TournamentList.tsx / TournamentDetail.tsx / CreateTournament.tsx
│       │   └── Stats.tsx
│       ├── hooks/                   # wagmi + react-query hooks
│       ├── components/              # Layout, MatchCard, ConnectWallet
│       └── config/wagmi.ts          # Chain & wallet config
└── docs/                      # Session logs & presentations
```

---

## Quick Start

### Prerequisites

- **Node.js** >= 18
- **npm** or **yarn**
- **MetaMask** browser extension

### 1. Clone

```bash
git clone https://github.com/hkfish01/Polkadot-DotDuel_v2.git
cd Polkadot-DotDuel_v2
```

### 2. Deploy Smart Contracts

```bash
cd contracts
npm install
cp .env.example .env
# Edit .env -> set DEPLOYER_PRIVATE_KEY, PLATFORM_WALLET, ORACLE_ADDRESS

npx hardhat compile
npx hardhat run scripts/deploy.ts --network mantleSepolia   # or your target network
```

The deploy script outputs the addresses for **DuelPlatform** and **TournamentPlatform**.

### 3. Start Backend

```bash
cd ../backend
npm install
cp .env.example .env
# Edit .env -> set CONTRACT_ADDRESS, TOURNAMENT_ADDRESS, RPC_URL

npm run dev        # runs on http://localhost:3001
```

### 4. Start Frontend

```bash
cd ../frontend
npm install
cp .env.example .env
# Edit .env -> set:
#   VITE_CONTRACT_ADDRESS=0x...
#   VITE_TOURNAMENT_ADDRESS=0x...
#   VITE_API_URL=http://localhost:3001

npm run dev        # runs on http://localhost:5173
```

Open http://localhost:5173 in your browser, connect MetaMask, and start duelling!

---

## Smart Contract Architecture

### DuelPlatform.sol

| Function | Description |
|----------|-------------|
| createMatch | Creator sets mode, stake, times, description |
| joinMatch | Opponent sends stake to join |
| submitResultByReferee | Referee declares winner (mode 0) |
| submitResultByOracle | Oracle submits winner (mode 1) |
| cancelMatch | Creator cancels; stakes refunded |
| getUserStats | Returns wins, losses, total staked/won |

**Fee structure**: Referee mode -> 3% referee + 0.5% platform. Oracle mode -> 0.5% platform.

### TournamentPlatform.sol

| Function | Description |
|----------|-------------|
| createTournament | Organiser sets name, bracket size, entry fee, schedule |
| registerForTournament | Player pays entry fee to register |
| startTournament | Generates shuffled bracket |
| submitMatchResult | Oracle submits round-by-round results |
| placePrediction | Spectators bet on predicted winner |
| claimPrediction | Claim proportional share of prediction pool |
| cancelTournament | Organiser cancels; entry fees refunded |

**Prize distribution**: 1st 60% / 2nd 25% / 3rd 15% (after 2.5% platform fee).
**Prediction pool fee**: 5% platform fee; rest split proportionally among correct bettors.

---

## API Endpoints

### Duels

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/matches | List all matches (with pagination) |
| GET | /api/matches/:id | Get match details |
| GET | /api/users/:address/stats | User win/loss stats |
| GET | /api/users/:address/matches | User match history |
| GET | /api/stats | Platform-wide stats + leaderboard |
| GET | /api/stats/recent | Recent matches |

### Tournaments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/tournaments | List tournaments |
| GET | /api/tournaments/:id | Tournament details |
| GET | /api/tournaments/:id/bracket/:round | Bracket data for a round |
| GET | /api/tournaments/:id/predictions | Prediction market data |
| GET | /api/tournaments/:id/results | Final results and placements |
| GET | /api/tournaments/stats | Tournament platform stats |

---

## Testing

```bash
cd contracts
npx hardhat test
```

Test coverage includes: deployment, match creation, joining, settlement, cancellation, admin functions, and query functions.

---

## Environment Variables

### contracts/.env

```
DEPLOYER_PRIVATE_KEY=0x...
PLATFORM_WALLET=0x...
ORACLE_ADDRESS=0x...
```

### backend/.env

```
PORT=3001
RPC_URL=https://rpc.sepolia.mantle.xyz
CONTRACT_ADDRESS=0x...
TOURNAMENT_ADDRESS=0x...
```

### frontend/.env

```
VITE_CONTRACT_ADDRESS=0x...
VITE_TOURNAMENT_ADDRESS=0x...
VITE_API_URL=http://localhost:3001
VITE_USE_TESTNET=true
```

---

## Roadmap

- [x] 1v1 Duel smart contract (Referee + Oracle modes)
- [x] React frontend with wagmi wallet integration
- [x] Express backend as chain indexer
- [x] Tournament bracket contract (4/8/16 players)
- [x] Prediction market (Polymarket-style)
- [x] Full English UI
- [ ] Migrate chain config to Polkadot Revive testnet/mainnet
- [ ] Oracle auto-settlement integration (mydupr API)
- [ ] Database layer (PostgreSQL) for faster queries
- [ ] Mobile-responsive design refinements
- [ ] Multi-language support (i18n)

---

## Hackathon Info

- **Event**: Polkadot Hackathon 2025
- **Track**: Track 3 — Original DApp Development
- **Team**: DotDuel
- **Version**: v2.0.0

---

## License

MIT

---

**Made with care for the Polkadot ecosystem.**
