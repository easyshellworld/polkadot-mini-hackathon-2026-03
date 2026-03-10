//读者扫码 → 先在 Redis 做校验和暂存 → 凑够规则后发起奖励交易 → 提供统计查询
package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/oschwald/geoip2-golang"
	"github.com/redis/go-redis/v9"
	"github.com/ying32/qqwry"

	"whale-vault/relay/internal/blockchain"
)

// RelayHandler 封装读者端依赖
type RelayHandler struct {
	RDB       *redis.Client
	Client    *ethclient.Client
	RewardSvc *blockchain.RewardService
	GeoIP     *geoip2.Reader
	QQWry     *qqwry.QQWry // 纯真 IP 库，国内 IP 解析到城市（如湛江市）
}

// CommonResponse 统一响应格式
type CommonResponse struct {
	Ok     bool   `json:"ok,omitempty"`
	Status string `json:"status,omitempty"`
	TxHash string `json:"txHash,omitempty"`
	Error  string `json:"error,omitempty"`
}

/* -------------------------------------------------------------------------- */
/*                                   书码相关                                   */
/* -------------------------------------------------------------------------- */

// SaveCode 处理书码校验与暂存
func (h *RelayHandler) SaveCode(w http.ResponseWriter, r *http.Request) {
	var codeHash, address string

	if r.Method == http.MethodGet {
		codeHash = r.URL.Query().Get("codeHash")
		address = r.URL.Query().Get("address")
	} else {
		var req struct {
			CodeHash string `json:"codeHash"`
			Address  string `json:"address"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err == nil {
			codeHash = req.CodeHash
			address = req.Address
		}
	}

	codeHash = strings.ToLower(strings.TrimSpace(codeHash))
	address = strings.ToLower(strings.TrimSpace(address))

	if codeHash == "" {
		h.sendJSON(w, http.StatusBadRequest, CommonResponse{Error: "缺失书码哈希"})
		return
	}

	ctx := r.Context()
	isValid, err := h.RDB.SIsMember(ctx, "vault:codes:valid", codeHash).Result()
	if err != nil {
		h.sendJSON(w, http.StatusInternalServerError, CommonResponse{Error: "数据库异常"})
		return
	}

	if !isValid {
		h.sendJSON(w, http.StatusBadRequest, CommonResponse{
			Error: "无效二维码：可能已使用或非正版",
		})
		return
	}

	// ✅ 记录首次扫码信息
	ip := extractClientIP(r)
	go h.RecordFirstScan(context.Background(), codeHash, address, ip)

	var count int64
	if address != "" {
		key := "vault:saved:" + address
		h.RDB.SAdd(ctx, key, codeHash)
		count, _ = h.RDB.SCard(ctx, key).Result()
	}

	h.sendJSON(w, http.StatusOK, map[string]interface{}{
		"ok":    true,
		"code":  codeHash,
		"count": count,
	})
}

// GetSaved 获取用户已暂存书码
func (h *RelayHandler) GetSaved(w http.ResponseWriter, r *http.Request) {
	addr := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("address")))
	if addr == "" {
		h.sendJSON(w, http.StatusBadRequest, CommonResponse{Error: "缺少 address"})
		return
	}

	codes, _ := h.RDB.SMembers(r.Context(), "vault:saved:"+addr).Result()
	h.sendJSON(w, http.StatusOK, map[string]interface{}{
		"ok":    true,
		"codes": codes,
	})
}

/* -------------------------------------------------------------------------- */
/*                                 推荐统计                                   */
/* -------------------------------------------------------------------------- */

// GetReferrerStats 获取推荐人统计（支持排行榜）
func (h *RelayHandler) GetReferrerStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	addr := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("address")))

	if addr == "" {
		stats, err := h.RDB.HGetAll(ctx, "whale_vault:referrer_stats").Result()
		if err != nil {
			h.sendJSON(w, http.StatusInternalServerError, CommonResponse{Error: "读取排行榜失败"})
			return
		}
		h.sendJSON(w, http.StatusOK, map[string]interface{}{
			"ok":   true,
			"all":  stats,
		})
		return
	}

	count, err := h.RDB.HGet(ctx, "whale_vault:referrer_stats", addr).Result()
	if err == redis.Nil {
		count = "0"
	}

	h.sendJSON(w, http.StatusOK, map[string]interface{}{
		"ok":      true,
		"address": addr,
		"count":   count,
	})
}

/* -------------------------------------------------------------------------- */
/*                                 推荐奖励                                   */
/* -------------------------------------------------------------------------- */

// Reward 执行推荐奖励（5 个 hashcode）
func (h *RelayHandler) Reward(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Referrer string   `json:"referrer"`
		Recipient string `json:"recipient"`
		Codes     []string `json:"codes"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.sendJSON(w, http.StatusBadRequest, CommonResponse{Error: "参数解析失败"})
		return
	}

	if len(req.Codes) != 5 {
		h.sendJSON(w, http.StatusBadRequest, CommonResponse{Error: "必须提供 5 个 hashcode"})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	txHash, businessHash, err := h.RewardSvc.DispenseReward(
		ctx,
		strings.ToLower(req.Referrer),
		strings.ToLower(req.Recipient),
		req.Codes,
	)

	if err != nil {
		log.Printf("❌ 推荐奖励失败: %v", err)
		h.sendJSON(w, http.StatusInternalServerError, CommonResponse{
			Error: err.Error(),
		})
		return
	}

	h.sendJSON(w, http.StatusOK, CommonResponse{
		Ok:     true,
		TxHash: txHash,
		Status: businessHash,
	})
}

/* -------------------------------------------------------------------------- */
/*                                   工具                                    */
/* -------------------------------------------------------------------------- */

func (h *RelayHandler) sendJSON(w http.ResponseWriter, code int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(payload)
}

/* -------------------------------------------------------------------------- */
/*                             首次扫码记录与查询                               */
/* -------------------------------------------------------------------------- */

// FirstScanInfo 首次扫码信息
type FirstScanInfo struct {
	FirstScanTime string  `json:"first_scan_time"`
	Location      string  `json:"location"`
	RewardAmount  float64 `json:"reward_amount"`
	SKU           string  `json:"sku"`
	ScannerAddr   string  `json:"scanner_address,omitempty"`
	ScanCount     int64   `json:"scan_count"` // 该二维码被扫的总次数
}

// isGenericLocation 是否为“泛化”地点（仅国家或未知），纯真可将其升级为省/市
func isGenericLocation(location string) bool {
	s := strings.TrimSpace(location)
	if s == "" || s == "未知" {
		return true
	}
	// "中国|..." 或 仅 "中国"（含 GeoIP 中文）
	if s == "中国" || strings.HasPrefix(s, "中国|") {
		return true
	}
	// GeoIP 英文兜底可能存 "China" / "China|..."
	if s == "China" || strings.HasPrefix(s, "China|") {
		return true
	}
	if strings.HasPrefix(s, "未知|") {
		return true
	}
	return false
}

// RecordFirstScan 记录首次扫码信息
// 当用户首次扫码领取 NFT 时调用，记录: 时间、地点、红包数量、SKU
func (h *RelayHandler) RecordFirstScan(ctx context.Context, codeHash, scannerAddr, ip string) {
	scanKey := "vault:scan:" + codeHash
	exists, _ := h.RDB.Exists(ctx, scanKey).Result()
	if exists > 0 {
		curLoc, _ := h.RDB.HGet(ctx, scanKey, "location").Result()
		// 必打日志：方便排查「已记录过」时为何没有升级/湛江日志
		log.Printf("📍 RecordFirstScan: codeHash=%s 已记录过 curLoc=%q ip=%s generic=%v skipIP=%v",
			codeHash, curLoc, ip, isGenericLocation(curLoc), ip == "" || ip == "127.0.0.1" || ip == "::1")
		// 若当前存的是「中国」/「未知」且本次请求 IP 非本地，用本次 IP 再解析并升级
		if isGenericLocation(curLoc) && ip != "" && ip != "127.0.0.1" && ip != "::1" {
			newLoc := h.getLocationFromIP(ip)
			if !isGenericLocation(newLoc) {
				_ = h.RDB.HSet(ctx, scanKey, "location", newLoc).Err()
				log.Printf("📍 RecordFirstScan: codeHash=%s 已存在但地点泛化，已用纯真/GeoIP 升级为 %s", codeHash, newLoc)
			} else {
				log.Printf("📍 RecordFirstScan: codeHash=%s 本次解析仍为泛化 newLoc=%q", codeHash, newLoc)
			}
		}
		return
	}

	// 首次：获取位置信息（优先纯真，再 GeoIP）
	location := h.getLocationFromIP(ip)

	// 获取 SKU (从 vault:codes:book_addr 获取)
	sku := ""
	bookAddr, _ := h.RDB.HGet(ctx, "vault:codes:book_addr", codeHash).Result()
	if bookAddr != "" {
		sku = bookAddr // SKU 即为书籍合约地址
	}

	// 生成随机红包金额 (2-10 元，保留2位小数)
	rewardAmount := generateRandomReward(2.0, 10.0)

	// 增加扫码次数计数
	scanCountKey := "vault:codes:scan_count:" + codeHash
	scanCount, _ := h.RDB.Incr(ctx, scanCountKey).Result()

	// 记录到 Redis
	scanTime := time.Now().Format("2006-01-02 15:04:05")
	_ = h.RDB.HSet(ctx, scanKey, map[string]interface{}{
		"first_scan_time": scanTime,
		"location":        location,
		"reward_amount":   rewardAmount,
		"sku":             sku,
		"scanner_address": scannerAddr,
		"scan_count":      scanCount,
		"timestamp":       time.Now().Unix(),
	}).Err()

	log.Printf("✅ RecordFirstScan: codeHash=%s location=%s sku=%s reward=%.2f scan_count=%d", codeHash, location, sku, rewardAmount, scanCount)
}

// generateRandomReward 生成随机红包金额 (min-max 元，保留2位小数)
func generateRandomReward(min, max float64) float64 {
	// 生成 200-1000 的整数，然后除以 100 得到 2.00-10.00
	minInt := int(min * 100)
	maxInt := int(max * 100)
	amountInt := minInt + rand.Intn(maxInt-minInt+1)
	return float64(amountInt) / 100.0
}

// GetScanInfo 获取首次扫码信息
// GET /relay/scan/info?codeHash=xxx
func (h *RelayHandler) GetScanInfo(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		h.sendJSON(w, http.StatusOK, map[string]any{"ok": true})
		return
	}

	codeHash := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("codeHash")))
	if strings.HasPrefix(codeHash, "0x") {
		codeHash = codeHash[2:]
	}
	if codeHash == "" {
		h.sendJSON(w, http.StatusBadRequest, CommonResponse{Error: "缺少 codeHash 参数"})
		return
	}

	ctx := r.Context()
	scanKey := "vault:scan:" + codeHash

	// 查询扫码记录
	data, err := h.RDB.HGetAll(ctx, scanKey).Result()
	if err != nil || len(data) == 0 {
		h.sendJSON(w, http.StatusOK, map[string]interface{}{
			"ok":      false,
			"message": "该码尚未被扫码领取",
			"data":    nil,
		})
		return
	}

	info := FirstScanInfo{
		FirstScanTime: data["first_scan_time"],
		Location:      normalizeLocationForAPI(data["location"]),
		ScannerAddr:   data["scanner_address"],
	}

	if rewardStr := data["reward_amount"]; rewardStr != "" {
		if reward, err := strconv.ParseFloat(rewardStr, 64); err == nil {
			info.RewardAmount = reward
		}
	}

	if scanCountStr := data["scan_count"]; scanCountStr != "" {
		if scanCount, err := strconv.ParseInt(scanCountStr, 10, 64); err == nil {
			info.ScanCount = scanCount
		}
	}

	info.SKU = data["sku"]

	h.sendJSON(w, http.StatusOK, map[string]interface{}{
		"ok":      true,
		"message": "获取首次扫码信息成功",
		"data":    info,
	})
}

// RecordScanAndClaimRedPacket 记录扫码并领取红包
// POST /relay/scan/record
// 请求体: {"codeHash": "xxx", "scannerAddress": "0x..."}
// 返回: 首次扫码信息（包含红包金额、地点、时间、扫码次数）
func (h *RelayHandler) RecordScanAndClaimRedPacket(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		h.sendJSON(w, http.StatusOK, map[string]any{"ok": true})
		return
	}

	if r.Method != http.MethodPost {
		h.sendJSON(w, http.StatusMethodNotAllowed, CommonResponse{Error: "仅支持 POST"})
		return
	}

	var req struct {
		CodeHash       string `json:"codeHash"`
		ScannerAddress string `json:"scannerAddress"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.sendJSON(w, http.StatusBadRequest, CommonResponse{Error: "无效的请求体"})
		return
	}

	codeHash := strings.ToLower(strings.TrimSpace(req.CodeHash))
	if strings.HasPrefix(codeHash, "0x") {
		codeHash = codeHash[2:]
	}
	scannerAddr := strings.ToLower(strings.TrimSpace(req.ScannerAddress))

	if codeHash == "" {
		h.sendJSON(w, http.StatusBadRequest, CommonResponse{Error: "缺少 codeHash"})
		return
	}

	ctx := r.Context()
	ip := extractClientIP(r)
	scanKey := "vault:scan:" + codeHash

	// 一码一领：若该码已有扫码记录，仅返回已有信息并标记已领取，不再写入
	exists, _ := h.RDB.Exists(ctx, scanKey).Result()
	if exists > 0 {
		data, _ := h.RDB.HGetAll(ctx, scanKey).Result()
		info := buildFirstScanInfoFromData(data)
		h.sendJSON(w, http.StatusOK, map[string]interface{}{
			"ok":             true,
			"message":        "该码已领取过，仅可查看",
			"already_claimed": true,
			"data":          info,
		})
		return
	}

	// 首次扫码：记录并返回
	h.RecordFirstScan(ctx, codeHash, scannerAddr, ip)
	data, err := h.RDB.HGetAll(ctx, scanKey).Result()
	if err != nil || len(data) == 0 {
		h.sendJSON(w, http.StatusOK, map[string]interface{}{
			"ok":      false,
			"message": "记录扫码信息失败",
			"data":    nil,
		})
		return
	}

	info := buildFirstScanInfoFromData(data)
	h.sendJSON(w, http.StatusOK, map[string]interface{}{
		"ok":              true,
		"message":         "红包领取成功",
		"already_claimed": false,
		"data":            info,
	})
}

// buildFirstScanInfoFromData 从 Redis HGetAll 结果组装 FirstScanInfo
func buildFirstScanInfoFromData(data map[string]string) FirstScanInfo {
	info := FirstScanInfo{
		FirstScanTime: data["first_scan_time"],
		Location:      normalizeLocationForAPI(data["location"]),
		ScannerAddr:   data["scanner_address"],
		SKU:           data["sku"],
	}
	if rewardStr := data["reward_amount"]; rewardStr != "" {
		if reward, err := strconv.ParseFloat(rewardStr, 64); err == nil {
			info.RewardAmount = reward
		}
	}
	if scanCountStr := data["scan_count"]; scanCountStr != "" {
		if scanCount, err := strconv.ParseInt(scanCountStr, 10, 64); err == nil {
			info.ScanCount = scanCount
		}
	}
	return info
}

// normalizeLocationForAPI 返回给前端的 location 统一用「未知」，不用 Unknown；并去掉纯真可能带的前导/中间横杠
func normalizeLocationForAPI(location string) string {
	if location == "" {
		return ""
	}
	if strings.TrimSpace(location) == "Unknown" || strings.HasPrefix(strings.TrimSpace(location), "Unknown|") {
		return strings.Replace(location, "Unknown", "未知", 1)
	}
	// 只处理竖线前的展示名部分（如 "–广东–湛江|113,34"）
	before, after, hasPipe := strings.Cut(location, "|")
	if hasPipe {
		before = trimQQWryDashes(before)
		return before + "|" + after
	}
	return trimQQWryDashes(location)
}

// trimQQWryDashes 去掉前导/尾随/中间横杠（– － —），如 "–广东–湛江" -> "广东湛江"
func trimQQWryDashes(s string) string {
	s = strings.TrimFunc(s, func(r rune) bool {
		return r == '-' || r == '－' || r == '–' || r == '—' || r == ' ' || r == '\t'
	})
	s = strings.ReplaceAll(s, "–", "")
	s = strings.ReplaceAll(s, "－", "")
	s = strings.ReplaceAll(s, "—", "")
	return strings.TrimSpace(s)
}

// parseQQWryLocation 从纯真库返回的字符串解析出展示用地区名（去掉运营商等）
// 例："中国广东省湛江市 电信" -> "广东省湛江市"；"中国–广东–湛江 电信" -> "广东湛江"
var reQQWryISP = regexp.MustCompile(`\s*(电信|联通|移动|铁通|教育网|长城宽带|鹏博士|广电网|阿里云|腾讯云|华为云|百度云|京东云|微软|亚马逊|未知)\s*$`)

func parseQQWryLocation(raw string) string {
	s := strings.TrimSpace(raw)
	if s == "" || strings.Contains(s, "未知IP") {
		return ""
	}
	s = reQQWryISP.ReplaceAllString(s, "")
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, "中国") {
		s = strings.TrimPrefix(s, "中国")
		s = strings.TrimSpace(s)
	}
	// 去掉前导/尾随横杠（纯真有时返回 "–广东–湛江" 这类格式）
	s = strings.TrimFunc(s, func(r rune) bool {
		return r == '-' || r == '－' || r == '–' || r == '—' || r == ' ' || r == '\t'
	})
	// 去掉中间的分隔横杠（纯真常用 –/－/—），如 "广东–湛江" -> "广东湛江"
	s = strings.ReplaceAll(s, "–", "")
	s = strings.ReplaceAll(s, "－", "")
	s = strings.ReplaceAll(s, "—", "")
	s = strings.TrimSpace(s)
	if s == "" {
		return "中国"
	}
	return s
}

// getLocationFromIP 从 IP 获取位置信息：优先纯真库（国内到城市），否则 GeoLite2
func (h *RelayHandler) getLocationFromIP(ip string) string {
	if ip == "" || ip == "127.0.0.1" || ip == "::1" {
		return "未知"
	}

	var lng, lat float64
	var nameFromQQWry string

	// 1) 优先纯真库（国内 IP 可解析到省/市）
	if h.QQWry != nil {
		raw := h.QQWry.GetIPLocationOfString(ip)
		nameFromQQWry = parseQQWryLocation(raw)
		if nameFromQQWry != "" {
			log.Printf("📍 纯真: ip=%s -> %s", ip, nameFromQQWry)
		}
	}

	// 2) GeoIP：取坐标（纯真无坐标），且纯真无结果时用 GeoIP 名称
	db := h.GeoIP
	if db == nil {
		db = geoIPGlobal
	}
	if db != nil {
		parsed := parseIP(ip)
		if parsed != nil {
			if rec, err := db.City(parsed); err == nil {
				lng, lat = rec.Location.Longitude, rec.Location.Latitude
				if nameFromQQWry == "" {
					nameFromQQWry = pickLocationDisplay(rec)
					if nameFromQQWry == "未知" {
						log.Printf("📍 GeoIP: ip=%s -> 未知 (lng=%f lat=%f)", ip, lng, lat)
					} else {
						log.Printf("📍 GeoIP: ip=%s -> %s (lng=%f lat=%f)", ip, nameFromQQWry, lng, lat)
					}
				}
			}
		}
	}

	if nameFromQQWry == "" {
		nameFromQQWry = "未知"
	}
	return fmt.Sprintf("%s|%f,%f", nameFromQQWry, lng, lat)
}
