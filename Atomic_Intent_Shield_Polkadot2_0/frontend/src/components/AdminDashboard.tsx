import React, { useEffect, useState, useCallback } from 'react';
import { getPendingIntents, getRecentIntents, getStats } from '../utils/solver-api';
import { POLKADOT_HUB_TESTNET } from '../constants';

interface IntentInfo {
  id: string;
  nullifier: string;
  status: string;
  created_at: string;
  matched_with?: string;
  settlement_tx_hash?: string;
  user?: string;
  token_in?: string;
  token_out?: string;
  amount_in?: string;
  min_amount_out?: string;
}

interface SolverStats {
  pending_intents: number;
  matched_pairs: number;
}

type FilterTab = 'all' | 'pending' | 'matched' | 'settled';

const txExplorerBase =
  `${POLKADOT_HUB_TESTNET.EXPLORER_URL.replace(/\/$/, '')}/tx/`;

function txUrl(txHash?: string): string | null {
  if (!txHash) return null;
  const base = txExplorerBase.endsWith('/') ? txExplorerBase : `${txExplorerBase}/`;
  return `${base}${txHash}`;
}

const AdminDashboard: React.FC = () => {
  const [pendingIntents, setPendingIntents] = useState<IntentInfo[]>([]);
  const [recentIntents, setRecentIntents] = useState<IntentInfo[]>([]);
  const [stats, setStats] = useState<SolverStats>({ pending_intents: 0, matched_pairs: 0 });
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [pending, recent, s] = await Promise.all([
        getPendingIntents(),
        getRecentIntents(),
        getStats(),
      ]);
      setPendingIntents(pending);
      setRecentIntents(recent);
      setStats(s);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchAll();
    if (!autoRefresh) return;
    const interval = setInterval(fetchAll, 4000);
    return () => clearInterval(interval);
  }, [fetchAll, autoRefresh]);

  // Merge all intents, dedup by id
  const allIntents: IntentInfo[] = (() => {
    const map = new Map<string, IntentInfo>();
    for (const i of pendingIntents) map.set(i.id, i);
    for (const i of recentIntents) map.set(i.id, i);
    const arr = Array.from(map.values());
    arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return arr;
  })();

  const filtered = allIntents.filter((i) => {
    if (filterTab === 'all') return true;
    return i.status === filterTab;
  });

  const countByStatus = (s: string) => allIntents.filter((i) => i.status === s).length;

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
      matched: 'bg-blue-900/50 text-blue-300 border-blue-700',
      settled: 'bg-green-900/50 text-green-300 border-green-700',
      cancelled: 'bg-gray-800 text-gray-400 border-gray-600',
      expired: 'bg-red-900/50 text-red-300 border-red-700',
    };
    return (
      <span className={`inline-block px-2 py-0.5 rounded border text-xs font-semibold ${colors[status] || 'bg-gray-800 text-gray-400 border-gray-600'}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  // Settlement side analysis
  const settlementSide = (intent: IntentInfo) => {
    if (intent.status === 'settled' && intent.settlement_tx_hash) {
      return <span className="text-green-400 text-xs">Both sides settled (state only)</span>;
    }
    if (intent.status === 'matched') {
      return <span className="text-yellow-400 text-xs">Awaiting on-chain settlement</span>;
    }
    return <span className="text-gray-500 text-xs">N/A</span>;
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Intents" value={allIntents.length} color="text-white" />
        <StatCard label="Pending" value={countByStatus('pending')} color="text-yellow-400" />
        <StatCard label="Matched" value={countByStatus('matched')} color="text-blue-400" />
        <StatCard label="Settled" value={countByStatus('settled')} color="text-green-400" />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex space-x-2">
          {(['all', 'pending', 'matched', 'settled'] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                filterTab === tab
                  ? tab === 'pending' ? 'bg-yellow-600 text-white'
                    : tab === 'matched' ? 'bg-blue-600 text-white'
                    : tab === 'settled' ? 'bg-green-600 text-white'
                    : 'bg-gray-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab !== 'all' && ` (${countByStatus(tab)})`}
            </button>
          ))}
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchAll}
            className="px-3 py-1.5 rounded-lg text-sm bg-gray-800 hover:bg-gray-700 text-gray-200"
          >
            Refresh
          </button>
          <label className="flex items-center space-x-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span>Auto (4s)</span>
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-900/70 text-gray-400 text-left">
            <tr>
              <th className="px-4 py-3">Nullifier</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Matched With</th>
              <th className="px-4 py-3">Settlement</th>
              <th className="px-4 py-3">Settlement Tx</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-gray-500 py-10">
                  No intents found
                </td>
              </tr>
            ) : (
              filtered.map((intent) => (
                <tr key={intent.id} className="hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-200">
                    {intent.nullifier.slice(0, 14)}...
                  </td>
                  <td className="px-4 py-3">{statusBadge(intent.status)}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(intent.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">
                    {intent.matched_with ? `${intent.matched_with.slice(0, 14)}...` : '—'}
                  </td>
                  <td className="px-4 py-3">{settlementSide(intent)}</td>
                  <td className="px-4 py-3">
                    {intent.settlement_tx_hash ? (
                      <a
                        href={txUrl(intent.settlement_tx_hash) || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-cyan-400 hover:text-cyan-300 underline"
                      >
                        {intent.settlement_tx_hash.slice(0, 14)}...
                      </a>
                    ) : (
                      <span className="text-gray-500 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Solver stats footer */}
      <div className="mt-4 text-xs text-gray-500 text-right">
        Solver stats — Pending: {stats.pending_intents} / Matched pairs: {stats.matched_pairs}
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
    <div className="text-gray-400 text-xs mb-1">{label}</div>
    <div className={`text-2xl font-bold ${color}`}>{value}</div>
  </div>
);

export default AdminDashboard;
