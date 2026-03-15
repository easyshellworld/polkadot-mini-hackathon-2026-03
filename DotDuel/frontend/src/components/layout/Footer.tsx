import { Github, Twitter, Send } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06] mt-auto bg-[#080b12]/80">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">
              About
            </h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              DotDuel is a decentralised 1v1 prediction & tournament platform
              built on Polkadot with Revive (REVM) technology.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">
              Quick Links
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/tournaments" className="text-gray-500 hover:text-emerald-400 transition-colors">
                  Tournaments
                </a>
              </li>
              <li>
                <a href="https://github.com" className="text-gray-500 hover:text-emerald-400 transition-colors">
                  GitHub
                </a>
              </li>
              <li>
                <a href="https://wiki.polkadot.network" className="text-gray-500 hover:text-emerald-400 transition-colors">
                  Polkadot Wiki
                </a>
              </li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">
              Community
            </h3>
            <div className="flex space-x-3">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-white/5 rounded-lg hover:bg-emerald-500/10 transition-colors"
              >
                <Github size={18} className="text-gray-400" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-white/5 rounded-lg hover:bg-emerald-500/10 transition-colors"
              >
                <Twitter size={18} className="text-gray-400" />
              </a>
              <a
                href="https://t.me"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-white/5 rounded-lg hover:bg-emerald-500/10 transition-colors"
              >
                <Send size={18} className="text-gray-400" />
              </a>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-6 border-t border-white/[0.06]">
          <div className="flex flex-col md:flex-row justify-between items-center text-xs text-gray-600">
            <p>© 2025 DotDuel — Decentralised Prediction & Tournament Protocol. Built for Polkadot Hackathon.</p>
            <p className="mt-2 md:mt-0 font-mono">v2.0.0</p>
          </div>
        </div>
      </div>
    </footer>
  )
}

