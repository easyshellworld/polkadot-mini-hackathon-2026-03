/**
 * Solver API client for PolkaShield.
 * Communicates with the Rust solver backend.
 *
 * API is identical to StarkShield's solver API (v1).
 */

function resolveSolverUrl(): string {
  const configured =
    (import.meta.env.VITE_SOLVER_URL as string | undefined) ||
    (import.meta.env.VITE_SOLVER_API_URL as string | undefined) ||
    '';

  if (typeof window === 'undefined') {
    return configured || 'http://localhost:3001';
  }

  // Avoid mixed-content failures when app is served over HTTPS.
  if (window.location.protocol === 'https:' && configured.startsWith('http://')) {
    return `${window.location.origin}/api`;
  }

  return configured || `${window.location.origin}/api`;
}

const SOLVER_URL = resolveSolverUrl();

interface SubmitIntentParams {
  intentHash: string;
  nullifier: string;
  proofData: string[];
  proofPublicInputs: string[];
  publicInputs: {
    user: string;
    recipient: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    minAmountOut: string;
    deadline: number;
    nonce: number;
    chainId: string;
    domainSeparator: string;
    version: number;
  };
  signature: string;
  encryptedDetails?: string;
}

export interface SolverSubmitMeta {
  correlationId: string | null;
  code: string | null;
  httpStatus: number;
}

export interface SubmitIntentResult {
  intent_id?: string;
  status?: string;
  match_id?: string;
  correlation_id?: string;
  [key: string]: any;
  meta: SolverSubmitMeta;
}

export class SolverApiError extends Error {
  code: string | null;
  correlationId: string | null;
  httpStatus: number;

  constructor(message: string, opts: { code?: string | null; correlationId?: string | null; httpStatus: number }) {
    super(message);
    this.name = 'SolverApiError';
    this.code = opts.code ?? null;
    this.correlationId = opts.correlationId ?? null;
    this.httpStatus = opts.httpStatus;
  }
}

interface IntentQueryResult {
  intent: {
    id: string;
    nullifier: string;
    status: string;
    created_at: string;
    matched_with?: string;
    settlement_tx_hash?: string;
    bridge_tx_hash?: string;
  };
}

async function apiCall(path: string, options?: RequestInit): Promise<any> {
  const url = `${SOLVER_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `API error: ${response.status}`);
  }

  return data;
}

/** Submit a trade intent to the solver */
export async function submitIntent(params: SubmitIntentParams): Promise<SubmitIntentResult> {
  const url = `${SOLVER_URL}/v1/intents`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent_hash: params.intentHash,
      nullifier: params.nullifier,
      proof_data: params.proofData,
      proof_public_inputs: params.proofPublicInputs,
      public_inputs: {
        user: params.publicInputs.user,
        recipient: params.publicInputs.recipient,
        token_in: params.publicInputs.tokenIn,
        token_out: params.publicInputs.tokenOut,
        amount_in: params.publicInputs.amountIn,
        min_amount_out: params.publicInputs.minAmountOut,
        deadline: params.publicInputs.deadline,
        nonce: params.publicInputs.nonce,
        chain_id: params.publicInputs.chainId,
        domain_separator: params.publicInputs.domainSeparator,
        version: params.publicInputs.version,
      },
      encrypted_details: params.encryptedDetails,
      signature: params.signature,
    }),
  });

  const data = await response.json();
  const meta: SolverSubmitMeta = {
    correlationId: data?.correlation_id ?? null,
    code: data?.code ?? null,
    httpStatus: response.status,
  };

  if (!response.ok) {
    throw new SolverApiError(data?.error || `API error: ${response.status}`, {
      code: data?.code,
      correlationId: data?.correlation_id,
      httpStatus: response.status,
    });
  }

  return {
    ...data,
    meta,
  };
}

/** Query an intent by nullifier */
export async function queryIntent(nullifier: string): Promise<IntentQueryResult> {
  return apiCall(`/v1/intents/${encodeURIComponent(nullifier)}`);
}

/** Get all pending intents */
export async function getPendingIntents(): Promise<any[]> {
  return apiCall('/v1/intents/pending');
}

/** Get recent intents across all statuses */
export async function getRecentIntents(): Promise<any[]> {
  return apiCall('/v1/intents/recent');
}

/** Get solver statistics */
export async function getStats(): Promise<{ pending_intents: number; matched_pairs: number }> {
  return apiCall('/v1/stats');
}

/** Health check */
export async function healthCheck(): Promise<any> {
  return apiCall('/v1/health');
}
