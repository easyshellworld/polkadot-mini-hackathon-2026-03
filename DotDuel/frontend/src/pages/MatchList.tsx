import { useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import MatchCard from '../components/match/MatchCard'
import { AlertCircle, Filter, RefreshCw, Search } from 'lucide-react'
import { MatchApiData, useMatchList } from '../hooks/useMatchesApi'
import { formatEther } from 'ethers'

export default function MatchList() {
  const { isConnected } = useAccount()
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterMode, setFilterMode] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const {
    data,
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useMatchList({ limit: 100 })

  const matches: MatchApiData[] = data?.matches ?? []

  const stats = useMemo(() => {
    const summary = {
      total: data?.meta?.total ?? matches.length,
      waiting: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
      refundReady: 0,
      volume: 0n,
    }

    for (const match of matches) {
      summary.volume += BigInt(match.stakeAmountWei ?? '0')
      const participantCount = match.participants.filter(
        (participant: string) => participant !== '0x0000000000000000000000000000000000000000'
      ).length
      const nowSeconds = Math.floor(Date.now() / 1000)

      if (match.status === 0 && participantCount < 2 && nowSeconds >= match.startTime) {
        summary.refundReady += 1
      }

      switch (match.status) {
        case 0:
          summary.waiting += 1
          break
        case 1:
          summary.inProgress += 1
          break
        case 2:
          summary.completed += 1
          break
        case 3:
          summary.cancelled += 1
          break
        default:
          break
      }
    }

    return summary
  }, [matches, data?.meta?.total])

  const filteredMatches = useMemo(() => {
    return matches.filter(match => {
      if (filterStatus !== 'all' && match.status !== parseInt(filterStatus)) {
        return false
      }

      if (filterMode !== 'all' && match.mode !== parseInt(filterMode)) {
        return false
      }

      if (searchQuery && !match.description.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }

      return true
    })
  }, [matches, filterStatus, filterMode, searchQuery])

  const totalVolumeDisplay = useMemo(() => {
    if (stats.volume === 0n) {
      return '0'
    }

    return Number.parseFloat(formatEther(stats.volume)).toFixed(2)
  }, [stats.volume])

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white text-white mb-2">
          Duel List
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Browse all open duels and join the one that interests you
        </p>
        <button
          onClick={() => refetch()}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm text-emerald-400 dark:text-emerald-400 border border-emerald-500 rounded-lg hover:bg-emerald-500/5 dark:hover:bg-emerald-900/30 transition-colors"
        >
          <RefreshCw size={16} className={isRefetching ? 'animate-spin' : ''} />
          {isRefetching ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={20} className="text-gray-500" />
          <h2 className="text-lg font-semibold text-white text-white">
            Filters
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-200 text-gray-300 mb-2">
              Search
            </label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search match descriptions..."
                className="w-full pl-10 pr-4 py-2 border border-white/[0.1] dark:border-white/[0.08] rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-white/[0.05] text-white"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-200 text-gray-300 mb-2">
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 border border-white/[0.1] dark:border-white/[0.08] rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-white/[0.05] text-white"
            >
              <option value="all">All Status</option>
              <option value="0">Waiting</option>
              <option value="1">In Progress</option>
              <option value="2">Completed</option>
              <option value="3">Cancelled</option>
            </select>
          </div>

          {/* Mode Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-200 text-gray-300 mb-2">
              Mode
            </label>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              className="w-full px-4 py-2 border border-white/[0.1] dark:border-white/[0.08] rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-white/[0.05] text-white"
            >
              <option value="all">All Modes</option>
              <option value="0">Referee Mode</option>
              <option value="1">Oracle Mode</option>
            </select>
          </div>
        </div>

        {/* Reset Button */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => {
              setFilterStatus('all')
              setFilterMode('all')
              setSearchQuery('')
            }}
            className="flex items-center gap-2 px-4 py-2 text-gray-200 text-gray-300 hover:bg-white/[0.04] dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <RefreshCw size={16} />
            Reset Filters
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Matches</p>
          <p className="text-2xl font-bold text-white text-white">{stats.total}</p>
        </div>
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Waiting</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.waiting}</p>
          {stats.refundReady > 0 && (
            <p className="text-xs text-amber-300 mt-1">
              Refund Ready: {stats.refundReady}
            </p>
          )}
        </div>
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">In Progress</p>
          <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
        </div>
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Completed</p>
          <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          {stats.cancelled > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Cancelled: {stats.cancelled}
            </p>
          )}
        </div>
      </div>

      <div className="mb-6 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:via-cyan-500/20 dark:to-teal-500/20 border border-emerald-500/30 dark:border-emerald-500/40 rounded-xl p-4">
        <p className="text-sm text-emerald-400 dark:text-emerald-300 mb-1">Total Stake Volume</p>
        <p className="text-2xl font-semibold text-emerald-400 dark:text-emerald-200">{totalVolumeDisplay} PAS</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/40 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-600 dark:text-red-300 mb-1">
              Error loading match data
            </p>
            <p className="text-sm text-red-600/80 dark:text-red-200">
              {error instanceof Error ? error.message : 'Please try again later.'}
            </p>
          </div>
        </div>
      )}

      {/* Match List */}
      {isLoading ? (
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-12 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-12 text-center">
          <div className="text-gray-400 mb-4">
            <Filter size={48} className="mx-auto" />
          </div>
          <h3 className="text-xl font-semibold text-white text-white mb-2">
            No Matches Found
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Adjust filters or create a new match
          </p>
          <button
            onClick={() => {
              setFilterStatus('all')
              setFilterMode('all')
              setSearchQuery('')
              refetch()
            }}
            className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg font-medium hover:from-emerald-600 hover:to-cyan-600 transition-all"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMatches.map(match => (
            <MatchCard
              key={match.id}
              match={{
                id: match.id,
                creator: match.creator,
                participants: match.participants,
                stakeAmount: BigInt(match.stakeAmountWei ?? '0'),
                status: match.status,
                mode: match.mode,
                startTime: match.startTime,
                endTime: match.endTime,
                description: match.description,
              }}
            />
          ))}
        </div>
      )}

      {/* Not Connected Notice */}
      {!isConnected && (
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 text-center">
          <p className="text-blue-800 dark:text-blue-200">
            💡 Connect your wallet to join matches
          </p>
        </div>
      )}
    </div>
  )
}

