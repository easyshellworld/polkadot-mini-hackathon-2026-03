#!/bin/bash
# x402 集成快速测试脚本

echo "🚀 x402 支付协议集成测试"
echo "========================"
echo ""

# 检查环境变量
echo "📋 步骤 1: 检查环境变量配置"
if [ ! -f .env.local ]; then
  echo "⚠️  .env.local 文件不存在，从模板复制..."
  cp .example.env.local .env.local
  echo "✅ 已创建 .env.local，请编辑文件配置必要的环境变量"
  echo ""
else
  echo "✅ .env.local 文件已存在"
  echo ""
fi

# 检查依赖
echo "📦 步骤 2: 检查 x402 依赖包"
if grep -q "@x402/core" package.json; then
  echo "✅ x402 依赖包已安装"
else
  echo "⚠️  x402 依赖包未安装，正在安装..."
  npm install @x402/core @x402/fetch @x402/evm viem
fi
echo ""

# 显示支持的网络
echo "🌐 步骤 3: 支持的支付网络"
echo "  - Sepolia 测试网 (eip155:11155111)"
echo "  - Base Sepolia 测试网 (eip155:84532)"
echo "  - Base 主网 (eip155:8453)"
echo ""

# 检查测试网 USDC
echo "💰 步骤 4: 获取测试网 USDC"
echo "  Sepolia USDC 水龙头: https://faucet.circle.com/"
echo "  Sepolia ETH 水龙头: https://sepoliafaucet.com/"
echo ""

# 启动开发服务器
echo "🎯 步骤 5: 启动开发服务器"
echo "  运行命令: npm run dev"
echo "  访问地址: http://localhost:3000/zh/counselors"
echo ""

echo "📚 详细文档:"
echo "  - X402_INTEGRATION_GUIDE.md - 完整集成指南"
echo "  - COUNSELORS_X402_INTEGRATION_PLAN.md - 集成方案"
echo "  - x402_USAGE_ANALYZE.md - x402 协议深度解析"
echo ""

echo "✨ 测试流程:"
echo "  1. 启动服务: npm run dev"
echo "  2. 访问页面: http://localhost:3000/zh/counselors"
echo "  3. 连接钱包（切换到 Sepolia 测试网）"
echo "  4. 点击购买服务"
echo "  5. 钱包签名 (EIP-712)"
echo "  6. 查看顾问联系方式"
echo "  7. 在 Etherscan 验证交易"
echo ""

read -p "是否立即启动开发服务器？(y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "🚀 正在启动..."
  npm run dev
fi
