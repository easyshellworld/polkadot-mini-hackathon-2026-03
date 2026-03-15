import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { ArrowLeft, Trophy, Users, Clock, DollarSign, Info } from 'lucide-react'
import { parseEther } from 'ethers'
import toast from 'react-hot-toast'
import { useTournamentContract } from '../hooks/useTournamentContract'

const bracketOptions = [
  { value: 0, label: '4 Players', desc: '2 rounds, 3 matches' },
  { value: 1, label: '8 Players', desc: '3 rounds, 7 matches' },
  { value: 2, label: '16 Players', desc: '4 rounds, 15 matches' },
]

export default function CreateTournament() {
  const navigate = useNavigate()
  const { isConnected } = useAccount()
  const { createTournament, isPending } = useTournamentContract()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [bracketSize, setBracketSize] = useState(0)
  const [entryFee, setEntryFee] = useState('0.01')
  const [registrationDays, setRegistrationDays] = useState(3)
  const [startDays, setStartDays] = useState(5)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isConnected) {
      toast.error('Please connect your wallet first')
      return
    }

    if (!name.trim()) {
      toast.error('Please enter a tournament name')
      return
    }

    if (!entryFee || parseFloat(entryFee) < 0) {
      toast.error('Please enter a valid entry fee')
      return
    }

    if (registrationDays < 1 || startDays <= registrationDays) {
      toast.error('Start time must be after registration deadline')
      return
    }

    try {
      const now = Math.floor(Date.now() / 1000)
      const regDeadline = now + registrationDays * 86400
      const startTime = now + startDays * 86400
      const entryFeeWei = parseEther(entryFee)

      await createTournament(name, description, bracketSize, entryFeeWei, regDeadline, startTime)
      toast.success('Tournament created successfully!')
      navigate('/tournaments')
    } catch (err: any) {
      console.error('Create tournament error:', err)
      toast.error(err?.message?.slice(0, 100) || 'Failed to create tournament')
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back */}
      <Link
        to="/tournaments"
        className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-emerald-400 mb-6"
      >
        <ArrowLeft size={18} />
        Back to Tournaments
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white text-white mb-2 flex items-center gap-3">
          <Trophy className="text-emerald-400" size={32} />
          Create Tournament
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Set up a bracket-style tournament with a prize pool and prediction market
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white text-white flex items-center gap-2">
            <Info size={20} className="text-emerald-400" />
            Basic Information
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-200 text-gray-300 mb-1">
              Tournament Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. DotDuel Championship S1"
              maxLength={100}
              className="w-full px-4 py-3 border border-white/[0.1] dark:border-white/[0.08] rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-white/[0.05] text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-200 text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your tournament (optional)"
              rows={3}
              maxLength={500}
              className="w-full px-4 py-3 border border-white/[0.1] dark:border-white/[0.08] rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-white/[0.05] text-white resize-none"
            />
          </div>
        </div>

        {/* Tournament Settings */}
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white text-white flex items-center gap-2">
            <Users size={20} className="text-emerald-400" />
            Tournament Settings
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-200 text-gray-300 mb-2">
              Bracket Size *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {bracketOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setBracketSize(opt.value)}
                  className={`p-4 rounded-lg border-2 text-center transition-all ${
                    bracketSize === opt.value
                      ? 'border-emerald-500 bg-emerald-500/5 dark:bg-emerald-900/20'
                      : 'border-white/[0.06] dark:border-white/[0.08] hover:border-white/[0.1]'
                  }`}
                >
                  <p className="text-lg font-bold text-white text-white">{opt.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-200 text-gray-300 mb-1 flex items-center gap-2">
              <DollarSign size={16} className="text-emerald-400" />
              Entry Fee (PAS) *
            </label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={entryFee}
              onChange={(e) => setEntryFee(e.target.value)}
              placeholder="0.01"
              className="w-full px-4 py-3 border border-white/[0.1] dark:border-white/[0.08] rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-white/[0.05] text-white"
            />
            <p className="text-xs text-gray-500 mt-1">
              Set to 0 for free entry. The total prize pool = entry fee × number of players.
            </p>
          </div>
        </div>

        {/* Timing */}
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white text-white flex items-center gap-2">
            <Clock size={20} className="text-emerald-400" />
            Schedule
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-200 text-gray-300 mb-1">
                Registration Period (days from now) *
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={registrationDays}
                onChange={(e) => setRegistrationDays(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-3 border border-white/[0.1] dark:border-white/[0.08] rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-white/[0.05] text-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                Registration closes {registrationDays} day{registrationDays > 1 ? 's' : ''} from now
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-200 text-gray-300 mb-1">
                Start Time (days from now) *
              </label>
              <input
                type="number"
                min={registrationDays + 1}
                max={60}
                value={startDays}
                onChange={(e) => setStartDays(parseInt(e.target.value) || registrationDays + 1)}
                className="w-full px-4 py-3 border border-white/[0.1] dark:border-white/[0.08] rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-white/[0.05] text-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                Tournament starts {startDays} day{startDays > 1 ? 's' : ''} from now
              </p>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-gradient-to-r from-emerald-900/20 to-cyan-900/20 dark:from-emerald-900/20 dark:to-cyan-900/20 rounded-xl p-6 border border-emerald-500/30 dark:border-emerald-500/20">
          <h3 className="text-sm font-semibold text-gray-200 text-gray-300 mb-3 uppercase tracking-wider">
            Summary
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Name:</span>{' '}
              <span className="text-white text-white font-medium">{name || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500">Bracket:</span>{' '}
              <span className="text-white text-white font-medium">
                {bracketOptions[bracketSize]?.label}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Entry Fee:</span>{' '}
              <span className="text-white text-white font-medium">{entryFee} PAS</span>
            </div>
            <div>
              <span className="text-gray-500">Max Prize Pool:</span>{' '}
              <span className="text-white text-white font-medium">
                {(
                  parseFloat(entryFee || '0') *
                  [4, 8, 16][bracketSize] *
                  0.975
                ).toFixed(3)}{' '}
                PAS
              </span>
            </div>
            <div>
              <span className="text-gray-500">Reg. Deadline:</span>{' '}
              <span className="text-white text-white font-medium">
                {new Date(Date.now() + registrationDays * 86400000).toLocaleDateString('en-US')}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Start:</span>{' '}
              <span className="text-white text-white font-medium">
                {new Date(Date.now() + startDays * 86400000).toLocaleDateString('en-US')}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Platform fee: 2.5% of entry pool, 5% of prediction pool
          </p>
        </div>

        {/* Submit */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={isPending || !isConnected}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg font-semibold hover:from-emerald-600 hover:to-cyan-600 disabled:opacity-50 transition-all text-lg"
          >
            {isPending
              ? 'Creating Tournament...'
              : !isConnected
              ? 'Connect Wallet to Create'
              : 'Create Tournament'}
          </button>
        </div>
      </form>
    </div>
  )
}
