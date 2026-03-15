import { useMemo } from 'react'
import { useAccount } from 'wagmi'
import { MatchApiData, useUserMatchesApi, useUserStatsApi } from '../hooks/useMatchesApi'
import MatchCard from '../components/match/MatchCard'
import { Trophy, Target, Award, TrendingUp, Wallet, RefreshCw, AlertCircle } from 'lucide-react'
import { formatEther } from 'ethers'

type NormalizedMatch = {
  id: number
  creator: string
  participants: string[]
  stakeAmount: bigint
  status: number
  mode: number
  startTime: number
  endTime: number
  description: string
}

export default function MyMatches() {
  const { address, isConnected } = useAccount()
  const {
    data: matches,
    isLoading: matchesLoading,
    isRefetching: matchesRefetching,
    error: matchesError,
    refetch: refetchMatches,
  } = useUserMatchesApi(address)
  const {
    data: stats,
    isLoading: statsLoading,
    isRefetching: statsRefetching,
    error: statsError,
    refetch: refetchStats,
  } = useUserStatsApi(address)

  const isRefreshing = matchesRefetching || statsRefetching

  const totalMatches = stats?.totalMatches ?? 0
  const wins = stats?.wins ?? 0
  const losses = stats?.losses ?? 0
  const winRateValue: number = stats?.winRate ?? 0
  const winRateDisplay = `${winRateValue.toFixed(1)}%`
  const totalStakedWei = BigInt(stats?.totalStakedWei ?? '0')
  const totalWonWei = BigInt(stats?.totalWonWei ?? '0')

  const normalizedMatches = useMemo<NormalizedMatch[]>(() => {
    if (!matches) return []
    return matches.map((match: MatchApiData) => ({
      id: match.id,
      creator: match.creator,
      participants: match.participants,
      stakeAmount: BigInt(match.stakeAmountWei ?? '0'),
      status: match.status,
      mode: match.mode,
      startTime: match.startTime,
      endTime: match.endTime,
      description: match.description,
    }))
  }, [matches])

  const handleRefresh = () => {
    void refetchStats()
    void refetchMatches()
  }

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-12 text-center">
          <Wallet className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h2 className="text-2xl font-bold text-white text-white mb-2">
            Connect Your Wallet
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Connect your wallet to view all your matches
          </p>
        </div>
      </div>
    )
  }

  const showMatchesSpinner = matchesLoading && normalizedMatches.length === 0
  const hasErrors = Boolean(matchesError || statsError)
  const errorText = [
    matchesError instanceof Error ? matchesError.message : null,
    statsError instanceof Error ? statsError.message : null,
  ]
    .filter(Boolean)
    .join('；')

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white text-white mb-2">
              My Duels
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              View all your duels and statistics
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {/* Total Matches */}
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Trophy className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            Total Duels
          </p>
          <p className="text-3xl font-bold text-white text-white">
            {statsLoading && !stats ? '...' : totalMatches}
          </p>
          {!statsLoading && (
            <p className="text-xs text-gray-500 text-gray-500 mt-2">
              Total staked: {formatEther(totalStakedWei)} PAS
            </p>
          )}
        </div>

        {/* Wins */}
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <Award className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Wins</p>
          <p className="text-3xl font-bold text-green-600">
            {statsLoading && !stats ? '...' : wins}
          </p>
        </div>

        {/* Losses */}
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
              <Target className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Losses</p>
          <p className="text-3xl font-bold text-red-600">
            {statsLoading && !stats ? '...' : losses}
          </p>
        </div>

        {/* Win Rate */}
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-cyan-500/10 dark:bg-cyan-900 rounded-lg">
              <TrendingUp className="w-5 h-5 text-cyan-400 dark:text-cyan-400" />
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Win Rate</p>
          <p className="text-3xl font-bold text-cyan-400">
            {statsLoading && !stats ? '...' : winRateDisplay}
          </p>
          {!statsLoading && (
            <p className="text-xs text-gray-500 text-gray-500 mt-2">
              Total won: {formatEther(totalWonWei)} PAS
            </p>
          )}
        </div>
      </div>

      {/* Matches List */}
      <div>
        <h2 className="text-2xl font-bold text-white text-white mb-6">
          Match History
        </h2>

        {showMatchesSpinner ? (
          <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-12 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        ) : normalizedMatches.length === 0 ? (
          <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-12 text-center">
            <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold text-white text-white mb-2">
              No Duels Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Create or join a duel to start competing
            </p>
            <div className="flex gap-4 justify-center">
              <a
                href="/create"
                className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg font-medium hover:from-emerald-600 hover:to-cyan-600 transition-all"
              >
                Create Duel
              </a>
              <a
                href="/matches"
                className="px-6 py-2 border-2 border-emerald-500 text-emerald-400 dark:text-emerald-400 rounded-lg font-medium hover:bg-emerald-500/5 dark:hover:bg-emerald-900/20 transition-all"
              >
                Browse Duels
              </a>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {normalizedMatches.map((match: NormalizedMatch) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
