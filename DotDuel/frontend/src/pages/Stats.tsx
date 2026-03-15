import { BarChart3, TrendingUp, Trophy, Users, DollarSign, Activity, RefreshCw, AlertCircle } from 'lucide-react'
import { formatEther } from 'ethers'
import { usePlatformStats, useRecentMatches } from '../hooks/useMatchesApi'

type LeaderboardEntry = {
  address: string
  wins: number
  losses: number
  winRate: number
  volumeWei: string
}

type RecentMatch = {
  id: number
  description: string
  stakeAmountWei: string
  status: number
  winner: string
  updatedAt: number
  stakeAmountDOT?: string
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

const statusLabels = ['Waiting', 'In Progress', 'Completed', 'Cancelled']
const statusClasses = [
  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'bg-white/[0.04] text-gray-100 bg-[#080b12] dark:text-gray-200',
]

const formatAddress = (addr: string) => {
  if (!addr || addr === ZERO_ADDRESS) return '—'
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

const formatTimestamp = (timestamp: number) => {
  if (!timestamp) return '—'
  return new Date(timestamp * 1000).toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Stats() {
  const {
    data: platformStats,
    isLoading: statsLoading,
    isRefetching: statsRefetching,
    error: statsError,
    refetch: refetchStats,
  } = usePlatformStats()

  const {
    data: recentMatches,
    isLoading: recentLoading,
    isRefetching: recentRefetching,
    error: recentError,
    refetch: refetchRecent,
  } = useRecentMatches(10)

  const isRefreshing = statsRefetching || recentRefetching
  const totalMatches = platformStats?.totalMatches ?? 0
  const totalUsers = platformStats?.totalUsers ?? 0
  const activeMatches = platformStats?.activeMatches ?? 0
  const completedMatches = platformStats?.completedMatches ?? 0
  const cancelledMatches = platformStats?.cancelledMatches ?? 0
  const waitingMatches = platformStats?.waitingMatches ?? 0

  const totalVolumeWei = BigInt(platformStats?.totalVolumeWei ?? '0')
  const totalVolumeDOT = Number.parseFloat(formatEther(totalVolumeWei))
  const totalVolumeDisplay = totalVolumeDOT === 0 ? '0.00' : totalVolumeDOT.toFixed(2)

  const completionRate = totalMatches > 0 ? ((completedMatches / totalMatches) * 100).toFixed(1) : '0.0'
  const activeRate = totalMatches > 0 ? ((activeMatches / totalMatches) * 100).toFixed(1) : '0.0'
  const cancelRate = totalMatches > 0 ? ((cancelledMatches / totalMatches) * 100).toFixed(1) : '0.0'

  const leaderboard: LeaderboardEntry[] = platformStats?.topPlayers ?? []
  const recentList: RecentMatch[] = recentMatches ?? []

  const hasErrors = Boolean(statsError || recentError)
  const errorText = [
    statsError instanceof Error ? statsError.message : null,
    recentError instanceof Error ? recentError.message : null,
  ]
    .filter(Boolean)
    .join('；')

  const handleRefresh = () => {
    void refetchStats()
    void refetchRecent()
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white text-white mb-2">
              Platform Stats
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              View platform-wide data and leaderboards
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-emerald-400 dark:text-emerald-300 border border-emerald-500/60 rounded-lg hover:bg-emerald-500/5 dark:hover:bg-emerald-900/30 transition-colors"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {hasErrors && (
        <div className="mb-6 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/40 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-600 dark:text-red-300 mb-1">
              Error loading data
            </p>
            <p className="text-sm text-red-600/80 dark:text-red-200">
              {errorText || 'Please try again later.'}
            </p>
          </div>
        </div>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <Trophy className="w-8 h-8" />
            <Activity className="w-6 h-6 opacity-50" />
          </div>
          <p className="text-sm opacity-90 mb-1">Total Duels</p>
          <p className="text-4xl font-bold">{statsLoading && !platformStats ? '...' : totalMatches}</p>
          <p className="text-xs opacity-75 mt-2">{waitingMatches} waiting</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <Users className="w-8 h-8" />
            <TrendingUp className="w-6 h-6 opacity-50" />
          </div>
          <p className="text-sm opacity-90 mb-1">Active Users</p>
          <p className="text-4xl font-bold">{statsLoading && !platformStats ? '...' : totalUsers}</p>
          <p className="text-xs opacity-75 mt-2">Unique addresses in duels</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <DollarSign className="w-8 h-8" />
            <BarChart3 className="w-6 h-6 opacity-50" />
          </div>
          <p className="text-sm opacity-90 mb-1">Total Volume</p>
          <p className="text-4xl font-bold">{statsLoading && !platformStats ? '...' : totalVolumeDisplay}</p>
          <p className="text-xs opacity-75 mt-2">PAS</p>
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Completed</p>
          <p className="text-3xl font-bold text-green-600">
            {statsLoading && !platformStats ? '...' : completedMatches}
          </p>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">{completionRate}% completion rate</div>
        </div>

        <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">In Progress</p>
          <p className="text-3xl font-bold text-blue-600">
            {statsLoading && !platformStats ? '...' : activeMatches}
          </p>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">{activeRate}% active rate</div>
        </div>

        <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Cancelled</p>
          <p className="text-3xl font-bold text-gray-600">
            {statsLoading && !platformStats ? '...' : cancelledMatches}
          </p>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">{cancelRate}% cancel rate</div>
        </div>
      </div>

      {/* Top Players Leaderboard */}
      <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-6 mb-8">
        <div className="flex items-center gap-2 mb-6">
          <Trophy className="w-6 h-6 text-yellow-500" />
          <h2 className="text-2xl font-bold text-white text-white">Leaderboard</h2>
        </div>

        {statsLoading && !platformStats ? (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">Loading...</div>
        ) : leaderboard.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No player data yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06] dark:border-white/[0.06]">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Rank</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Player</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Wins</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Losses</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Win Rate</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Volume</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((player, index) => {
                  const volumeDOT = Number.parseFloat(formatEther(BigInt(player.volumeWei ?? '0')))
                  const volumeDisplay = volumeDOT === 0 ? '0.00' : volumeDOT.toFixed(2)
                  return (
                    <tr
                      key={player.address + index}
                      className="border-b border-gray-100 dark:border-white/[0.06] last:border-0 hover:bg-white/[0.02] dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          {index < 3 ? (
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                                index === 0
                                  ? 'bg-yellow-500'
                                  : index === 1
                                  ? 'bg-gray-400'
                                  : 'bg-orange-600'
                              }`}
                            >
                              {index + 1}
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-600 text-gray-200 text-gray-300 font-bold">
                              {index + 1}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-mono text-sm text-white text-white">{formatAddress(player.address)}</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="text-sm font-semibold text-white text-white">{player.wins}</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="text-sm font-semibold text-white text-white">{player.losses}</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="text-sm font-semibold text-green-600">{player.winRate.toFixed(1)}%</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="text-sm font-semibold text-white text-white">{volumeDisplay} PAS</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Matches */}
      <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-2 mb-6">
          <Activity className="w-6 h-6 text-emerald-400" />
          <h2 className="text-2xl font-bold text-white text-white">Recent Matches</h2>
        </div>

        {recentLoading && !recentMatches ? (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">Loading...</div>
        ) : recentList.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No match history yet</p>
        ) : (
          <div className="space-y-3">
            {recentList.map((match: RecentMatch) => {
              const stakeDOT = match.stakeAmountDOT
                ? Number.parseFloat(match.stakeAmountDOT)
                : Number.parseFloat(formatEther(BigInt(match.stakeAmountWei ?? '0')))
              const stakeDisplay = Number.isFinite(stakeDOT) ? stakeDOT.toFixed(2) : '0.00'
              const statusClass = statusClasses[match.status] ?? statusClasses[0]
              const statusLabel = statusLabels[match.status] ?? 'Unknown'
              const hasWinner = match.winner && match.winner !== ZERO_ADDRESS
              return (
                <div
                  key={match.id}
                  className="flex items-center justify-between p-4 bg-white/[0.02] dark:bg-white/[0.05] rounded-lg hover:bg-white/[0.04] dark:hover:bg-gray-600 transition-colors"
                >
                  <div className="flex-1 pr-4">
                    <p className="font-medium text-white text-white mb-1 line-clamp-1">
                      {match.description || `Match #${match.id}`}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Stake: {stakeDisplay} PAS · Updated {formatTimestamp(match.updatedAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusClass}`}>
                      {statusLabel}
                    </span>
                    {hasWinner && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">
                        Winner: {formatAddress(match.winner)}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
