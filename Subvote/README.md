# subvote

**subvote** is a governance discussion layer for the Polkadot ecosystem, designed for deployment on **Revive** and expansion with **Polkadot 2.0**.

It combines:

- an EVM-compatible smart contract layer for stake and topic anchors,
- a modern wallet-based web interface for creating and joining governance topics,
- a future indexing and event-sync pipeline for auditable discussion state,
- and a product model focused on structured, low-noise, on-chain-adjacent coordination.

## Hackathon Positioning

**Recommended track:** Track 3, Original DApp Development

subvote fits the "Deploy on Revive, Scale on Polkadot 2.0" theme because it is being built as:

- a **new native DApp** for governance discussion and topic coordination,
- an application that uses an **EVM-compatible contract stack** (`Solidity`, `wagmi`, `viem`) that can be deployed on **Revive**,
- and a product that is conceptually aligned with **Polkadot 2.0 scale**, where many governance, coordination, and community processes need low-cost, structured, multi-topic discussion infrastructure.

## Problem

Governance discussion is often fragmented across forums, group chats, and proposal pages. That creates three problems:

1. Important context is lost before a decision is made.
2. There is no consistent way to anchor topic lifecycle, participation, and archive state on-chain.
3. Discussion quality is hard to compare, audit, or replay after the topic closes.

subvote is designed to solve this by creating a dedicated discussion workflow around a topic:

- users stake assets to obtain in-app voting power (`VP`),
- topic creators open a discussion topic,
- participants join and contribute messages inside that topic,
- the platform records key hashes and lifecycle anchors on-chain,
- and the discussion can later be replayed as an auditable archive.

## Core Idea

subvote is not trying to replace on-chain voting.

Instead, it creates a **structured pre-vote and post-vote coordination layer**:

- **off-chain for rich user experience and discussion flow,**
- **on-chain for critical audit anchors and lifecycle events.**

This makes it a good fit for Polkadot governance, treasury discussion, protocol coordination, and ecosystem operations where the decision process matters just as much as the final result.

## Why Revive and Polkadot 2.0

### Revive fit

Revive is attractive for this project because it is EVM-compatible while living inside the Polkadot ecosystem. subvote is already oriented around an EVM developer experience:

- Solidity contracts
- MetaMask / injected wallet flow
- `wagmi` + `viem`
- wallet-connection patterns familiar to Ethereum developers

That means the contract and frontend integration path is naturally portable to Revive.

### Polkadot 2.0 fit

subvote is designed for an ecosystem where coordination becomes broader, faster, and more modular:

- more topics can exist at the same time,
- discussion can be broken into smaller, auditable rooms,
- topic state can be anchored and replayed,
- and the system can later expand into richer indexing, cross-chain references, and ecosystem-wide governance tooling.

In short:

- **Revive** gives the project an easy EVM deployment target.
- **Polkadot 2.0** gives it a meaningful long-term scaling context.

## What the Project Does

The product vision is:

1. A user connects a wallet and signs in.
2. The user stakes an asset and receives usable discussion power (`VP`).
3. The user creates a topic with metadata such as category, expiry, and optional OpenGov references.
4. Other users join the topic and participate in its message board.
5. The topic closes, reward / archive actions are triggered, and key hashes are anchored on-chain.
6. The archive remains reviewable as a replayable governance record.

## Current Repository Status

This repository is an **active prototype / scaffold**, not a finished production release.

What is already present:

- a polished **Next.js frontend prototype** covering key product surfaces,
- wallet integration with `wagmi` / `viem`,
- Solidity source for core contracts,
- a Graph subgraph scaffold,
- a detailed PRD and implementation blueprint.

What is still incomplete:

- full backend business logic rebuild,
- production-grade database and API flow,
- finalized contract toolchain and deployment scripts,
- live event sync worker,
- end-to-end on-chain integration on Revive.

This is intentional for hackathon iteration: the repo already demonstrates the product direction, UX model, and contract architecture while leaving room for deployment and backend completion.

## Implemented Frontend Surfaces

The current web app includes:

- **Overview**: explains the subvote model and user journey
- **Get VP**: a guided flow for the VP acquisition concept
- **Square**: a topic discovery board for browsing active discussion rooms
- **New Topic**: a topic studio for composing topics, setting parameters, configuring reward behavior, and seeding the topic board
- **Room view**: a topic discussion stage with room-specific context and message interaction patterns

The current UI is prototype-driven and uses mock data in several places, but it is already structured around the intended product workflow.

## Repository Structure

```text
subvote/
├─ apps/
│  ├─ web/        # Next.js App Router frontend
│  └─ subgraph/   # Graph subgraph scaffold for event indexing
├─ contracts/
│  ├─ stake-manager/
│  └─ topic-registry/
├─ doc/           # PRD and implementation blueprint
├─ package.json
├─ pnpm-workspace.yaml
└─ README.md
```

## Smart Contract Scope

### StakeManager

Purpose:

- record staked asset amounts,
- emit stake-related events,
- support later backend synchronization.

Current contract package:

- `contracts/stake-manager/src/StakeManager.sol`

Key functions:

- `stake(uint256 amount)`
- `getStakeOf(address account)`

### TopicRegistry

Purpose:

- register `topicHash` and `configHash`,
- record join actions,
- anchor archive state after topic close.

Current contract package:

- `contracts/topic-registry/src/TopicRegistry.sol`

Key functions:

- `registerTopic(bytes32 topicHash, bytes32 configHash)`
- `joinTopic(bytes32 topicHash)`
- `anchorArchive(bytes32 topicHash, bytes32 archiveHash, string snapshotCid)`
- plus helper lifecycle actions such as `closeTopic(...)`

### Important note

The contracts workspace is currently **source-only**. A full Solidity toolchain such as Foundry or Hardhat has not yet been wired into this repository.

## Indexing / Data Layer Direction

The repo includes `apps/subgraph/` as a local Graph scaffold. Its purpose is to validate the indexing path and provide a base for:

- contract event indexing,
- queryable topic history,
- and future ecosystem analytics.

At the moment it is a template and still needs real ABI, address, and schema updates before it can index the live contract set for this project.

## Tech Stack

### Frontend

- Next.js 15
- React 19
- TypeScript 5
- Tailwind CSS 4
- `wagmi`
- `viem`
- WalletConnect
- Lucide icons

### App / Data Architecture

- tRPC 11
- TanStack Query 5
- Prisma 6
- Zod 3

### Smart Contracts

- Solidity 0.8.x source

### Indexing

- The Graph subgraph scaffold

### Workspace / Tooling

- `pnpm` workspace
- ESLint
- Prettier

## Environment Setup

### Requirements

- Node.js 20+
- `pnpm` 10+

### Install

```bash
pnpm install
```

### Run the web app

```bash
pnpm dev
```

The app will run locally at:

```text
http://localhost:3000
```

### Build

```bash
pnpm build
```

### Typecheck

```bash
pnpm typecheck
```

### Lint

```bash
pnpm lint
```

## Environment Variables

For the frontend:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

For the subgraph local environment, see `apps/subgraph/README.md`.

## Network and Deployment Notes

At the moment, local development in this repository is configured around **Polkadot Hub Testnet** in the wallet layer.

For a hackathon submission aligned with Revive, the intended path is:

1. deploy the Solidity contracts to **Revive**,
2. switch the frontend chain / RPC configuration to Revive,
3. point the indexer / event pipeline to the deployed contracts,
4. and keep the same EVM-compatible wallet tooling.

This is one of the strongest parts of the project design: it does not require a new contract language or a custom wallet flow to enter the Polkadot ecosystem.

## Why This Project Matters

subvote is trying to build a missing layer in governance infrastructure:

- not just voting,
- not just chat,
- but a structured, replayable, auditable coordination space around a topic.

That can be useful for:

- OpenGov discussions,
- treasury proposal review,
- protocol upgrade coordination,
- grant evaluation,
- ecosystem retrospectives,
- and operational incident follow-up.

## Mapping to the Judging Criteria

### 1. Technical Implementation

- clear separation between frontend, contract, and indexing layers
- realistic contract interfaces for stake and topic anchors
- strong PRD-driven implementation framing
- modern TypeScript + React + EVM tooling stack

### 2. Innovation and Practicality

- introduces a discussion layer specifically designed for governance-quality signal
- combines UI-driven coordination with on-chain auditability
- focuses on real ecosystem workflows instead of generic social features

### 3. Polkadot / Revive Ecosystem Fit

- deployable through an EVM-compatible path
- aligned with governance-heavy use cases in the Polkadot ecosystem
- designed for future scaling and richer ecosystem indexing

### 4. Developer Experience

- familiar Ethereum-style wallet and contract tooling
- simple workspace layout
- explicit docs and PRD guidance
- easy local frontend startup

### 5. Project Potential and Ecosystem Contribution

- can evolve into a governance coordination primitive
- useful for DAOs, councils, treasury reviewers, and protocol teams
- extensible into analytics, archive tooling, and multi-topic coordination systems

## Roadmap

Near-term next steps:

1. Add a proper Solidity toolchain and deployment scripts.
2. Deploy contracts to Revive.
3. Replace mock frontend flows with live tRPC / database logic.
4. Implement topic publish / join / archive end-to-end.
5. Add a chain event sync worker.
6. Replace the placeholder subgraph configuration with real contract indexing.
7. Connect archive replay to real topic lifecycle data.

## Demo

Optional demo video:

- add a 2-5 minute walkthrough showing the main product flow,
- highlight why Revive is the right deployment target,
- and show how topic creation, room participation, and archive / reward handling work.

## Additional Documentation

- Product and implementation blueprint:
  - `doc/subvote_V2.0_精简版_PRD_技术拆分清单.md`
- Subgraph usage:
  - `apps/subgraph/README.md`
- Contract notes:
  - `contracts/stake-manager/README.md`
  - `contracts/topic-registry/README.md`

## Summary

subvote is an original governance discussion DApp for the Polkadot ecosystem.

It is being built with an EVM-compatible architecture that makes **Revive** a natural deployment target, while its product direction is well aligned with the **scale, modularity, and coordination needs of Polkadot 2.0**.
