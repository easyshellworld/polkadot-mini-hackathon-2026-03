import { useParams, Link } from 'react-router-dom'
import { Trophy, Users, Clock, ArrowLeft, Swords, TrendingUp, AlertCircle } from 'lucide-react'
import { useAccount } from 'wagmi'
import { formatEther, parseEther } from 'ethers'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  useTournamentDetail,
  useTournamentBracket,
  useTournamentPredictions,
} from '../hooks/useTournamentApi'
import { useTournamentContract } from '../hooks/useTournamentContract'

const statusNames = ['Registration', 'In Progress', 'Completed', 'Cancelled']
const statusColors = [
  'bg-green-500',
  'bg-blue-500',
  'bg-cyan-500',
  'bg-white/[0.02]0',
]

const formatAddress = (addr: string) => {
  if (!addr || addr === '0x0000000000000000000000000000000000000000') return 'TBD'
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

const formatDate = (timestamp: number) => {
  if (!timestamp) return '-'
  return new Date(timestamp * 1000).toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>()
  const tournamentId = id ? parseInt(id) : 0
  const { address, isConnected } = useAccount()
  const [predictionAmount, setPredictionAmount] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [activeTab, setActiveTab] = useState<'bracket' | 'predictions' | 'players'>('bracket')
  const [settleRound, setSettleRound] = useState(1)
  const [settleMatchIndex, setSettleMatchIndex] = useState(0)
  const [settleResult, setSettleResult] = useState(1)

  const { data: tournament, isLoading, error, refetch: refetchTournament } = useTournamentDetail(tournamentId)
  const {
    data: bracketData,
    refetch: refetchBracket,
  } = useTournamentBracket(tournamentId, tournament?.currentRound ?? 0)
  const { data: predictionData, refetch: refetchPredictions } = useTournamentPredictions(tournamentId)

  const {
    registerForTournament,
    startTournament,
    submitMatchResult,
    placePrediction,
    claimPrediction,
    isPending,
    isConfirmed,
    error: txError,
  } = useTournamentContract()

  useEffect(() => {
    if (!isConfirmed) return

    refetchTournament()
    refetchBracket()
    refetchPredictions()
  }, [isConfirmed, refetchTournament, refetchBracket, refetchPredictions])

  useEffect(() => {
    if (!txError) return
    toast.error(txError.message?.slice(0, 120) || 'Transaction failed')
  }, [txError])

  const handleRegister = async () => {
    if (!tournament) return
    try {
      await registerForTournament(tournamentId, BigInt(tournament.entryFee || 0))
      toast.success('Successfully registered for tournament!')
    } catch (err: any) {
      toast.error(err?.message?.slice(0, 100) || 'Registration failed')
    }
  }

  const handlePlacePrediction = async () => {
    if (!predictionAmount || !selectedPlayer) {
      toast.error('Enter amount and select a player')
      return
    }
    try {
      const weiAmount = parseEther(predictionAmount)
      await placePrediction(tournamentId, selectedPlayer, weiAmount)
      toast.success('Prediction placed!')
      setPredictionAmount('')
      setSelectedPlayer('')
    } catch (err: any) {
      toast.error(err?.message?.slice(0, 100) || 'Prediction failed')
    }
  }

  const handleClaimPrediction = async () => {
    try {
      await claimPrediction(tournamentId)
      toast.success('Prediction rewards claimed!')
    } catch (err: any) {
      toast.error(err?.message?.slice(0, 100) || 'Claim failed')
    }
  }

  const handleStartTournament = async () => {
    try {
      await startTournament(tournamentId)
      toast.success('Start tournament transaction submitted!')
    } catch (err: any) {
      toast.error(err?.message?.slice(0, 100) || 'Start tournament failed')
    }
  }

  const handleSubmitTournamentResult = async () => {
    try {
      await submitMatchResult(tournamentId, settleRound, settleMatchIndex, settleResult)
      toast.success('Match result submitted!')
    } catch (err: any) {
      toast.error(err?.message?.slice(0, 100) || 'Submit result failed')
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  if (error || !tournament) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-8 text-center">
        <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
        <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">
          Tournament Not Found
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          This tournament may not exist or there was an error loading it.
        </p>
        <Link to="/tournaments" className="text-emerald-400 hover:underline">
          ← Back to Tournaments
        </Link>
      </div>
    )
  }

  const isRegistered = tournament.players?.some(
    (p: string) => p.toLowerCase() === address?.toLowerCase()
  )
  const isOrganizer = tournament.organizer?.toLowerCase() === address?.toLowerCase()
  const canRegister =
    isConnected && !isRegistered && tournament.status === 0 && !isOrganizer
  const canPredict = isConnected && (tournament.status === 0 || tournament.status === 1)
  const canStartTournament =
    isConnected && tournament.status === 0 && tournament.registeredCount === tournament.maxPlayers
  const canSubmitTournamentResult = isConnected && tournament.status === 1
  const prizePool = Number(formatEther(BigInt(tournament.prizePool || 0)))
  const entryFee = Number(formatEther(BigInt(tournament.entryFee || 0)))
  const predictionPool = Number(formatEther(BigInt(tournament.predictionPool || 0)))
  const predictionSummary = (() => {
    const groups = new Map<string, { totalAmount: bigint; betCount: number }>()

    for (const pred of predictionData ?? []) {
      const key = pred.predictedWinner
      const current = groups.get(key) ?? { totalAmount: 0n, betCount: 0 }
      current.totalAmount += BigInt(pred.amount ?? '0')
      current.betCount += 1
      groups.set(key, current)
    }

    return Array.from(groups.entries()).map(([predictedWinner, summary]) => ({
      predictedWinner,
      totalAmount: summary.totalAmount,
      betCount: summary.betCount,
    }))
  })()
  const nextUnsettledMatch = Array.isArray(bracketData)
    ? bracketData.find((m: any) => !m.isSettled && m.playerOne && m.playerTwo)
    : null

  const handleUseNextUnsettled = () => {
    if (!nextUnsettledMatch) {
      toast('No unsettled match found in current round')
      return
    }

    setSettleRound(Number(nextUnsettledMatch.round ?? tournament.currentRound ?? 1))
    setSettleMatchIndex(Number(nextUnsettledMatch.matchIndex ?? 0))
    setSettleResult(1)
  }

  return (
    <div>
      {/* Back Button */}
      <Link
        to="/tournaments"
        className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-emerald-400 mb-6"
      >
        <ArrowLeft size={18} />
        Back to Tournaments
      </Link>

      {/* Tournament Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-2xl p-8 text-white mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <span className={`px-3 py-1 rounded-full text-sm font-medium text-white ${statusColors[tournament.status]}`}>
              {statusNames[tournament.status] ?? 'Unknown'}
            </span>
            <span className="text-sm text-white/80">Tournament #{tournamentId}</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {tournament.name || `Tournament #${tournamentId}`}
          </h1>
          {tournament.description && (
            <p className="text-white/80 mb-4 max-w-2xl">{tournament.description}</p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-white/70 mb-1">Prize Pool</p>
              <p className="text-2xl font-bold">{prizePool.toFixed(3)} PAS</p>
            </div>
            <div>
              <p className="text-sm text-white/70 mb-1">Entry Fee</p>
              <p className="text-2xl font-bold">{entryFee.toFixed(3)} PAS</p>
            </div>
            <div>
              <p className="text-sm text-white/70 mb-1">Players</p>
              <p className="text-2xl font-bold">
                {tournament.registeredCount}/{tournament.maxPlayers}
              </p>
            </div>
            <div>
              <p className="text-sm text-white/70 mb-1">Round</p>
              <p className="text-2xl font-bold">
                {tournament.currentRound}/{tournament.totalRounds}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-4 mb-8">
        {canRegister && (
          <button
            onClick={handleRegister}
            disabled={isPending}
            className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 transition-all"
          >
            {isPending ? 'Registering...' : `Register (${entryFee.toFixed(3)} PAS)`}
          </button>
        )}
        {isRegistered && tournament.status === 0 && (
          <span className="px-6 py-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg font-semibold flex items-center gap-2">
            <Users size={18} /> You are registered!
          </span>
        )}
        {tournament.status === 2 && canPredict && (
          <button
            onClick={handleClaimPrediction}
            disabled={isPending}
            className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-600 text-white rounded-lg font-semibold hover:from-yellow-600 hover:to-orange-700 disabled:opacity-50 transition-all"
          >
            {isPending ? 'Claiming...' : 'Claim Prediction Rewards'}
          </button>
        )}
        {canStartTournament && (
          <button
            onClick={handleStartTournament}
            disabled={isPending}
            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg font-semibold hover:from-emerald-600 hover:to-cyan-600 disabled:opacity-50 transition-all"
          >
            {isPending ? 'Starting...' : 'Start Tournament'}
          </button>
        )}
      </div>

      {canSubmitTournamentResult && (
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-2">Oracle Result Submission</h2>
          <p className="text-sm text-gray-500 mb-4">
            For demo and operations: submit round results to advance bracket and finish the tournament.
          </p>

          <div className="mb-4 p-4 rounded-lg border border-cyan-500/30 bg-cyan-500/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-cyan-200 font-semibold">Demo Mode Assistant</p>
                <p className="text-xs text-gray-300 mt-1">
                  Current round: {tournament.currentRound}.{' '}
                  {nextUnsettledMatch
                    ? `Next suggested match index: ${Number(nextUnsettledMatch.matchIndex)}`
                    : 'No unsettled match found in this round.'}
                </p>
              </div>
              <button
                onClick={handleUseNextUnsettled}
                disabled={!nextUnsettledMatch}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg text-sm font-semibold hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50"
              >
                Use Next Unsettled
              </button>
            </div>
            {nextUnsettledMatch && (
              <p className="text-xs text-gray-300 mt-3 font-mono">
                {formatAddress(nextUnsettledMatch.playerOne)} vs {formatAddress(nextUnsettledMatch.playerTwo)}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Round</label>
              <input
                type="number"
                min={1}
                value={settleRound}
                onChange={(e) => setSettleRound(parseInt(e.target.value || '1', 10))}
                className="w-full px-3 py-2 border border-white/[0.1] rounded-lg dark:bg-white/[0.05] text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Match Index</label>
              <input
                type="number"
                min={0}
                value={settleMatchIndex}
                onChange={(e) => setSettleMatchIndex(parseInt(e.target.value || '0', 10))}
                className="w-full px-3 py-2 border border-white/[0.1] rounded-lg dark:bg-white/[0.05] text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Winner</label>
              <select
                value={settleResult}
                onChange={(e) => setSettleResult(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 border border-white/[0.1] rounded-lg dark:bg-white/[0.05] text-white"
              >
                <option value={1}>Player One</option>
                <option value={2}>Player Two</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleSubmitTournamentResult}
                disabled={isPending || settleRound < 1 || settleMatchIndex < 0 || (settleResult !== 1 && settleResult !== 2)}
                className="w-full px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-semibold hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50"
              >
                {isPending ? 'Submitting...' : 'Submit Match Result'}
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Note: this call requires oracle-authorized wallet permissions on-chain.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-white/[0.06] dark:border-white/[0.06] mb-6">
        <nav className="flex gap-6">
          {[
            { key: 'bracket' as const, label: 'Bracket', icon: Swords },
            { key: 'predictions' as const, label: 'Predictions', icon: TrendingUp },
            { key: 'players' as const, label: 'Players', icon: Users },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 pb-3 border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-emerald-500 text-emerald-400 dark:text-emerald-400'
                  : 'border-transparent text-gray-500 hover:text-gray-200 dark:hover:text-gray-300'
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'bracket' && (
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-bold text-white text-white mb-4">
            Tournament Bracket
          </h2>
          {tournament.status === 0 ? (
            <div className="text-center py-12">
              <Clock size={48} className="mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 dark:text-gray-400">
                Bracket will be generated when the tournament starts
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Registration deadline: {formatDate(tournament.registrationDeadline)}
              </p>
            </div>
          ) : bracketData?.length ? (
            <div className="space-y-4">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                Showing Round {tournament.currentRound} of {tournament.totalRounds}
              </div>
              {bracketData.map((match: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-white/[0.02] dark:bg-white/[0.05]/50 rounded-lg p-4 border border-white/[0.06] dark:border-white/[0.08]"
                >
                  <div className="flex-1">
                    <div className={`font-mono text-sm ${match.winner?.toLowerCase() === match.playerOne?.toLowerCase()
                      ? 'text-green-600 font-bold' : 'text-gray-200 text-gray-300'}`}>
                      {formatAddress(match.playerOne)}
                    </div>
                  </div>
                  <div className="px-4 text-gray-400 font-bold">VS</div>
                  <div className="flex-1 text-right">
                    <div className={`font-mono text-sm ${match.winner?.toLowerCase() === match.playerTwo?.toLowerCase()
                      ? 'text-green-600 font-bold' : 'text-gray-200 text-gray-300'}`}>
                      {formatAddress(match.playerTwo)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No bracket data available for current round</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'predictions' && (
        <div className="space-y-6">
          {/* Place Prediction */}
          {canPredict && (
            <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-white text-white mb-4">
                Place a Prediction
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Predict who will win the tournament and earn rewards if correct!
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200 text-gray-300 mb-1">
                    Player to Win
                  </label>
                  <select
                    value={selectedPlayer}
                    onChange={(e) => setSelectedPlayer(e.target.value)}
                    className="w-full px-4 py-2 border border-white/[0.1] dark:border-white/[0.08] rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-white/[0.05] text-white"
                  >
                    <option value="">Select a player</option>
                    {tournament.players?.map((p: string) => (
                      <option key={p} value={p}>
                        {formatAddress(p)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 text-gray-300 mb-1">
                    Amount (PAS)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={predictionAmount}
                    onChange={(e) => setPredictionAmount(e.target.value)}
                    placeholder="0.01"
                    className="w-full px-4 py-2 border border-white/[0.1] dark:border-white/[0.08] rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-white/[0.05] text-white"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handlePlacePrediction}
                    disabled={isPending || !selectedPlayer || !predictionAmount}
                    className="w-full px-6 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg font-medium hover:from-emerald-600 hover:to-cyan-600 disabled:opacity-50 transition-all"
                  >
                    {isPending ? 'Placing...' : 'Place Prediction'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Prediction Stats */}
          <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold text-white text-white mb-4">
              Prediction Market
            </h2>
            {predictionSummary.length ? (
              <div className="space-y-3">
                {predictionSummary.map((pred, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-white/[0.02] dark:bg-white/[0.05]/50 rounded-lg p-4"
                  >
                    <div>
                      <span className="font-mono text-sm text-gray-200 text-gray-300">
                        {formatAddress(pred.predictedWinner)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-emerald-400 dark:text-emerald-400">
                        {Number(formatEther(pred.totalAmount)).toFixed(3)} PAS
                      </span>
                      <span className="text-xs text-gray-500 ml-2">
                        ({pred.betCount} bets)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">
                No predictions placed yet. Be the first!
              </p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'players' && (
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-bold text-white text-white mb-4">
            Registered Players ({tournament.registeredCount}/{tournament.maxPlayers})
          </h2>
          {tournament.players?.length ? (
            <div className="space-y-2">
              {tournament.players.map((player: string, idx: number) => (
                <div
                  key={player}
                  className="flex items-center justify-between bg-white/[0.02] dark:bg-white/[0.05]/50 rounded-lg p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold">
                      {idx + 1}
                    </span>
                    <span className="font-mono text-gray-200 text-gray-300">
                      {formatAddress(player)}
                    </span>
                    {player.toLowerCase() === address?.toLowerCase() && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/10 dark:bg-emerald-900/40 text-emerald-400 dark:text-emerald-300">
                        You
                      </span>
                    )}
                  </div>
                  {(tournament as any).winner?.toLowerCase() === player.toLowerCase() && (
                    <Trophy className="text-yellow-500" size={20} />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">No players registered yet</p>
          )}
        </div>
      )}

      {/* Tournament Info */}
      <div className="mt-8 bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-bold text-white text-white mb-4">
          Tournament Details
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-100 dark:border-white/[0.06]">
            <span className="text-gray-500">Organizer</span>
            <span className="font-mono text-gray-200 text-gray-300">
              {formatAddress(tournament.organizer)}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100 dark:border-white/[0.06]">
            <span className="text-gray-500">Bracket Size</span>
            <span className="text-gray-200 text-gray-300">
              {tournament.maxPlayers} Players
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100 dark:border-white/[0.06]">
            <span className="text-gray-500">Registration Deadline</span>
            <span className="text-gray-200 text-gray-300">
              {formatDate(tournament.registrationDeadline)}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100 dark:border-white/[0.06]">
            <span className="text-gray-500">Start Time</span>
            <span className="text-gray-200 text-gray-300">
              {formatDate(tournament.startTime)}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100 dark:border-white/[0.06]">
            <span className="text-gray-500">Prediction Pool</span>
            <span className="text-gray-200 text-gray-300">
              {predictionPool.toFixed(3)} PAS
            </span>
          </div>
          {(tournament as any).winner && (tournament as any).winner !== '0x0000000000000000000000000000000000000000' && (
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-white/[0.06]">
              <span className="text-gray-500">Winner</span>
              <span className="font-mono text-yellow-600 dark:text-yellow-400 font-bold">
                {formatAddress((tournament as any).winner)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
