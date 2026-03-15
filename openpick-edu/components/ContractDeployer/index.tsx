'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';

interface ContractDeployerProps {
  onDeploy: (config: DeployConfig) => void;
  isDeploying: boolean;
  deployResult: any;
  compileResult: any;
}

interface DeployConfig {
  bytecode: string;
  abi: any[];
  constructorArgs: any[];
  gasLimit?: number;
  gasPrice?: string;
}

const ContractDeployer: React.FC<ContractDeployerProps> = ({ 
  onDeploy, 
  isDeploying, 
  deployResult,
  compileResult 
}) => {
  const t = useTranslations('contract');
  const [constructorArgs, setConstructorArgs] = useState<string[]>([]);
  const [gasLimit, setGasLimit] = useState<string>('3000000');
  const [gasPrice, setGasPrice] = useState<string>('20');

  const isDeployable = compileResult && compileResult.success && compileResult.output;

  const handleDeploy = () => {
    if (!isDeployable) return;

    const config: DeployConfig = {
      bytecode: compileResult.output.bytecode,
      abi: compileResult.output.abi,
      constructorArgs: constructorArgs.map(arg => {
        // Try to parse as JSON, if fails, treat as string
        try {
          return JSON.parse(arg);
        } catch {
          return arg;
        }
      }),
      gasLimit: parseInt(gasLimit),
      gasPrice: `${gasPrice} gwei`
    };

    onDeploy(config);
  };

  const getConstructorInputs = () => {
    if (!isDeployable || !compileResult.output.abi) return [];
    
    const constructor = compileResult.output.abi.find((item: any) => item.type === 'constructor');
    return constructor ? constructor.inputs : [];
  };

  const constructorInputs = getConstructorInputs();

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-zinc-900">
      <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Deploy Contract</h2>
        <button
          onClick={handleDeploy}
          disabled={isDeploying || !isDeployable}
          className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-zinc-400 disabled:cursor-not-allowed dark:bg-green-600 dark:hover:bg-green-700"
        >
          {isDeploying ? 'Deploying...' : 'Deploy Contract'}
        </button>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {!isDeployable ? (
          <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
            <p>Please compile your contract first before deploying</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Constructor Arguments */}
            {constructorInputs.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2 text-zinc-900 dark:text-white">Constructor Arguments:</h3>
                <div className="space-y-2">
                  {constructorInputs.map((input: any, index: number) => (
                    <div key={index} className="flex items-center space-x-2">
                      <label className="text-sm font-medium w-1/3 text-zinc-700 dark:text-zinc-300">
                        {input.name} ({input.type}):
                      </label>
                      <input
                        type="text"
                        value={constructorArgs[index] || ''}
                        onChange={(e) => {
                          const newArgs = [...constructorArgs];
                          newArgs[index] = e.target.value;
                          setConstructorArgs(newArgs);
                        }}
                        placeholder={`Enter ${input.type} value`}
                        className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Gas Configuration */}
            <div>
              <h3 className="font-semibold mb-2 text-zinc-900 dark:text-white">Gas Configuration:</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Gas Limit:</label>
                  <input
                    type="number"
                    value={gasLimit}
                    onChange={(e) => setGasLimit(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">Gas Price (Gwei):</label>
                  <input
                    type="number"
                    value={gasPrice}
                    onChange={(e) => setGasPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Contract Info */}
            <div>
              <h3 className="font-semibold mb-2 text-zinc-900 dark:text-white">Contract Information:</h3>
              <div className="bg-gray-50 dark:bg-zinc-800 p-3 rounded-md">
                <p className="text-sm text-zinc-700 dark:text-zinc-300"><strong>Bytecode Size:</strong> {compileResult.output.bytecode.length / 2 - 1} bytes</p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300"><strong>ABI Functions:</strong> {compileResult.output.abi.filter((item: any) => item.type === 'function').length}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Deploy Result */}
      {deployResult && (
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 max-h-48 overflow-y-auto">
          <h3 className="font-semibold mb-2 text-zinc-900 dark:text-white">Deployment Result:</h3>
          {deployResult.success ? (
            <div className="text-green-600 dark:text-green-400">
              <p>✓ Contract deployed successfully!</p>
              <div className="mt-2 text-sm space-y-1">
                <p className="text-zinc-700 dark:text-zinc-300"><strong>Contract Address:</strong> {deployResult.contractAddress}</p>
                <p className="text-zinc-700 dark:text-zinc-300"><strong>Transaction URL:</strong> <a href={deployResult.transactionUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">{deployResult.transactionUrl}</a></p>
                {deployResult.blockNumber && (
                  <p className="text-zinc-700 dark:text-zinc-300"><strong>Block Number:</strong> {deployResult.blockNumber}</p>
                )}
                {deployResult.gasUsed && (
                  <p className="text-zinc-700 dark:text-zinc-300"><strong>Gas Used:</strong> {deployResult.gasUsed}</p>
                )}
                {deployResult.note && (
                  <p className="text-xs mt-2 text-zinc-600 dark:text-zinc-400">{deployResult.note}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-red-600 dark:text-red-400">
              <p>✗ Deployment failed</p>
              {deployResult.error && (
                <p className="mt-2 text-sm">{deployResult.error}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ContractDeployer;