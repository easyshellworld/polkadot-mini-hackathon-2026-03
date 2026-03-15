/**
 * x402 Resource Server Configuration
 * 用于保护顾问购买接口，实现真实的链上 USDC 支付
 */

import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';

// 全局 x402 服务器实例
let resourceServer: x402ResourceServer | null = null;
let isInitializing = false;

/**
 * 获取或创建 x402 Resource Server
 * 应用启动时只需初始化一次
 */
export async function getX402ResourceServer(): Promise<x402ResourceServer> {
  // 如果已经初始化，直接返回
  if (resourceServer) {
    return resourceServer;
  }

  // 防止并发初始化
  if (isInitializing) {
    // 等待初始化完成
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (resourceServer) return resourceServer;
  }

  isInitializing = true;

  try {
    // 1. 获取 Facilitator URL（默认使用 Coinbase 官方服务）
    const facilitatorUrl = process.env.X402_FACILITATOR_URL || 'https://x402.org';

    // 2. 创建资源服务器
    resourceServer = new x402ResourceServer([
      new HTTPFacilitatorClient({ url: facilitatorUrl })
    ]);

    // 3. 注册支持的网络和支付方案
    // Sepolia 测试网
    resourceServer.register('eip155:11155111', new ExactEvmScheme());
    
    // Base Sepolia 测试网
    resourceServer.register('eip155:84532', new ExactEvmScheme());
    
    // Base 主网
    resourceServer.register('eip155:8453', new ExactEvmScheme());

    // 4. 初始化资源服务器（获取 Facilitator 支持列表）
    await resourceServer.initialize();

    console.log('\u2705 x402 Resource Server initialized successfully');
    console.log(`   Facilitator: ${facilitatorUrl}`);
    console.log(`   Supported networks: eip155:11155111, eip155:84532, eip155:8453`);

    return resourceServer;
  } catch (error) {
    console.error('\u274c Failed to initialize x402 Resource Server:', error);
    throw error;
  } finally {
    isInitializing = false;
  }
}

/**
 * 获取 USDC 合约地址
 */
export function getUSDCAddress(network: string): string {
  const usdcAddresses: Record<string, string> = {
    'eip155:11155111': process.env.USDC_SEPOLIA || '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    'eip155:84532': process.env.USDC_BASE_SEPOLIA || '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    'eip155:8453': process.env.USDC_BASE || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  };

  return usdcAddresses[network] || usdcAddresses['eip155:11155111'];
}

/**
 * 重置 x402 服务器（用于测试）
 */
export function resetX402Server() {
  resourceServer = null;
  isInitializing = false;
}
