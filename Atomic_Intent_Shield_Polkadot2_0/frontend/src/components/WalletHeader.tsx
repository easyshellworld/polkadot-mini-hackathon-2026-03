import React from 'react';
import { usePolkadot } from '../providers/PolkadotProvider';
import { useEvm } from '../providers/EvmProvider';

const wsProto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const PRESET_RPC = {
  local: typeof window !== 'undefined' ? `${wsProto}//${window.location.host}/ws` : 'ws://127.0.0.1:9944',
  westendAssetHub: (import.meta.env.VITE_WESTEND_ASSET_HUB_WS as string | undefined) || 'wss://westend-asset-hub-rpc.polkadot.io',
};

const configuredEvmChainName = (import.meta.env.VITE_EVM_CHAIN_NAME as string | undefined) || 'Revive';
const configuredEvmChainId = ((import.meta.env.VITE_EVM_CHAIN_ID_HEX as string | undefined) || '').toLowerCase();

const WalletHeader: React.FC = () => {
  const {
    accounts,
    selectedAccount,
    isConnected,
    isConnecting,
    isApiReady,
    rpcEndpoint,
    connect,
    disconnect,
    selectAccount,
    setRpcEndpoint,
  } = usePolkadot();

  const { evmAddress, isEvmConnected, evmChainId, disconnectEvm } = useEvm();

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <header className="border-b border-gray-800 px-6 py-4">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-2xl font-bold">
            Atomic Intent <span className="text-pink-500">Shield</span>
          </span>
          <span className="text-xs bg-pink-500/20 text-pink-400 px-2 py-0.5 rounded-full">
            Testnet
          </span>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setRpcEndpoint(PRESET_RPC.local)}
              className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700"
              title="Switch RPC to local development chain"
            >
              Local Development
            </button>
            <button
              onClick={() => setRpcEndpoint(PRESET_RPC.westendAssetHub)}
              className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700"
              title="Switch RPC to Westend Asset Hub"
            >
              Westend Asset Hub
            </button>
            <input
              type="text"
              value={rpcEndpoint}
              onChange={(e) => setRpcEndpoint(e.target.value)}
              className="w-[290px] bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200"
              title="Current RPC endpoint"
            />
          </div>
          <div className={`text-xs ${isApiReady ? 'text-emerald-400' : 'text-yellow-400'}`}>
            RPC: {isApiReady ? 'Connected' : 'Connecting...'}
          </div>

          {isConnected && selectedAccount ? (
            <div className="flex items-center space-x-3">
              <div className="text-sm">
                <div className="text-gray-400">{selectedAccount.meta.name || 'Account'}</div>
                <div className="font-mono text-xs text-gray-500">
                  {truncateAddress(selectedAccount.address)}
                </div>
              </div>

              <select
                value={selectedAccount.address}
                onChange={(e) => {
                  const account = accounts.find((item) => item.address === e.target.value);
                  if (account) {
                    selectAccount(account);
                  }
                }}
                className="max-w-[220px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200"
                title="Switch connected account"
              >
                {accounts.map((account) => (
                  <option key={account.address} value={account.address}>
                    {(account.meta.name || 'Account') + ' (' + (account.meta.source || 'wallet') + ')'}
                  </option>
                ))}
              </select>

              <button
                onClick={connect}
                disabled={isConnecting}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-700 rounded-lg text-xs transition-colors"
              >
                {isConnecting ? 'Refreshing...' : 'Reload Accounts'}
              </button>

              <button
                onClick={disconnect}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={connect}
              disabled={isConnecting}
              className="px-6 py-2 bg-pink-600 hover:bg-pink-500 disabled:bg-gray-600 rounded-lg font-medium transition-colors"
            >
              {isConnecting ? 'Connecting...' : 'Connect Polkadot Wallet'}
            </button>
          )}

          {/* EVM wallet status */}
          {isEvmConnected && evmAddress && (
            <div className="flex items-center space-x-3">
              <div className="text-sm">
                <div className="text-indigo-400">EVM Wallet</div>
                <div className="font-mono text-xs text-gray-300">
                  {truncateAddress(evmAddress)}
                </div>
              </div>
              {evmChainId && (
                <span className="text-xs text-gray-500">
                  ({configuredEvmChainId && evmChainId.toLowerCase() === configuredEvmChainId
                    ? configuredEvmChainName
                    : `chain ${evmChainId}`})
                </span>
              )}
              <button
                onClick={disconnectEvm}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default WalletHeader;
