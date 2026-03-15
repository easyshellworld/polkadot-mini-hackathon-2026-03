# DotDuel 部署指南 - Mantle Network

## 前置準備

### 1. 取得 Mantle Sepolia 測試幣
若要在 Mantle Sepolia Testnet 部署，需要 MNT 測試代幣用於 Gas 費用。

**領取測試幣：**
- 訪問 https://faucet.sepolia.mantle.xyz
- 輸入你的錢包地址
- 每次可領取 0.5 MNT（每 24 小時一次）

### 2. 導出私鑰

#### 從 MetaMask 導出
1. 打開 MetaMask 錢包
2. 點選右上角頭像 → 賬戶詳情
3. 點選「導出私鑰」
4. 輸入密碼確認
5. 複製私鑰（**不要分享任何人**）

#### 從其他錢包
- **Trust Wallet/imToken**: 錢包設定 → 私鑰/助記詞 → 導出
- **Hardhat 本地帳戶**: 若有 mnemonic.json，從中推導

---

## 部署步驟

### 步驟 1: 配置環境變數

```bash
cd contracts
cp .env.example .env
```

編輯 `.env` 檔案：

```dotenv
# 你的私鑰（不包含 0x 前綴，64 個十六進制字符）
DEPLOYER_PRIVATE_KEY=你的私鑰在這裡

# 平台錢包地址（可選，預設為 deployer 地址）
PLATFORM_WALLET=0x...

# Oracle 地址（可選，預設為 deployer 地址）
ORACLE_ADDRESS=0x...
```

**例子：**
```dotenv
DEPLOYER_PRIVATE_KEY=1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
PLATFORM_WALLET=0xYourAddress123...
ORACLE_ADDRESS=0xOracleAddress456...
```

### 步驟 2: 驗證配置

```bash
# 查看 hardhat.config.ts 已設定的網路
npx hardhat networks
```

應該能看到 `mantleSepolia` 與 `mantle` 在列表中。

### 步驟 3: 部署到 Mantle Sepolia（推薦先測試）

```bash
npx hardhat run scripts/deploy.ts --network mantleSepolia
```

**預期輸出：**
```
🚀 開始部署 DuelPlatform 合約...
📋 版本: v0.1.0-mvp

👤 部署賬戶: 0xYourAddress...
💰 賬戶餘額: 0.5 MNT

⚙️  配置:
   平台錢包: 0xYourAddress...
   Oracle 地址: 0xYourAddress...

✅ DuelPlatform 部署成功!
📍 合約地址: 0x...
🔗 區塊鏈: mantle-sepolia
📦 部署區塊: 12345

📌 合約版本: v0.1.0-mvp
✓ 平台錢包已設置: 0x...
✓ Oracle 地址已設置: 0x...

🎉 部署完成！

📝 請保存以下信息:
==================================================
合約地址: 0x...
部署者: 0x...
平台錢包: 0x...
Oracle: 0x...
==================================================

🔧 下一步:
1. 更新前端配置 (VITE_CONTRACT_ADDRESS)
2. 更新後端配置 (CONTRACT_ADDRESS)
3. 在區塊瀏覽器驗證合約（可選）
```

### 步驟 4: 驗證合約（可選）

部署成功後，可將合約代碼提交到 Mantlescan 以便大家查看與驗證。

```bash
npx hardhat verify --network mantleSepolia <合約地址> <平台錢包> <Oracle地址>
```

**例子：**
```bash
npx hardhat verify --network mantleSepolia 0xAbcd... 0xPlatform... 0xOracle...
```

驗證成功後，在 [sepolia.mantlescan.xyz](https://sepolia.mantlescan.xyz) 搜尋合約地址，即可看到代碼。

### 步驟 5: 部署到 Mantle 主網（生產環境）

確認一切無誤後，可部署到主網：

```bash
# 確保 .env 中的 DEPLOYER_PRIVATE_KEY 有實際主網資金
npx hardhat run scripts/deploy.ts --network mantle
```

---

## 常見問題

### Q: Cannot read properties of undefined (reading 'address')
**A:** `DEPLOYER_PRIVATE_KEY` 未設定或為空。
- 檢查 `.env` 是否有填入私鑰
- 確認私鑰格式正確（64 個十六進制字符，不含 0x）

### Q: Insufficient funds for gas
**A:** 賬戶 MNT 餘額不足。
- 前往 https://faucet.sepolia.mantle.xyz 領取測試幣
- 或轉帳 MNT 到該地址

### Q: Network is not configured
**A:** Hardhat 設定缺失或不正確。
- 檢查 `hardhat.config.ts` 中 `mantleSepolia` 配置
- 確認 RPC URL 為 `https://rpc.sepolia.mantle.xyz`

### Q: Error: invalid address
**A:** 私鑰格式不合法。
- 確認私鑰長度為 64 字符（不包含 0x）
- 若無法確認，用新錢包重試（MetaMask 可建立新帳戶）

### Q: Connection timeout / RPC error
**A:** RPC 暫時無法連線。
- 稍後重試
- 檢查網路連線
- 嘗試另一個 RPC: `https://rpc.sepolia.mantle.xyz` 或其他公開節點

---

## 下一步

部署成功後：

1. **複製合約地址**到 `frontend/.env` 的 `VITE_CONTRACT_ADDRESS`
2. **複製合約地址**到 `backend/.env` 的 `CONTRACT_ADDRESS`
3. 啟動前端與後端
4. 連接 MetaMask 並切換到 Mantle Sepolia 網路
5. 開始 Demo

---

## 有用連結

- **Mantle 官方文檔**: https://docs.mantle.xyz
- **Mantle Sepolia 水龍頭**: https://faucet.sepolia.mantle.xyz
- **區塊瀏覽器**: https://sepolia.mantlescan.xyz
- **Hardhat 部署指南**: https://hardhat.org/hardhat-runner/docs/guides/deploying
