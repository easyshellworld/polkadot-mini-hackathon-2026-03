/**
 * Client-side ZK proof generation using snarkjs + circomlibjs.
 *
 * This module generates Groth16 proofs for trade intents in the browser.
 * The proofs encode:
 * - Intent parameters commitment (Poseidon hash)
 * - Nullifier for double-spend prevention
 * - Validity constraints (deadline, amounts, etc.)
 *
 * Chain-agnostic: Same Circom circuits used for both StarkShield and PolkaShield.
 */

// @ts-ignore - snarkjs doesn't have TypeScript types
import * as snarkjs from 'snarkjs';
import { cryptoWaitReady, decodeAddress } from '@polkadot/util-crypto';

interface ProofInput {
  user: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  minAmountOut: string;
}

interface GeneratedProof {
  intentHash: string;
  nullifier: string;
  proofData: string[];
  publicInputs: string[];
}

// Paths to compiled circuit artifacts (served from public/)
const WASM_PATH = '/circuits/intent_circuit.wasm';
const ZKEY_PATH = '/circuits/intent_circuit_final.zkey';

/**
 * Generate a Poseidon hash of the intent parameters.
 * Uses circomlibjs for browser-compatible Poseidon.
 */
async function computePoseidonHash(inputs: bigint[]): Promise<bigint> {
  // Dynamic import for circomlibjs (heavy WASM module)
  const { buildPoseidon } = await import('circomlibjs');
  const poseidon = await buildPoseidon();

  const hash = poseidon(inputs);
  return poseidon.F.toObject(hash);
}

/**
 * Convert a Substrate SS58 address to a circuit field element.
 * Uses the raw public key bytes so the value is stable across SS58 prefixes.
 */
async function addressToFieldElement(address: string): Promise<bigint> {
  await cryptoWaitReady();

  try {
    const pubkey = decodeAddress(address); // 32-byte account public key
    return bytesToFieldElement(pubkey);
  } catch {
    // Fallback for non-SS58 symbolic inputs (e.g. PAS_NATIVE marker).
    let hash = BigInt(0);
    for (let i = 0; i < address.length; i++) {
      hash = (hash * BigInt(31) + BigInt(address.charCodeAt(i))) % (BigInt(2) ** BigInt(253));
    }
    return hash;
  }
}

function bytesToFieldElement(bytes: Uint8Array): bigint {
  let value = 0n;
  for (const b of bytes) {
    value = (value << 8n) + BigInt(b);
  }
  return value % (BigInt(2) ** BigInt(253));
}

/**
 * Generate a random salt for uniqueness
 */
function generateSalt(): bigint {
  const bytes = new Uint8Array(31); // 31 bytes to fit in field
  crypto.getRandomValues(bytes);
  let salt = BigInt(0);
  for (const byte of bytes) {
    salt = salt * BigInt(256) + BigInt(byte);
  }
  return salt;
}

/**
 * Generate a Groth16 proof for a trade intent.
 *
 * Steps:
 * 1. Convert inputs to field elements
 * 2. Compute Poseidon intent hash (commitment)
 * 3. Compute nullifier = Poseidon(user, salt)
 * 4. Generate Groth16 proof via snarkjs
 * 5. Return serialized proof data
 */
export async function generateProof(input: ProofInput): Promise<GeneratedProof> {
  // Convert addresses to field elements
  const userField = await addressToFieldElement(input.user);
  const tokenInField = await addressToFieldElement(input.tokenIn);
  const tokenOutField = await addressToFieldElement(input.tokenOut);
  const amountIn = BigInt(input.amountIn);
  const minAmountOut = BigInt(input.minAmountOut);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now
  const salt = generateSalt();

  // Compute intent hash: Poseidon(user, tokenIn, tokenOut, amountIn, minAmountOut, deadline, salt)
  const intentHash = await computePoseidonHash([
    userField,
    tokenInField,
    tokenOutField,
    amountIn,
    minAmountOut,
    deadline,
    salt,
  ]);

  // Compute nullifier: Poseidon(user, salt)
  const nullifier = await computePoseidonHash([userField, salt]);

  // Current time for deadline check in circuit
  const currentTime = BigInt(Math.floor(Date.now() / 1000));

  // Circuit inputs
  const circuitInputs = {
    // Private inputs
    user: userField.toString(),
    tokenIn: tokenInField.toString(),
    tokenOut: tokenOutField.toString(),
    amountIn: amountIn.toString(),
    minAmountOut: minAmountOut.toString(),
    deadline: deadline.toString(),
    salt: salt.toString(),
    balanceProof: ['1', '1', '1', '1'], // Placeholder
    approvalProof: ['1', '1', '1', '1'], // Placeholder

    // Public inputs
    intentHash: intentHash.toString(),
    nullifier: nullifier.toString(),
    currentTime: currentTime.toString(),
  };

  try {
    // Generate Groth16 proof
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      circuitInputs,
      WASM_PATH,
      ZKEY_PATH,
    );

    // Serialize proof points
    const proofData = [
      proof.pi_a[0],
      proof.pi_a[1],
      proof.pi_b[0][0],
      proof.pi_b[0][1],
      proof.pi_b[1][0],
      proof.pi_b[1][1],
      proof.pi_c[0],
      proof.pi_c[1],
    ];

    return {
      intentHash: '0x' + intentHash.toString(16).padStart(64, '0'),
      nullifier: '0x' + nullifier.toString(16).padStart(64, '0'),
      proofData,
      publicInputs: publicSignals,
    };
  } catch (error) {
    console.error('Proof generation failed:', error);
    // Fallback for development (when circuit artifacts are not available)
    return {
      intentHash: '0x' + intentHash.toString(16).padStart(64, '0'),
      nullifier: '0x' + nullifier.toString(16).padStart(64, '0'),
      proofData: ['0', '0', '0', '0', '0', '0', '0', '0'],
      publicInputs: [intentHash.toString(), nullifier.toString(), currentTime.toString()],
    };
  }
}
