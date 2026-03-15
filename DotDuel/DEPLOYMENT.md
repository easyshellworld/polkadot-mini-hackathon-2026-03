# Polkadot Duel Platform - 部署指南

> 完整的測試網部署指南

**版本**: v1.0.0-mvp  
**目標網絡**: Passet Hub Testnet  
**更新時間**: 2025-10-27

---

## 📋 部署前準備

### 1. 環境要求

```bash
# Node.js
node >= 18.0.0

# 工具
- MetaMask 錢包
- 測試網 DOT 代幣
- Git
```

### 2. 獲取測試幣

#### Passet Hub 測試網水龍頭
```
網絡名稱: Passet Hub Testnet
RPC URL: https://passet-hub-testnet.polkadot.io
Chain ID: 1000
貨幣符號: DOT
區塊瀏覽器: (待確認)
```

**獲取測試幣**:
```
方法 1: 使用官方水龍頭
- 訪問 Polkadot 測試網水龍頭
- 輸入你的錢包地址
- 請求測試幣

方法 2: 通過 Discord
- 加入 Polkadot Discord
- 在測試網頻道請求
```

### 3. 準備錢包

```bash
# 1. 創建或導入部署錢包
# 2. 確保有足夠的測試幣 (至少 1 DOT)
# 3. 導出私鑰（用於 Oracle）

# 錢包地址示例：
Deployer: 0x1234...
Oracle: 0x5678...
Platform Wallet: 0x9abc...
```

---

## 🚀 部署流程

### 階段 1: 部署智能合約

#### Step 1: 配置部署參數

```bash
cd hackathon/contracts

# 創建 .env 文件
cat > .env << EOF
PRIVATE_KEY=your_deployer_private_key_here
PLATFORM_WALLET=your_platform_wallet_address
ORACLE_ADDRESS=your_oracle_address
PASSET_HUB_RPC=https://passet-hub-testnet.polkadot.io
EOF
```

#### Step 2: 編譯合約

```bash
npm run compile
```

#### Step 3: 部署到測試網

```bash
# 部署到 Passet Hub 測試網
npm run deploy:passetHub

# 記錄輸出的合約地址
# 示例輸出：
# DuelPlatform deployed to: 0xAbCd...1234
```

#### Step 4: 驗證部署

```bash
# 使用 Hardhat 驗證合約
npx hardhat verify --network passetHub <CONTRACT_ADDRESS> \
  <PLATFORM_WALLET> \
  <ORACLE_ADDRESS>
```

### 階段 2: 配置前端

#### Step 1: 更新配置

```bash
cd hackathon/frontend

# 更新 src/config/wagmi.ts
# 將部署的合約地址填入

# 創建 .env 文件
cat > .env << EOF
VITE_CONTRACT_ADDRESS=0xYourContractAddress
VITE_CHAIN_ID=1000
VITE_RPC_URL=https://passet-hub-testnet.polkadot.io
EOF
```

#### Step 2: 構建生產版本

```bash
npm run build
```

#### Step 3: 部署前端

**選項 A: Vercel**
```bash
# 安裝 Vercel CLI
npm i -g vercel

# 部署
vercel --prod
```

**選項 B: Netlify**
```bash
# 安裝 Netlify CLI
npm i -g netlify-cli

# 部署
netlify deploy --prod --dir=dist
```

**選項 C: GitHub Pages**
```bash
# 添加部署腳本到 package.json
npm run build
npm run deploy
```

### 階段 3: 配置後端

#### Step 1: 配置環境變量

```bash
cd hackathon/backend

# 創建 .env 文件
cat > .env << EOF
PORT=3000
NODE_ENV=production

# Database (如果使用)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=polkadot_duel
DB_USER=postgres
DB_PASSWORD=your_password

# Blockchain
RPC_URL=https://passet-hub-testnet.polkadot.io
CONTRACT_ADDRESS=0xYourContractAddress
CHAIN_ID=1000

# Oracle
ORACLE_PRIVATE_KEY=your_oracle_private_key
MYDUPR_API_URL=https://api.mydupr.com

# CORS
ALLOWED_ORIGINS=https://your-frontend-url.com,http://localhost:5173
EOF
```

#### Step 2: 構建後端

```bash
npm run build
```

#### Step 3: 部署後端

**選項 A: Railway**
```bash
# 安裝 Railway CLI
npm i -g @railway/cli

# 登錄
railway login

# 初始化項目
railway init

# 部署
railway up
```

**選項 B: Heroku**
```bash
# 安裝 Heroku CLI
npm i -g heroku

# 登錄
heroku login

# 創建應用
heroku create polkadot-duel-backend

# 部署
git push heroku main
```

**選項 C: DigitalOcean App Platform**
```bash
# 通過 Web UI 部署
# 1. 連接 GitHub 倉庫
# 2. 選擇 backend 目錄
# 3. 配置環境變量
# 4. 部署
```

### 階段 4: 啟動 Oracle 服務

#### Step 1: 確認 Oracle 配置

```bash
# 確保後端的 Oracle 私鑰已配置
# 確保合約地址正確
```

#### Step 2: 啟動 Oracle

```bash
# 方法 1: 通過 API
curl -X POST https://your-backend-url.com/api/oracle/start

# 方法 2: 自動啟動（在後端啟動時）
# 修改 backend/src/index.ts 添加：
# import { getOracleService } from './services/oracle.js'
# getOracleService().start()
```

#### Step 3: 驗證 Oracle 狀態

```bash
curl https://your-backend-url.com/api/oracle/status
```

---

## ✅ 部署驗證清單

### 智能合約 ✓
- [ ] 合約已部署到測試網
- [ ] 合約地址已記錄
- [ ] 合約已驗證（可選）
- [ ] 平台錢包地址正確
- [ ] Oracle 地址正確

### 前端 ✓
- [ ] 構建成功（無錯誤）
- [ ] 部署到託管服務
- [ ] 可以訪問前端 URL
- [ ] 錢包可以連接
- [ ] 合約地址配置正確

### 後端 ✓
- [ ] 構建成功（無錯誤）
- [ ] 部署到服務器
- [ ] 可以訪問後端 URL
- [ ] Health check 正常
- [ ] 環境變量配置正確

### Oracle ✓
- [ ] Oracle 服務已啟動
- [ ] Oracle 地址有測試幣
- [ ] Oracle 可以監聽事件
- [ ] Oracle 可以提交交易

---

## 🧪 端到端測試

### 測試場景 1: 裁判模式比賽

```bash
# 1. 連接錢包到前端
# 2. 創建裁判模式比賽
#    - 選擇模式: 裁判模式
#    - 押注金額: 0.1 DOT
#    - 描述: 測試比賽 1
# 3. 等待交易確認
# 4. 檢查比賽列表中是否出現
# 5. 用另一個賬戶加入比賽
# 6. 等待比賽開始
# 7. 裁判提交結果
# 8. 檢查贏家是否收到獎金
# 9. 檢查統計頁面是否更新
```

### 測試場景 2: Oracle 模式比賽

```bash
# 1. 連接錢包到前端
# 2. 創建 Oracle 模式比賽
#    - 選擇模式: Oracle 模式
#    - 押注金額: 0.1 DOT
#    - External Match ID: test-match-123
# 3. 等待交易確認
# 4. 用另一個賬戶加入比賽
# 5. 等待比賽開始
# 6. 手動觸發 Oracle 結算（測試用）
#    curl -X POST backend-url/api/oracle/settle \
#      -H "Content-Type: application/json" \
#      -d '{"matchId": 2, "externalMatchId": "test-match-123"}'
# 7. 檢查結果是否正確
```

### 測試場景 3: 取消比賽

```bash
# 1. 創建比賽但不讓第二個玩家加入
# 2. 等待一段時間
# 3. 創建者取消比賽
# 4. 檢查押注是否退回
```

---

## 📊 監控和維護

### 監控指標

```bash
# 1. 智能合約
- 總比賽數
- 活躍比賽數
- 總交易量
- Gas 使用情況

# 2. 前端
- 訪問量
- 錯誤率
- 加載時間

# 3. 後端
- API 響應時間
- 錯誤率
- Oracle 運行狀態

# 4. Oracle
- 已處理比賽數
- 成功率
- Gas 消耗
```

### 日誌查看

```bash
# 後端日誌
# Railway: railway logs
# Heroku: heroku logs --tail
# DigitalOcean: 通過 Web UI 查看

# Oracle 日誌
# 查看後端日誌中的 Oracle 相關輸出
```

---

## 🔧 故障排查

### 問題 1: 合約部署失敗

```bash
# 原因: Gas 不足
# 解決: 確保錢包有足夠的測試幣

# 原因: RPC 連接失敗
# 解決: 檢查網絡配置，使用正確的 RPC URL
```

### 問題 2: 前端無法連接合約

```bash
# 原因: 合約地址錯誤
# 解決: 檢查 .env 中的 CONTRACT_ADDRESS

# 原因: 網絡不匹配
# 解決: 確保 MetaMask 連接到正確的測試網
```

### 問題 3: Oracle 無法提交結果

```bash
# 原因: Oracle 私鑰未配置
# 解決: 在後端 .env 中配置 ORACLE_PRIVATE_KEY

# 原因: Oracle 地址沒有測試幣
# 解決: 給 Oracle 地址發送測試幣

# 原因: Oracle 地址不是合約中的 Oracle
# 解決: 檢查合約中的 Oracle 地址是否匹配
```

---

## 📝 部署記錄模板

```markdown
## 部署記錄 - v1.0.0-mvp

### 日期
2025-10-27

### 網絡
Passet Hub Testnet

### 合約地址
DuelPlatform: 0x...

### 部署賬戶
Deployer: 0x...
Oracle: 0x...
Platform Wallet: 0x...

### 前端 URL
https://polkadot-duel.vercel.app

### 後端 URL
https://polkadot-duel-backend.railway.app

### 部署時間
開始: 2025-10-27 10:00
完成: 2025-10-27 12:00
總計: 2 小時

### 測試結果
- [x] 創建比賽 ✅
- [x] 加入比賽 ✅
- [x] 提交結果 ✅
- [x] Oracle 自動結算 ✅
- [x] 統計頁面 ✅

### 備註
所有功能正常運行
```

---

## 🎯 下一步

### 生產環境準備
- [ ] 配置自定義域名
- [ ] 設置 SSL 證書
- [ ] 配置 CDN
- [ ] 設置監控告警
- [ ] 準備備份方案

### 優化
- [ ] Gas 優化
- [ ] 前端性能優化
- [ ] API 緩存
- [ ] 數據庫索引

---

**部署指南版本**: v1.0.0  
**最後更新**: 2025-10-27  
**維護者**: Polkadot Duel Team

🚀 **準備好部署了嗎？Let's go!**

