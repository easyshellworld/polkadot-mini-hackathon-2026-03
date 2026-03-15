/**
 * Contract addresses and token constants for PolkaShield.
 * Targeting Polkadot Hub TestNet (PAS).
 */

// Contract addresses (populated after deployment via VITE_ env vars)
export const CONTRACTS = {
  DARK_POOL: import.meta.env.VITE_DARK_POOL_ADDRESS || '',
  INTENT_VERIFIER: import.meta.env.VITE_VERIFIER_ADDRESS || '',
  GROTH16_VERIFIER: import.meta.env.VITE_GROTH16_VERIFIER_ADDRESS || '',
};

// Special marker used across frontend/solver to represent native PAS.
export const PAS_NATIVE_MARKER = 'PAS_NATIVE';

// Polkadot Hub TestNet chain constants
export const POLKADOT_HUB_TESTNET = {
  CHAIN_ID: 420420417,
  CHAIN_ID_HEX: '0x190f1b41',
  RPC_URL: 'https://services.polkadothub-rpc.com/testnet',
  EXPLORER_URL: 'https://blockscout-testnet.polkadot.io',
  NATIVE_DECIMALS: 18,
};

// Known tokens for demo flows (Polkadot Hub TestNet)
export const TOKENS: Record<string, { name: string; symbol: string; decimals: number; address: string }> = {
  PAS_NATIVE: {
    name: 'Polkadot Hub TestNet Native Token',
    symbol: 'PAS',
    decimals: 18,
    address: PAS_NATIVE_MARKER,
  },
  WETH_SNOWBRIDGE: {
    name: 'Wrapped ETH (Snowbridge)',
    symbol: 'wETH',
    decimals: 18,
    address: import.meta.env.VITE_WETH_CONTRACT || '',
  },
};

// Protocol constants
export const PROTOCOL = {
  CHAIN_ID: 'polkashield-pas-testnet',
  DOMAIN_SEPARATOR: 'polkashield-v1',
  VERSION: 1,
  DEFAULT_DEADLINE_SECONDS: 3600, // 1 hour
  DEFAULT_SLIPPAGE_BPS: 50, // 0.5%
};
