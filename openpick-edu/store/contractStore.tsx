// 合约状态管理Store
// 路径：/store/contractStore.ts

import { create } from 'zustand';

// 编译结果类型
export interface CompileResult {
  abi: any[];
  bytecode: string;
  deployedBytecode: string;
  metadata: string;
}

// 部署配置类型
export interface DeployConfig {
  bytecode: string;
  abi: any[];
  constructorArgs: any[];
  chainId: number;
  gasLimit: number;
  gasPrice?: string;
}

// 部署结果类型
export interface DeployResult {
  transactionHash: string;
  contractAddress: string;
  blockNumber?: number;
  gasUsed: number;
}

// 网络类型
export interface Network {
  id: number;
  name: string;
}

// 合约编辑器状态
export interface ContractEditorState {
  sourceCode: string;             // 合约源代码
  compileResult: CompileResult | null;    // 编译结果
  isCompiling: boolean;           // 编译状态
  selectedTemplate: string | null; // 选中的模板
  errors: any[];                  // 编译错误
  
  setSourceCode: (source: string) => void;
  setCompileResult: (result: CompileResult | null) => void;
  setIsCompiling: (isCompiling: boolean) => void;
  setSelectedTemplate: (template: string | null) => void;
  setErrors: (errors: any[]) => void;
  reset: () => void;
}

// 合约部署状态
export interface ContractDeployerState {
  deployConfig: DeployConfig;     // 部署配置
  deployResult: DeployResult | null;      // 部署结果
  isDeploying: boolean;           // 部署状态
  selectedNetwork: Network;       // 选中的网络
  estimatedGas: number;           // 估算的Gas
  recommendedGasPrice: string;    // 推荐的Gas价格
  
  setDeployConfig: (config: Partial<DeployConfig>) => void;
  setDeployResult: (result: DeployResult | null) => void;
  setIsDeploying: (isDeploying: boolean) => void;
  setSelectedNetwork: (network: Network) => void;
  setEstimatedGas: (gas: number) => void;
  setRecommendedGasPrice: (price: string) => void;
  reset: () => void;
}

// 默认网络配置
const DEFAULT_NETWORK: Network = {
  id: 11155111,
  name: 'Ethereum Sepolia Test'
};

// 默认部署配置
const DEFAULT_DEPLOY_CONFIG: DeployConfig = {
  bytecode: '',
  abi: [],
  constructorArgs: [],
  chainId: DEFAULT_NETWORK.id,
  gasLimit: 3000000
};

// 基础NFT合约模板
const BASE_NFT_TEMPLATE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyNFT is ERC721, Ownable {
    uint256 private _tokenIdCounter;

    constructor() ERC721("MyNFT", "MNFT") Ownable(msg.sender) {
        _tokenIdCounter = 0;
    }

    function safeMint(address to) public onlyOwner {
        uint256 tokenId = _tokenIdCounter++;
        _safeMint(to, tokenId);
    }
}
`;

// 创建合约编辑器store
export const useContractEditorStore = create<ContractEditorState>((set) => ({
  sourceCode: BASE_NFT_TEMPLATE,
  compileResult: null,
  isCompiling: false,
  selectedTemplate: 'basic',
  errors: [],
  
  setSourceCode: (source) => set({ sourceCode: source }),
  setCompileResult: (result) => set({ compileResult: result }),
  setIsCompiling: (isCompiling) => set({ isCompiling }),
  setSelectedTemplate: (template) => set({ selectedTemplate: template }),
  setErrors: (errors) => set({ errors }),
  reset: () => set({
    sourceCode: BASE_NFT_TEMPLATE,
    compileResult: null,
    isCompiling: false,
    selectedTemplate: 'basic',
    errors: []
  })
}));

// 创建合约部署store
export const useContractDeployerStore = create<ContractDeployerState>((set) => ({
  deployConfig: DEFAULT_DEPLOY_CONFIG,
  deployResult: null,
  isDeploying: false,
  selectedNetwork: DEFAULT_NETWORK,
  estimatedGas: 3000000,
  recommendedGasPrice: '20',
  
  setDeployConfig: (config) => set((state) => ({
    deployConfig: { ...state.deployConfig, ...config }
  })),
  setDeployResult: (result) => set({ deployResult: result }),
  setIsDeploying: (isDeploying) => set({ isDeploying }),
  setSelectedNetwork: (network) => set({ selectedNetwork: network }),
  setEstimatedGas: (gas) => set({ estimatedGas: gas }),
  setRecommendedGasPrice: (price) => set({ recommendedGasPrice: price }),
  reset: () => set({
    deployConfig: DEFAULT_DEPLOY_CONFIG,
    deployResult: null,
    isDeploying: false,
    selectedNetwork: DEFAULT_NETWORK,
    estimatedGas: 3000000,
    recommendedGasPrice: '20'
  })
}));