import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<any>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  removeListener?: (event: string, handler: (...args: any[]) => void) => void;
};

interface EvmContextType {
  evmProvider: Eip1193Provider | null;
  evmAddress: string | null;
  evmChainId: string | null;
  evmBalance: string | null;
  isEvmConnected: boolean;
  isEvmConnecting: boolean;
  connectEvm: () => Promise<void>;
  disconnectEvm: () => void;
}

const EvmContext = createContext<EvmContextType>({
  evmProvider: null,
  evmAddress: null,
  evmChainId: null,
  evmBalance: null,
  isEvmConnected: false,
  isEvmConnecting: false,
  connectEvm: async () => {},
  disconnectEvm: () => {},
});

export const useEvm = () => useContext(EvmContext);

function getEvmProvider(): Eip1193Provider | null {
  if (typeof window === 'undefined') return null;
  return (window as any).ethereum as Eip1193Provider | undefined || null;
}

const EVM_CHAIN_ID = (import.meta.env.VITE_EVM_CHAIN_ID_HEX as string | undefined) || '0xaa36a7';
const EVM_CHAIN_NAME = (import.meta.env.VITE_EVM_CHAIN_NAME as string | undefined) || 'Sepolia';
const EVM_RPC_URL = (import.meta.env.VITE_EVM_RPC_URL as string | undefined) || 'https://ethereum-sepolia-rpc.publicnode.com';
const EVM_EXPLORER_URL = (import.meta.env.VITE_EVM_EXPLORER_URL as string | undefined) || 'https://sepolia.etherscan.io';
const EVM_CURRENCY_SYMBOL = (import.meta.env.VITE_EVM_CURRENCY_SYMBOL as string | undefined) || 'ETH';

function formatEthBalance(weiHex: string): string {
  const wei = BigInt(weiHex);
  const eth = Number(wei) / 1e18;
  return eth.toFixed(4);
}

/** Ask the wallet to switch to configured EVM network; add it if missing. */
async function ensureConfiguredNetwork(provider: Eip1193Provider): Promise<void> {
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: EVM_CHAIN_ID }],
    });
  } catch (err: any) {
    // 4902 = chain not added yet
    if (err?.code === 4902) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: EVM_CHAIN_ID,
          chainName: EVM_CHAIN_NAME,
          nativeCurrency: { name: `${EVM_CHAIN_NAME} Native`, symbol: EVM_CURRENCY_SYMBOL, decimals: 18 },
          rpcUrls: [EVM_RPC_URL],
          blockExplorerUrls: [EVM_EXPLORER_URL],
        }],
      });
    } else {
      throw err;
    }
  }
}

export const EvmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [evmAddress, setEvmAddress] = useState<string | null>(null);
  const [evmChainId, setEvmChainId] = useState<string | null>(null);
  const [evmBalance, setEvmBalance] = useState<string | null>(null);
  const [isEvmConnecting, setIsEvmConnecting] = useState(false);
  const evmProvider = getEvmProvider();
  const isEvmConnected = !!evmAddress;

  const fetchBalance = useCallback(async (address: string) => {
    const provider = getEvmProvider();
    if (!provider || !address) return;
    try {
      const balHex = await provider.request({ method: 'eth_getBalance', params: [address, 'latest'] }) as string;
      setEvmBalance(formatEthBalance(balHex));
    } catch {
      setEvmBalance(null);
    }
  }, []);

  const connectEvm = useCallback(async () => {
    const provider = getEvmProvider();
    if (!provider) {
      throw new Error('No EVM wallet found. Please install MetaMask or enable SubWallet EVM.');
    }
    setIsEvmConnecting(true);
    try {
      const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
      // Ensure we are on configured EVM network (Revive/Sepolia/etc.)
      await ensureConfiguredNetwork(provider);
      const chainId = await provider.request({ method: 'eth_chainId' }) as string;
      const addr = accounts?.[0] || null;
      setEvmAddress(addr);
      setEvmChainId(chainId);
      if (addr) await fetchBalance(addr);
    } catch (err: any) {
      throw new Error(err?.message || 'Failed to connect EVM wallet');
    } finally {
      setIsEvmConnecting(false);
    }
  }, [fetchBalance]);

  const disconnectEvm = useCallback(() => {
    setEvmAddress(null);
    setEvmChainId(null);
    setEvmBalance(null);
  }, []);

  // Listen for account/chain changes
  useEffect(() => {
    const provider = getEvmProvider();
    if (!provider?.on) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnectEvm();
      } else {
        setEvmAddress(accounts[0]);
        fetchBalance(accounts[0]);
      }
    };
    const handleChainChanged = (chainId: string) => {
      setEvmChainId(chainId);
      if (evmAddress) fetchBalance(evmAddress);
    };

    provider.on('accountsChanged', handleAccountsChanged);
    provider.on('chainChanged', handleChainChanged);

    return () => {
      provider.removeListener?.('accountsChanged', handleAccountsChanged);
      provider.removeListener?.('chainChanged', handleChainChanged);
    };
  }, [evmAddress, fetchBalance, disconnectEvm]);

  return (
    <EvmContext.Provider
      value={{
        evmProvider,
        evmAddress,
        evmChainId,
        evmBalance,
        isEvmConnected,
        isEvmConnecting,
        connectEvm,
        disconnectEvm,
      }}
    >
      {children}
    </EvmContext.Provider>
  );
};
