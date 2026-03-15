# Changelog

## 1.0.4-demo-faucet (2026-03-13)

- Added frontend Demo Faucet actions in `TradePanel` to mint mock `wETH` and `USDC` directly from the connected EVM wallet.
- Added configurable mint amounts via `VITE_TEST_MINT_WETH` and `VITE_TEST_MINT_USDC` (default `1000` each).
- Mint flow now waits for receipt and refreshes wallet token balances in the panel.

## 1.0.3-license (2026-03-13)

- License updated from MIT to AIS Non-Commercial Source-Available License v1.0.
- README license section updated to clarify noncommercial usage and separate commercial licensing requirement.

## 1.0.2-docs-live-data (2026-03-12)

- Pulled live deployment metadata from `https://ais-polkadot.shieldtrade.io/` and Blockscout.
- Updated `README.md` with verified production values:
  - `IntentVerifierMock`: `0xC5F6dFF773a7A30a0c946eD712BCb5B83D6DCEeC`
  - `DarkPool`: `0xDE227ca9bB69B3149DC043e74889306230497604`
  - Deploy tx hashes for both contracts
  - Sample settlement tx + explorer links
  - Live demo token addresses (`mWETH`, `mUSDC`)
- Added live site and proxied API endpoint references.

## 1.0.1-docs (2026-03-12)

- Rewrote `README.md` with clean Markdown structure and complete sections.
- Updated Revive deployment documentation with concrete network constants:
  - Chain ID `420420417`
  - RPC `https://services.polkadothub-rpc.com/testnet`
  - Explorer `https://blockscout-testnet.polkadot.io`
- Replaced broken placeholder block with a clear deployment table for contract addresses and tx/explorer links.
- Added explicit instructions for extracting deployment outputs from script-generated files.

## 1.0.0-hackathon (2026-03-11)

- Created public GitHub submission package with sensitive/infrastructure data removed.
- Kept core hackathon deliverables: frontend, solver, circuits, Revive Solidity contracts, and deployment helpers.
- Rewrote README for hackathon submission format and judging alignment.
