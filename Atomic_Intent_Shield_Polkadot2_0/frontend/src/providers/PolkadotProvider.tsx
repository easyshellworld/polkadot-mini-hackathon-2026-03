import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { web3Enable, web3Accounts, web3FromAddress } from '@polkadot/extension-dapp';
import type { InjectedAccountWithMeta } from '@polkadot/extension-inject/types';
import { decodeAddress } from '@polkadot/util-crypto';

interface PolkadotContextType {
  api: ApiPromise | null;
  rpcEndpoint: string;
  accounts: InjectedAccountWithMeta[];
  selectedAccount: InjectedAccountWithMeta | null;
  isConnected: boolean;
  isConnecting: boolean;
  isApiReady: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  selectAccount: (account: InjectedAccountWithMeta) => void;
  setRpcEndpoint: (endpoint: string) => void;
  getSigner: () => Promise<any>;
}

const PolkadotContext = createContext<PolkadotContextType>({
  api: null,
  rpcEndpoint: '',
  accounts: [],
  selectedAccount: null,
  isConnected: false,
  isConnecting: false,
  isApiReady: false,
  connect: async () => {},
  disconnect: () => {},
  selectAccount: () => {},
  setRpcEndpoint: () => {},
  getSigner: async () => null,
});

export const usePolkadot = () => useContext(PolkadotContext);

const PAS_ASSET_HUB_WS = 'wss://sys.ibp.network/asset-hub-paseo';

function isAccountId32(address: string): boolean {
  try {
    return decodeAddress(address).length === 32;
  } catch {
    return false;
  }
}

function resolveDefaultWsEndpoint(): string {
  if (import.meta.env.VITE_SUBSTRATE_WS) return import.meta.env.VITE_SUBSTRATE_WS;
  if (import.meta.env.VITE_SUBSTRATE_RPC_URL) return import.meta.env.VITE_SUBSTRATE_RPC_URL;

  // Prefer same-origin /ws proxy first; fallback endpoint remains available via UI switch.
  if (typeof window === 'undefined') return PAS_ASSET_HUB_WS;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

const DEFAULT_WS_ENDPOINT = resolveDefaultWsEndpoint();

export const PolkadotProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [api, setApi] = useState<ApiPromise | null>(null);
  const [rpcEndpoint, setRpcEndpointState] = useState<string>(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_WS_ENDPOINT;
    }
    const stored = window.localStorage.getItem('polkashield_rpc_endpoint');
    if (!stored) return DEFAULT_WS_ENDPOINT;
    // Auto-fix: if page is HTTPS but stored endpoint is insecure ws://, reset to default
    if (window.location.protocol === 'https:' && stored.startsWith('ws://')) {
      window.localStorage.removeItem('polkashield_rpc_endpoint');
      return DEFAULT_WS_ENDPOINT;
    }
    if (stored.includes('paseo-asset-hub-rpc.polkadot.io')) {
      window.localStorage.removeItem('polkashield_rpc_endpoint');
      return DEFAULT_WS_ENDPOINT;
    }
    return stored;
  });
  const [accounts, setAccounts] = useState<InjectedAccountWithMeta[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<InjectedAccountWithMeta | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isApiReady, setIsApiReady] = useState(false);

  const setRpcEndpoint = useCallback((endpoint: string) => {
    const trimmed = endpoint.trim();
    if (!trimmed) {
      return;
    }
    setRpcEndpointState(trimmed);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('polkashield_rpc_endpoint', trimmed);
    }
  }, []);

  // Initialize API connection
  useEffect(() => {
    let mounted = true;
    let apiInstance: ApiPromise | null = null;

    const initApi = async () => {
      setIsApiReady(false);
      try {
        const provider = new WsProvider(rpcEndpoint);
        apiInstance = await ApiPromise.create({ provider });
        if (!mounted) {
          await apiInstance.disconnect();
          return;
        }
        setApi(apiInstance);
        setIsApiReady(true);
      } catch (error) {
        if (mounted) {
          setApi(null);
          setIsApiReady(false);
        }
        console.error('Failed to connect to Substrate node:', error);
      }
    };

    initApi();

    return () => {
      mounted = false;
      if (apiInstance) {
        apiInstance.disconnect();
      }
    };
  }, [rpcEndpoint]);

  // Connect to browser wallet extension
  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      // Enable the extension (Polkadot.js, SubWallet, Talisman)
      const extensions = await web3Enable('Atomic Intent for Polkadot');
      if (extensions.length === 0) {
        throw new Error('No Polkadot wallet extension found. Please install Polkadot.js, SubWallet, or Talisman.');
      }

      // Get all accounts
      const allAccounts = await web3Accounts();
      const substrateAccounts = allAccounts.filter((account) => isAccountId32(account.address));
      setAccounts(substrateAccounts);

      if (substrateAccounts.length > 0) {
        setSelectedAccount(substrateAccounts[0]);
        setIsConnected(true);
      } else {
        setSelectedAccount(null);
        setIsConnected(false);
        throw new Error('No Substrate account detected in your wallet. Please switch to a Polkadot/Substrate account (usually starts with 5...).');
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccounts([]);
    setSelectedAccount(null);
    setIsConnected(false);
  }, []);

  const selectAccount = useCallback((account: InjectedAccountWithMeta) => {
    setSelectedAccount(account);
  }, []);

  // Get signer for the selected account (for signing transactions)
  const getSigner = useCallback(async () => {
    if (!selectedAccount) {
      throw new Error('No account selected');
    }
    const injector = await web3FromAddress(selectedAccount.address);
    return injector.signer;
  }, [selectedAccount]);

  return (
    <PolkadotContext.Provider
      value={{
        api,
        rpcEndpoint,
        accounts,
        selectedAccount,
        isConnected,
        isConnecting,
        isApiReady,
        connect,
        disconnect,
        selectAccount,
        setRpcEndpoint,
        getSigner,
      }}
    >
      {children}
    </PolkadotContext.Provider>
  );
};
