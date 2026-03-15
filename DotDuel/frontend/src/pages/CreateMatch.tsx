import { useState } from 'react'
import { useAccount } from 'wagmi'
import { useContract } from '../hooks/useContract'
import { parseEther } from 'ethers'
import toast from 'react-hot-toast'
import { Loader2, Trophy, Calendar, DollarSign, FileText } from 'lucide-react'

export default function CreateMatch() {
  const { isConnected } = useAccount()
  const { createMatch, isPending, isConfirming, isConfirmed } = useContract()

  const [formData, setFormData] = useState({
    mode: '0', // 0: Referee mode, 1: Oracle mode
    stakeAmount: '',
    startTime: '',
    endTime: '',
    description: '',
    externalMatchId: '',
    includeStake: true, // Referee also stakes
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isConnected) {
      toast.error('Please connect your wallet first')
      return
    }

    try {
      const stakeInWei = parseEther(formData.stakeAmount)
      const startTimestamp = Math.floor(new Date(formData.startTime).getTime() / 1000)
      const endTimestamp = Math.floor(new Date(formData.endTime).getTime() / 1000)

      const now = Math.floor(Date.now() / 1000)
      if (Number.isNaN(startTimestamp) || Number.isNaN(endTimestamp)) {
        toast.error('Please select valid dates')
        return
      }
      if (startTimestamp <= now) {
        toast.error('Start time must be in the future')
        return
      }
      if (endTimestamp <= startTimestamp) {
        toast.error('End time must be after start time')
        return
      }
      const duration = endTimestamp - startTimestamp
      if (duration < 3600) {
        toast.error('Match duration must be at least 1 hour')
        return
      }
      const maxDuration = 30 * 24 * 3600
      if (duration > maxDuration) {
        toast.error('Match duration cannot exceed 30 days')
        return
      }

      await createMatch(
        Number(formData.mode),
        stakeInWei,
        startTimestamp,
        endTimestamp,
        formData.description,
        formData.externalMatchId,
        formData.includeStake
      )

      toast.success('Match created successfully!')
      
      // Reset form
      setFormData({
        mode: '0',
        stakeAmount: '',
        startTime: '',
        endTime: '',
        description: '',
        externalMatchId: '',
        includeStake: true,
      })
    } catch (error: any) {
      console.error('Create match error:', error)
      toast.error(error?.message || 'Failed to create match')
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked
      setFormData(prev => ({ ...prev, [name]: checked }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-8 text-center">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h2 className="text-2xl font-bold text-white text-white mb-2">
            Connect Your Wallet
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            You need to connect a wallet to create a match
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white text-white mb-2">
          Create Duel
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Set up match parameters and invite players to join
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-6 space-y-6">
        {/* Mode Selection */}
        <div>
          <label className="block text-sm font-medium text-white text-white mb-2">
            <div className="flex items-center gap-2">
              <Trophy size={16} />
              Match Mode
            </div>
          </label>
          <select
            name="mode"
            value={formData.mode}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-white/[0.1] dark:border-white/[0.08] rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-white/[0.05] text-white"
            required
          >
            <option value="0">Referee Mode (referee decides result)</option>
            <option value="1">Oracle Mode (API auto-decides result)</option>
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {formData.mode === '0' 
              ? 'Referee creates match & submits result manually. Fee: referee 3% + platform 0.5%' 
              : 'Syncs match data from external API, auto-decides result. Fee: platform 0.5%'}
          </p>
        </div>

        {/* Stake Amount */}
        <div>
          <label className="block text-sm font-medium text-white text-white mb-2">
            <div className="flex items-center gap-2">
              <DollarSign size={16} />
              Stake Amount (PAS)
            </div>
          </label>
          <input
            type="number"
            name="stakeAmount"
            value={formData.stakeAmount}
            onChange={handleChange}
            step="0.001"
            min="0.001"
            placeholder="0.1"
            className="w-full px-4 py-2 border border-white/[0.1] dark:border-white/[0.08] rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-white/[0.05] text-white"
            required
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Amount each player needs to stake
          </p>
        </div>

        {/* Referee also stakes */}
        {formData.mode === '0' && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="includeStake"
              name="includeStake"
              checked={formData.includeStake}
              onChange={handleChange}
              className="w-4 h-4 text-emerald-400 border-white/[0.1] rounded focus:ring-emerald-500"
            />
            <label htmlFor="includeStake" className="text-sm text-white text-white">
              I (referee) also stake and participate as a player
            </label>
          </div>
        )}

        {/* Start Time */}
        <div>
          <label className="block text-sm font-medium text-white text-white mb-2">
            <div className="flex items-center gap-2">
              <Calendar size={16} />
              Start Time
            </div>
          </label>
          <input
            type="datetime-local"
            name="startTime"
            value={formData.startTime}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-white/[0.1] dark:border-white/[0.08] rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-white/[0.05] text-white"
            required
          />
        </div>

        {/* End Time */}
        <div>
          <label className="block text-sm font-medium text-white text-white mb-2">
            <div className="flex items-center gap-2">
              <Calendar size={16} />
              End Time
            </div>
          </label>
          <input
            type="datetime-local"
            name="endTime"
            value={formData.endTime}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-white/[0.1] dark:border-white/[0.08] rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-white/[0.05] text-white"
            required
          />
        </div>

        {/* Match Description */}
        <div>
          <label className="block text-sm font-medium text-white text-white mb-2">
            <div className="flex items-center gap-2">
              <FileText size={16} />
              Match Description
            </div>
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={4}
            placeholder="e.g. Pickleball singles match..."
            className="w-full px-4 py-2 border border-white/[0.1] dark:border-white/[0.08] rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-white/[0.05] text-white"
            required
          />
        </div>

        {/* External Match ID (required for Oracle mode) */}
        {formData.mode === '1' && (
          <div>
            <label className="block text-sm font-medium text-white text-white mb-2">
              External Match ID (mydupr)
            </label>
            <input
              type="text"
              name="externalMatchId"
              value={formData.externalMatchId}
              onChange={handleChange}
              placeholder="mydupr-123456"
              className="w-full px-4 py-2 border border-white/[0.1] dark:border-white/[0.08] rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-white/[0.05] text-white"
              required
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Match ID from the mydupr API
            </p>
          </div>
        )}

        {/* Submit */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={isPending || isConfirming}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg font-medium hover:from-emerald-600 hover:to-cyan-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending || isConfirming ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                {isPending ? 'Confirming...' : 'Waiting for confirmation...'}
              </>
            ) : (
              <>
                <Trophy size={20} />
                Create Match
              </>
            )}
          </button>

          {isConfirmed && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-200">
                ✅ Match created successfully! Transaction confirmed.
              </p>
            </div>
          )}
        </div>
      </form>

      {/* Info Section */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
          💡 How It Works
        </h3>
        <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
          <li>• After creating a match, wait for another player to join and stake</li>
          <li>• Once both players have staked, the match status becomes "In Progress"</li>
          <li>• After the match ends, the referee or Oracle submits the result</li>
          <li>• The winner automatically receives the prize (minus fees)</li>
          <li>• If no opponent joins, you can cancel the match and get a refund</li>
        </ul>
      </div>
    </div>
  )
}


