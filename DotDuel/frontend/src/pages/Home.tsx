import { Link } from 'react-router-dom'
import { Trophy, Users, Shield, Zap, Swords, TrendingUp, ArrowRight, Sparkles } from 'lucide-react'
import { usePlatformStats } from '../hooks/useMatchesApi'
import { formatEther } from 'ethers'

export default function Home() {
  const features = [
    {
      icon: <Trophy className="w-6 h-6" />,
      title: 'Transparent Predictions',
      description: 'Smart contracts auto-execute — code guarantees fairness',
      color: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20',
      iconColor: 'text-emerald-400',
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: 'Dual Mode',
      description: 'Referee mode & Oracle auto mode — flexible for every scenario',
      color: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/20',
      iconColor: 'text-cyan-400',
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: 'Secure & Trustless',
      description: 'Funds custodied by smart contracts — no middleman required',
      color: 'from-violet-500/20 to-violet-500/5 border-violet-500/20',
      iconColor: 'text-violet-400',
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'Auto Settlement',
      description: 'Results settled and prizes distributed instantly on-chain',
      color: 'from-amber-500/20 to-amber-500/5 border-amber-500/20',
      iconColor: 'text-amber-400',
    },
    {
      icon: <Swords className="w-6 h-6" />,
      title: 'Tournament Brackets',
      description: '4/8/16-player elimination brackets with prize pools',
      color: 'from-rose-500/20 to-rose-500/5 border-rose-500/20',
      iconColor: 'text-rose-400',
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: 'Prediction Market',
      description: 'Polymarket-style bets on tournament winners — earn rewards',
      color: 'from-orange-500/20 to-orange-500/5 border-orange-500/20',
      iconColor: 'text-orange-400',
    },
  ]

  const { data: stats } = usePlatformStats()
  const totalMatches = stats?.totalMatches ?? 0
  const totalVolumeETH = stats ? Number(formatEther(BigInt(stats.totalVolumeWei))) : 0
  const totalUsers = stats?.totalUsers ?? 0

  return (
    <div className="space-y-20">
      {/* Hero Section */}
      <section className="relative text-center pt-16 pb-8">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-emerald-500/8 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10">
          <div className="mb-8">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-mono tracking-wider uppercase">
              <Sparkles size={14} />
              Polkadot Hackathon 2026 — Track 3
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tight leading-[1.05]">
            DotDuel
            <br />
            <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400 text-transparent bg-clip-text">
              Prediction Protocol
            </span>
          </h1>

          <p className="text-lg text-gray-400 mb-10 max-w-xl mx-auto leading-relaxed">
            Peer-to-peer predictions and bracket tournaments with on-chain settlement.
            Stake, compete, and earn — powered by Polkadot.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/create"
              className="group inline-flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-xl font-semibold hover:from-emerald-400 hover:to-cyan-400 transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
            >
              Create Duel
              <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              to="/arena"
              className="px-7 py-3.5 border border-amber-500/40 text-amber-400 rounded-xl font-semibold hover:bg-amber-500/10 transition-all"
            >
              Prediction Arena
            </Link>
            <Link
              to="/matches"
              className="px-7 py-3.5 border border-white/10 text-gray-300 rounded-xl font-semibold hover:bg-white/5 hover:border-white/20 transition-all"
            >
              Browse Duels
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section>
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-3">Core Features</h2>
          <p className="text-gray-500">Everything you need for decentralised predictions</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`p-6 rounded-2xl bg-gradient-to-br ${feature.color} border backdrop-blur-sm hover:scale-[1.02] transition-transform`}
            >
              <div className={`${feature.iconColor} mb-4`}>
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="relative overflow-hidden rounded-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 via-cyan-600/20 to-emerald-600/20" />
        <div className="absolute inset-0 bg-[#080b12]/60 backdrop-blur-sm" />
        <div className="relative z-10 p-10 md:p-14">
          <h2 className="text-3xl font-bold text-center text-white mb-10">Platform Stats</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-5xl md:text-6xl font-black text-white mb-2 font-mono">{totalMatches}</div>
              <div className="text-emerald-400/70 text-sm uppercase tracking-widest font-medium">Total Duels</div>
            </div>
            <div>
              <div className="text-5xl md:text-6xl font-black text-white mb-2 font-mono">{totalVolumeETH.toFixed(2)}</div>
              <div className="text-emerald-400/70 text-sm uppercase tracking-widest font-medium">Volume (PAS)</div>
            </div>
            <div>
              <div className="text-5xl md:text-6xl font-black text-white mb-2 font-mono">{totalUsers}</div>
              <div className="text-emerald-400/70 text-sm uppercase tracking-widest font-medium">Unique Users</div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section>
        <h2 className="text-3xl font-bold text-center text-white mb-12">
          How It Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { step: '01', title: 'Connect Wallet', desc: 'Connect MetaMask to the Polkadot network' },
            { step: '02', title: 'Create or Join', desc: 'Stake PAS on a 1v1 duel or join a tournament bracket' },
            { step: '03', title: 'Auto Settlement', desc: 'Smart contract distributes winnings automatically' },
          ].map((item) => (
            <div key={item.step} className="text-center group">
              <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/20 flex items-center justify-center group-hover:border-emerald-500/40 transition-colors">
                <span className="text-xl font-mono font-bold text-emerald-400">{item.step}</span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {item.title}
              </h3>
              <p className="text-gray-400 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center py-12 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
        <h2 className="text-3xl font-bold text-white mb-3">
          Ready to Compete?
        </h2>
        <p className="text-gray-400 mb-8">
          Create your first duel or join a tournament right now
        </p>
        <div className="flex gap-3 justify-center flex-col sm:flex-row">
          <Link
            to="/create"
            className="inline-flex items-center gap-2 px-7 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-xl font-semibold hover:from-emerald-400 hover:to-cyan-400 transition-all shadow-lg shadow-emerald-500/20"
          >
            Create Duel
          </Link>
          <Link
            to="/tournaments/create"
            className="px-7 py-3 border border-white/10 text-gray-300 rounded-xl font-semibold hover:bg-white/5 transition-all"
          >
            Create Tournament
          </Link>
        </div>
      </section>
    </div>
  )
}

