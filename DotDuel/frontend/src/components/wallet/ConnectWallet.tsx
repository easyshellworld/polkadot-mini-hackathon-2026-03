import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { Wallet, LogOut, Loader2 } from 'lucide-react'

export default function ConnectWallet() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  // Find priority connector (MetaMask or Injected)
  const primaryConnector = connectors.find(c => c.id === 'io.metamask') || 
                          connectors.find(c => c.id === 'injected') || 
                          connectors[0];

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/[0.06] rounded-lg">
          <Wallet size={14} className="text-emerald-400" />
          <span className="text-sm font-mono text-gray-300">
            {formatAddress(address)}
          </span>
        </div>
        <button
          onClick={() => disconnect()}
          className="flex items-center gap-2 px-3 py-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          title="Disconnect wallet"
        >
          <LogOut size={14} />
          <span className="hidden sm:inline text-sm">Disconnect</span>
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {primaryConnector && (
        <button
          key={primaryConnector.id}
          onClick={() => connect({ connector: primaryConnector })}
          disabled={isPending}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg font-medium hover:from-emerald-400 hover:to-cyan-400 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <Wallet size={16} />
              <span>Connect Wallet</span>
            </>
          )}
        </button>
      )}
    </div>
  )
}

