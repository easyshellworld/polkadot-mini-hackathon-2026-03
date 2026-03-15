#!/bin/bash

# DotDuel - 推送前安全檢查腳本
# 版本: v1.0.0-mvp

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔒 DotDuel - 推送前安全檢查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 顏色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

cd "$(dirname "$0")/.."

echo "📍 檢查目錄: $(pwd)"
echo ""

# ============================================
# 檢查 1: .env 文件
# ============================================
echo "🔍 檢查 1: .env 文件是否被追蹤..."
if git ls-files | grep -q "\.env$" | grep -v "\.env\.example"; then
    echo -e "${RED}❌ 錯誤: 發現 .env 文件被追蹤${NC}"
    git ls-files | grep "\.env$" | grep -v "\.env\.example"
    ((ERRORS++))
else
    echo -e "${GREEN}✅ 通過${NC}"
fi
echo ""

# ============================================
# 檢查 2: 私鑰字符串
# ============================================
echo "🔍 檢查 2: 私鑰字符串..."
PRIVATE_KEYS=$(git diff --cached | grep -i "private.*key" | grep -v "PRIVATE_KEY=" | grep -v "env.example" | wc -l)
if [ "$PRIVATE_KEYS" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  警告: 發現可能的私鑰字符串${NC}"
    ((WARNINGS++))
else
    echo -e "${GREEN}✅ 通過${NC}"
fi
echo ""

# ============================================
# 檢查 3: node_modules
# ============================================
echo "🔍 檢查 3: node_modules 是否被忽略..."
if git ls-files | grep -q "node_modules/"; then
    echo -e "${RED}❌ 錯誤: node_modules 被追蹤${NC}"
    ((ERRORS++))
else
    echo -e "${GREEN}✅ 通過${NC}"
fi
echo ""

# ============================================
# 檢查 4: 大文件
# ============================================
echo "🔍 檢查 4: 大文件檢查..."
LARGE_FILES=$(find . -type f -size +10M 2>/dev/null | grep -v node_modules | grep -v .git)
if [ ! -z "$LARGE_FILES" ]; then
    echo -e "${YELLOW}⚠️  警告: 發現大文件 (>10MB)${NC}"
    echo "$LARGE_FILES"
    ((WARNINGS++))
else
    echo -e "${GREEN}✅ 通過${NC}"
fi
echo ""

# ============================================
# 檢查 5: .env.example 存在
# ============================================
echo "🔍 檢查 5: .env.example 文件..."
MISSING_EXAMPLE=0
for dir in contracts frontend backend; do
    if [ -f "$dir/.env.example" ]; then
        echo -e "${GREEN}✅ $dir/.env.example 存在${NC}"
    else
        echo -e "${YELLOW}⚠️  警告: $dir/.env.example 不存在${NC}"
        ((MISSING_EXAMPLE++))
    fi
done
if [ $MISSING_EXAMPLE -gt 0 ]; then
    ((WARNINGS++))
fi
echo ""

# ============================================
# 檢查 6: Git 倉庫大小
# ============================================
echo "🔍 檢查 6: Git 倉庫大小..."
if [ -d ".git" ]; then
    GIT_SIZE=$(du -sh .git | cut -f1)
    echo "   倉庫大小: $GIT_SIZE"
    
    # 轉換為 MB 進行比較（簡單檢查）
    if [[ $GIT_SIZE == *"G"* ]]; then
        echo -e "${YELLOW}⚠️  警告: 倉庫大於 1GB${NC}"
        ((WARNINGS++))
    else
        echo -e "${GREEN}✅ 通過${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  未初始化 Git${NC}"
    ((WARNINGS++))
fi
echo ""

# ============================================
# 檢查 7: README.md 完整性
# ============================================
echo "🔍 檢查 7: README.md 完整性..."
if [ ! -f "README.md" ]; then
    echo -e "${RED}❌ 錯誤: README.md 不存在${NC}"
    ((ERRORS++))
else
    # 檢查關鍵部分
    README_CHECKS=0
    
    if grep -q "DotDuel" README.md; then
        ((README_CHECKS++))
    fi
    
    if grep -q "安裝\|Installation\|快速開始\|Quick Start" README.md; then
        ((README_CHECKS++))
    fi
    
    if grep -q "部署\|Deployment" README.md; then
        ((README_CHECKS++))
    fi
    
    if [ $README_CHECKS -ge 2 ]; then
        echo -e "${GREEN}✅ 通過 ($README_CHECKS/3 關鍵部分)${NC}"
    else
        echo -e "${YELLOW}⚠️  警告: README.md 可能不完整${NC}"
        ((WARNINGS++))
    fi
fi
echo ""

# ============================================
# 檢查 8: LICENSE 文件
# ============================================
echo "🔍 檢查 8: LICENSE 文件..."
if [ -f "LICENSE" ] || [ -f "LICENSE.md" ]; then
    echo -e "${GREEN}✅ 通過${NC}"
else
    echo -e "${YELLOW}⚠️  警告: LICENSE 文件不存在${NC}"
    ((WARNINGS++))
fi
echo ""

# ============================================
# 檢查 9: 重要文檔
# ============================================
echo "🔍 檢查 9: 重要文檔..."
DOCS=("DEPLOYMENT.md" "PROJECT_POSITIONING.md" "CHANGELOG.md")
for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ]; then
        echo -e "${GREEN}✅ $doc 存在${NC}"
    else
        echo -e "${YELLOW}⚠️  $doc 不存在${NC}"
        ((WARNINGS++))
    fi
done
echo ""

# ============================================
# 總結
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 檢查總結"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ 所有檢查通過！可以安全推送${NC}"
    echo ""
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  發現 $WARNINGS 個警告${NC}"
    echo ""
    echo "建議修復警告後再推送，但不是必須的"
    exit 0
else
    echo -e "${RED}❌ 發現 $ERRORS 個錯誤和 $WARNINGS 個警告${NC}"
    echo ""
    echo "❗ 請修復所有錯誤後再推送！"
    exit 1
fi

