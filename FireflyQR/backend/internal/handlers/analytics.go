package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/oschwald/geoip2-golang"
)

// 异步写 Redis 用（不要用 r.Context()，请求结束后可能取消）
var analyticsCtx = context.Background()

// 可选：包级 GeoIP（让 mint.go 也能用，不必把 GeoIP 塞进 MintHandler）
var geoIPGlobal *geoip2.Reader

// SetGeoIP 在 main.go 里调用一次即可：handlers.SetGeoIP(geoDB)
func SetGeoIP(db *geoip2.Reader) { geoIPGlobal = db }

// ECharts 点：name + [lng, lat, count]
type MapNode struct {
	Name  string    `json:"name"`
	Value []float64 `json:"value"` // [lng, lat, count]
}

type LeaderboardItem struct {
	Name  string  `json:"name"`
	Count int     `json:"count"`
	Lng   float64 `json:"lng"`
	Lat   float64 `json:"lat"`
}

// Redis keys（拆开：coords + counts，保证 HINCRBY 原子增量，不丢数）
const (
	keyOldLocations = "vault:analytics:locations" // 旧格式兼容：field="city|lng,lat" -> count
	keyCoords       = "vault:heatmap:coords"      // 新：field="city_NA" -> "lng,lat"
	keyCounts       = "vault:heatmap:counts"      // 新：field="city_NA" -> count(int)
	keyLocations    = "vault:heatmap:locations"   // 兼容输出：field="city_NA" -> "lng,lat,count"
)

// -----------------------------
// GET /api/v1/analytics/distribution
// 返回：{ ok: true, regions: [...] }
// -----------------------------
func (h *RelayHandler) GetDistribution(w http.ResponseWriter, r *http.Request) {
	// CORS
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	regions := make([]MapNode, 0, 256)

	coordsMap, _ := h.RDB.HGetAll(r.Context(), keyCoords).Result()
	countsMap, _ := h.RDB.HGetAll(r.Context(), keyCounts).Result()

	// ✅ 优先读 coords + counts
	if len(coordsMap) > 0 && len(countsMap) > 0 {
		for field, coordStr := range coordsMap {
			coordParts := strings.Split(coordStr, ",")
			if len(coordParts) < 2 {
				continue
			}
			lng, _ := strconv.ParseFloat(strings.TrimSpace(coordParts[0]), 64)
			lat, _ := strconv.ParseFloat(strings.TrimSpace(coordParts[1]), 64)

			cntStr := strings.TrimSpace(countsMap[field])
			if cntStr == "" {
				continue
			}
			cnt, _ := strconv.ParseFloat(cntStr, 64)

			city := strings.TrimSpace(strings.Split(field, "_")[0])
			if city == "" || city == "Unknown" {
				city = "未知"
			}

			regions = append(regions, MapNode{
				Name:  city,
				Value: []float64{lng, lat, cnt},
			})
		}

		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":      true,
			"regions": regions,
		})
		return
	}

	// 兼容：老结构 vault:heatmap:locations
	resNew, _ := h.RDB.HGetAll(r.Context(), keyLocations).Result()
	for field, value := range resNew {
		parts := strings.Split(value, ",")
		if len(parts) < 3 {
			continue
		}
		lng, _ := strconv.ParseFloat(strings.TrimSpace(parts[0]), 64)
		lat, _ := strconv.ParseFloat(strings.TrimSpace(parts[1]), 64)
		cnt, _ := strconv.ParseFloat(strings.TrimSpace(parts[2]), 64)

		city := strings.TrimSpace(strings.Split(field, "_")[0])
		if city == "" || city == "Unknown" {
			city = "未知"
		}

		regions = append(regions, MapNode{
			Name:  city,
			Value: []float64{lng, lat, cnt},
		})
	}

	_ = json.NewEncoder(w).Encode(map[string]any{
		"ok":      true,
		"regions": regions,
	})
}

// -----------------------------
// GET /api/v1/analytics/leaderboard?limit=10
// 返回：{ ok: true, data: { items: [...] } }
// -----------------------------
func (h *RelayHandler) GetLeaderboard(w http.ResponseWriter, r *http.Request) {
	// CORS
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 50 {
		limit = 10
	}

	coordsMap, _ := h.RDB.HGetAll(r.Context(), keyCoords).Result()
	countsMap, _ := h.RDB.HGetAll(r.Context(), keyCounts).Result()

	items := make([]LeaderboardItem, 0, len(countsMap))

	// ✅ 优先新结构
	if len(coordsMap) > 0 && len(countsMap) > 0 {
		for field, cntStr := range countsMap {
			cnt, _ := strconv.Atoi(strings.TrimSpace(cntStr))

			coordStr := coordsMap[field]
			coordParts := strings.Split(coordStr, ",")
			if len(coordParts) < 2 {
				continue
			}
			lng, _ := strconv.ParseFloat(strings.TrimSpace(coordParts[0]), 64)
			lat, _ := strconv.ParseFloat(strings.TrimSpace(coordParts[1]), 64)

			city := trimQQWryDashes(strings.TrimSpace(strings.Split(field, "_")[0]))
			if city == "" || city == "Unknown" {
				city = "未知"
			}

			items = append(items, LeaderboardItem{
				Name:  city,
				Count: cnt,
				Lng:   lng,
				Lat:   lat,
			})
		}
	} else {
		// 兼容老结构 vault:heatmap:locations
		resNew, _ := h.RDB.HGetAll(r.Context(), keyLocations).Result()
		for field, value := range resNew {
			parts := strings.Split(value, ",")
			if len(parts) < 3 {
				continue
			}
			lng, _ := strconv.ParseFloat(strings.TrimSpace(parts[0]), 64)
			lat, _ := strconv.ParseFloat(strings.TrimSpace(parts[1]), 64)
			cnt, _ := strconv.Atoi(strings.TrimSpace(parts[2]))

			city := trimQQWryDashes(strings.TrimSpace(strings.Split(field, "_")[0]))
			if city == "" || city == "Unknown" {
				city = "未知"
			}

			items = append(items, LeaderboardItem{
				Name:  city,
				Count: cnt,
				Lng:   lng,
				Lat:   lat,
			})
		}
	}

	sort.Slice(items, func(i, j int) bool { return items[i].Count > items[j].Count })
	if len(items) > limit {
		items = items[:limit]
	}

	_ = json.NewEncoder(w).Encode(map[string]any{
		"ok": true,
		"data": map[string]any{
			"items": items,
		},
	})
}

// -----------------------------
// CaptureEcho：捕获一次“读者行为/回响”并按 IP -> city 聚合
// 优先使用 getLocationFromIP（纯真+GeoIP），国内 IP 可到城市级（如湛江），榜单不再只显示“中国”
// 写入：vault:analytics:locations（旧）、vault:heatmap:coords/counts/locations
// -----------------------------
func (h *RelayHandler) CaptureEcho(ip string) {
	go func(userIP string) {
		userIP = strings.TrimSpace(userIP)
		if userIP == "" || userIP == "127.0.0.1" || userIP == "::1" {
			return
		}

		// 统一用 getLocationFromIP（纯真优先，再 GeoIP），与 scan/record 一致
		locationStr := h.getLocationFromIP(userIP)
		parts := strings.SplitN(locationStr, "|", 2)
		city := strings.TrimSpace(parts[0])
		if city == "" || city == "Unknown" {
			city = "未知"
		}
		lng, lat := 0.0, 0.0
		if len(parts) >= 2 {
			coordParts := strings.Split(parts[1], ",")
			if len(coordParts) >= 2 {
				lng, _ = strconv.ParseFloat(strings.TrimSpace(coordParts[0]), 64)
				lat, _ = strconv.ParseFloat(strings.TrimSpace(coordParts[1]), 64)
			}
		}

		// 旧格式写入（兼容）
		locationKeyOld := fmt.Sprintf("%s|%f,%f", city, lng, lat)
		_ = h.RDB.HIncrBy(analyticsCtx, keyOldLocations, locationKeyOld, 1).Err()

		// 新格式：coords + counts
		field := fmt.Sprintf("%s_%s", city, "NA")

		// coords：覆盖写（同城坐标固定）
		coordVal := fmt.Sprintf("%f,%f", lng, lat)
		_ = h.RDB.HSet(analyticsCtx, keyCoords, field, coordVal).Err()

		// counts：原子自增（关键）
		newCnt, err := h.RDB.HIncrBy(analyticsCtx, keyCounts, field, 1).Result()
		if err != nil {
			return
		}

		// locations：兼容输出（lng,lat,count）
		locVal := fmt.Sprintf("%f,%f,%d", lng, lat, newCnt)
		_ = h.RDB.HSet(analyticsCtx, keyLocations, field, locVal).Err()
	}(ip)
}

func parseIP(s string) net.IP {
	// 可能带端口
	if host, _, err := net.SplitHostPort(s); err == nil {
		s = host
	}
	// 可能是 "client, proxy1"
	if strings.Contains(s, ",") {
		s = strings.TrimSpace(strings.Split(s, ",")[0])
	}
	return net.ParseIP(strings.TrimSpace(s))
}

func pickCityName(names map[string]string) string {
	if names == nil {
		return ""
	}
	// 中文优先
	if v := strings.TrimSpace(names["zh-CN"]); v != "" {
		return v
	}
	if v := strings.TrimSpace(names["zh"]); v != "" {
		return v
	}
	// 英文兜底
	if v := strings.TrimSpace(names["en"]); v != "" {
		return v
	}
	// 任意一个
	for _, v := range names {
		v = strings.TrimSpace(v)
		if v != "" {
			return v
		}
	}
	return ""
}

// pickLocationDisplay 从 GeoIP City 记录中取最佳展示名：城市 -> 省份/州 -> 国家 -> "未知"
// 解决移动端/运营商 IP 常无城市数据导致显示 Unknown 的问题
func pickLocationDisplay(rec *geoip2.City) string {
	if rec == nil {
		return "未知"
	}
	if s := pickCityName(rec.City.Names); strings.TrimSpace(s) != "" {
		return s
	}
	if len(rec.Subdivisions) > 0 {
		if s := pickCityName(rec.Subdivisions[0].Names); strings.TrimSpace(s) != "" {
			return s
		}
	}
	if s := pickCityName(rec.Country.Names); strings.TrimSpace(s) != "" {
		return s
	}
	return "未知"
}
