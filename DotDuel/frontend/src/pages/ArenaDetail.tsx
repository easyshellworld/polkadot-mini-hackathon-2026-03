import { useParams, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { formatEther, parseEther } from 'ethers'
import { ArrowLeft, Clock, Users, Trophy, TrendingUp, Flame, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAccount } from 'wagmi'
import { useArenaDetail, useArenaBets, useArenaOddsHistory } from '../hooks/useArenaApi'
import { useArenaContract } from '../hooks/useArenaContract'

const statusMap: Record<number, { label: string; color: string }> = {
  0: { label: 'Betting Open', color: 'bg-green-500' },
  1: { label: 'Locked', color: 'bg-yellow-500' },
  2: { label: 'Resolved', color: 'bg-blue-500' },
  3: { label: 'Cancelled', color: 'bg-white/[0.02]0' },
}

function OddsBar({ pctA, pctB, sideA, sideB }: { pctA: number; pctB: number; sideA: string; sideB: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm font-bold mb-2">
        <span className="text-blue-600 dark:text-blue-400">{sideA} — {pctA.toFixed(1)}%</span>
        <span className="text-red-600 dark:text-red-400">{pctB.toFixed(1)}% — {sideB}</span>
      </div>
      <div className="relative h-10 bg-gray-200 dark:bg-white/[0.05] rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-700 ease-out"
          style={{ width: `${pctA}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 bg-gradient-to-l from-red-600 to-red-400 transition-all duration-700 ease-out"
          style={{ width: `${pctB}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-between px-4 text-white text-sm font-bold">
          <span>{pctA > 5 ? `${pctA.toFixed(1)}%` : ''}</span>
          <span>{pctB > 5 ? `${pctB.toFixed(1)}%` : ''}</span>
        </div>
      </div>
    </div>
  )
}

function MiniOddsChart({ history, sideA, sideB }: { history: any[]; sideA: string; sideB: string }) {
  const allHistory = Array.isArray(history) ? history : []
  const [replayIndex, setReplayIndex] = useState(Math.max(allHistory.length - 1, 0))
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    setReplayIndex(Math.max(allHistory.length - 1, 0))
    setIsPlaying(false)
  }, [allHistory.length])

  useEffect(() => {
    if (!isPlaying) return
    if (allHistory.length <= 1) return
    if (replayIndex >= allHistory.length - 1) {
      setIsPlaying(false)
      return
    }

    const timer = setInterval(() => {
      setReplayIndex((prev) => {
        const next = prev + 1
        if (next >= allHistory.length - 1) {
          setIsPlaying(false)
          return allHistory.length - 1
        }
        return next
      })
    }, 700)

    return () => clearInterval(timer)
  }, [isPlaying, replayIndex, allHistory.length])

  if (allHistory.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
        No betting activity yet
      </div>
    )
  }

  const visibleCount = Math.min(Math.max(replayIndex + 1, 1), allHistory.length)
  const visibleHistory = allHistory.slice(0, visibleCount)

  // Build points from visible history for replay
  const pointsA = visibleHistory.map((h: any) => Number(h.percentA ?? 50))
  const pointsB = visibleHistory.map((h: any) => Number(h.percentB ?? 50))
  const fullPointsA = allHistory.map((h: any) => Number(h.percentA ?? 50))
  const firstA = pointsA[0] ?? 50
  const latestA = pointsA[pointsA.length - 1] ?? 50
  const finalA = fullPointsA[fullPointsA.length - 1] ?? 50
  const deltaA = latestA - firstA
  const currentStep = visibleHistory[visibleHistory.length - 1]
  const progress = allHistory.length <= 1 ? 100 : ((visibleCount - 1) / (allHistory.length - 1)) * 100

  const currentBetAmount = (() => {
    try {
      return Number(formatEther(BigInt(currentStep?.amountWei ?? '0'))).toFixed(4)
    } catch {
      return '0.0000'
    }
  })()

  const maxY = 100
  const svgW = 440
  const svgH = 180
  const padL = 26
  const padR = 8
  const padT = 8
  const padB = 16

  const mapPoint = (p: number, i: number, arrLength: number) => {
    const x = padL + (i / Math.max(arrLength - 1, 1)) * (svgW - padL - padR)
    const y = padT + ((maxY - p) / maxY) * (svgH - padT - padB)
    return { x, y }
  }

  const pathPointsA = pointsA.map((p, i) => mapPoint(p, i, pointsA.length))
  const pathPointsB = pointsB.map((p, i) => mapPoint(p, i, pointsB.length))

  const lineA = pathPointsA.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x},${pt.y}`).join(' ')
  const lineB = pathPointsB.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x},${pt.y}`).join(' ')
  const areaA = `${lineA} L ${padL + (svgW - padL - padR)},${svgH - padB} L ${padL},${svgH - padB} Z`

  return (
    <div className="relative">
      <div className="mb-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-gray-300">
            <span className="font-semibold text-cyan-300">Replay</span> {visibleCount}/{allHistory.length}
            {' · '}
            Current: {latestA.toFixed(1)}% {sideA}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (allHistory.length <= 1) return
                if (replayIndex >= allHistory.length - 1) {
                  setReplayIndex(0)
                }
                setIsPlaying((v) => !v)
              }}
              disabled={allHistory.length <= 1}
              className="px-3 py-1.5 text-xs rounded-md bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 hover:bg-cyan-500/30 disabled:opacity-40"
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button
              onClick={() => {
                setIsPlaying(false)
                setReplayIndex(Math.max(allHistory.length - 1, 0))
              }}
              className="px-3 py-1.5 text-xs rounded-md bg-white/[0.06] text-gray-200 border border-white/[0.12] hover:bg-white/[0.1]"
            >
              Reset
            </button>
          </div>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
          <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-44" preserveAspectRatio="none">
        {[25, 50, 75].map((yPct) => {
          const y = padT + ((maxY - yPct) / maxY) * (svgH - padT - padB)
          return (
            <g key={yPct}>
              <line x1={padL} y1={y} x2={svgW - padR} y2={y} stroke="rgba(148,163,184,0.3)" strokeDasharray={yPct === 50 ? '4,4' : '2,4'} />
              <text x={2} y={y + 4} fill="rgba(148,163,184,0.8)" fontSize="10">{yPct}%</text>
            </g>
          )
        })}

        <path d={areaA} fill="url(#oddsAFill)" opacity="0.4" />
        <path d={lineA} fill="none" stroke="#3b82f6" strokeWidth="2.5" />
        <path d={lineB} fill="none" stroke="#ef4444" strokeWidth="2.5" opacity="0.9" />

        {pathPointsA.map((pt, i) => (
          <circle key={`a-${i}`} cx={pt.x} cy={pt.y} r="2.6" fill="#3b82f6" opacity="0.9" />
        ))}
        {pathPointsB.map((pt, i) => (
          <circle key={`b-${i}`} cx={pt.x} cy={pt.y} r="2.6" fill="#ef4444" opacity="0.9" />
        ))}

        {pathPointsA.length > 0 && (
          <>
            <circle cx={pathPointsA[pathPointsA.length - 1].x} cy={pathPointsA[pathPointsA.length - 1].y} r="4" fill="#3b82f6" />
            <circle cx={pathPointsB[pathPointsB.length - 1].x} cy={pathPointsB[pathPointsB.length - 1].y} r="4" fill="#ef4444" />
          </>
        )}

        <defs>
          <linearGradient id="oddsAFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
          </linearGradient>
        </defs>
      </svg>

      <div className="flex items-center justify-between gap-3 text-xs mt-2">
        <span className="text-blue-400 font-medium">{sideA} line</span>
        <span className="text-gray-400">{allHistory.length} bets tracked</span>
        <span className="text-red-400 font-medium">{sideB} line</span>
      </div>

      <div className="mt-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-gray-300">
        Step {visibleCount}: {currentStep?.side === 1 ? sideA : sideB} bet by {currentStep?.bettor?.slice?.(0, 6)}...{currentStep?.bettor?.slice?.(-4)} ({currentBetAmount} PAS)
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2">
          <p className="text-[11px] text-gray-400">Start</p>
          <p className="text-sm font-semibold text-blue-300">{firstA.toFixed(1)}% {sideA}</p>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2">
          <p className="text-[11px] text-gray-400">Latest / Final</p>
          <p className="text-sm font-semibold text-blue-300">{latestA.toFixed(1)}% {sideA}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Final: {finalA.toFixed(1)}%</p>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2">
          <p className="text-[11px] text-gray-400">Shift</p>
          <p className={`text-sm font-semibold ${deltaA >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
            {deltaA >= 0 ? '+' : ''}{deltaA.toFixed(1)} pts
          </p>
        </div>
      </div>
    </div>
  )
}

export default function ArenaDetail() {
  const { id } = useParams<{ id: string }>()
  const arenaId = Number(id)
  const { address } = useAccount()
  const { arena, loading, refetch: refetchArena } = useArenaDetail(arenaId)
  const { bets, refetch: refetchBets } = useArenaBets(arenaId)
  const { history } = useArenaOddsHistory(arenaId)
  const { placeBet, resolveArena, claimWinnings, isPending, isConfirming, isConfirmed, error } = useArenaContract()

  const [betAmount, setBetAmount] = useState('0.01')
  const [selectedSide, setSelectedSide] = useState<1 | 2>(1)

  // Refetch after successful tx
  useEffect(() => {
    if (isConfirmed) {
      toast.success('Transaction confirmed!')
      refetchArena()
      refetchBets()
    }
  }, [isConfirmed])

  useEffect(() => {
    if (!error) return

    const rawMessage = error.message || 'Transaction failed'
    const cleanMessage = rawMessage
      .replace(/^.*execution reverted:?\s*/i, '')
      .replace(/^.*User rejected the request\.?\s*/i, 'Transaction rejected in wallet.')
      .trim()

    toast.error(cleanMessage || 'Transaction failed')
  }, [error])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    )
  }

  if (!arena) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl text-gray-500">Arena not found</h2>
        <Link to="/arena" className="text-orange-500 hover:underline mt-2 inline-block">Back to Arenas</Link>
      </div>
    )
  }

  const totalA = BigInt(arena.totalSideAWei ?? '0')
  const totalB = BigInt(arena.totalSideBWei ?? '0')
  const total = totalA + totalB
  const pctA = total > 0n ? Number((totalA * 10000n) / total) / 100 : 50
  const pctB = total > 0n ? Number((totalB * 10000n) / total) / 100 : 50
  const poolDisplay = Number(formatEther(total)).toFixed(4)
  const { label: statusLabel, color: statusColor } = statusMap[arena.status] ?? statusMap[3]
  const isOpen = arena.status === 0
  const isResolved = arena.status === 2
  const isCreator = address?.toLowerCase() === arena.creator?.toLowerCase()
  const bettingDeadline = new Date(arena.bettingDeadline * 1000)
  const resolveDeadline = new Date(arena.resolveDeadline * 1000)
  const now = Date.now() / 1000
  const canBet = isOpen && now < arena.bettingDeadline && !isCreator
  const canResolve = isCreator && now >= arena.bettingDeadline && now <= arena.resolveDeadline && !isResolved && arena.status !== 3
  const betBlockedReason = !address
    ? 'Please connect your wallet first.'
    : !isOpen
      ? `Betting is currently ${statusLabel.toLowerCase()}.`
      : now >= arena.bettingDeadline
        ? 'Betting deadline has passed for this arena.'
        : isCreator
          ? 'Arena creator cannot place bets on their own market.'
          : null

  // User bets summary
  const userBets = bets.filter((b: any) => b.bettor?.toLowerCase() === address?.toLowerCase())
  const userSideA = userBets.filter((b: any) => b.side === 1).reduce((s: bigint, b: any) => s + BigInt(b.amountWei), 0n)
  const userSideB = userBets.filter((b: any) => b.side === 2).reduce((s: bigint, b: any) => s + BigInt(b.amountWei), 0n)
  const hasWinningBet = isResolved && (
    (arena.winningSide === 1 && userSideA > 0n) ||
    (arena.winningSide === 2 && userSideB > 0n)
  )

  const handleBet = () => {
    if (!canBet) {
      toast.error(betBlockedReason || 'Betting is not available right now')
      return
    }

    try {
      const amount = parseEther(betAmount)
      placeBet(arenaId, selectedSide, amount)
    } catch (err: any) {
      console.error('Place bet error:', err)
      toast.error('Invalid bet amount')
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <Link to="/arena" className="inline-flex items-center gap-1 text-gray-500 hover:text-orange-500 transition-colors">
        <ArrowLeft size={18} />
        Back to Arenas
      </Link>

      {/* Title card */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusColor}`}>{statusLabel}</span>
          <span className="text-gray-400 text-sm">Arena #{arena.id}</span>
        </div>
        <h1 className="text-3xl font-bold mb-2">{arena.title}</h1>
        {arena.description && (
          <p className="text-gray-400">{arena.description}</p>
        )}

        <div className="grid grid-cols-3 gap-4 mt-6 text-center">
          <div>
            <Trophy className="w-5 h-5 mx-auto mb-1 text-orange-400" />
            <p className="text-2xl font-bold">{poolDisplay}</p>
            <p className="text-xs text-gray-400">Prize Pool (PAS)</p>
          </div>
          <div>
            <Users className="w-5 h-5 mx-auto mb-1 text-orange-400" />
            <p className="text-2xl font-bold">{arena.betCount}</p>
            <p className="text-xs text-gray-400">Total Bets</p>
          </div>
          <div>
            <Clock className="w-5 h-5 mx-auto mb-1 text-orange-400" />
            <p className="text-sm font-mono">{bettingDeadline.toLocaleString()}</p>
            <p className="text-xs text-gray-400">Bet Deadline</p>
          </div>
        </div>
      </div>

      {/* Live Odds */}
      <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-white text-white flex items-center gap-2 mb-4">
          <Flame className="w-5 h-5 text-orange-500" />
          Live Odds
        </h2>
        <OddsBar pctA={pctA} pctB={pctB} sideA={arena.sideA} sideB={arena.sideB} />

        <div className="grid grid-cols-2 gap-4 mt-4 text-center">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
            <p className="text-sm text-blue-600 dark:text-blue-400 font-semibold">{arena.sideA}</p>
            <p className="text-xl font-bold text-white text-white">
              {Number(formatEther(totalA)).toFixed(4)} PAS
            </p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
            <p className="text-sm text-red-600 dark:text-red-400 font-semibold">{arena.sideB}</p>
            <p className="text-xl font-bold text-white text-white">
              {Number(formatEther(totalB)).toFixed(4)} PAS
            </p>
          </div>
        </div>
      </div>

      {/* Odds History Chart */}
      <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-white text-white flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-orange-500" />
          Odds Movement
        </h2>
        <MiniOddsChart history={history} sideA={arena.sideA} sideB={arena.sideB} />
      </div>

      {/* Place Bet */}
      {canBet && (
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-white text-white mb-4">Place Your Bet</h2>

          {/* Side selector */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => setSelectedSide(1)}
              className={`p-4 rounded-xl border-2 transition-all font-semibold text-center ${
                selectedSide === 1
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'border-white/[0.06] dark:border-white/[0.08] text-gray-500 hover:border-blue-300'
              }`}
            >
              {arena.sideA}
              <p className="text-xs mt-1 font-normal opacity-75">{pctA.toFixed(1)}% odds</p>
            </button>
            <button
              onClick={() => setSelectedSide(2)}
              className={`p-4 rounded-xl border-2 transition-all font-semibold text-center ${
                selectedSide === 2
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  : 'border-white/[0.06] dark:border-white/[0.08] text-gray-500 hover:border-red-300'
              }`}
            >
              {arena.sideB}
              <p className="text-xs mt-1 font-normal opacity-75">{pctB.toFixed(1)}% odds</p>
            </button>
          </div>

          {/* Amount */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-200 text-gray-300 mb-1">
              Bet Amount (PAS)
            </label>
            <input
              type="number"
              step="0.001"
              min="0.001"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              className="w-full px-4 py-3 border border-white/[0.1] dark:border-white/[0.08] rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-white/[0.05] text-white"
            />
            <div className="flex gap-2 mt-2">
              {['0.01', '0.1', '1', '10'].map((v) => (
                <button
                  key={v}
                  onClick={() => setBetAmount(v)}
                  className="px-3 py-1 text-xs bg-white/[0.04] dark:bg-white/[0.05] rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
                >
                  {v} PAS
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleBet}
            disabled={isPending || isConfirming}
            className={`w-full py-4 rounded-xl font-bold text-lg text-white transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
              selectedSide === 1
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-blue-500/25'
                : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-red-500/25'
            }`}
          >
            {isPending ? 'Confirm in wallet...' : isConfirming ? 'Processing...' : `Bet on ${selectedSide === 1 ? arena.sideA : arena.sideB}`}
          </button>
        </div>
      )}

      {!canBet && (
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl shadow-sm p-6 border border-amber-500/30">
          <h2 className="text-lg font-bold text-white mb-2">Betting Unavailable</h2>
          <p className="text-sm text-amber-300">{betBlockedReason}</p>
          <p className="text-xs text-gray-400 mt-2">
            Betting window: until {bettingDeadline.toLocaleString()}
          </p>
        </div>
      )}

      {/* Your Bets */}
      {address && userBets.length > 0 && (
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-white text-white mb-3">Your Bets</h2>
          {userSideA > 0n && (
            <p className="text-blue-600 dark:text-blue-400 font-semibold">
              {arena.sideA}: {Number(formatEther(userSideA)).toFixed(4)} PAS
            </p>
          )}
          {userSideB > 0n && (
            <p className="text-red-600 dark:text-red-400 font-semibold">
              {arena.sideB}: {Number(formatEther(userSideB)).toFixed(4)} PAS
            </p>
          )}
          {hasWinningBet && (
            <button
              onClick={() => claimWinnings(arenaId)}
              disabled={isPending || isConfirming}
              className="mt-3 w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold hover:from-green-600 hover:to-emerald-700 disabled:opacity-50"
            >
              {isPending ? 'Confirm...' : 'Claim Winnings 🎉'}
            </button>
          )}
        </div>
      )}

      {/* Resolve (Creator only) */}
      {canResolve && (
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-white text-white mb-3">Resolve Arena</h2>
          <p className="text-sm text-gray-500 mb-4">As the creator, select the winning side.</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => resolveArena(arenaId, 1)}
              disabled={isPending || isConfirming}
              className="py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <CheckCircle size={18} />
              {arena.sideA} Wins
            </button>
            <button
              onClick={() => resolveArena(arenaId, 2)}
              disabled={isPending || isConfirming}
              className="py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <CheckCircle size={18} />
              {arena.sideB} Wins
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Resolve deadline: {resolveDeadline.toLocaleString()}
          </p>
        </div>
      )}

      {/* Result */}
      {isResolved && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl p-6 border border-green-300 dark:border-green-700">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-6 h-6 text-yellow-500" />
            <h2 className="text-lg font-bold text-white text-white">Result</h2>
          </div>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {arena.winningSide === 1 ? arena.sideA : arena.sideB} Wins!
          </p>
        </div>
      )}

      {/* Recent Bets Feed */}
      {bets.length > 0 && (
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-white text-white mb-4">Bet Activity</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {[...bets].reverse().map((bet: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-gray-100 dark:border-white/[0.06] last:border-0">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${bet.side === 1 ? 'bg-blue-500' : 'bg-red-500'}`} />
                  <span className="text-gray-500 font-mono text-xs">
                    {bet.bettor?.slice(0, 6)}...{bet.bettor?.slice(-4)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`font-semibold ${bet.side === 1 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                    {bet.side === 1 ? arena.sideA : arena.sideB}
                  </span>
                  <span className="font-bold text-white text-white">
                    {Number(formatEther(BigInt(bet.amountWei))).toFixed(4)} PAS
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
