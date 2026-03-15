import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, Users, Clock, Filter, RefreshCw, Search, Plus } from 'lucide-react'
import { useTournamentList, TournamentApiData } from '../hooks/useTournamentApi'
import { formatEther } from 'ethers'

const statusNames = ['Registration', 'In Progress', 'Completed', 'Cancelled']
const statusColors = [
  'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'bg-cyan-500/10 text-cyan-300 dark:bg-cyan-900 dark:text-cyan-200',
  'bg-white/[0.04] text-gray-100 bg-[#080b12] dark:text-gray-200',
]

const bracketSizeLabels = ['4 Players', '8 Players', '16 Players']

const formatAddress = (addr: string) => {
  if (!addr || addr === '0x0000000000000000000000000000000000000000') return '-'
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

const formatDate = (timestamp: number) => {
  if (!timestamp) return '-'
  return new Date(timestamp * 1000).toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function TournamentList() {
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const { data, isLoading, isRefetching, error, refetch } = useTournamentList({ limit: 50 })
  const tournaments: TournamentApiData[] = data?.tournaments ?? []

  const filteredTournaments = useMemo(() => {
    return tournaments.filter((t) => {
      if (filterStatus !== 'all' && t.status !== parseInt(filterStatus)) return false
      if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })
  }, [tournaments, filterStatus, searchQuery])

  const stats = useMemo(() => {
    return {
      total: tournaments.length,
      registration: tournaments.filter((t) => t.status === 0).length,
      inProgress: tournaments.filter((t) => t.status === 1).length,
      completed: tournaments.filter((t) => t.status === 2).length,
    }
  }, [tournaments])

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white text-white mb-2">
            Tournaments
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Browse and join bracket-style tournaments with prize pools
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-emerald-400 dark:text-emerald-400 border border-emerald-500 rounded-lg hover:bg-emerald-500/5 dark:hover:bg-emerald-900/30 transition-colors"
          >
            <RefreshCw size={16} className={isRefetching ? 'animate-spin' : ''} />
            {isRefetching ? 'Refreshing...' : 'Refresh'}
          </button>
          <Link
            to="/tournaments/create"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg font-medium hover:from-emerald-600 hover:to-cyan-600 transition-all"
          >
            <Plus size={16} />
            Create Tournament
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total</p>
          <p className="text-2xl font-bold text-white text-white">{stats.total}</p>
        </div>
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Registration Open</p>
          <p className="text-2xl font-bold text-green-600">{stats.registration}</p>
        </div>
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">In Progress</p>
          <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
        </div>
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Completed</p>
          <p className="text-2xl font-bold text-cyan-400">{stats.completed}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={20} className="text-gray-500" />
          <h2 className="text-lg font-semibold text-white text-white">Filters</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tournaments..."
              className="w-full pl-10 pr-4 py-2 border border-white/[0.1] dark:border-white/[0.08] rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-white/[0.05] text-white"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-4 py-2 border border-white/[0.1] dark:border-white/[0.08] rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-white/[0.05] text-white"
          >
            <option value="all">All Status</option>
            <option value="0">Registration</option>
            <option value="1">In Progress</option>
            <option value="2">Completed</option>
            <option value="3">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Tournament List */}
      {isLoading ? (
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-12 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading tournaments...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-6 text-center">
          <p className="text-red-600 dark:text-red-400">Failed to load tournaments. Please try again later.
          </p>
        </div>
      ) : filteredTournaments.length === 0 ? (
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-12 text-center">
          <Trophy size={48} className="mx-auto mb-4 text-gray-400" />
          <h3 className="text-xl font-semibold text-white text-white mb-2">
            No Tournaments Found
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Be the first to create a tournament!
          </p>
          <Link
            to="/tournaments/create"
            className="inline-block px-6 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg font-medium hover:from-emerald-600 hover:to-cyan-600 transition-all"
          >
            Create Tournament
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTournaments.map((tournament) => (
            <Link key={tournament.id} to={`/tournaments/${tournament.id}`}>
              <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 border border-white/[0.06] dark:border-white/[0.06] hover:border-emerald-500 dark:hover:border-emerald-500">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[tournament.status] ?? statusColors[3]}`}>
                        {statusNames[tournament.status] ?? 'Unknown'}
                      </span>
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/[0.04] text-gray-100 dark:bg-white/[0.05] dark:text-gray-200">
                        {bracketSizeLabels[tournament.bracketSize] ?? 'Custom'}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-white text-white line-clamp-2">
                      {tournament.name || `Tournament #${tournament.id}`}
                    </h3>
                  </div>
                  <Trophy className="w-6 h-6 text-yellow-500 flex-shrink-0" />
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Players</p>
                      <p className="text-sm font-semibold text-white text-white">
                        {tournament.registeredCount}/{tournament.maxPlayers}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Trophy size={16} className="text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Prize Pool</p>
                      <p className="text-sm font-semibold text-white text-white">
                        {Number(formatEther(BigInt(tournament.prizePool))).toFixed(3)} PAS
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Entry Fee</p>
                      <p className="text-sm font-semibold text-white text-white">
                        {Number(formatEther(BigInt(tournament.entryFee))).toFixed(3)} PAS
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-full flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Organizer</p>
                      <p className="text-sm font-mono text-gray-200 text-gray-300">
                        {formatAddress(tournament.organizer)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Registration deadline / Progress */}
                <div className="pt-4 border-t border-white/[0.06] dark:border-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {tournament.status === 0
                        ? `Reg. ends: ${formatDate(tournament.registrationDeadline)}`
                        : tournament.status === 1
                        ? `Round ${tournament.currentRound}/${tournament.totalRounds}`
                        : `Tournament #${tournament.id}`}
                    </span>
                    {tournament.status === 0 && (
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">
                        Join Now →
                      </span>
                    )}
                    {tournament.status === 1 && (
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        View Bracket →
                      </span>
                    )}
                    {tournament.status === 2 && (
                      <span className="text-sm font-medium text-cyan-400 dark:text-cyan-400">
                        View Results →
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
