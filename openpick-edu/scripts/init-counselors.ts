/**
 * 顾问系统初始化脚本
 * 用于添加测试顾问数据
 * 
 * 运行方式：
 * npx tsx scripts/init-counselors.ts
 */

import { addCounselor } from '../lib/database-counselors';

const testCounselors = [
  {
    name: 'Alice Chen',
    skills: [
      { name: 'Solidity', level: 'expert' },
      { name: 'Smart Contract Security', level: 'expert' },
      { name: 'DeFi', level: 'advanced' }
    ],
    remark: '5年智能合约开发经验，曾参与多个头部DeFi项目的安全审计',
    priceUsd: 15.0,
    telegram: '@alice_web3',
    wechat: 'alice_chen_web3',
    walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    servedTimes: 0,
  },
  {
    name: 'Bob Zhang',
    skills: [
      { name: 'React', level: 'expert' },
      { name: 'Next.js', level: 'expert' },
      { name: 'Web3.js', level: 'advanced' },
      { name: 'Ethers.js', level: 'advanced' }
    ],
    remark: 'Web3前端专家，擅长构建 DApp 用户界面和钱包集成',
    priceUsd: 12.0,
    telegram: '@bob_frontend',
    wechat: 'bob_zhang_dev',
    walletAddress: '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
    servedTimes: 0,
  },
  {
    name: 'Carol Li',
    skills: [
      { name: 'NFT', level: 'expert' },
      { name: 'ERC-721', level: 'expert' },
      { name: 'ERC-1155', level: 'advanced' },
      { name: 'IPFS', level: 'advanced' }
    ],
    remark: 'NFT技术专家，深入了解NFT标准和元数据存储',
    priceUsd: 10.0,
    telegram: '@carol_nft',
    wechat: 'carol_li_nft',
    walletAddress: '0xdD2FD4581271e230360230F9337D5c0430Bf44C0',
    servedTimes: 0,
  },
  {
    name: 'David Wang',
    skills: [
      { name: 'Rust', level: 'expert' },
      { name: 'Substrate', level: 'advanced' },
      { name: 'Polkadot', level: 'advanced' },
      { name: 'Move', level: 'intermediate' }
    ],
    remark: 'Polkadot生态开发者，专注于Substrate框架和跨链技术',
    priceUsd: 18.0,
    telegram: '@david_polkadot',
    wechat: 'david_wang_rust',
    walletAddress: '0xbDA5747bFD65F08deb54cb465eB87D40e51B197E',
    servedTimes: 0,
  },
  {
    name: 'Eva Martinez',
    skills: [
      { name: 'Tokenomics', level: 'expert' },
      { name: 'DAO Governance', level: 'expert' },
      { name: 'Game Theory', level: 'advanced' },
      { name: 'Economics', level: 'expert' }
    ],
    remark: '加密经济学专家，帮助项目设计可持续的代币经济模型和治理机制',
    priceUsd: 20.0,
    telegram: '@eva_tokenomics',
    wechat: 'eva_martinez_eco',
    walletAddress: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    servedTimes: 0,
  },
  {
    name: 'Frank Liu',
    skills: [
      { name: 'Layer 2', level: 'expert' },
      { name: 'Optimistic Rollup', level: 'advanced' },
      { name: 'ZK-Rollup', level: 'advanced' },
      { name: 'Scaling Solutions', level: 'expert' }
    ],
    remark: 'Layer2扩容方案专家，深入研究Optimism、Arbitrum等主流L2技术',
    priceUsd: 22.0,
    telegram: '@frank_layer2',
    wechat: 'frank_liu_l2',
    walletAddress: '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
    servedTimes: 0,
  },
  {
    name: 'Grace Kim',
    skills: [
      { name: 'Python', level: 'expert' },
      { name: 'MEV', level: 'advanced' },
      { name: 'Trading Bots', level: 'expert' },
      { name: 'Arbitrage', level: 'advanced' }
    ],
    remark: 'DeFi交易策略专家，擅长MEV研究和自动化交易系统开发',
    priceUsd: 25.0,
    telegram: '@grace_mev',
    wechat: 'grace_kim_defi',
    walletAddress: '0x5AEDA56215b167893e80B4fE645BA6d5Bab767DE',
    servedTimes: 0,
  },
  {
    name: 'Henry Tanaka',
    skills: [
      { name: 'Solana', level: 'expert' },
      { name: 'Anchor', level: 'expert' },
      { name: 'Rust', level: 'advanced' },
      { name: 'High Performance', level: 'advanced' }
    ],
    remark: 'Solana生态核心开发者，精通Anchor框架和高性能程序开发',
    priceUsd: 17.0,
    telegram: '@henry_solana',
    wechat: 'henry_tanaka_sol',
    walletAddress: '0x6813Eb9362372EEF6200f3b1dbC3f819671cBA69',
    servedTimes: 0,
  },
];

async function initCounselors() {
  console.log('开始初始化顾问数据...\n');

  for (const counselor of testCounselors) {
    try {
      const result = await addCounselor(counselor);
      console.log(`✓ 成功添加顾问: ${counselor.name} (ID: ${result.id})`);
    } catch (error) {
      console.error(`✗ 添加顾问失败 ${counselor.name}:`, error);
    }
  }

  console.log('\n顾问数据初始化完成！');
  console.log('\n下一步：');
  console.log('1. 启动开发服务器: npm run dev');
  console.log('2. 访问顾问页面: http://localhost:3000/zh/counselors');
  console.log('3. 连接钱包后即可购买顾问服务');
}

initCounselors().catch(console.error);
