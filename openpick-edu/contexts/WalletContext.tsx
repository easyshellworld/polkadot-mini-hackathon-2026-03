'use client';

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

interface Wallet {
  address: string;
  chainId: number;
  balance?: string;
  provider?: ethers.BrowserProvider;
  isWalletConnect?: boolean;
}

interface WalletContextType {
  wallet: Wallet | null;
  isConnecting: boolean;
  error: string | null;
  connectWallet: (method: 'injected' | 'walletconnect') => Promise<void>;
  disconnectWallet: () => Promise<void>;
  switchChain: (chainId: number) => Promise<void>;
  signMessage: (message: string) => Promise<string>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

interface WalletProviderProps {
  children: React.ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletConnectModal, setWalletConnectModal] = useState<any>(null);

  useEffect(() => {
    // Check if wallet is already connected (via MetaMask or other injected providers)
    const checkInjectedProvider = async () => {
      if (window.ethereum) {
        try {
          // Check if we have a previously connected wallet in localStorage
          const savedWalletAddress = localStorage.getItem('walletAddress');
          const isConnected = localStorage.getItem('walletConnected') === 'true';
          
          const provider = new ethers.BrowserProvider(window.ethereum);
          const accounts = await provider.listAccounts();
          
          // If we have a saved wallet and it's still in the accounts list, reconnect
          if (isConnected && savedWalletAddress && accounts.some(acc => acc.address === savedWalletAddress)) {
            const account = accounts.find(acc => acc.address === savedWalletAddress);
            if (account) {
              const network = await provider.getNetwork();
              const balance = await provider.getBalance(account.address);
              
              setWallet({
                address: account.address,
                chainId: Number(network.chainId),
                balance: ethers.formatEther(balance),
                provider
              });
            }
          } 
          // Otherwise, if there are accounts but no saved state, check if they were previously connected
          else if (accounts.length > 0 && isConnected) {
            const network = await provider.getNetwork();
            const balance = await provider.getBalance(accounts[0].address);
            
            setWallet({
              address: accounts[0].address,
              chainId: Number(network.chainId),
              balance: ethers.formatEther(balance),
              provider
            });
            
            // Update the saved wallet address
            localStorage.setItem('walletAddress', accounts[0].address);
          }
        } catch (err) {
          console.error('Failed to check injected provider:', err);
        }
      }
    };

    checkInjectedProvider();
    
    // Set up event listeners for MetaMask
    if (window.ethereum) {
      // Handle account changes
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          // User disconnected their wallet
          setWallet(null);
          localStorage.removeItem('walletConnected');
          localStorage.removeItem('walletAddress');
        } else if (accounts[0] !== wallet?.address) {
          // User switched to a different account
          const updateWallet = async () => {
            try {
              if (!window.ethereum) return;
              const provider = new ethers.BrowserProvider(window.ethereum);
              const network = await provider.getNetwork();
              const balance = await provider.getBalance(accounts[0]);
              
              setWallet({
                address: accounts[0],
                chainId: Number(network.chainId),
                balance: ethers.formatEther(balance),
                provider
              });
              
              // Update the saved wallet address
              localStorage.setItem('walletAddress', accounts[0]);
            } catch (err) {
              console.error('Failed to update wallet after account change:', err);
            }
          };
          updateWallet();
        }
      };
      
      // Handle chain changes
      const handleChainChanged = (chainId: string) => {
        // Reload the page when chain changes to avoid any inconsistencies
        window.location.reload();
      };
      
      // Handle disconnect
      const handleDisconnect = (error: { code: number; message: string }) => {
        console.error('MetaMask disconnected:', error);
        setWallet(null);
        localStorage.removeItem('walletConnected');
        localStorage.removeItem('walletAddress');
      };
      
      // Add event listeners
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      window.ethereum.on('disconnect', handleDisconnect);
      
      // Clean up event listeners when component unmounts
      return () => {
        if (window.ethereum && window.ethereum.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
          window.ethereum.removeListener('disconnect', handleDisconnect);
        }
      };
    }
  }, [wallet?.address]);

  // Initialize WalletConnect Modal on client side only
  const initializeWalletConnect = useCallback(async () => {
    if (!walletConnectModal && typeof window !== 'undefined') {
      try {
        // Dynamically import WalletConnect Modal to avoid SSR issues and test file imports
        const { WalletConnectModal } = await import('@walletconnect/modal');
        
        const modal = new WalletConnectModal({
          projectId: process.env.WALLETCONNECT_PROJECT_ID || 'default-project-id',
          themeMode: 'light',
          themeVariables: {
            '--wcm-font-family': 'Inter, sans-serif',
            '--wcm-background-border-radius': '8px'
          },
          chains: ['11155111']
        });
        setWalletConnectModal(modal);
        return modal;
      } catch (err) {
        console.error('Failed to initialize WalletConnect:', err);
        throw new Error('Failed to initialize WalletConnect');
      }
    }
    return walletConnectModal;
  }, [walletConnectModal]);

  const connectInjectedWallet = async () => {
    if (window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      const network = await provider.getNetwork();
      const balance = await provider.getBalance(accounts[0]);

      setWallet({
        address: accounts[0],
        chainId: Number(network.chainId),
        balance: ethers.formatEther(balance),
        provider
      });
      
      // Save connection state to localStorage
      localStorage.setItem('walletConnected', 'true');
      localStorage.setItem('walletAddress', accounts[0]);
    } else {
      throw new Error('No Web3 provider found. Please install MetaMask or another Web3 wallet.');
    }
  };

  const connectWalletConnect = async () => {
    const modal = await initializeWalletConnect();
    if (!modal) {
      throw new Error('Failed to initialize WalletConnect modal');
    }

    // This is a simplified implementation
    // In a production app, you would use the full WalletConnect SDK
    // For now, we'll just show the modal and use a mock implementation
    // The full implementation would require @walletconnect/sign-client
    await modal.openModal();
    throw new Error('WalletConnect is not fully implemented yet. Please use MetaMask for now.');
  };

  const connectWallet = async (method: 'injected' | 'walletconnect' = 'injected') => {
    setIsConnecting(true);
    setError(null);

    try {
      if (method === 'injected') {
        await connectInjectedWallet();
      } else {
        await connectWalletConnect();
      }
    } catch (err) {
      console.error('Failed to connect wallet:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = async () => {
    try {
      if (wallet?.isWalletConnect && walletConnectModal) {
        await walletConnectModal.closeModal();
      }
      setWallet(null);
      
      // Clear connection state from localStorage
      localStorage.removeItem('walletConnected');
      localStorage.removeItem('walletAddress');
    } catch (err) {
      console.error('Failed to disconnect wallet:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect wallet');
    }
  };

  const switchChain = async (chainId: number) => {
    if (!wallet?.provider) {
      throw new Error('No wallet connected');
    }

    try {
      // Try to switch to the chain
      await wallet.provider.send('wallet_switchEthereumChain', [{ chainId: ethers.toBeHex(chainId) }]);
      const network = await wallet.provider.getNetwork();
      setWallet(prev => prev ? { ...prev, chainId: Number(network.chainId) } : null);
    } catch (err: any) {
      // If the chain doesn't exist, try to add it
      if (err.code === 4902) {
        try {
          // Add Sepolia test network
          if (chainId === 11155111) {
            await wallet.provider.send('wallet_addEthereumChain', [{
              chainId: ethers.toBeHex(chainId),
              chainName: 'Ethereum Sepolia Test Network',
              nativeCurrency: {
                name: 'Ethereum',
                symbol: 'ETH',
                decimals: 18
              },
              rpcUrls: ['https://sepolia.infura.io/v3/7cb673f9a1324974899fc4cd4429b450'],
              blockExplorerUrls: ['https://sepolia.etherscan.io']
            }]);
            
            // Switch to the newly added chain
            await wallet.provider.send('wallet_switchEthereumChain', [{ chainId: ethers.toBeHex(chainId) }]);
            const network = await wallet.provider.getNetwork();
            setWallet(prev => prev ? { ...prev, chainId: Number(network.chainId) } : null);
          } else {
            throw new Error(`Unsupported chain ID: ${chainId}`);
          }
        } catch (addError) {
          console.error('Failed to add chain:', addError);
          throw new Error(`Failed to add chain: ${addError instanceof Error ? addError.message : 'Unknown error'}`);
        }
      } else {
        console.error('Failed to switch chain:', err);
        throw new Error(`Failed to switch chain: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  };

  const signMessage = async (message: string): Promise<string> => {
    if (!wallet?.provider) {
      throw new Error('No wallet connected');
    }

    try {
      const signer = await wallet.provider.getSigner();
      return await signer.signMessage(message);
    } catch (err) {
      console.error('Failed to sign message:', err);
      throw new Error('Failed to sign message');
    }
  };

  return (
    <WalletContext.Provider
      value={{
        wallet,
        isConnecting,
        error,
        connectWallet,
        disconnectWallet,
        switchChain,
        signMessage
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};