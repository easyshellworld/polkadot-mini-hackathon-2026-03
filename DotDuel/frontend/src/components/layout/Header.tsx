import { Link, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import ConnectWallet from '../wallet/ConnectWallet'

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()

  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'Duels', href: '/matches' },
    { name: 'Arena', href: '/arena' },
    { name: 'Tournaments', href: '/tournaments' },
    { name: 'My Duels', href: '/my-matches' },
    { name: 'Stats', href: '/stats' },
  ]

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/'
    return location.pathname.startsWith(href)
  }

  return (
    <header className="sticky top-0 z-50 bg-[#080b12]/80 backdrop-blur-xl border-b border-white/[0.06]">
      <nav className="container mx-auto px-4 py-3 max-w-7xl">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <img src="/dotduel.png" alt="DotDuel" className="w-9 h-9 rounded-xl ring-1 ring-white/10 group-hover:ring-emerald-500/40 transition-all" />
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-white tracking-tight leading-none">
                DotDuel
              </h1>
              <p className="text-[10px] text-emerald-400/70 font-mono tracking-widest uppercase">v2.0.0</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  isActive(item.href)
                    ? 'text-emerald-400 bg-emerald-500/10'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* Connect Wallet */}
          <div className="hidden md:block">
            <ConnectWallet />
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-gray-400 hover:text-white transition-colors"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-3 pb-3 border-t border-white/[0.06] pt-3 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive(item.href)
                    ? 'text-emerald-400 bg-emerald-500/10'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.name}
              </Link>
            ))}
            <div className="px-2 pt-2">
              <ConnectWallet />
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}

