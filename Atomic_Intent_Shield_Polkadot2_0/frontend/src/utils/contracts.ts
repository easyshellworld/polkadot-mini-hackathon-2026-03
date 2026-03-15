/**
 * Polkadot Hub EVM contract interaction utilities.
 * Uses EIP-1193 provider (MetaMask / SubWallet EVM) for Revive-deployed
 * Solidity contracts on Westend Asset Hub.
 */

import { CONTRACTS } from '../constants';
import { ethers } from 'ethers';

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<any>;
};

const darkPoolAbi = [
  'function getIntentStatus(bytes32 nullifier) view returns (uint8)',
  'function submitIntent((address user,address recipient,bytes32 intentHash,bytes32 nullifier,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,bytes proofData,bytes publicInputs,uint64 deadline) submission)',
];

const darkPoolIface = new ethers.utils.Interface(darkPoolAbi);

/**
 * Encode a uint256 value as a 32-byte hex string (no 0x prefix).
 */
function encodeUint256(value: bigint): string {
  return value.toString(16).padStart(64, '0');
}

/**
 * Encode a bytes32 value (hex string with 0x prefix) as 32-byte padded hex.
 */
function encodeBytes32(hex: string): string {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  return clean.padStart(64, '0');
}

/**
 * Compute the first 4 bytes of a keccak256 hash for a function selector.
 * Uses the SubtleCrypto API — we rely on the solver for heavy operations,
 * this is just for read-only calls / UI display.
 */
function stringifyProofPayload(values: string[]): string {
  return JSON.stringify(values);
}

/**
 * Query intent status from the DarkPool contract (read-only eth_call).
 * Returns the status as a number, or null if not found.
 */
export async function queryIntentOnChain(
  provider: Eip1193Provider,
  nullifier: string,
): Promise<number | null> {
  const data = darkPoolIface.encodeFunctionData('getIntentStatus', [nullifier]);

  try {
    const result = await provider.request({
      method: 'eth_call',
      params: [{
        to: CONTRACTS.DARK_POOL,
        data,
      }, 'latest'],
    }) as string;

    if (!result || result === '0x') {
      return null;
    }
    const decoded = darkPoolIface.decodeFunctionResult('getIntentStatus', result);
    return Number(decoded[0]);
  } catch (error) {
    console.error('Failed to query intent status:', error);
    return null;
  }
}

/**
 * Submit an intent via the solver API (ZK proof is generated client-side,
 * then sent to the solver which submits the on-chain transaction).
 * Direct on-chain submission from the browser is also possible via EVM tx.
 */
export async function submitIntentViaEvm(
  provider: Eip1193Provider,
  from: string,
  user: string,
  recipient: string,
  nullifier: string,
  intentHash: string,
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  minAmountOut: string,
  proofData: string[],
  publicInputs: string[],
  deadline: number,
): Promise<string> {
  if (!CONTRACTS.DARK_POOL) {
    throw new Error('Missing VITE_DARK_POOL_ADDRESS for direct EVM submission.');
  }

  // For Track 1 demo path, verifier mock ignores proof payload internals.
  const proofDataBytes = ethers.utils.hexlify(
    ethers.utils.toUtf8Bytes(stringifyProofPayload(proofData))
  );
  const publicInputBytes = ethers.utils.hexlify(
    ethers.utils.toUtf8Bytes(stringifyProofPayload(publicInputs))
  );

  const calldata = darkPoolIface.encodeFunctionData('submitIntent', [{
    user,
    recipient,
    intentHash,
    nullifier,
    tokenIn,
    tokenOut,
    amountIn,
    minAmountOut,
    proofData: proofDataBytes,
    publicInputs: publicInputBytes,
    deadline,
  }]);

  const txHash = await provider.request({
    method: 'eth_sendTransaction',
    params: [{
      from,
      to: CONTRACTS.DARK_POOL,
      data: calldata,
      value: '0x0',
    }],
  }) as string;

  return txHash;
}

/**
 * Approve ERC-20 token spending for the DarkPool contract.
 * Standard ERC-20 approve(address spender, uint256 amount).
 */
export async function approveERC20(
  provider: Eip1193Provider,
  from: string,
  tokenAddress: string,
  amount: bigint,
): Promise<string> {
  // approve(address,uint256) selector = 0x095ea7b3
  const data = '0x095ea7b3'
    + encodeBytes32(CONTRACTS.DARK_POOL) // spender (address padded to 32 bytes)
    + encodeUint256(amount);

  const txHash = await provider.request({
    method: 'eth_sendTransaction',
    params: [{
      from,
      to: tokenAddress,
      data,
    }],
  }) as string;

  return txHash;
}
