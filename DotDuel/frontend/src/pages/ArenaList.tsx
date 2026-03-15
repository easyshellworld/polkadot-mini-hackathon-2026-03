import { Link } from 'react-router-dom'
import { formatEther } from 'ethers'
import { Flame, Clock, Trophy, Users, Plus } from 'lucide-react'
import { useArenaList } from '../hooks/useArenaApi'

const statusMap: Record<number, { label: string; color: string }> = {
  0: { label: 'Betting Open', color: 'bg-green-500 text-white' },
  1: { label: 'Locked', color: 'bg-yellow-500 text-white' },
  2: { label: 'Resolved', color: 'bg-blue-500 text-white' },
  3: { label: 'Cancelled', color: 'bg-white/[0.02]0 text-white' },
}

export default function ArenaList() {
  const { arenas, total, loading } = useArenaList({ limit: 50 })

  const totalPoolWei = arenas.reduce(
    (sum: bigint, a: any) => sum + BigInt(a.totalSideAWei ?? '0') + BigInt(a.totalSideBWei ?? '0'),
    0n
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white text-white flex items-center gap-3">
            <Flame className="w-8 h-8 text-orange-500" />
            Prediction Arena
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Pick a side. Bet on the outcome. Win big.
          </p>
        </div>
        <Link
          to="/arena/create"
          className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-red-700 transition-all shadow-lg shadow-orange-500/25"
        >
          <Plus size={20} />
          Create Arena
        </Link>
      </div>

      {/* Stats banner */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-orange-200 mb-1">Total Pool Volume</p>
            <p className="text-3xl font-bold">
              {Number(formatEther(totalPoolWei)).toFixed(3)} PAS
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-orange-200 mb-1">Active Arenas</p>
            <p className="text-3xl font-bold">{total}</p>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
        </div>
      )}

      {/* Empty */}
      {!loading && arenas.length === 0 && (
        <div className="text-center py-16">
          <Flame className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400">No arenas yet</h3>
          <p className="text-gray-500 mt-2">Be the first to create a Prediction Arena!</p>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {arenas.map((arena: any) => {
          const totalA = BigInt(arena.totalSideAWei ?? '0')
          const totalB = BigInt(arena.totalSideBWei ?? '0')
          const total = totalA + totalB
          const pctA = total > 0n ? Number((totalA * 100n) / total) : 50
          const pctB = 100 - pctA
          const pool = Number(formatEther(total))
          const { label, color } = statusMap[arena.status] ?? statusMap[3]
          const deadline = new Date(arena.bettingDeadline * 1000)
          const isOpen = arena.status === 0

          return (
            <Link
              key={arena.id}
              to={`/arena/${arena.id}`}
              className="group bg-white/[0.03] backdrop-blur-sm rounded-2xl shadow-sm border border-white/[0.06] dark:border-white/[0.06] hover:shadow-xl hover:border-orange-400 dark:hover:border-orange-500 transition-all overflow-hidden"
            >
              {/* Header */}
              <div className="p-5 pb-3">
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${color}`}>
                    {label}
                  </span>
                  <span className="text-xs text-gray-400">#{arena.id}</span>
                </div>
                <h3 className="text-lg font-bold text-white text-white line-clamp-1 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                  {arena.title}
                </h3>
                {arena.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                    {arena.description}
                  </p>
                )}
              </div>

              {/* Odds bar */}
              <div className="px-5 pb-4">
                <div className="flex items-center justify-between text-sm font-semibold mb-2">
                  <span className="text-blue-600 dark:text-blue-400">{arena.sideA}</span>
                  <span className="text-red-600 dark:text-red-400">{arena.sideB}</span>
                </div>
                <div className="relative h-6 bg-white/[0.04] dark:bg-white/[0.05] rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-400 rounded-l-full transition-all duration-500"
                    style={{ width: `${pctA}%` }}
                  />
                  <div
                    className="absolute inset-y-0 right-0 bg-gradient-to-l from-red-500 to-red-400 rounded-r-full transition-all duration-500"
                    style={{ width: `${pctB}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-between px-3 text-xs font-bold text-white">
                    <span>{pctA}%</span>
                    <span>{pctB}%</span>
                  </div>
                </div>
              </div>

              {/* Footer stats */}
              <div className="px-5 pb-5 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1">
                  <Trophy size={14} className="text-orange-500" />
                  <span>{pool.toFixed(3)} PAS</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users size={14} />
                  <span>{arena.betCount} bets</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock size={14} />
                  <span>{isOpen ? deadline.toLocaleDateString() : label}</span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
