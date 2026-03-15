import { useState, useCallback, useEffect } from 'react';
import { usePolkadot } from '../providers/PolkadotProvider';
import { queryIntent } from '../utils/solver-api';

/**
 * Hook for polling intent status from the solver API.
 */
export function useIntentStatus(nullifier: string | null, pollIntervalMs = 5000) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!nullifier) return;
    setLoading(true);
    try {
      const result = await queryIntent(nullifier);
      setStatus(result.intent.status);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [nullifier]);

  useEffect(() => {
    if (!nullifier) return;
    fetchStatus();
    const interval = setInterval(fetchStatus, pollIntervalMs);
    return () => clearInterval(interval);
  }, [nullifier, pollIntervalMs, fetchStatus]);

  return { status, loading, error, refresh: fetchStatus };
}

/**
 * Hook for managing wallet connection state.
 */
export function useWallet() {
  const { selectedAccount, isConnected, connect, disconnect, getSigner } = usePolkadot();

  return {
    address: selectedAccount?.address || null,
    name: selectedAccount?.meta.name || null,
    isConnected,
    connect,
    disconnect,
    getSigner,
  };
}
