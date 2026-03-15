import React, { useEffect, useState } from 'react';
import { queryIntent, getPendingIntents, getRecentIntents } from '../utils/solver-api';
import { POLKADOT_HUB_TESTNET } from '../constants';

interface IntentInfo {
  id: string;
  nullifier: string;
  status: string;
  created_at: string;
  matched_with?: string;
  settlement_tx_hash?: string;
  bridge_tx_hash?: string;
}

const IntentStatus: React.FC = () => {
  const [nullifierQuery, setNullifierQuery] = useState('');
  const [intent, setIntent] = useState<IntentInfo | null>(null);
  const [pendingIntents, setPendingIntents] = useState<IntentInfo[]>([]);
  const [recentIntents, setRecentIntents] = useState<IntentInfo[]>([]);
  const [showSettledOnly, setShowSettledOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const settlementExplorerBase = `${POLKADOT_HUB_TESTNET.EXPLORER_URL.replace(/\/$/, '')}/tx/`;

  const evmTxUrl = (txHash?: string) => {
    if (!txHash) return null;
    const base = settlementExplorerBase.endsWith('/') ? settlementExplorerBase : `${settlementExplorerBase}/`;
    return `${base}${txHash}`;
  };

  const settlementTxUrl = (txHash?: string) => {
    if (!txHash) return null;
    const base = settlementExplorerBase.endsWith('/') ? settlementExplorerBase : `${settlementExplorerBase}/`;
    return `${base}${txHash}`;
  };

  const runQuery = async (nullifier: string) => {
    if (!nullifier) return;
    setError(null);
    try {
      const result = await queryIntent(nullifier);
      setIntent(result.intent);
      setNullifierQuery(nullifier);
    } catch (err: any) {
      setError(err.message || 'Intent not found');
      setIntent(null);
    }
  };

  // Poll pending intents
  useEffect(() => {
    const fetchPending = async () => {
      try {
        const intents = await getPendingIntents();
        setPendingIntents(intents);
      } catch {
        // Silent fail for polling
      }
    };

    const fetchRecent = async () => {
      try {
        const intents = await getRecentIntents();
        setRecentIntents(intents);
      } catch {
        // Silent fail for polling
      }
    };

    fetchPending();
    fetchRecent();
    const interval = setInterval(() => {
      fetchPending();
      fetchRecent();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleQuery = async () => {
    await runQuery(nullifierQuery);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-400';
      case 'matched': return 'text-blue-400';
      case 'settled': return 'text-green-400';
      case 'cancelled': return 'text-gray-400';
      case 'expired': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const filteredRecentIntents = recentIntents.filter((ri) => {
    if (showSettledOnly) return ri.status === 'settled';
    return ri.status !== 'pending';
  });

  return (
    <div className="bg-gray-800 rounded-2xl p-6 shadow-xl">
      <h2 className="text-xl font-bold mb-6">Intent Status</h2>

      {/* Query by nullifier */}
      <div className="flex space-x-2 mb-6">
        <input
          type="text"
          value={nullifierQuery}
          onChange={(e) => setNullifierQuery(e.target.value)}
          placeholder="Enter nullifier (0x...)"
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 text-sm"
        />
        <button
          onClick={handleQuery}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
        >
          Query
        </button>
      </div>

      {/* Query result */}
      {error && (
        <div className="text-red-400 text-sm mb-4">{error}</div>
      )}
      {intent && (
        <div className="bg-gray-900 rounded-lg p-4 mb-6">
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Status</span>
              <span className={`font-bold ${statusColor(intent.status)}`}>
                {intent.status.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Nullifier</span>
              <span className="font-mono text-xs">{intent.nullifier.slice(0, 16)}...</span>
            </div>
            {intent.matched_with && (
              <div className="flex justify-between">
                <span className="text-gray-400">Matched With</span>
                <span className="font-mono text-xs">{intent.matched_with.slice(0, 16)}...</span>
              </div>
            )}
            {intent.settlement_tx_hash && (
              <div className="flex justify-between">
                <span className="text-gray-400">Settlement Tx (EVM, state-only)</span>
                <a
                  href={settlementTxUrl(intent.settlement_tx_hash) || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-cyan-400 hover:text-cyan-300 underline"
                >
                  {intent.settlement_tx_hash.slice(0, 16)}...
                </a>
              </div>
            )}
            {intent.bridge_tx_hash && (
              <div className="flex justify-between">
                <span className="text-gray-400">Bridge Tx (EVM)</span>
                <a
                  href={evmTxUrl(intent.bridge_tx_hash) || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-orange-400 hover:text-orange-300 underline"
                >
                  {intent.bridge_tx_hash.slice(0, 16)}...
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pending intents */}
      <h3 className="text-sm font-bold text-gray-400 mb-3">
        Pending Intents ({pendingIntents.length})
      </h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {pendingIntents.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">No pending intents</p>
        ) : (
          pendingIntents.map((pi) => (
            <div
              key={pi.id}
              className="bg-gray-900 rounded-lg px-3 py-2 flex justify-between items-center cursor-pointer hover:bg-gray-700"
              onClick={() => {
                runQuery(pi.nullifier);
              }}
            >
              <span className="font-mono text-xs text-gray-300">
                {pi.nullifier.slice(0, 12)}...
              </span>
              <span className={`text-xs ${statusColor(pi.status)}`}>
                {pi.status}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="mt-6 mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-400">
          Recent Matched/Settled
        </h3>
        <button
          type="button"
          onClick={() => setShowSettledOnly((v) => !v)}
          className={`text-xs px-3 py-1 rounded-lg border transition-colors ${showSettledOnly
            ? 'bg-green-900/30 border-green-600 text-green-300'
            : 'bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-700'
            }`}
        >
          {showSettledOnly ? 'Showing: Settled' : 'Filter: Settled Only'}
        </button>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {filteredRecentIntents.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">
            {showSettledOnly ? 'No settled intents yet' : 'No matched/settled intents yet'}
          </p>
        ) : (
          filteredRecentIntents
            .map((ri) => (
              <div
                key={`${ri.id}-recent`}
                className="bg-gray-900 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-700"
                onClick={() => runQuery(ri.nullifier)}
              >
                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs text-gray-300">
                    {ri.nullifier.slice(0, 12)}...
                  </span>
                  <span className={`text-xs ${statusColor(ri.status)}`}>
                    {ri.status}
                  </span>
                </div>
                {ri.settlement_tx_hash && (
                  <div className="mt-1 text-right">
                    <a
                      href={settlementTxUrl(ri.settlement_tx_hash) || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[11px] text-cyan-400 hover:text-cyan-300 underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Settlement tx: {ri.settlement_tx_hash.slice(0, 16)}...
                    </a>
                  </div>
                )}
                {ri.bridge_tx_hash && (
                  <div className="mt-1 text-right">
                    <a
                      href={evmTxUrl(ri.bridge_tx_hash) || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[11px] text-orange-400 hover:text-orange-300 underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      EVM tx: {ri.bridge_tx_hash.slice(0, 16)}...
                    </a>
                  </div>
                )}
              </div>
            ))
        )}
      </div>
    </div>
  );
};

export default IntentStatus;
