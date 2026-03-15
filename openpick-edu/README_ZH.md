# OpenPick EDU Platform

一个集成了 AI 与 Web3 的终身教育平台，从简单的 NFT 示例入门。

## 快速开始

1. 安装依赖
   ```bash
   npm install
   ```

2. 配置环境变量
   ```bash
   cp .example.env.local .env.local
   ```
   编辑 `.env.local`，添加：
   ```env
   # WalletConnect 配置
   WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id_here
   
   # AI API 配置
   AI_API_BASE_URL=https://api.deepseek.com/v1
   AI_API_MODEL=deepseek-chat
   AI_API_KEY=your-api-key
   AI_MAX_POST_FREQUENCY_PER_DAY=5
   
   # 智能合约配置
   FACTORY_CONTRACT_ADDRESS=your-factory-contract-address
   
   # 管理员配置
   ADMIN_ADDRESS=0x67e2c2e6186ae9Cc17798b5bD0c3c36Ef0209aC9
   
   # 数据库配置
   DATABASE_TYPE=memory
   
   # 顾问系统配置
   CRON_SECRET=your_cron_secret_here
   PLATFORM_WALLET_ADDRESS=0x0000000000000000000000000000000000000000
   
   # x402 支付协议配置
   X402_FACILITATOR_URL=https://x402.org
   X402_DEFAULT_NETWORK=eip155:11155111
   
   # USDC 合约地址
   USDC_SEPOLIA=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
   USDC_BASE_SEPOLIA=0x036CbD53842c5426634e7929541eC2318f3dCF7e
   USDC_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
   
   # Turso 数据库配置（用于生产环境/Vercel 部署）
   TURSO_DATABASE_URL=libsql://your-database-name-your-username.turso.io
   TURSO_AUTH_TOKEN=your_turso_auth_token_here
   ```

3. 启动开发服务器
   ```bash
   npm run dev
   ```

4. 访问 [http://localhost:3000](http://localhost:3000)

## 核心功能

- **钱包连接**: 通过 WalletConnect 支持 MetaMask 等钱包
- **AI 聊天**: 支持多模型（DeepSeek、OpenAI、Anthropic）并带有基于 IP 的频率限制
- **排行榜**: 使用 SQLite/Turso 数据库展示用户互动和学习进度
- **讨论区**: 集成 Giscus 的用户互动和分享功能
- **NFT 铸造**: 支持图片、视频和音频文件的自定义合约部署
- **智能合约编译器**: 支持 OpenZeppelin 导入的 Solidity 编译
- **自定义合约部署**: 通过 Factory 合约支持用户自定义合约部署
- **顾问服务**: 教育咨询服务，支持 x402 USDC 支付
- **x402 支付协议**: 链上 USDC 支付集成
- **多语言**: 使用 next-intl 支持中英文
- **项目跟踪**: 通过项目完成系统跟踪用户学习进度

## 技术栈

- Next.js 16 (App Router)
- React 19
- Tailwind CSS 4
- Ethers.js 6, Viem, WalletConnect
- Vercel AI SDK, OpenAI SDK
- TypeScript 5
- SQLite / Turso (无服务器数据库)
- Zustand (状态管理)
- next-intl (国际化)
- x402 协议 (链上支付)

## 架构与数据流

应用程序遵循现代 Web3 架构，包含以下关键组件：

1. **前端 (Next.js App Router)**
   - 通过 WalletConnect 和 MetaMask 进行客户端钱包连接
   - 带有流式响应的 AI 聊天界面
   - NFT 铸造和管理界面
   - Solidity 合约编辑器和编译器
   - 顾问服务市场
   - 国际化支持 (中/英)

2. **后端 (API 路由)**
   - `/api/chat` - 处理 AI 模型集成和基于 IP 的频率限制
   - `/api/leaderboard` - 管理用户分数和排名
   - `/api/mint` - 处理 NFT 铸造请求
   - `/api/compile` - Solidity 合约编译，支持 OpenZeppelin 导入
   - `/api/deploy` - 智能合约部署
   - `/api/templates` - 合约模板
   - `/api/counselors/*` - 顾问管理和订单处理
   - `/api/admin/verify` - 管理员认证
   - `/api/user-project-entries` - 跟踪学习进度
   - `/api/cron/complete-expired-orders` - 订单完成定时任务

3. **智能合约**
   - 用于部署自定义 ERC721 集合的 Factory 合约
   - 支持元数据的自定义 ERC721 实现
   - 合约模板：BasicERC721、MintableERC721、SimpleCounter
   - 通过环境变量配置合约地址

4. **数据库（SQLite 与 Turso 用于无服务器部署）**
   - `users` - 用户数据和钱包地址
   - `project_items` - 项目定义
   - `user_project_entries` - 项目完成跟踪
   - `counselors` - 顾问档案和服务
   - `counselor_orders` - 服务订单记录
   - 带分页的排行榜排名
   - 学习进度分析

5. **支付系统 (x402 协议)**
   - Sepolia、Base Sepolia 和 Base 主网上的 USDC 支付
   - Facilitator 客户端集成
   - 链上支付验证

## 项目结构

```
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   │   ├── chat/          # AI 聊天 API
│   │   ├── leaderboard/   # 排行榜数据 API
│   │   ├── mint/          # NFT 铸造 API
│   │   ├── compile/       # Solidity 编译器 API
│   │   ├── deploy/        # 合约部署 API
│   │   ├── templates/     # 合约模板 API
│   │   ├── counselors/    # 顾问服务 APIs
│   │   ├── admin/         # 管理员认证
│   │   ├── cron/          # 定时任务
│   │   └── project-items/ # 项目跟踪 APIs
│   └── [locale]/          # 国际化路由
│       ├── page.tsx       # 首页 (聊天)
│       ├── leaderboard/   # 排行榜页面
│       ├── discussions/   # 讨论区
│       └── counselors/    # 顾问服务页面
├── components/            # React 组件
│   ├── ChatContainer.tsx  # 主聊天界面
│   ├── ChatMessage.tsx    # 聊天消息组件
│   ├── InputArea.tsx      # 带文件上传的聊天输入
│   ├── NFTMintForm.tsx    # NFT 铸造表单
│   ├── ContractEditor/    # Solidity 代码编辑器
│   ├── ContractDeployer/  # 合约部署 UI
│   ├── ContractModal/     # 合约交互弹窗
│   ├── LeaderboardTable.tsx # 排行榜表格
│   ├── GiscusComments.tsx # GitHub 讨论
│   ├── CounselorCard.tsx  # 顾问卡片
│   ├── AddCounselorModal.tsx # 添加顾问弹窗
│   ├── Header.tsx         # 导航头部
│   ├── Footer.tsx         # 页面底部
│   └── SettingsModal.tsx  # 设置配置
├── contexts/              # React Context
│   ├── WalletContext.tsx  # 钱包连接状态
│   └── AIConfigContext.tsx # AI 模型配置
├── contracts/             # 智能合约
│   ├── ERC721Factory.abi.json   # 工厂合约 ABI
│   ├── CustomERC721.abi.json    # ERC721 合约 ABI
│   ├── erc721.abi.json          # 标准 ERC721 ABI
│   └── templates/               # 合约模板
│       ├── BasicERC721.sol
│       ├── MintableERC721.sol
│       └── SimpleCounter.sol
├── hooks/                 # 自定义 React Hooks
│   ├── useAdmin.ts        # 管理员认证 Hook
│   └── useCounselor.ts    # 顾问数据 Hook
├── lib/                   # 工具库
│   ├── contract.ts        # 智能合约交互
│   ├── deploy.ts          # 合约部署工具
│   ├── database-turso.ts  # Turso/SQLite 操作
│   ├── database-counselors.ts # 顾问数据库
│   ├── database-local.ts  # 本地数据库回退
│   ├── x402-server.ts     # x402 支付服务器
│   ├── admin-auth.ts      # 管理员认证
│   └── giscus-*.ts        # Giscus 配置
└── public/locales/        # 国际化文件
    ├── en/                # 英文翻译
    │   ├── chat.json
    │   ├── common.json
    │   ├── wallet.json
    │   ├── mint.json
    │   ├── leaderboard.json
    │   ├── discussions.json
    │   └── counselors.json
    └── zh/                # 中文翻译
        └── ... (相同文件)
```

## 部署

### Vercel

#### 一键部署

使用一键部署按钮将项目部署到 Vercel：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/aiqubits-projects/clone?repository-url=https%3A%2F%2Fgithub.com%2Faiqubits%2Fopenpick-edu&env=WALLETCONNECT_PROJECT_ID,AI_API_BASE_URL,AI_API_MODEL,AI_API_KEY,FACTORY_CONTRACT_ADDRESS,TURSO_DATABASE_URL,TURSO_AUTH_TOKEN&envDescription=Required%20environment%20variables%20for%20the%20app&envLink=https%3A%2F%2Fgithub.com%2Faiqubits%2Fopenpick-edu%23environment-variables)

#### 手动部署

1. 设置 Turso 数据库（生产环境必需）：
   ```bash
   # 安装 Turso CLI
   curl -sSfL https://get.tur.so/install.sh | bash
   
   # 创建 Turso 账户
   turso auth signup
   
   # 创建数据库
   turso db create openpick-db
   
   # 获取数据库 URL 和认证令牌
   turso db show openpick-db --url
   turso db tokens create openpick-db
   ```

2. 推送代码到 GitHub
3. 在 Vercel 导入项目
4. 配置环境变量（包括 Turso 凭据）
5. 部署

### 自定义部署

1. 构建应用程序
   ```bash
   npm run build
   ```

2. 初始化数据库（SQLite 将自动创建）
   ```bash
   npm start
   ```

## 可用脚本

- `npm run dev` - 启动开发服务器
- `npm run build` - 构建生产版本
- `npm run start` - 启动生产服务器
- `npm run lint` - 运行 ESLint
- `npm run test` - 运行 Jest 测试
- `npm run test:watch` - 监听模式运行测试
- `npm run test:api` - 仅运行 API 测试

## 许可证

Apache License 2.0
