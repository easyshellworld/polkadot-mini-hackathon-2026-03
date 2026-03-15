# 變更日誌

所有值得注意的項目變更都將記錄在此文件中。

格式基於 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，  
項目遵循 [語義化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [1.0.0-mvp] - 2025-10-27 (Update 2)

### 📝 部署準備

#### 部署文檔
- `DEPLOYMENT.md` - 完整部署指南
  - 環境準備
  - 部署流程（4個階段）
  - 驗證清單
  - 端到端測試
  - 監控和維護
  - 故障排查
- `DEPLOYMENT_CHECKLIST.md` - 詳細檢查清單
  - 部署前檢查
  - 4個部署階段清單
  - 功能測試清單
  - API 測試清單
  - 性能檢查
  - 交付清單

#### 部署腳本
- `scripts/test-deployment.sh` - 自動化測試腳本
  - 前端測試（5個端點）
  - 後端 API 測試（6個端點）
  - 響應時間測試
  - 自動統計報告

### 🎨 改進
- 部署腳本更加詳細
- 檢查清單更加完整
- 文檔更加清晰

### 📝 變更
- 部署準備完成度 100%
- 項目整體完成度 95%

### 📊 統計
- 新增文檔: 2 個
- 新增腳本: 1 個
- 總文檔頁數: 20+ 頁

## [1.0.0-mvp] - 2025-10-27 (Initial)

### 🎉 MVP 完成

這是 Polkadot Duel Platform 的第一個 MVP 版本！

### ✨ 新增

#### Oracle 自動化服務
- Oracle Service 類實現
  - 監聽區塊鏈事件
  - 定時檢查待結算比賽
  - 從 mydupr API 獲取結果
  - 自動提交結果到鏈上
- Oracle API 路由
  - GET /api/oracle/status - 查詢狀態
  - POST /api/oracle/start - 啟動服務
  - POST /api/oracle/stop - 停止服務
  - POST /api/oracle/settle - 手動結算
  - POST /api/oracle/submit - 提交結果
- ethers.js 集成
- 事件監聽機制
- 定時任務調度

### 🎨 改進
- 後端 README 完善
- Oracle 文檔詳細說明
- 錯誤處理完善

### 📝 變更
- 版本號更新為 v1.0.0-mvp
- MVP 開發完成度 90%

### 📊 統計
- 新增後端代碼: ~650 行
- Oracle 服務: ~300 行
- Oracle 路由: ~150 行
- API 端點總數: 12 個
- 總代碼量: 3,800 行

### 🎯 完成情況
- ✅ 智能合約: 100%
- ✅ 前端開發: 100%
- ✅ 後端 API: 100%
- ✅ Oracle 服務: 100%
- ⏳ 測試網部署: 0%

## [0.5.0-mvp] - 2025-10-27

### ✨ 新增

#### 後端 API 服務初始化
- Express + TypeScript 項目初始化
- RESTful API 架構設計
- CORS 和中間件配置
- 健康檢查端點

#### API 路由實現
- `/api/matches` - 比賽查詢路由
  - GET /api/matches - 獲取所有比賽（支持過濾、分頁）
  - GET /api/matches/:id - 獲取單個比賽
  - POST /api/matches - 創建比賽記錄
- `/api/stats` - 統計查詢路由
  - GET /api/stats/platform - 平台整體統計
  - GET /api/stats/recent - 最近比賽記錄
- `/api/users` - 用戶查詢路由
  - GET /api/users/:address/stats - 用戶統計
  - GET /api/users/:address/matches - 用戶比賽列表

#### 基礎設施
- TypeScript 配置
- 環境變量管理
- 錯誤處理中間件
- 日誌中間件
- 404 處理

### 🎨 改進
- 統一的 API 響應格式
- 完整的錯誤處理
- 開發環境熱重載

### 📝 變更
- 版本號更新為 v0.5.0-mvp
- 項目進度達到 80%

### 📊 統計
- 新增後端文件: 8 個
- 後端代碼: ~600 行
- API 端點: 8 個
- 後端初始化: 100%

## [0.4.0-mvp] - 2025-10-27

### ✨ 新增

#### MatchDetail 頁面完整實現
- 比賽詳情展示（描述、金額、模式、時間）
- 參與者列表顯示
- 加入比賽功能（狀態 WAITING）
- 提交結果功能（裁判模式，狀態 WAITING_RESULT）
- 取消比賽功能（創建者，狀態 WAITING）
- 實時權限控制
- 完整的錯誤處理

#### MyMatches 頁面完整實現
- 用戶統計數據展示（總比賽、勝場、敗場、勝率）
- 個人比賽列表
- 統計卡片視覺化
- 未連接錢包友好提示
- 空狀態處理

#### Stats 頁面完整實現
- 平台整體統計（總比賽、用戶數、交易量）
- 詳細數據分析（完成率、活躍率、取消率）
- 排行榜系統（Top 5 玩家）
- 最近比賽記錄
- 視覺化數據展示

### 🎨 改進
- 所有頁面統一設計語言
- 響應式布局優化
- 狀態顏色統一
- Loading 狀態完善
- 錯誤提示友好化

### 📝 變更
- 版本號更新為 v0.4.0-mvp
- 前端核心功能基本完成

### 📊 統計
- 新增頁面: 3 個（MatchDetail, MyMatches, Stats）
- 頁面代碼: ~800 行
- 總代碼增加: ~800 行
- 前端完成度: 90%

## [0.3.0-mvp] - 2025-10-27

### ✨ 新增

#### 錢包連接功能
- 集成 wagmi 和 React Query
- 實現 ConnectWallet 組件
- 支持 MetaMask 連接
- 顯示錢包地址（簡化格式）
- 連接/斷開功能

#### 合約交互
- 創建 wagmi 配置（Passet Hub 測試網）
- 複製合約 ABI 到前端
- 實現 useContract Hook（寫入合約）
- 實現 useMatchData Hook（讀取比賽數據）
- 實現 useUserStats Hook（用戶統計）
- 實現 useUserMatches Hook（用戶比賽列表）

#### CreateMatch 頁面完整實現
- 比賽模式選擇（裁判/Oracle）
- 押注金額輸入
- 開始/結束時間選擇
- 比賽描述輸入
- 外部比賽ID（Oracle模式）
- 裁判參與押注選項
- 實時交易狀態顯示
- 表單驗證和錯誤處理

#### 配置和工具
- 環境變量配置
- Passet Hub 網絡配置
- Toast 通知集成
- 交易狀態追蹤

### 🎨 改進
- Header 集成真實的錢包連接按鈕
- 未連接狀態的友好提示
- 響應式的錢包地址顯示
- 交易確認的 Loading 狀態

### 📝 變更
- 版本號更新為 v0.3.0-mvp
- 所有組件統一版本顯示

### 📊 統計
- 新增 Hooks: 4 個
- 新增配置文件: 2 個
- CreateMatch 頁面: ~350 行
- 錢包組件: ~80 行
- 總代碼增加: ~600 行

## [0.2.0-mvp] - 2025-10-27

### ✨ 新增

#### 前端基礎框架
- 初始化 React 18 + TypeScript + Vite 項目
- 配置 Tailwind CSS 和 PostCSS
- 實現響應式 Layout 組件（Header + Footer）
- 創建 6 個基礎頁面路由
- 實現 Home 首頁完整 UI
- 配置路徑別名 (@/)
- 添加深色/淺色模式支持

#### UI 組件
- Header 組件（導航欄 + 移動端菜單）
- Footer 組件（信息 + 社交鏈接）
- Home 頁面（Hero + 特點 + 統計 + 流程）
- 基礎頁面骨架（CreateMatch, MatchList, MatchDetail, MyMatches, Stats）

#### 配置文件
- Vite 配置
- TypeScript 配置
- Tailwind 配置
- ESLint 配置
- 環境變量範例

### 🎨 設計
- 粉紅→紫色漸變主題
- 統一的設計系統
- 流暢的動畫效果
- 響應式布局

### 📝 變更
- 版本號更新為 v0.2.0-mvp
- 在 console 和 UI 中顯示版本號

### 📊 統計
- 新增組件: 9 個
- 新增頁面: 6 個
- 前端代碼: ~600 行
- 依賴包: 714 個
- 啟動時間: 328ms

## [Unreleased]

## [0.1.0-mvp] - 2025-10-27

### ✨ 新增

#### 智能合約
- 實現 `DuelPlatform.sol` 主合約（v0.1.0-mvp）
- 支持雙模式（裁判模式和 API 自動模式）
- 創建比賽功能 (`createMatch`)
- 加入比賽功能 (`joinMatch`)
- 提交結果功能（裁判和 Oracle）
- 自動結算功能 (`_settleMatch`)
- 取消比賽功能 (`cancelMatch`)
- 用戶統計追蹤
- 管理功能（Oracle 設置、平台錢包、暫停等）

#### 安全機制
- 集成 OpenZeppelin ReentrancyGuard（防重入攻擊）
- 集成 OpenZeppelin Ownable（權限控制）
- 集成 OpenZeppelin Pausable（緊急暫停）
- 完善的輸入驗證
- 狀態機嚴格控制

#### 測試
- 14 個完整的測試用例
- 覆蓋所有核心功能
- 100% 測試通過率

#### 部署
- Hardhat 部署腳本
- 支持本地網絡和 Passet Hub 測試網
- 詳細的部署日誌

#### 配置
- Hardhat 配置文件
- TypeScript 配置
- 環境變量範例
- Git 忽略規則

#### 文檔
- 項目 README
- 開發進度記錄
- 變更日誌（本文件）

### 🔧 修復

- 修復 `joinMatch` 函數狀態檢查邏輯
  - 允許在 IN_PROGRESS 狀態下加入（開始時間前）
  - 解決創建者同時加入導致的狀態問題

- 修復測試用例邏輯錯誤
  - 調整參與者順序假設
  - 修正取消比賽測試場景

### 📝 變更

- 手續費率使用常量定義
  - `REFEREE_FEE_RATE`: 300 (3%)
  - `PLATFORM_FEE_RATE`: 50 (0.5%)
  - `FEE_DENOMINATOR`: 10000

- 時間限制常量
  - `MIN_MATCH_DURATION`: 1 hours
  - `MAX_MATCH_DURATION`: 30 days

### 🗑️ 移除

- N/A（首次發布）

### 🔒 安全

- 使用 OpenZeppelin 經過審計的合約庫
- 實現 ReentrancyGuard 防止重入攻擊
- 權限控制確保只有授權方可執行敏感操作
- 緊急暫停機制應對異常情況

## 版本歷史

### v0.1.0-mvp (2025-10-27) - MVP 版本
**目標**: 黑客松 MVP，實現核心功能

**包含功能**:
- ✅ 智能合約核心邏輯
- ✅ 完整測試套件
- ✅ 部署腳本
- ✅ 基礎文檔

**不包含**:
- ⏳ 前端界面
- ⏳ 後端 API
- ⏳ Oracle 服務
- ⏳ 生產環境優化

### 計劃版本

#### v0.2.0 (預計 2025-10-28)
- 前端基礎框架
- 錢包連接
- 基本頁面布局

#### v0.3.0 (預計 2025-10-29)
- 前端核心功能
- 創建和加入比賽 UI

#### v0.4.0 (預計 2025-10-30)
- 後端 API 服務
- 數據索引

#### v0.5.0 (預計 2025-10-31)
- Oracle 自動化服務
- 完整流程打通

#### v1.0.0 (預計 2025-11-01)
- 黑客松完整版本
- 所有功能完成
- 部署到 Passet Hub 測試網

## 開發統計

### v0.1.0-mvp
- **代碼行數**: 462 (合約) + 268 (測試)
- **開發時間**: 5 小時
- **測試用例**: 14 個
- **Bug 修復**: 3 個
- **提交次數**: 1 次

## 貢獻者

- AI Assistant - 主要開發者

## 致謝

- OpenZeppelin - 安全合約庫
- Hardhat - 開發框架
- Polkadot - 區塊鏈平台

---

[Unreleased]: https://github.com/your-org/polkadot-duel-platform/compare/v0.1.0...HEAD
[0.1.0-mvp]: https://github.com/your-org/polkadot-duel-platform/releases/tag/v0.1.0-mvp

