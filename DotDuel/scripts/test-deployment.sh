#!/bin/bash

# 部署測試腳本
# 用於測試部署後的所有功能

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Polkadot Duel Platform - 部署測試"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 配置（請根據實際部署修改）
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"
BACKEND_URL="${BACKEND_URL:-http://localhost:3000}"

echo "📍 測試目標:"
echo "   前端: $FRONTEND_URL"
echo "   後端: $BACKEND_URL"
echo ""

# 測試計數器
TESTS_PASSED=0
TESTS_FAILED=0

# 測試函數
test_endpoint() {
  local name=$1
  local url=$2
  local expected=$3
  
  echo -n "Testing $name... "
  response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
  
  if [ "$response" -eq "$expected" ]; then
    echo "✅ PASS (HTTP $response)"
    ((TESTS_PASSED++))
  else
    echo "❌ FAIL (HTTP $response, expected $expected)"
    ((TESTS_FAILED++))
  fi
}

test_json_response() {
  local name=$1
  local url=$2
  local key=$3
  
  echo -n "Testing $name... "
  response=$(curl -s "$url" 2>/dev/null)
  
  if echo "$response" | grep -q "\"$key\""; then
    echo "✅ PASS"
    ((TESTS_PASSED++))
  else
    echo "❌ FAIL (key '$key' not found)"
    ((TESTS_FAILED++))
  fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. 前端測試"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

test_endpoint "前端首頁" "$FRONTEND_URL" 200
test_endpoint "前端 - 創建比賽" "$FRONTEND_URL/create" 200
test_endpoint "前端 - 比賽列表" "$FRONTEND_URL/matches" 200
test_endpoint "前端 - 我的比賽" "$FRONTEND_URL/my-matches" 200
test_endpoint "前端 - 統計" "$FRONTEND_URL/stats" 200

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. 後端 API 測試"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

test_json_response "Health Check" "$BACKEND_URL/health" "status"
test_json_response "Health Check - Version" "$BACKEND_URL/health" "version"

test_endpoint "Matches API" "$BACKEND_URL/api/matches" 200
test_endpoint "Stats - Platform" "$BACKEND_URL/api/stats/platform" 200
test_endpoint "Stats - Recent" "$BACKEND_URL/api/stats/recent" 200

test_json_response "Oracle Status" "$BACKEND_URL/api/oracle/status" "oracleAddress"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. API 響應時間測試"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

test_response_time() {
  local name=$1
  local url=$2
  local max_time=$3
  
  echo -n "Testing $name response time... "
  time=$(curl -s -o /dev/null -w "%{time_total}" "$url" 2>/dev/null)
  time_ms=$(echo "$time * 1000" | bc | cut -d. -f1)
  
  if [ "$time_ms" -lt "$max_time" ]; then
    echo "✅ PASS (${time_ms}ms < ${max_time}ms)"
    ((TESTS_PASSED++))
  else
    echo "⚠️  SLOW (${time_ms}ms > ${max_time}ms)"
    ((TESTS_FAILED++))
  fi
}

test_response_time "Health Check" "$BACKEND_URL/health" 500
test_response_time "Matches API" "$BACKEND_URL/api/matches" 1000
test_response_time "Oracle Status" "$BACKEND_URL/api/oracle/status" 500

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 測試結果"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ 通過: $TESTS_PASSED"
echo "❌ 失敗: $TESTS_FAILED"
echo "📊 總計: $((TESTS_PASSED + TESTS_FAILED))"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo "🎉 所有測試通過！"
  echo ""
  exit 0
else
  echo "⚠️  有 $TESTS_FAILED 個測試失敗"
  echo ""
  exit 1
fi

