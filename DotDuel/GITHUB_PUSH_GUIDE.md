# GitHub 推送指南

> 將 DotDuel 項目推送到 GitHub 的完整指南

**版本**: v1.0.0-mvp  
**更新**: 2025-10-27

---

## 🚀 快速開始（推薦）

### 使用自動化腳本

```bash
# 運行自動推送腳本
cd /Users/terry/Desktop/develop/cursor/polkadot/hackathon
bash scripts/push-to-github.sh
```

---

## 📋 手動步驟（詳細版）

### 步驟 1: 創建 GitHub 倉庫

1. 訪問 https://github.com
2. 點擊右上角 "+" → "New repository"
3. 填寫信息：
   - **Repository name**: `dotduel-polkadot-hackathon`
   - **Description**: `DotDuel - 去中心化預測協議 | Polkadot 黑客松項目`
   - **Public** 或 **Private**（建議黑客松期間用 Private）
   - ✅ 不要勾選 "Initialize with README"（我們已經有了）
4. 點擊 "Create repository"

### 步驟 2: 初始化 Git（如果還沒有）

```bash
cd /Users/terry/Desktop/develop/cursor/polkadot/hackathon

# 檢查是否已初始化
git status

# 如果顯示 "not a git repository"，則初始化
git init
```

### 步驟 3: 檢查 .gitignore

```bash
# 確保 .gitignore 存在
cat .gitignore

# 如果不存在或不完整，運行創建腳本
bash scripts/setup-gitignore.sh
```

### 步驟 4: 添加文件到 Git

```bash
# 添加所有文件
git add .

# 查看將要提交的文件
git status

# ⚠️ 確保沒有 .env 文件！
# 應該看到：
# - contracts/.env (ignored)
# - frontend/.env (ignored)
# - backend/.env (ignored)
```

### 步驟 5: 創建首次提交

```bash
# 創建提交
git commit -m "🎉 Initial commit: DotDuel - 去中心化預測協議

- 完整的智能合約實現 (Solidity 0.8.24)
- React + TypeScript 前端 (6個頁面)
- Express + TypeScript 後端 (12個API端點)
- Oracle 自動化服務
- 完整的測試覆蓋 (14個測試，100%通過)
- 部署文檔和指南

黑客松: Dot Your Future 2025
賽道: Track 1 - Polkadot 多虛擬機環境創新應用
版本: v1.0.0-mvp"
```

### 步驟 6: 添加遠程倉庫

```bash
# 替換 YOUR_USERNAME 為您的 GitHub 用戶名
git remote add origin https://github.com/YOUR_USERNAME/dotduel-polkadot-hackathon.git

# 驗證遠程倉庫
git remote -v
```

### 步驟 7: 推送到 GitHub

```bash
# 推送到 main 分支
git branch -M main
git push -u origin main

# 如果推送失敗，可能需要先拉取
# git pull origin main --allow-unrelated-histories
# git push -u origin main
```

---

## 🔒 安全檢查清單

### ⚠️ 推送前必須檢查

```bash
# 運行安全檢查腳本
bash scripts/pre-push-check.sh
```

**手動檢查：**

- [ ] ✅ 所有 `.env` 文件已被忽略
- [ ] ✅ 沒有私鑰在代碼中
- [ ] ✅ 沒有敏感的 API 密鑰
- [ ] ✅ `.env.example` 文件存在（模板）
- [ ] ✅ `node_modules/` 已被忽略
- [ ] ✅ 構建文件夾已被忽略

### 檢查命令

```bash
# 檢查是否有 .env 文件被追蹤
git ls-files | grep ".env$"
# 應該返回空（或只有 .env.example）

# 檢查是否有私鑰
git grep -i "private.*key" -- ':!*.md' ':!GITHUB_PUSH_GUIDE.md'
# 應該沒有實際的私鑰字符串

# 查看將要推送的文件大小
du -sh .git
# 應該小於 50MB
```

---

## 📝 後續推送

### 日常推送流程

```bash
cd /Users/terry/Desktop/develop/cursor/polkadot/hackathon

# 1. 查看更改
git status

# 2. 添加更改
git add .
# 或添加特定文件
git add contracts/contracts/DuelPlatform.sol

# 3. 提交
git commit -m "feat: 添加新功能描述"

# 4. 推送
git push
```

### Commit Message 建議

使用語義化提交信息：

```bash
# 新功能
git commit -m "feat: 添加 Oracle 自動結算功能"

# 修復 bug
git commit -m "fix: 修復合約結算邏輯錯誤"

# 文檔更新
git commit -m "docs: 更新部署指南"

# 樣式調整
git commit -m "style: 優化首頁界面"

# 重構
git commit -m "refactor: 重構合約查詢邏輯"

# 測試
git commit -m "test: 添加 Oracle 服務測試"

# 配置
git commit -m "chore: 更新依賴版本"
```

---

## 🔄 常用 Git 命令

### 查看狀態

```bash
# 查看當前狀態
git status

# 查看提交歷史
git log --oneline

# 查看最近3次提交
git log -3 --oneline --decorate
```

### 撤銷操作

```bash
# 撤銷工作區更改
git checkout -- filename

# 撤銷暫存區更改
git reset HEAD filename

# 修改最後一次提交
git commit --amend
```

### 分支操作

```bash
# 創建新分支
git checkout -b feature/new-feature

# 切換分支
git checkout main

# 查看所有分支
git branch -a

# 推送新分支
git push -u origin feature/new-feature
```

---

## 🚨 問題排查

### Q1: 推送被拒絕 (rejected)

```bash
# 原因：遠程有更新
# 解決：先拉取再推送
git pull origin main --rebase
git push
```

### Q2: 文件太大無法推送

```bash
# 原因：單個文件 > 100MB 或總大小太大
# 解決：檢查並移除大文件

# 查找大文件
find . -type f -size +10M

# 如果是 node_modules，確保已被忽略
echo "node_modules/" >> .gitignore
git rm -r --cached node_modules
git commit -m "chore: remove node_modules"
```

### Q3: 需要身份驗證

```bash
# 使用 Personal Access Token (PAT)

# 1. 在 GitHub 創建 PAT:
#    Settings → Developer settings → Personal access tokens → 
#    Tokens (classic) → Generate new token

# 2. 選擇權限：
#    ✅ repo (所有)
#    ✅ workflow (如果需要 CI/CD)

# 3. 使用 PAT 作為密碼
git push
# Username: your_github_username
# Password: ghp_your_token_here

# 4. 或配置 credential helper
git config --global credential.helper store
```

### Q4: 意外提交了 .env 文件

```bash
# 立即從 Git 歷史中移除
git rm --cached contracts/.env
git rm --cached frontend/.env
git rm --cached backend/.env

# 確保 .gitignore 正確
echo "*.env" >> .gitignore
echo "!.env.example" >> .gitignore

# 提交更改
git commit -m "security: remove .env files from tracking"
git push

# ⚠️ 重要：立即更換所有私鑰和密碼！
```

---

## 📦 推薦的倉庫結構

```
dotduel-polkadot-hackathon/
├── .github/
│   └── workflows/          # CI/CD（可選）
├── contracts/              # 智能合約
├── frontend/               # 前端應用
├── backend/                # 後端 API
├── docs/                   # 文檔
├── scripts/                # 腳本
├── .gitignore
├── README.md
├── CHANGELOG.md
├── DEPLOYMENT.md
├── PROJECT_POSITIONING.md
└── LICENSE
```

---

## 📖 GitHub README 優化建議

確保您的 `README.md` 包含：

- [ ] 項目標題和簡介
- [ ] 技術棧徽章
- [ ] 快速開始指南
- [ ] 功能特性列表
- [ ] 架構圖（如果有）
- [ ] 部署指南
- [ ] 測試說明
- [ ] 黑客松信息
- [ ] 授權信息
- [ ] 聯繫方式

---

## 🏷️ 創建 Release（提交後）

```bash
# 在 GitHub 網頁上：
# 1. 進入倉庫
# 2. 點擊右側 "Releases"
# 3. "Draft a new release"
# 4. 填寫：
#    - Tag: v1.0.0-mvp
#    - Title: DotDuel v1.0.0-mvp - Hackathon Release
#    - Description: MVP 版本說明
# 5. 發布
```

---

## 🎯 黑客松提交檢查清單

提交到黑客松前確認：

- [ ] ✅ 代碼已推送到 GitHub
- [ ] ✅ README.md 完整清晰
- [ ] ✅ 包含完整的部署指南
- [ ] ✅ 所有測試都通過
- [ ] ✅ 沒有敏感信息
- [ ] ✅ 有明確的 LICENSE
- [ ] ✅ CHANGELOG.md 記錄完整
- [ ] ✅ 包含項目定位文檔
- [ ] ✅ 合約地址已記錄（如果已部署）
- [ ] ✅ Demo 視頻連結（如果有）

---

## 🔗 有用的連結

- [Git 官方文檔](https://git-scm.com/doc)
- [GitHub 指南](https://guides.github.com/)
- [語義化版本](https://semver.org/lang/zh-CN/)
- [語義化提交](https://www.conventionalcommits.org/zh-hans/)

---

**文檔版本**: v1.0  
**更新時間**: 2025-10-27

🚀 **準備好推送了嗎？** 運行 `bash scripts/push-to-github.sh` 開始！

