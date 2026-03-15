'use client';

import React, { useState } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import ContractEditor from '../ContractEditor';
import ContractDeployer from '../ContractDeployer';
import { ContractDeploymentService, DeployConfig } from '../../lib/deploy';

interface ContractModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ContractModal: React.FC<ContractModalProps> = ({ isOpen, onClose }) => {
  const { wallet, connectWallet, switchChain } = useWallet();
  const [activeTab, setActiveTab] = useState<'editor' | 'deployer'>('editor');
  const [isCompiling, setIsCompiling] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [compileResult, setCompileResult] = useState<any>(null);
  const [deployResult, setDeployResult] = useState<any>(null);

  const handleCompile = async (sourceCode: string) => {
    setIsCompiling(true);
    setDeployResult(null); // Reset deploy result when compiling

    try {
      const response = await fetch('/api/compile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: sourceCode,
          version: '0.8.28',
          optimize: true,
          runs: 200
        })
      });

      const result = await response.json();
      setCompileResult(result);

      // If compilation is successful, switch to deployer tab
      if (result.success) {
        setActiveTab('deployer');
      }
    } catch (error) {
      console.error('Compilation error:', error);
      setCompileResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown compilation error'
      });
    } finally {
      setIsCompiling(false);
    }
  };

  const handleDeploy = async (config: DeployConfig) => {
    if (!wallet?.provider) {
      alert('Please connect your wallet first');
      return;
    }

    setIsDeploying(true);

    try {
      // Check if user is on the correct network (Sepolia testnet)
      const sepoliaChainId = 11155111;
      if (wallet.chainId !== sepoliaChainId) {
        // Try to switch to Sepolia network
        try {
          await switchChain(sepoliaChainId);
        } catch (err) {
          console.error('Failed to switch to Sepolia network:', err);
          alert(`Please switch to Sepolia test network in your wallet. Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
          return;
        }
      }
      
      // Get signer from wallet provider
      const signer = await wallet.provider.getSigner();
      
      // Use client-side deployment for better security
      const result = await ContractDeploymentService.deployWithWallet(config, signer);
      setDeployResult(result);
    } catch (error) {
      console.error('Deployment error:', error);
      setDeployResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown deployment error'
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const handleConnectWallet = () => {
    connectWallet('injected');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-6xl w-full h-4/5 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Custom NFT Contract Development</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Wallet Connection Status */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-800">
          {wallet ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  Connected: {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                </span>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  (Chain ID: {wallet.chainId})
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-sm text-zinc-700 dark:text-zinc-300">Not connected</span>
              </div>
              <button
                onClick={handleConnectWallet}
                className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors"
              >
                Connect Wallet
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab('editor')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'editor'
                ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            Contract Editor
          </button>
          <button
            onClick={() => setActiveTab('deployer')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'deployer'
                ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
            disabled={!compileResult?.success}
          >
            Contract Deployer
            {!compileResult?.success && (
              <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">(Compile first)</span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'editor' && (
            <ContractEditor
              onCompile={handleCompile}
              isCompiling={isCompiling}
              compileResult={compileResult}
            />
          )}
          {activeTab === 'deployer' && (
            <ContractDeployer
              onDeploy={handleDeploy}
              isDeploying={isDeploying}
              deployResult={deployResult}
              compileResult={compileResult}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ContractModal;