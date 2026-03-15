import { ethers } from 'ethers';

export interface DeployConfig {
  bytecode: string;
  abi: any[];
  constructorArgs?: any[];
  gasLimit?: number;
  gasPrice?: string;
}

export interface DeployResult {
  success: boolean;
  contractAddress?: string;
  contractUrl?: string;
  transactionHash?: string;
  transactionUrl?: string;
  blockNumber?: number;
  gasUsed?: string;
  deployer?: string;
  error?: string;
}

export class ContractDeploymentService {
  /**
   * Deploy a contract using the client-side wallet
   * This is the recommended approach for security
   */
  static async deployWithWallet(
    config: DeployConfig,
    signer: ethers.JsonRpcSigner
  ): Promise<DeployResult> {
    try {
      // Create contract factory
      const factory = new ethers.ContractFactory(config.abi, config.bytecode, signer);

      // Prepare deployment options
      const deployOptions: any = {};
      if (config.gasLimit) deployOptions.gasLimit = config.gasLimit;
      if (config.gasPrice) {
        // Parse gas price if it's a string with units
        if (typeof config.gasPrice === 'string' && config.gasPrice.includes('gwei')) {
          // Remove all whitespace and 'gwei' text, then parse
          const gasPriceValue = config.gasPrice.replace(/\s+gwei/g, '');
          deployOptions.gasPrice = ethers.parseUnits(gasPriceValue, 'gwei');
        } else {
          deployOptions.gasPrice = config.gasPrice;
        }
      }

      // Deploy the contract
      let contract;
      if (config.constructorArgs && config.constructorArgs.length > 0) {
        contract = await factory.deploy(...config.constructorArgs, deployOptions);
      } else {
        contract = await factory.deploy(deployOptions);
      }

      // Wait for deployment to complete
      const deploymentReceipt = await contract.waitForDeployment();

      // Get transaction details
      const deployTransaction = contract.deploymentTransaction();
      if (!deployTransaction) {
        throw new Error('Deployment transaction not found');
      }

      const receipt = await deployTransaction.wait();

      const contractAddress = await contract.getAddress();
      
      return {
        success: true,
        contractAddress: contractAddress,
        contractUrl: `https://sepolia.etherscan.io/address/${contractAddress}`,
        transactionHash: deployTransaction.hash,
        transactionUrl: `https://sepolia.etherscan.io/tx/${deployTransaction.hash}`,
        blockNumber: receipt?.blockNumber,
        gasUsed: receipt?.gasUsed?.toString(),
        deployer: await signer.getAddress()
      };

    } catch (error) {
      console.error('Deployment error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown deployment error'
      };
    }
  }

  /**
   * Deploy a contract using the server API
   * This requires authentication via signature
   */
  static async deployWithServer(
    config: DeployConfig,
    signer: ethers.JsonRpcSigner
  ): Promise<DeployResult> {
    try {
      // Sign a message to authenticate the user
      const message = 'Deploy contract with OpenPick';
      const signature = await signer.signMessage(message);

      // Send deployment request to server
      const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${signature}`
        },
        body: JSON.stringify(config)
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.error || 'Deployment failed'
        };
      }

      return result;

    } catch (error) {
      console.error('Server deployment error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown deployment error'
      };
    }
  }
}