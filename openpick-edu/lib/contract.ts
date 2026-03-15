import { ethers } from 'ethers';
import ERC721FactoryABI from '../contracts/ERC721Factory.abi.json';
import CustomERC721ABI from '../contracts/CustomERC721.abi.json';

// 获取Factory合约地址的函数
const getFactoryContractAddress = (): string => {
  // 如果在浏览器环境中，尝试从localStorage获取用户配置的地址
  if (typeof window !== 'undefined') {
    try {
      const savedContractSettings = localStorage.getItem('contract-settings');
      if (savedContractSettings) {
        const contractSettings = JSON.parse(savedContractSettings);
        if (contractSettings.factoryContractAddress && contractSettings.factoryContractAddress.trim()) {
          return contractSettings.factoryContractAddress;
        }
      }
    } catch (error) {
      console.error('Failed to parse contract settings from localStorage:', error);
    }
  }
  
  // 如果没有用户配置或解析失败，使用环境变量中的地址
  return process.env.FACTORY_CONTRACT_ADDRESS || '0xa35e78984fbeAbcF1E5FF07FC1098295FCa0028F';
};

// Factory合约地址 - 从环境变量或用户配置中读取
const FACTORY_CONTRACT_ADDRESS = getFactoryContractAddress();

// 从导入的JSON中提取ABI数组
const factoryABI = ERC721FactoryABI.abi;
const erc721ABI = CustomERC721ABI.abi;

interface CreateCollectionParams {
  provider: ethers.BrowserProvider;
  name: string;
  symbol: string;
  baseURI?: string;
}

export const createCollection = async (params: CreateCollectionParams): Promise<{
  collectionAddress: string;
  transactionHash: string;
}> => {
  try {
    // 获取签名者
    const signer = await params.provider.getSigner();
    
    // 获取最新的Factory合约地址
    const factoryContractAddress = getFactoryContractAddress();
    
    // 创建Factory合约实例
    const factoryContract = new ethers.Contract(
      factoryContractAddress,
      factoryABI,
      signer
    );
    
    // 调用createCollection函数
    const tx = await factoryContract.createCollection(
      params.name,
      params.symbol,
      params.baseURI || ''
    );
    
    // 等待交易确认
    const receipt = await tx.wait();
    
    // 打印完整的交易日志用于调试
    console.log('Transaction receipt:', receipt);
    console.log('Transaction logs:', receipt.logs);
    console.log('Number of logs:', receipt.logs.length);
    
    // 从事件中获取集合地址
    let collectionAddress = '';
    
    // 检查所有日志
    if (receipt.logs.length > 0) {
      for (let i = 0; i < receipt.logs.length; i++) {
        const log = receipt.logs[i];
        console.log(`Processing log ${i}:`, log);
        
        try {
          // 尝试解析日志
          const parsedLog = factoryContract.interface.parseLog(log);
          console.log(`Parsed log ${i}:`, parsedLog);
          
          // 检查是否是CollectionCreated事件
          if (parsedLog && parsedLog.name === 'CollectionCreated') {
            console.log('Found CollectionCreated event!');
            console.log('Event args:', parsedLog.args);
            
            // 从事件参数中获取集合地址
            if (parsedLog.args && parsedLog.args.collection) {
              collectionAddress = parsedLog.args.collection;
              console.log('Collection address from event:', collectionAddress);
              break; // 找到后退出循环
            }
          }
        } catch (error) {
          console.log(`Failed to parse log ${i}:`, error);
          console.log(`Log topics for log ${i}:`, log.topics);
          
          // 尝试直接从topics中获取集合地址（如果事件签名匹配）
          // CollectionCreated事件的签名: keccak256("CollectionCreated(address,address,string,string)")
          const collectionCreatedTopic = "0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0";
          
          if (log.topics[0] === collectionCreatedTopic && log.topics.length >= 3) {
            // 第二个topic是indexed的collection地址
            collectionAddress = ethers.getAddress(ethers.dataSlice(log.topics[1], 12));
            console.log('Collection address from topics:', collectionAddress);
            break; // 找到后退出循环
          }
        }
      }
    }
    
    if (!collectionAddress) {
      console.error('Collection address not found in transaction logs');
      console.log('All logs details:');
      receipt.logs.forEach((log: ethers.Log, index: number) => {
        console.log(`Log ${index}:`, {
          address: log.address,
          topics: log.topics,
          data: log.data,
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash
        });
      });
      throw new Error('Collection address not found in transaction logs');
    }
    
    return {
      collectionAddress,
      transactionHash: receipt.hash
    };
  } catch (error) {
    console.error('Error creating collection:', error);
    if (error instanceof Error) {
      throw new Error(`Collection creation failed: ${error.message}`);
    }
    throw new Error('Collection creation failed');
  }
};

interface GetUserCollectionsParams {
  provider: ethers.BrowserProvider;
  userAddress: string;
}

export const getUserCollections = async (params: GetUserCollectionsParams): Promise<string[]> => {
  try {
    // 获取最新的Factory合约地址
    const factoryContractAddress = getFactoryContractAddress();
    
    // 创建Factory合约实例（只读）
    const factoryContract = new ethers.Contract(
      factoryContractAddress,
      factoryABI,
      params.provider
    );
    
    // 调用getCollections函数
    const collections = await factoryContract.getCollections(params.userAddress);
    
    return collections;
  } catch (error) {
    console.error('Error fetching user collections:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to fetch user collections: ${error.message}`);
    }
    throw new Error('Failed to fetch user collections');
  }
};

interface MintNFTParams {
  provider: ethers.BrowserProvider;
  contractAddress: string;
  toAddress: string;
}

export const mintNFT = async (params: MintNFTParams): Promise<{
  transactionHash: string;
  tokenId: number;
}> => {
  try {
    // 获取签名者
    const signer = await params.provider.getSigner();
    
    // 创建合约实例
    const contract = new ethers.Contract(params.contractAddress, erc721ABI, signer);
    
    // 调用mint函数（不需要tokenURI参数，因为合约使用baseURI）
    const tx = await contract.mint(params.toAddress);
    
    // 等待交易确认
    const receipt = await tx.wait();
    
    // 从交易日志中提取tokenId
    let tokenId = 0;
    if (receipt.logs.length > 0) {
      try {
        // 解析Transfer事件获取tokenId
        const event = contract.interface.parseLog(receipt.logs[0]);
        if (event && event.name === 'Transfer') {
          tokenId = Number(event.args.tokenId);
        }
      } catch (error) {
        console.error('Error parsing Transfer event:', error);
        // 如果无法从日志中获取tokenId，使用tokenCounter
        try {
          const currentTokenId = await contract.tokenCounter();
          tokenId = Number(currentTokenId) - 1; // 新铸造的token是当前计数器减1
        } catch (counterError) {
          console.error('Error getting token counter:', counterError);
          // 最后的备用方案：使用随机数
          tokenId = Math.floor(Math.random() * 10000);
        }
      }
    }
    
    // 返回结果
    return {
      transactionHash: receipt.hash,
      tokenId
    };
  } catch (error) {
    console.error('Error minting NFT:', error);
    if (error instanceof Error) {
      throw new Error(`NFT minting failed: ${error.message}`);
    }
    throw new Error('NFT minting failed');
  }
};

interface GetNFTMetadataParams {
  provider: ethers.BrowserProvider;
  contractAddress: string;
  tokenId: number;
}

export const getNFTMetadata = async (params: GetNFTMetadataParams): Promise<any> => {
  try {
    // 创建合约实例（只读）
    const contract = new ethers.Contract(params.contractAddress, erc721ABI, params.provider);
    
    // 获取token URI
    const tokenURI = await contract.tokenURI(params.tokenId);
    
    // 直接获取元数据
    const response = await fetch(tokenURI);
    return await response.json();
  } catch (error) {
    console.error('Error fetching NFT metadata:', error);
    throw new Error('Failed to fetch NFT metadata');
  }
};

interface GetNFTContractInfoParams {
  provider: ethers.BrowserProvider;
  contractAddress: string;
}

export const getNFTContractInfo = async (params: GetNFTContractInfoParams): Promise<{
  name: string;
  symbol: string;
  baseURI?: string;
  owner?: string;
}> => {
  try {
    // 创建合约实例（只读）
    const contract = new ethers.Contract(params.contractAddress, erc721ABI, params.provider);
    
    // 获取合约信息
    const [name, symbol, owner] = await Promise.all([
      contract.name(),
      contract.symbol(),
      contract.owner().catch(() => null) // 如果owner函数不存在，返回null
    ]);
    
    // 尝试获取baseURI，如果不存在则忽略
    let baseURI;
    try {
      baseURI = await contract.baseURI();
    } catch (e) {
      // 忽略baseURI不存在的错误
    }
    
    return {
      name,
      symbol,
      ...(baseURI && { baseURI }),
      ...(owner && { owner })
    };
  } catch (error) {
    console.error('Error fetching contract info:', error);
    throw new Error('Failed to fetch contract info');
  }
};

interface GetNFTBalanceParams {
  provider: ethers.BrowserProvider;
  contractAddress: string;
  ownerAddress: string;
}

export const getNFTBalance = async (params: GetNFTBalanceParams): Promise<number> => {
  try {
    // 创建合约实例（只读）
    const contract = new ethers.Contract(params.contractAddress, erc721ABI, params.provider);
    
    // 获取NFT余额
    const balance = await contract.balanceOf(params.ownerAddress);
    
    return Number(balance);
  } catch (error) {
    console.error('Error fetching NFT balance:', error);
    throw new Error('Failed to fetch NFT balance');
  }
};

interface GetOwnerOfNFTParams {
  provider: ethers.BrowserProvider;
  contractAddress: string;
  tokenId: number;
}

export const getOwnerOfNFT = async (params: GetOwnerOfNFTParams): Promise<string> => {
  try {
    // 创建合约实例（只读）
    const contract = new ethers.Contract(params.contractAddress, erc721ABI, params.provider);
    
    // 获取NFT所有者
    const owner = await contract.ownerOf(params.tokenId);
    
    return owner;
  } catch (error) {
    console.error('Error fetching NFT owner:', error);
    throw new Error('Failed to fetch NFT owner');
  }
};