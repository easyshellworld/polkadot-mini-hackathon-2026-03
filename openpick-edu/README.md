# OpenPick EDU Platform

A lifelong education platform integrating AI and Web3, starting from a simple NFT example.

## Quick Start

1. Install dependencies
   ```bash
   npm install
   ```

2. Configure environment variables
   ```bash
   cp .example.env.local .env.local
   ```
   Edit `.env.local` and add:
   ```env
   # WalletConnect Configuration
   WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id_here
   
   # AI API Configuration
   AI_API_BASE_URL=https://api.deepseek.com/v1
   AI_API_MODEL=deepseek-chat
   AI_API_KEY=your-api-key
   AI_MAX_POST_FREQUENCY_PER_DAY=5
   
   # Smart Contract Configuration
   FACTORY_CONTRACT_ADDRESS=your-factory-contract-address
   
   # Admin Configuration
   ADMIN_ADDRESS=0x67e2c2e6186ae9Cc17798b5bD0c3c36Ef0209aC9
   
   # Database Configuration
   DATABASE_TYPE=memory
   
   # Counselor System Configuration
   CRON_SECRET=your_cron_secret_here
   PLATFORM_WALLET_ADDRESS=0x0000000000000000000000000000000000000000
   
   # x402 Payment Protocol Configuration
   X402_FACILITATOR_URL=https://x402.org
   X402_DEFAULT_NETWORK=eip155:11155111
   
   # USDC Contract Addresses
   USDC_SEPOLIA=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
   USDC_BASE_SEPOLIA=0x036CbD53842c5426634e7929541eC2318f3dCF7e
   USDC_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
   
   # Turso Database Configuration (for production/Vercel deployment)
   TURSO_DATABASE_URL=libsql://your-database-name-your-username.turso.io
   TURSO_AUTH_TOKEN=your_turso_auth_token_here
   ```

3. Start development server
   ```bash
   npm run dev
   ```

4. Visit [http://localhost:3000](http://localhost:3000)

## Core Features

- **Wallet Connection**: Support for MetaMask and other wallets through WalletConnect
- **AI Chat**: Multi-model support (DeepSeek, OpenAI, Anthropic) with IP-based rate limiting
- **Leaderboard**: Display user interactions and learning progress with SQLite/Turso database
- **Discussion Forum**: User interaction and sharing with Giscus integration
- **NFT Minting**: Support for images, videos, and audio files with custom contract deployment
- **Smart Contract Compiler**: Solidity compilation with OpenZeppelin support
- **Custom Contract Deployment**: Support for user-defined contract deployment through Factory contract
- **Counselor Service**: Educational counseling service with x402 USDC payment support
- **x402 Payment Protocol**: On-chain USDC payment integration for services
- **Multilingual**: Chinese and English support with next-intl
- **Project Tracking**: Track user learning progress through project completion system

## Tech Stack

- Next.js 16 (App Router)
- React 19
- Tailwind CSS 4
- Ethers.js 6, Viem, WalletConnect
- Vercel AI SDK, OpenAI SDK
- TypeScript 5
- SQLite / Turso (serverless database)
- Zustand (state management)
- next-intl (internationalization)
- x402 Protocol (on-chain payments)

## Architecture & Data Flow

The application follows a modern web3 architecture with the following key components:

1. **Frontend (Next.js App Router)**
   - Client-side wallet connection via WalletConnect and MetaMask
   - AI chat interface with streaming responses
   - NFT minting and management UI
   - Solidity contract editor and compiler
   - Counselor service marketplace
   - Internationalization support (zh/en)

2. **Backend (API Routes)**
   - `/api/chat` - Handles AI model integration with IP-based rate limiting
   - `/api/leaderboard` - Manages user scores and rankings
   - `/api/mint` - Processes NFT minting requests
   - `/api/compile` - Solidity contract compilation with OpenZeppelin imports
   - `/api/deploy` - Smart contract deployment
   - `/api/templates` - Contract templates
   - `/api/counselors/*` - Counselor management and orders
   - `/api/admin/verify` - Admin authentication
   - `/api/user-project-entries` - Tracks learning progress
   - `/api/cron/complete-expired-orders` - Scheduled task for order completion

3. **Smart Contracts**
   - Factory contract for deploying custom ERC721 collections
   - Custom ERC721 implementation with metadata support
   - Contract templates: BasicERC721, MintableERC721, SimpleCounter
   - Contract addresses configurable via environment variables

4. **Database (SQLite with Turso for serverless deployment)**
   - `users` - User data and wallet addresses
   - `project_items` - Project definitions
   - `user_project_entries` - Project completion tracking
   - `counselors` - Counselor profiles and services
   - `counselor_orders` - Service order records
   - Leaderboard rankings with pagination
   - Learning progress analytics

5. **Payment System (x402 Protocol)**
   - USDC payment on Sepolia, Base Sepolia, and Base Mainnet
   - Facilitator client integration
   - On-chain payment verification

## Project Structure

```
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── chat/          # AI chat API
│   │   ├── leaderboard/   # Leaderboard data API
│   │   ├── mint/          # NFT minting API
│   │   ├── compile/       # Solidity compiler API
│   │   ├── deploy/        # Contract deployment API
│   │   ├── templates/     # Contract templates API
│   │   ├── counselors/    # Counselor service APIs
│   │   ├── admin/         # Admin authentication
│   │   ├── cron/          # Scheduled tasks
│   │   └── project-items/ # Project tracking APIs
│   └── [locale]/          # Internationalized routes
│       ├── page.tsx       # Home page (chat)
│       ├── leaderboard/   # Leaderboard page
│       ├── discussions/   # Discussion forum
│       └── counselors/    # Counselor service page
├── components/            # React components
│   ├── ChatContainer.tsx  # Main chat interface
│   ├── ChatMessage.tsx    # Chat message component
│   ├── InputArea.tsx      # Chat input with file upload
│   ├── NFTMintForm.tsx    # NFT minting form
│   ├── ContractEditor/    # Solidity code editor
│   ├── ContractDeployer/  # Contract deployment UI
│   ├── ContractModal/     # Contract interaction modal
│   ├── LeaderboardTable.tsx # Leaderboard table
│   ├── GiscusComments.tsx # GitHub discussions
│   ├── CounselorCard.tsx  # Counselor card
│   ├── AddCounselorModal.tsx # Add counselor modal
│   ├── Header.tsx         # Navigation header
│   ├── Footer.tsx         # Page footer
│   └── SettingsModal.tsx  # Settings configuration
├── contexts/              # React Context
│   ├── WalletContext.tsx  # Wallet connection state
│   └── AIConfigContext.tsx # AI model configuration
├── contracts/             # Smart contracts
│   ├── ERC721Factory.abi.json   # Factory contract ABI
│   ├── CustomERC721.abi.json    # ERC721 contract ABI
│   ├── erc721.abi.json          # Standard ERC721 ABI
│   └── templates/               # Contract templates
│       ├── BasicERC721.sol
│       ├── MintableERC721.sol
│       └── SimpleCounter.sol
├── hooks/                 # Custom React hooks
│   ├── useAdmin.ts        # Admin authentication hook
│   └── useCounselor.ts    # Counselor data hook
├── lib/                   # Utility libraries
│   ├── contract.ts        # Smart contract interactions
│   ├── deploy.ts          # Contract deployment utilities
│   ├── database-turso.ts  # Turso/SQLite operations
│   ├── database-counselors.ts # Counselor database
│   ├── database-local.ts  # Local database fallback
│   ├── x402-server.ts     # x402 payment server
│   ├── admin-auth.ts      # Admin authentication
│   └── giscus-*.ts        # Giscus configuration
└── public/locales/        # Internationalization files
    ├── en/                # English translations
    │   ├── chat.json
    │   ├── common.json
    │   ├── wallet.json
    │   ├── mint.json
    │   ├── leaderboard.json
    │   ├── discussions.json
    │   └── counselors.json
    └── zh/                # Chinese translations
        └── ... (same files)
```

## Deployment

### Vercel

#### One-Click Deployment

Deploy this project to Vercel with a single click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/aiqubits-projects/clone?repository-url=https%3A%2F%2Fgithub.com%2Faiqubits%2Fopenpick-edu&env=WALLETCONNECT_PROJECT_ID,AI_API_BASE_URL,AI_API_MODEL,AI_API_KEY,FACTORY_CONTRACT_ADDRESS,TURSO_DATABASE_URL,TURSO_AUTH_TOKEN&envDescription=Required%20environment%20variables%20for%20the%20app&envLink=https%3A%2F%2Fgithub.com%2Faiqubits%2Fopenpick-edu%23environment-variables)

#### Manual Deployment

1. Set up Turso Database (required for production):
   ```bash
   # Install Turso CLI
   curl -sSfL https://get.tur.so/install.sh | bash
   
   # Create a Turso account
   turso auth signup
   
   # Create a database
   turso db create openpick-db
   
   # Get database URL and auth token
   turso db show openpick-db --url
   turso db tokens create openpick-db
   ```

2. Push code to GitHub
3. Import project in Vercel
4. Configure environment variables (including Turso credentials)
5. Deploy

### Custom Deployment

1. Build the application
   ```bash
   npm run build
   ```

2. Initialize the database (SQLite will be created automatically)
   ```bash
   npm start
   ```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run Jest tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:api` - Run API tests only

## License

Apache License 2.0
