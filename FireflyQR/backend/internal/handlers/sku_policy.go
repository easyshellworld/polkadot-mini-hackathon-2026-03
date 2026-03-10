package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/redis/go-redis/v9"
)

const (
	skuPolicyKeyPrefix = "vault:sku:policy:"
	defaultFreeReplaceDays = 7
	defaultWarrantyDays    = 365
)

// GetSKUPolicy 返回某 SKU（合约）的售后策略
// GET /api/v1/sku-policy?contract=0x...
func GetSKUPolicy(rdb *redis.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		contract := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("contract")))
		contract = strings.TrimPrefix(contract, "0x")
		if contract == "" || !common.IsHexAddress("0x"+contract) {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode( map[string]interface{}{"ok": false, "error": "缺少或无效的 contract 参数"})
			return
		}
		key := skuPolicyKeyPrefix + contract
		data, err := rdb.HGetAll(r.Context(), key).Result()
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			_ = json.NewEncoder(w).Encode( map[string]interface{}{"ok": false, "error": err.Error()})
			return
		}
		freeDays := defaultFreeReplaceDays
		warrantyDays := defaultWarrantyDays
		if v := data["free_replacement_days"]; v != "" {
			if n, e := strconv.Atoi(v); e == nil && n >= 0 {
				freeDays = n
			}
		}
		if v := data["warranty_days"]; v != "" {
			if n, e := strconv.Atoi(v); e == nil && n >= 0 {
				warrantyDays = n
			}
		}
		_ = json.NewEncoder(w).Encode( map[string]interface{}{
			"ok":                    true,
			"contract":              "0x" + contract,
			"free_replacement_days": freeDays,
			"warranty_days":         warrantyDays,
		})
	}
}

// GetSKUDeadlines 根据领取时间与 SKU 策略返回免费换新/保修截止时间
// GET /api/v1/sku-deadlines?code_hash=xxx
// 从 vault:scan:<codeHash> 取 first_scan_time 与 sku（合约），从 vault:sku:policy:<sku> 取天数，计算截止时间
func (h *RelayHandler) GetSKUDeadlines(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		h.sendJSON(w, http.StatusOK, map[string]any{"ok": true})
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	codeHash := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("code_hash")))
	if strings.HasPrefix(codeHash, "0x") {
		codeHash = codeHash[2:]
	}
	if codeHash == "" {
		h.sendJSON(w, http.StatusBadRequest, map[string]interface{}{"ok": false, "error": "缺少 code_hash 参数"})
		return
	}
	ctx := r.Context()
	scanKey := "vault:scan:" + codeHash
	data, err := h.RDB.HGetAll(ctx, scanKey).Result()
	if err != nil || len(data) == 0 {
		h.sendJSON(w, http.StatusOK, map[string]interface{}{
			"ok": false, "error": "该码尚无扫码记录，无法计算售后截止时间", "claim_time": "", "free_replacement_deadline": "", "warranty_deadline": ""})
		return
	}
	claimTimeStr := strings.TrimSpace(data["first_scan_time"])
	sku := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(data["sku"]), "0x"))
	if claimTimeStr == "" {
		h.sendJSON(w, http.StatusOK, map[string]interface{}{
			"ok": false, "error": "扫码记录中无 first_scan_time", "claim_time": "", "free_replacement_deadline": "", "warranty_deadline": ""})
		return
	}
	// 若 sku 为空，可从 vault:codes:book_addr 取
	if sku == "" {
		if v, _ := h.RDB.HGet(ctx, "vault:codes:book_addr", codeHash).Result(); v != "" {
			sku = strings.ToLower(strings.TrimPrefix(strings.TrimSpace(v), "0x"))
		}
		if v, _ := h.RDB.HGet(ctx, "vault:codes:book_addr", "0x"+codeHash).Result(); v != "" && sku == "" {
			sku = strings.ToLower(strings.TrimPrefix(strings.TrimSpace(v), "0x"))
		}
	}
	// 解析领取时间（格式 "2006-01-02 15:04:05"，与 relay 写入时一致，按服务器本地时区）
	claimTime, err := time.ParseInLocation("2006-01-02 15:04:05", claimTimeStr, time.Local)
	if err != nil {
		claimTime, err = time.ParseInLocation("2006-01-02 15:04:05", claimTimeStr, time.UTC)
	}
	if err != nil {
		claimTime, err = time.Parse(time.RFC3339, claimTimeStr)
	}
	if err != nil {
		h.sendJSON(w, http.StatusOK, map[string]interface{}{
			"ok": false, "error": "first_scan_time 格式无法解析: " + claimTimeStr, "claim_time": claimTimeStr, "free_replacement_deadline": "", "warranty_deadline": ""})
		return
	}
	freeDays := defaultFreeReplaceDays
	warrantyDays := defaultWarrantyDays
	if sku != "" {
		policyKey := skuPolicyKeyPrefix + sku
		policy, _ := h.RDB.HGetAll(ctx, policyKey).Result()
		if v := policy["free_replacement_days"]; v != "" {
			if n, e := strconv.Atoi(v); e == nil && n >= 0 {
				freeDays = n
			}
		}
		if v := policy["warranty_days"]; v != "" {
			if n, e := strconv.Atoi(v); e == nil && n >= 0 {
				warrantyDays = n
			}
		}
	}
	freeDeadline := claimTime.AddDate(0, 0, freeDays)
	warrantyDeadline := claimTime.AddDate(0, 0, warrantyDays)
	h.sendJSON(w, http.StatusOK, map[string]interface{}{
		"ok":                       true,
		"claim_time":               claimTime.Format("2006-01-02 15:04:05"),
		"free_replacement_days":    freeDays,
		"warranty_days":            warrantyDays,
		"free_replacement_deadline": freeDeadline.Format("2006-01-02 15:04:05"),
		"warranty_deadline":        warrantyDeadline.Format("2006-01-02 15:04:05"),
		"sku":                      "0x" + sku,
	})
}

// GetSKUDeadlinesByReader 按 (contract, reader) 查 code_hash 后返回与 GetSKUDeadlines 相同结构的售后截止（供 NFT 管理页按钱包查）
// GET /api/v1/sku-deadlines-by-reader?contract=0x...&reader=0x...
func (h *RelayHandler) GetSKUDeadlinesByReader(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		h.sendJSON(w, http.StatusOK, map[string]any{"ok": true})
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	contract := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("contract")))
	contract = strings.TrimPrefix(contract, "0x")
	reader := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("reader")))
	reader = strings.TrimPrefix(reader, "0x")
	if contract == "" || reader == "" || !common.IsHexAddress("0x"+contract) || !common.IsHexAddress("0x"+reader) {
		h.sendJSON(w, http.StatusBadRequest, map[string]interface{}{"ok": false, "error": "缺少或无效的 contract / reader 参数"})
		return
	}
	ctx := r.Context()
	keyNo0x := "vault:reader:code:" + contract
	codeHash, err := h.RDB.HGet(ctx, keyNo0x, reader).Result()
	if (err != nil || codeHash == "") && common.IsHexAddress("0x"+reader) {
		// 兼容旧数据：写入时可能用了带 0x 的 field 或 key
		codeHash, err = h.RDB.HGet(ctx, keyNo0x, "0x"+reader).Result()
	}
	if (err != nil || codeHash == "") && common.IsHexAddress("0x"+contract) {
		codeHash, err = h.RDB.HGet(ctx, "vault:reader:code:0x"+contract, reader).Result()
	}
	if (err != nil || codeHash == "") && common.IsHexAddress("0x"+contract) && common.IsHexAddress("0x"+reader) {
		codeHash, err = h.RDB.HGet(ctx, "vault:reader:code:0x"+contract, "0x"+reader).Result()
	}
	if err != nil || codeHash == "" {
		h.sendJSON(w, http.StatusOK, map[string]interface{}{
			"ok": false, "error": "该钱包在此合约下无关联领取码，无法计算售后", "claim_time": "", "free_replacement_deadline": "", "warranty_deadline": ""})
		return
	}
	codeHash = strings.ToLower(strings.TrimSpace(codeHash))
	if strings.HasPrefix(codeHash, "0x") {
		codeHash = codeHash[2:]
	}
	scanKey := "vault:scan:" + codeHash
	data, err := h.RDB.HGetAll(ctx, scanKey).Result()
	if err != nil || len(data) == 0 {
		h.sendJSON(w, http.StatusOK, map[string]interface{}{
			"ok": false, "error": "该码尚无扫码记录", "claim_time": "", "free_replacement_deadline": "", "warranty_deadline": ""})
		return
	}
	claimTimeStr := strings.TrimSpace(data["first_scan_time"])
	sku := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(data["sku"]), "0x"))
	if claimTimeStr == "" {
		h.sendJSON(w, http.StatusOK, map[string]interface{}{
			"ok": false, "error": "扫码记录中无 first_scan_time", "claim_time": "", "free_replacement_deadline": "", "warranty_deadline": ""})
		return
	}
	if sku == "" {
		if v, _ := h.RDB.HGet(ctx, "vault:codes:book_addr", codeHash).Result(); v != "" {
			sku = strings.ToLower(strings.TrimPrefix(strings.TrimSpace(v), "0x"))
		}
		if v, _ := h.RDB.HGet(ctx, "vault:codes:book_addr", "0x"+codeHash).Result(); v != "" && sku == "" {
			sku = strings.ToLower(strings.TrimPrefix(strings.TrimSpace(v), "0x"))
		}
	}
	claimTime, err := time.ParseInLocation("2006-01-02 15:04:05", claimTimeStr, time.Local)
	if err != nil {
		claimTime, err = time.ParseInLocation("2006-01-02 15:04:05", claimTimeStr, time.UTC)
	}
	if err != nil {
		claimTime, err = time.Parse(time.RFC3339, claimTimeStr)
	}
	if err != nil {
		h.sendJSON(w, http.StatusOK, map[string]interface{}{
			"ok": false, "error": "first_scan_time 格式无法解析", "claim_time": claimTimeStr, "free_replacement_deadline": "", "warranty_deadline": ""})
		return
	}
	freeDays := defaultFreeReplaceDays
	warrantyDays := defaultWarrantyDays
	if sku != "" {
		policy, _ := h.RDB.HGetAll(ctx, skuPolicyKeyPrefix+sku).Result()
		if v := policy["free_replacement_days"]; v != "" {
			if n, e := strconv.Atoi(v); e == nil && n >= 0 {
				freeDays = n
			}
		}
		if v := policy["warranty_days"]; v != "" {
			if n, e := strconv.Atoi(v); e == nil && n >= 0 {
				warrantyDays = n
			}
		}
	}
	freeDeadline := claimTime.AddDate(0, 0, freeDays)
	warrantyDeadline := claimTime.AddDate(0, 0, warrantyDays)
	h.sendJSON(w, http.StatusOK, map[string]interface{}{
		"ok":                        true,
		"claim_time":                claimTime.Format("2006-01-02 15:04:05"),
		"free_replacement_days":     freeDays,
		"warranty_days":             warrantyDays,
		"free_replacement_deadline":  freeDeadline.Format("2006-01-02 15:04:05"),
		"warranty_deadline":         warrantyDeadline.Format("2006-01-02 15:04:05"),
		"sku":                       "0x" + sku,
	})
}

