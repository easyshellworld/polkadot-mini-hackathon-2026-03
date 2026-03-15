# PolkaShield Solidity (Track 1 Migration Scaffold)

This package is the EVM migration scaffold for Revive Track 1 submission.
It provides:
- `DarkPool.sol`: minimal intent lifecycle (submit, cancel, settle)
- `IntentVerifierMock.sol`: mock proof verifier for demo
- Hardhat compile/test/deploy workflow

## Quick Start

```bash
cd contracts/solidity
npm install
npm run build
npm test
```

## Deploy To Revive

1. Copy `.env.example` to `.env` and fill values.
2. Run:

```bash
npm run deploy:revive
```

Deployment script prints deployed addresses as JSON for frontend/solver env wiring.

## Deploy Mock Tokens (No Circle Needed)

If testnet USDC faucet is unavailable, deploy local demo tokens on Revive:

```bash
cd contracts/solidity

# optional: comma-separated recipients
export MINT_RECIPIENTS=0xUserA,0xUserB
export MOCK_USDC_MINT=10000
export MOCK_WETH_MINT=10

npm run deploy:mocks
```

This deploys:
- `mUSDC` (6 decimals)
- `mWETH` (18 decimals)

Then mint tokens to recipients for approve/swap demo flow.

## Frontend Direct Submit Toggle

To route EVM intent submission directly to Solidity `DarkPool` from browser:

```bash
# frontend/.env
VITE_DARK_POOL_ADDRESS=<deployed_dark_pool_address>
VITE_EVM_DIRECT_SUBMIT=true
```

If `VITE_EVM_DIRECT_SUBMIT` is unset or `false`, frontend keeps using solver submission path.

## Notes

- This is a submission scaffold for migration proof.
- Replace `IntentVerifierMock` with production verifier before mainnet deployment.
