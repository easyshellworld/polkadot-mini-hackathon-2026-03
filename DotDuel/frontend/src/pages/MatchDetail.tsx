import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAccount } from 'wagmi'
import { useContract } from '../hooks/useContract'
import { useMatchDetail } from '../hooks/useMatchesApi'
import { formatEther } from 'ethers'
import toast from 'react-hot-toast'
import {
  Trophy,
  Users,
  Clock,
  DollarSign,
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'

const statusNames = ['Waiting', 'In Progress', 'Completed', 'Cancelled']
const statusColors = [
  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'bg-white/[0.04] text-gray-100 bg-[#080b12] dark:text-gray-200',
]

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

export default function MatchDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { address, isConnected } = useAccount()
  const [winnerAddress, setWinnerAddress] = useState('')

  const matchId = id ? parseInt(id) : 0
  const {
    data: match,
    isLoading,
    error,
    refetch,
    isRefetching
  } = useMatchDetail(matchId)
  const {
    joinMatch,
    submitResultByReferee,
    cancelMatch,
    isPending,
    isConfirming,
    isConfirmed,
  } = useContract()

  const formatAddress = (addr: string) => {
    if (!addr || addr === ZERO_ADDRESS) return 'Waiting for player'
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleJoinMatch = async () => {
    if (!isConnected) {
      toast.error('Please connect your wallet first')
      return
    }

    if (!match) return

    const stakeAmountWei = BigInt(match.stakeAmountWei ?? '0')

    try {
      await joinMatch(matchId, stakeAmountWei)
      toast.success('Successfully joined the match!')
      await refetch()
    } catch (error: any) {
      console.error('Failed to join match:', error)
      toast.error(error?.message || 'Failed to join match')
    }
  }

  const handleSubmitResult = async () => {
    if (!winnerAddress) {
      toast.error('Please enter the winner address')
      return
    }

    if (!winnerAddress.startsWith('0x') || winnerAddress.length !== 42) {
      toast.error('Please enter a valid wallet address')
      return
    }

    if (!match) return

    try {
      await submitResultByReferee(matchId, winnerAddress)
      toast.success('Result submitted successfully!')
      setWinnerAddress('')
      await refetch()
    } catch (error: any) {
      console.error('Failed to submit result:', error)
      toast.error(error?.message || 'Failed to submit result')
    }
  }

  const handleCancelMatch = async () => {
    const confirmMessage = isUnfilledAfterStart
      ? 'This duel already started without enough players. End it now and refund any locked stake?'
      : 'Are you sure you want to cancel this match? Stakes will be refunded.'

    if (!confirm(confirmMessage)) {
      return
    }

    if (!match) return

    try {
      await cancelMatch(matchId)
      toast.success('Match cancelled!')
      await refetch()
    } catch (error: any) {
      console.error('Failed to cancel match:', error)
      toast.error(error?.message || 'Failed to cancel match')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    )
  }

  if (error || !match) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-12 text-center">
          <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h2 className="text-2xl font-bold text-white text-white mb-2">
            Match Not Found
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            The specified match was not found or the ID is invalid
          </p>
          <button
            onClick={() => navigate('/matches')}
            className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg font-medium hover:from-emerald-600 hover:to-cyan-600 transition-all"
          >
            Back to Duel List
          </button>
        </div>
      </div>
    )
  }

  const stakeAmountWei = BigInt(match.stakeAmountWei ?? '0')
  const totalPoolWei = stakeAmountWei * BigInt(2)
  const normalizedAddress = address?.toLowerCase() ?? ''
  const creatorAddress = match.creator?.toLowerCase?.() ?? ''
  const refereeAddress = match.referee?.toLowerCase?.() ?? ''

  const participantCount = match.participants.filter(
    (participant: string) => participant !== ZERO_ADDRESS
  ).length
  const nowSeconds = Math.floor(Date.now() / 1000)

  const isCreator = normalizedAddress !== '' && normalizedAddress === creatorAddress
  const isReferee = normalizedAddress !== '' && normalizedAddress === refereeAddress
  const isParticipant =
    normalizedAddress !== '' &&
    match.participants.some(
      (participant: string) => participant.toLowerCase() === normalizedAddress
    )

  const canJoin =
    isConnected && !isParticipant && match.status === 0 && participantCount < 2 && nowSeconds < match.startTime
  const canSubmitResult =
    isConnected && isReferee && match.mode === 0 && match.status === 1
  const isUnfilledAfterStart = match.status === 0 && participantCount < 2 && nowSeconds >= match.startTime
  const canCancel =
    isConnected && match.status === 0 && (isCreator || isReferee || nowSeconds >= match.startTime)
  const joinBlockedReason = !isConnected
    ? 'Please connect your wallet first.'
    : isParticipant
      ? 'This wallet is already part of the duel.'
      : match.status !== 0
        ? 'This duel is no longer open for joining.'
        : participantCount >= 2
          ? 'This duel already has two participants.'
          : nowSeconds >= match.startTime
            ? 'This duel has already started, so new players cannot join.'
            : null

  const cancelDescription = isUnfilledAfterStart
    ? 'This duel already started without enough participants. End it now and refund any existing stake.'
    : 'Cancel the match and refund stakes to all participants'

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/matches')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-emerald-400 dark:hover:text-emerald-400 mb-4"
        >
          <ArrowLeft size={20} />
          Back to Duel List
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white text-white mb-2">
              Duel Details
            </h1>
            <p className="text-gray-600 dark:text-gray-400">Duel ID: #{matchId}</p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-4 py-2 rounded-full text-sm font-medium ${
                statusColors[match.status] ??
                'bg-white/[0.04] text-gray-100 bg-[#080b12] dark:text-gray-200'
              }`}
            >
              {statusNames[match.status] ?? 'Unknown'}
            </span>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-emerald-400 dark:text-emerald-300 border border-emerald-500/60 rounded-lg hover:bg-emerald-500/5 dark:hover:bg-emerald-900/30 transition-colors"
            >
              <RefreshCw size={16} className={isRefetching ? 'animate-spin' : ''} />
              {isRefetching ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Info Card */}
      <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-6 mb-6">
        {/* Description */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-semibold text-white text-white">
              Description
            </h2>
          </div>
          <p className="text-gray-200 text-gray-300 whitespace-pre-wrap">
            {match.description || 'No description'}
          </p>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Stake Amount */}
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-500/10 dark:bg-emerald-900 rounded-lg">
              <DollarSign className="w-5 h-5 text-emerald-400 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                Stake Amount
              </p>
              <p className="text-lg font-semibold text-white text-white">
                {formatEther(stakeAmountWei)} PAS
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Total Prize Pool: {formatEther(totalPoolWei)} PAS
              </p>
            </div>
          </div>

          {/* Mode */}
          <div className="flex items-start gap-3">
            <div className="p-2 bg-cyan-500/10 dark:bg-cyan-900 rounded-lg">
              <Trophy className="w-5 h-5 text-cyan-400 dark:text-cyan-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                Match Mode
              </p>
              <p className="text-lg font-semibold text-white text-white">
                {match.mode === 0 ? 'Referee Mode' : 'Oracle Mode'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {match.mode === 0
                  ? 'Referee submits result manually'
                  : 'API auto-decides result'}
              </p>
            </div>
          </div>

          {/* Start Time */}
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                Start Time
              </p>
              <p className="text-base font-medium text-white text-white">
                {formatDate(match.startTime)}
              </p>
            </div>
          </div>

          {/* End Time */}
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                End Time
              </p>
              <p className="text-base font-medium text-white text-white">
                {formatDate(match.endTime)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Participants Card */}
      <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-emerald-400" />
          <h2 className="text-xl font-semibold text-white text-white">
            Participants ({participantCount}/2)
          </h2>
        </div>

        <div className="space-y-3">
          {match.participants.map((participant: string, index: number) => {
            const isEmpty = participant === ZERO_ADDRESS
            const participantAddress = participant.toLowerCase()
            const isCurrentUser = normalizedAddress !== '' && normalizedAddress === participantAddress

            const labels: string[] = []
            if (participantAddress === creatorAddress) {
              labels.push('Creator')
            }
            if (participantAddress === refereeAddress && match.mode === 0) {
              labels.push('Referee')
            }
            if (isCurrentUser) {
              labels.push('You')
            }

            return (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-white/[0.02] dark:bg-white/[0.05] rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-mono text-sm font-medium text-white text-white">
                      {isEmpty ? 'Waiting for player...' : formatAddress(participant)}
                    </p>
                    {!isEmpty && labels.length > 0 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {labels.join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
                {!isEmpty && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-6 space-y-4">
        {/* Join Match */}
        {canJoin && (
          <div>
            <h3 className="text-lg font-semibold text-white text-white mb-3">
              Join Match
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Stake {formatEther(stakeAmountWei)} PAS to join
            </p>
            <button
              onClick={handleJoinMatch}
              disabled={isPending || isConfirming}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg font-medium hover:from-emerald-600 hover:to-cyan-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending || isConfirming ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  {isPending ? 'Confirming...' : 'Awaiting confirmation...'}
                </>
              ) : (
                <>
                  <Trophy size={20} />
                  Join Match
                </>
              )}
            </button>
          </div>
        )}

        {/* Submit Result */}
        {canSubmitResult && (
          <div>
            <h3 className="text-lg font-semibold text-white text-white mb-3">
              Submit Result
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              As referee, enter the winner's wallet address
            </p>
            <div className="space-y-3">
              <input
                type="text"
                value={winnerAddress}
                onChange={(e) => setWinnerAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-2 border border-white/[0.1] dark:border-white/[0.08] rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-white/[0.05] text-white font-mono text-sm"
              />
              <button
                onClick={handleSubmitResult}
                disabled={isPending || isConfirming || !winnerAddress}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-medium hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending || isConfirming ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    {isPending ? 'Confirming...' : 'Awaiting confirmation...'}
                  </>
                ) : (
                  <>
                    <CheckCircle size={20} />
                    Submit Result
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Cancel Match */}
        {canCancel && (
          <div>
            <h3 className="text-lg font-semibold text-white text-white mb-3">
              {isUnfilledAfterStart ? 'End Unfilled Match' : 'Cancel Match'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {cancelDescription}
            </p>
            <button
              onClick={handleCancelMatch}
              disabled={isPending || isConfirming}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending || isConfirming ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  {isPending ? 'Confirming...' : 'Awaiting confirmation...'}
                </>
              ) : (
                <>
                  <XCircle size={20} />
                  {isUnfilledAfterStart ? 'End Match & Refund' : 'Cancel Match'}
                </>
              )}
            </button>
          </div>
        )}

        {isUnfilledAfterStart && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-sm font-medium text-amber-200">
              This duel has already reached its start time without enough players. It can now be ended and refunded.
            </p>
          </div>
        )}

        {/* No Actions Available */}
        {!canJoin && !canSubmitResult && !canCancel && (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="text-gray-600 dark:text-gray-400">
              {!isConnected
                ? 'Please connect your wallet to take action'
                : match.status === 2
                ? 'Match completed'
                : match.status === 3
                ? 'Match cancelled'
                : match.status === 0
                ? joinBlockedReason || 'No actions available'
                : 'No actions available'}
            </p>
          </div>
        )}

        {/* Success Message */}
        {isConfirmed && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-200">
              ✅ Action successful! Transaction confirmed.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
