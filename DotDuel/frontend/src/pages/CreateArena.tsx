import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flame, Swords, FileText, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAccount } from 'wagmi'
import { useArenaContract } from '../hooks/useArenaContract'

export default function CreateArena() {
  const navigate = useNavigate()
  const { address } = useAccount()
  const { createArena, isPending, isConfirming, isConfirmed } = useArenaContract()

  const [title, setTitle] = useState('')
  const [sideA, setSideA] = useState('')
  const [sideB, setSideB] = useState('')
  const [description, setDescription] = useState('')
  const [bettingHours, setBettingHours] = useState(24)
  const [resolveHours, setResolveHours] = useState(48)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!address) {
      toast.error('Please connect your wallet')
      return
    }
    if (!title.trim() || !sideA.trim() || !sideB.trim()) {
      toast.error('Title and both side names are required')
      return
    }
    if (bettingHours < 2) {
      toast.error('Betting period must be at least 2 hours')
      return
    }
    if (resolveHours <= bettingHours) {
      toast.error('Resolve deadline must be after betting deadline')
      return
    }

    try {
      const now = Math.floor(Date.now() / 1000)
      const bettingDeadline = BigInt(now + bettingHours * 3600)
      const resolveDeadline = BigInt(now + resolveHours * 3600)

      createArena(title, sideA, sideB, description, bettingDeadline, resolveDeadline)
      toast.success('Arena creation submitted!')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create arena')
    }
  }

  if (isConfirmed) {
    toast.success('Arena created successfully!')
    navigate('/arena')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white text-white flex items-center gap-3">
          <Flame className="w-8 h-8 text-orange-500" />
          Create Prediction Arena
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Set up a match and let the crowd predict the winner.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Match Info */}
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white text-white flex items-center gap-2">
            <Swords size={20} className="text-orange-500" />
            Match Details
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-200 text-gray-300 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Lakers vs Warriors"
              maxLength={100}
              className="w-full px-4 py-3 border border-white/[0.1] dark:border-white/[0.08] rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-white/[0.05] text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-200 text-gray-300 mb-1">
                Side A *
              </label>
              <input
                type="text"
                value={sideA}
                onChange={(e) => setSideA(e.target.value)}
                placeholder="e.g. Lakers"
                maxLength={50}
                className="w-full px-4 py-3 border border-white/[0.1] dark:border-white/[0.08] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-white/[0.05] text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-200 text-gray-300 mb-1">
                Side B *
              </label>
              <input
                type="text"
                value={sideB}
                onChange={(e) => setSideB(e.target.value)}
                placeholder="e.g. Warriors"
                maxLength={50}
                className="w-full px-4 py-3 border border-white/[0.1] dark:border-white/[0.08] rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-white/[0.05] text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-200 text-gray-300 mb-1 flex items-center gap-1">
              <FileText size={14} />
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details about the match..."
              rows={3}
              maxLength={500}
              className="w-full px-4 py-3 border border-white/[0.1] dark:border-white/[0.08] rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-white/[0.05] text-white"
            />
          </div>
        </div>

        {/* Timing */}
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white text-white flex items-center gap-2">
            <Clock size={20} className="text-orange-500" />
            Timing
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-200 text-gray-300 mb-1">
                Betting Period (hours) *
              </label>
              <input
                type="number"
                min={2}
                max={168}
                value={bettingHours}
                onChange={(e) => setBettingHours(parseInt(e.target.value) || 24)}
                className="w-full px-4 py-3 border border-white/[0.1] dark:border-white/[0.08] rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-white/[0.05] text-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                Betting closes in {bettingHours} hours
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-200 text-gray-300 mb-1">
                Resolve Deadline (hours) *
              </label>
              <input
                type="number"
                min={bettingHours + 1}
                max={336}
                value={resolveHours}
                onChange={(e) => setResolveHours(parseInt(e.target.value) || 48)}
                className="w-full px-4 py-3 border border-white/[0.1] dark:border-white/[0.08] rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-white/[0.05] text-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                You must resolve by {resolveHours} hours from now
              </p>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl p-6 border border-orange-200 dark:border-orange-800">
          <h3 className="text-sm font-semibold text-gray-200 text-gray-300 mb-3 uppercase tracking-wider">
            Summary
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Match:</span>{' '}
              <span className="font-medium text-white text-white">
                {sideA || '?'} vs {sideB || '?'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Creator Reward:</span>{' '}
              <span className="font-medium text-white text-white">2% of prize pool</span>
            </div>
            <div>
              <span className="text-gray-500">Bet Closes:</span>{' '}
              <span className="font-medium text-white text-white">{bettingHours}h from now</span>
            </div>
            <div>
              <span className="text-gray-500">Min Bet:</span>{' '}
              <span className="font-medium text-white text-white">0.001 PAS</span>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending || isConfirming || !address}
          className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl font-bold text-lg hover:from-orange-600 hover:to-red-700 transition-all shadow-lg shadow-orange-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Confirm in wallet...' : isConfirming ? 'Creating...' : 'Create Arena'}
        </button>
      </form>
    </div>
  )
}
