package main

import (
	"context"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/gorilla/mux"
	"github.com/ying32/qqwry"
	"github.com/joho/godotenv"
	"github.com/oschwald/geoip2-golang"
	"github.com/redis/go-redis/v9"

	"whale-vault/relay/internal/blockchain"
	"whale-vault/relay/internal/handlers"
)

// ============================================================
// Config
// ============================================================

type Config struct {
	// base
	Port      string
	RPCURL    string
	ChainID   *big.Int
	RedisAddr string

	// contracts
	FactoryAddr      string
	NFTStatsContract string
	EndGameAddr      string // reward contract

	// stats
	NFTStatsFromBlock uint64
	NFTStatsInterval  time.Duration
	NFTStatsChunk     uint64
	NFTStatsPoll      time.Duration

	// keys
	USDTContract     string
	USDTAdminPrivKey string
	AdminAPIKey      string

	// reward signer key
	BackendPrivKey string

	// geoip
	GeoLiteCityMMDB string

	// 国内 IP 库（纯真 qqwry.dat，可选）
	QQWRYDat string

	// qr code
	QRCodeBaseURL string
}

func LoadConfig(dotenvPath string) (*Config, error) {
	if err := godotenv.Load(dotenvPath); err != nil {
		log.Println("⚠️ 未加载 .env:", err)
	} else {
		log.Println("✅ 已加载 .env")
	}

	get := func(k, def string) string {
		v := strings.TrimSpace(os.Getenv(k))
		if v == "" {
			return def
		}
		return v
	}

	rpcURL := get("RPC_URL", "")
	if rpcURL == "" {
		return nil, fmt.Errorf("RPC_URL 未设置")
	}
	chainIDStr := get("CHAIN_ID", "")
	if chainIDStr == "" {
		return nil, fmt.Errorf("CHAIN_ID 未设置")
	}
	cInt, err := strconv.ParseInt(chainIDStr, 10, 64)
	if err != nil || cInt <= 0 {
		return nil, fmt.Errorf("CHAIN_ID 无效: %s", chainIDStr)
	}

	cfg := &Config{
		Port:      get("PORT", "8080"),
		RPCURL:    rpcURL,
		ChainID:   big.NewInt(cInt),
		RedisAddr: get("REDIS_ADDR", "localhost:6379"),

		FactoryAddr:      get("FACTORY_ADDR", ""),
		NFTStatsContract: get("NFT_STATS_CONTRACT", ""),
		EndGameAddr:      get("EndGame_ADDR", ""),

		USDTContract:     get("USDT_CONTRACT", ""),
		USDTAdminPrivKey: strings.TrimPrefix(get("USDT_ADMIN_PRIVKEY", ""), "0x"),
		AdminAPIKey:      get("ADMIN_API_KEY", ""),

		BackendPrivKey: strings.TrimPrefix(get("BACKEND_PRIVATE_KEY", ""), "0x"),

		GeoLiteCityMMDB: get("GEOLITE2_CITY_MMDB", "/opt/Whale-Vault/geoip/GeoLite2-City.mmdb"),
		QQWRYDat:        get("QQWRY_DAT", "qqwry.dat"),

		QRCodeBaseURL: get("QR_CODE_BASE_URL", "http://whale3070.com"),
	}

	// optional stats knobs
	if v := get("NFT_STATS_FROM_BLOCK", ""); v != "" {
		if u, e := strconv.ParseUint(v, 10, 64); e == nil {
			cfg.NFTStatsFromBlock = u
		}
	}
	if v := get("NFT_STATS_INTERVAL_SECONDS", ""); v != "" {
		if sec, e := strconv.ParseInt(v, 10, 64); e == nil && sec > 0 {
			cfg.NFTStatsInterval = time.Duration(sec) * time.Second
		}
	}
	if v := get("NFT_STATS_CHUNK", ""); v != "" {
		if u, e := strconv.ParseUint(v, 10, 64); e == nil && u > 0 {
			cfg.NFTStatsChunk = u
		}
	}
	if v := get("NFT_STATS_POLL_SECONDS", ""); v != "" {
		if sec, e := strconv.ParseInt(v, 10, 64); e == nil && sec > 0 {
			cfg.NFTStatsPoll = time.Duration(sec) * time.Second
		}
	}

	return cfg, nil
}

// ============================================================
// Globals
// ============================================================

var (
	ctx    = context.Background()
	rdb    *redis.Client
	client *ethclient.Client
)

// ============================================================
// NFT Stats (ERC-721 Transfer logs)
// ============================================================

var (
	transferSigHash = common.HexToHash("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef")
	zeroTopic       = "0x0000000000000000000000000000000000000000000000000000000000000000"
	systemUser      = "0x0000000000000000000000000000000000001000"
)

type NFTStatsJob struct {
	RDB           *redis.Client
	Client        *ethclient.Client
	Contract      common.Address
	FromBlockHint uint64
	Interval      time.Duration
	ChunkSize     uint64
	Logger        *log.Logger
}

func (j *NFTStatsJob) Start(ctx context.Context) {
	if j.Interval <= 0 {
		j.Interval = 1 * time.Minute
	}
	if j.ChunkSize == 0 {
		j.ChunkSize = 50_000
	}
	j.runOnce(ctx)

	ticker := time.NewTicker(j.Interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			j.logf("NFTStatsJob stopped: %v", ctx.Err())
			return
		case <-ticker.C:
			j.runOnce(ctx)
		}
	}
}

// runOnceTimeout 单次扫描最大耗时，避免 RPC/Redis 挂起导致 goroutine 永久阻塞
const runOnceTimeout = 5 * time.Minute

func (j *NFTStatsJob) runOnce(ctx context.Context) {
	if j.RDB == nil || j.Client == nil {
		j.logf("NFTStatsJob missing deps: rdb/client nil")
		return
	}

	runCtx, cancel := context.WithTimeout(ctx, runOnceTimeout)
	defer cancel()

	contract := strings.ToLower(j.Contract.Hex())
	keyPrefix := fmt.Sprintf("vault:stats:nft:%s", contract)
	keyLast := keyPrefix + ":last_block"
	keyMinted := keyPrefix + ":minted_total"
	keyUnique := keyPrefix + ":unique_minters"
	keyReal := keyPrefix + ":unique_real_users"
	keyMintersSet := keyPrefix + ":minters:set"
	keyRealSet := keyPrefix + ":real_users:set"

	startBlock := j.FromBlockHint
	if v, err := j.RDB.Get(runCtx, keyLast).Result(); err == nil && v != "" {
		if b, ok := new(big.Int).SetString(v, 10); ok {
			startBlock = b.Uint64() + 1
		}
	}

	latest, err := j.Client.BlockNumber(runCtx)
	if err != nil {
		j.logf("BlockNumber error: %v", err)
		return
	}
	if startBlock > latest {
		return
	}

	var mintedInc int64
	var toBlockDone uint64

	for from := startBlock; from <= latest; {
		select {
		case <-runCtx.Done():
			j.logf("NFTStatsJob runOnce timeout or cancelled contract=%s at block %d", contract, from)
			return
		default:
		}

		to := from + j.ChunkSize - 1
		if to > latest {
			to = latest
		}

		logs, err := j.fetchTransferLogs(runCtx, from, to)
		if err != nil {
			j.logf("FilterLogs %d-%d error: %v", from, to, err)
			return
		}

		for _, lg := range logs {
			if len(lg.Topics) < 3 {
				continue
			}
			if strings.ToLower(lg.Topics[1].Hex()) != zeroTopic {
				continue
			}

			mintedInc++
			toAddr := strings.ToLower(topicToAddress(lg.Topics[2]))
			_ = j.RDB.SAdd(runCtx, keyMintersSet, toAddr).Err()
			if toAddr != systemUser {
				_ = j.RDB.SAdd(runCtx, keyRealSet, toAddr).Err()
			}
		}

		toBlockDone = to
		from = to + 1
	}

	if mintedInc > 0 {
		_ = j.RDB.IncrBy(runCtx, keyMinted, mintedInc).Err()
	}

	uniqueMinters, _ := j.RDB.SCard(runCtx, keyMintersSet).Result()
	uniqueReal, _ := j.RDB.SCard(runCtx, keyRealSet).Result()

	_ = j.RDB.Set(runCtx, keyUnique, uniqueMinters, 0).Err()
	_ = j.RDB.Set(runCtx, keyReal, uniqueReal, 0).Err()
	_ = j.RDB.Set(runCtx, keyLast, fmt.Sprintf("%d", toBlockDone), 0).Err()

	mintedTotal, _ := j.RDB.Get(runCtx, keyMinted).Result()
	j.logf("NFTStats updated contract=%s blocks=%d..%d minted+%d (total=%s) unique=%d real=%d",
		contract, startBlock, toBlockDone, mintedInc, mintedTotal, uniqueMinters, uniqueReal,
	)
}

func (j *NFTStatsJob) fetchTransferLogs(ctx context.Context, from, to uint64) ([]types.Log, error) {
	q := ethereum.FilterQuery{
		FromBlock: big.NewInt(int64(from)),
		ToBlock:   big.NewInt(int64(to)),
		Addresses: []common.Address{j.Contract},
		Topics:    [][]common.Hash{{transferSigHash}},
	}
	return j.Client.FilterLogs(ctx, q)
}

func topicToAddress(topic common.Hash) string {
	b := topic.Bytes()
	return "0x" + hex.EncodeToString(b[12:])
}

func (j *NFTStatsJob) logf(format string, args ...any) {
	if j.Logger != nil {
		j.Logger.Printf(format, args...)
	} else {
		log.Printf(format, args...)
	}
}

// ============================================================
// Multi-contract Stats Manager
// ============================================================

type NFTStatsManager struct {
	RDB    *redis.Client
	Client *ethclient.Client
	Logger *log.Logger

	DefaultFromBlock uint64
	Interval         time.Duration
	ChunkSize        uint64
	PollContracts    time.Duration

	mu    sync.Mutex
	jobs  map[string]context.CancelFunc
	start sync.Once
}

func (m *NFTStatsManager) Start(ctx context.Context) {
	m.start.Do(func() {
		if m.PollContracts <= 0 {
			m.PollContracts = 30 * time.Second
		}
		if m.Interval <= 0 {
			m.Interval = 1 * time.Minute
		}
		if m.ChunkSize == 0 {
			m.ChunkSize = 50_000
		}
		if m.jobs == nil {
			m.jobs = map[string]context.CancelFunc{}
		}
	})

	m.refreshOnce(ctx)

	tk := time.NewTicker(m.PollContracts)
	defer tk.Stop()

	for {
		select {
		case <-ctx.Done():
			m.logf("NFTStatsManager stopped: %v", ctx.Err())
			m.stopAll()
			return
		case <-tk.C:
			m.refreshOnce(ctx)
		}
	}
}

const refreshOnceTimeout = 30 * time.Second

func (m *NFTStatsManager) refreshOnce(ctx context.Context) {
	if m.RDB == nil || m.Client == nil {
		m.logf("NFTStatsManager missing deps: rdb/client nil")
		return
	}

	runCtx, cancel := context.WithTimeout(ctx, refreshOnceTimeout)
	defer cancel()

	setVals, err := m.RDB.SMembers(runCtx, "vault:nft:contracts").Result()
	if err != nil {
		m.logf("NFTStatsManager refreshOnce SMembers error: %v", err)
		return
	}

	uniq := map[string]struct{}{}
	for _, c := range setVals {
		c = strings.ToLower(strings.TrimSpace(c))
		if isHexAddress(c) {
			uniq[c] = struct{}{}
		}
	}

	for c := range uniq {
		m.ensureJob(ctx, c) // 用 manager 的长期 ctx，避免 job 随 refreshOnce 的 runCtx 被 cancel 而退出
	}
}

func (m *NFTStatsManager) ensureJob(parent context.Context, contractLower string) {
	m.mu.Lock()
	_, exists := m.jobs[contractLower]
	m.mu.Unlock()
	if exists {
		return
	}

	fromBlock := m.DefaultFromBlock
	getCtx, getCancel := context.WithTimeout(parent, 10*time.Second)
	if v, err := m.RDB.Get(getCtx, fmt.Sprintf("vault:stats:nft:%s:from_block", contractLower)).Result(); err == nil && v != "" {
		if u, e := strconv.ParseUint(strings.TrimSpace(v), 10, 64); e == nil {
			fromBlock = u
		}
	}
	getCancel()

	job := &NFTStatsJob{
		RDB:           m.RDB,
		Client:        m.Client,
		Contract:      common.HexToAddress(contractLower),
		FromBlockHint: fromBlock,
		Interval:      m.Interval,
		ChunkSize:     m.ChunkSize,
		Logger:        m.Logger,
	}

	jobCtx, cancel := context.WithCancel(parent)

	m.mu.Lock()
	if _, ok := m.jobs[contractLower]; ok {
		m.mu.Unlock()
		cancel()
		return
	}
	m.jobs[contractLower] = cancel
	m.mu.Unlock()

	go job.Start(jobCtx)
	m.logf("📊 NFTStatsJob started (auto): contract=%s fromBlock=%d interval=%s chunk=%d",
		contractLower, fromBlock, m.Interval.String(), m.ChunkSize,
	)
}

func (m *NFTStatsManager) stopAll() {
	m.mu.Lock()
	defer m.mu.Unlock()
	for c, cancel := range m.jobs {
		cancel()
		delete(m.jobs, c)
	}
}

func (m *NFTStatsManager) logf(format string, args ...any) {
	if m.Logger != nil {
		m.Logger.Printf(format, args...)
	} else {
		log.Printf(format, args...)
	}
}

// ============================================================
// Handlers (stats + reward)
// ============================================================

func nftStatsHandler(defaultContract string) http.HandlerFunc {
	type resp struct {
		Ok    bool   `json:"ok"`
		Error string `json:"error,omitempty"`
		Data  any    `json:"data,omitempty"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		if rdb == nil {
			writeJSON(w, http.StatusServiceUnavailable, resp{Ok: false, Error: "redis unavailable"})
			return
		}

		contract := strings.TrimSpace(r.URL.Query().Get("contract"))
		if contract == "" {
			contract = strings.TrimSpace(defaultContract)
		}
		if !isHexAddress(contract) {
			writeJSON(w, http.StatusBadRequest, resp{Ok: false, Error: "invalid contract"})
			return
		}
		contract = strings.ToLower(contract)

		keyPrefix := fmt.Sprintf("vault:stats:nft:%s", contract)
		keyLast := keyPrefix + ":last_block"
		keyMinted := keyPrefix + ":minted_total"
		keyUnique := keyPrefix + ":unique_minters"
		keyReal := keyPrefix + ":unique_real_users"

		reqCtx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()
		last, _ := rdb.Get(reqCtx, keyLast).Result()
		minted, _ := rdb.Get(reqCtx, keyMinted).Result()
		unique, _ := rdb.Get(reqCtx, keyUnique).Result()
		real, _ := rdb.Get(reqCtx, keyReal).Result()

		toInt := func(s string) int64 {
			s = strings.TrimSpace(s)
			if s == "" {
				return 0
			}
			v, err := strconv.ParseInt(s, 10, 64)
			if err != nil {
				return 0
			}
			return v
		}

		mintedTotal := toInt(minted)
		// 优先从链上 totalSales() 读取（QuickNFT 等合约提供），失败则用 Redis 扫块结果
		if client != nil {
			addr := common.HexToAddress(contract)
			// totalSales()(uint256) selector = first 4 bytes of keccak256("totalSales()")
			sel := crypto.Keccak256([]byte("totalSales()"))[:4]
			out, err := client.CallContract(reqCtx, ethereum.CallMsg{To: &addr, Data: sel}, nil)
			if err == nil && len(out) >= 32 {
				mintedTotal = new(big.Int).SetBytes(out[:32]).Int64()
			}
		}

		writeJSON(w, http.StatusOK, resp{
			Ok: true,
			Data: map[string]any{
				"contract":           contract,
				"minted_total":       mintedTotal,
				"unique_minters":     toInt(unique),
				"unique_real_users":  toInt(real),
				"last_scanned_block": toInt(last),
			},
		})
	}
}

func nftContractsHandler() http.HandlerFunc {
	type resp struct {
		Ok    bool     `json:"ok"`
		Error string   `json:"error,omitempty"`
		Data  []string `json:"data,omitempty"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		if rdb == nil {
			writeJSON(w, http.StatusServiceUnavailable, resp{Ok: false, Error: "redis unavailable"})
			return
		}
		reqCtx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()
		setVals, err := rdb.SMembers(reqCtx, "vault:nft:contracts").Result()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, resp{Ok: false, Error: err.Error()})
			return
		}
		out := make([]string, 0, len(setVals))
		for _, c := range setVals {
			c = strings.ToLower(strings.TrimSpace(c))
			if isHexAddress(c) {
				out = append(out, c)
			}
		}
		writeJSON(w, http.StatusOK, resp{Ok: true, Data: out})
	}
}

type dispenseReq struct {
	Referrer  string   `json:"referrer"`
	Recipient string   `json:"recipient"`
	Codes     []string `json:"codes"`
}

type dispenseResp struct {
	Ok           bool   `json:"ok"`
	Error        string `json:"error,omitempty"`
	TxHash       string `json:"txHash,omitempty"`
	BusinessHash string `json:"businessHash,omitempty"`
}

func rewardDispenseHandler(svc *blockchain.RewardService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		if svc == nil {
			writeJSON(w, http.StatusServiceUnavailable, dispenseResp{Ok: false, Error: "reward service not configured"})
			return
		}
		var req dispenseReq
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, dispenseResp{Ok: false, Error: "invalid json"})
			return
		}

		ref := strings.TrimSpace(req.Referrer)
		recv := strings.TrimSpace(req.Recipient)
		if !isHexAddress(ref) || !isHexAddress(recv) {
			writeJSON(w, http.StatusBadRequest, dispenseResp{Ok: false, Error: "invalid address"})
			return
		}
		if len(req.Codes) != 5 {
			writeJSON(w, http.StatusBadRequest, dispenseResp{Ok: false, Error: "必须提供 5 个 hashcode"})
			return
		}
		for i := range req.Codes {
			req.Codes[i] = strings.TrimSpace(req.Codes[i])
			if !isBytes32(req.Codes[i]) {
				writeJSON(w, http.StatusBadRequest, dispenseResp{Ok: false, Error: fmt.Sprintf("codes[%d] 不是 bytes32 (0x+64hex)", i)})
				return
			}
		}

		cctx, cancel := context.WithTimeout(r.Context(), 25*time.Second)
		defer cancel()

		tx, biz, err := svc.DispenseReward(cctx, ref, recv, req.Codes)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, dispenseResp{Ok: false, Error: err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, dispenseResp{Ok: true, TxHash: tx, BusinessHash: biz})
	}
}

// ============================================================
// main
// ============================================================

func main() {
	// ✅ 动态获取 .env 路径：优先使用当前目录，否则尝试获取可执行文件所在目录
	envPath := ".env"
	if _, err := os.Stat(envPath); os.IsNotExist(err) {
		// 获取可执行文件所在目录
		if exePath, err := os.Executable(); err == nil {
			exeDir := filepath.Dir(exePath)
			envPath = filepath.Join(exeDir, ".env")
		}
	}

	cfg, err := LoadConfig(envPath)

	if err != nil {
		log.Fatal(err)
	}

	// Redis
	rdb = redis.NewClient(&redis.Options{
		Addr:         cfg.RedisAddr,
		Protocol:     2,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		DialTimeout:  5 * time.Second,
	})
	pingCtx, cancelPing := context.WithTimeout(context.Background(), 10*time.Second)
	err = rdb.Ping(pingCtx).Err()
	cancelPing()
	if err != nil {
		log.Fatalf("❌ Redis 连接失败 (%s): %v", cfg.RedisAddr, err)
	}
	log.Println("✅ Redis 连接成功, addr =", cfg.RedisAddr)

	// Ethereum client
	client, err = ethclient.Dial(cfg.RPCURL)
	if err != nil {
		log.Fatalf("❌ RPC 连接失败: %v", err)
	}
	log.Println("✅ 以太坊客户端连接成功")
	log.Println("🔗 当前网络 ChainID:", cfg.ChainID.String())

	// ✅ GeoLite2 mmdb
	geoDB, err := geoip2.Open(cfg.GeoLiteCityMMDB)
	if err != nil {
		log.Fatalf("❌ GeoLite2 mmdb open failed: %v (path=%s)", err, cfg.GeoLiteCityMMDB)
	}
	log.Println("✅ GeoLite2 City DB loaded:", cfg.GeoLiteCityMMDB)
	defer geoDB.Close()

	// 让 handlers 包级 GeoIP 也能用（你 analytics.go 里支持 geoIPGlobal）
	handlers.SetGeoIP(geoDB)

	// 纯真 IP 库（国内 IP 解析到城市，如湛江市）
	var qqwryDB *qqwry.QQWry
	if _, err := os.Stat(cfg.QQWRYDat); err == nil {
		qqwryDB = qqwry.NewQQWry(cfg.QQWRYDat)
		log.Println("✅ 纯真 IP 库 loaded:", cfg.QQWRYDat)
	} else {
		log.Printf("⚠️ 纯真 IP 库未找到 (%s)，国内 IP 仅用 GeoLite2", cfg.QQWRYDat)
	}

	// Load relayers
	handlers.LoadRelayers(client, cfg.ChainID)

	// handlers DI
	relayH := &handlers.RelayHandler{RDB: rdb, Client: client, GeoIP: geoDB, QQWry: qqwryDB}
	marketH := &handlers.MarketHandler{RDB: rdb}
	factoryH := &handlers.FactoryHandler{RDB: rdb, Client: client, ChainID: cfg.ChainID}
	mintH := &handlers.MintHandler{RDB: rdb, Client: client, RelayForEcho: relayH}
	authH := &handlers.AuthHandler{RDB: rdb, Client: client}
	publisherH := &handlers.PublisherHandler{RDB: rdb, Client: client, FactoryAddr: cfg.FactoryAddr, QRCodeBaseURL: cfg.QRCodeBaseURL}

	// NFT stats 合约列表来源：Redis SET vault:nft:contracts（mint/部署时 SAdd）
	// 换链后需清空旧链合约，否则会继续扫 Avalanche 等旧地址
	const nftContractsKey = "vault:nft:contracts"
	if os.Getenv("NFT_CONTRACTS_CLEAR") == "1" {
		if err := rdb.Del(ctx, nftContractsKey).Err(); err != nil {
			log.Printf("⚠️ 清空 %s 失败: %v", nftContractsKey, err)
		} else {
			log.Println("📊 NFT stats: 已按 NFT_CONTRACTS_CLEAR=1 清空 Redis 合约列表（换链后请去掉该变量重启）")
		}
	}
	if list := strings.TrimSpace(os.Getenv("NFT_CONTRACTS")); list != "" {
		pipe := rdb.Pipeline()
		pipe.Del(ctx, nftContractsKey)
		for _, a := range strings.Split(list, ",") {
			a = strings.ToLower(strings.TrimSpace(a))
			if a != "" && isHexAddress(a) {
				pipe.SAdd(ctx, nftContractsKey, a)
			}
		}
		if _, err := pipe.Exec(ctx); err != nil {
			log.Printf("⚠️ 设置 NFT_CONTRACTS 失败: %v", err)
		} else {
			log.Println("📊 NFT stats: 已按 NFT_CONTRACTS 覆盖合约列表")
		}
	}

	// NFT stats manager
	manager := &NFTStatsManager{RDB: rdb, Client: client, Logger: log.Default()}
	manager.DefaultFromBlock = cfg.NFTStatsFromBlock
	manager.Interval = cfg.NFTStatsInterval
	manager.ChunkSize = cfg.NFTStatsChunk
	manager.PollContracts = cfg.NFTStatsPoll
	go manager.Start(ctx)
	log.Println("📊 NFTStatsManager started (multi-contract mode)")

	// Reward service（不再调用 NewRewardService）
	rewardSvc := &blockchain.RewardService{
		Client:      client,
		Redis:       rdb,
		BackendKey:  cfg.BackendPrivKey,
		ContractHex: cfg.EndGameAddr,
	}

	// routes
	r := mux.NewRouter()
	r.Use(requestLoggerMiddleware)

	// --- auth
	r.HandleFunc("/secret/get-binding", authH.GetBinding).Methods("GET", "OPTIONS")
	r.HandleFunc("/secret/verify", authH.Verify).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/admin/check-access", authH.CheckAdminAccess).Methods("GET", "OPTIONS")

	// --- relay
	r.HandleFunc("/relay/save-code", relayH.SaveCode).Methods("POST", "GET", "OPTIONS")
	r.HandleFunc("/relay/reward", relayH.Reward).Methods("POST", "OPTIONS")
	r.HandleFunc("/relay/stats", relayH.GetReferrerStats).Methods("GET", "OPTIONS")
	r.HandleFunc("/relay/scan/info", relayH.GetScanInfo).Methods("GET", "OPTIONS")
	r.HandleFunc("/relay/scan/record", relayH.RecordScanAndClaimRedPacket).Methods("POST", "OPTIONS")

	// --- mint
	r.HandleFunc("/relay/mint", mintH.Mint).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/v1/nft/total-minted", mintH.GetTotalMinted).Methods("GET", "OPTIONS")
	r.PathPrefix("/relay/tx/").HandlerFunc(mintH.GetTxResult).Methods("GET", "OPTIONS")

	// --- stats APIs
	r.HandleFunc("/api/v1/nft/stats", nftStatsHandler(cfg.NFTStatsContract)).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/v1/nft/contracts", nftContractsHandler()).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/v1/nft/contract/{address}/mints", mintH.GetContractMints).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/v1/nft/contract/{address}/owners", mintH.GetContractOwners).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/v1/nft/buy-listed", mintH.BuyListed).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/v1/nft/secondary-activate-receiver", mintH.GetSecondaryActivateReceiver).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/v1/nft/secondary-activate", mintH.SecondaryActivate).Methods("POST", "OPTIONS")

	// --- market
	r.HandleFunc("/api/v1/tickers", marketH.GetTickers).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/v1/market/tickers", marketH.GetTickers).Methods("GET", "OPTIONS")

	// --- factory / publisher
	r.HandleFunc("/api/v1/precheck-code", factoryH.PrecheckCode).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/v1/factory/verify-publisher", factoryH.VerifyPublisher).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/v1/publisher/balance", factoryH.GetPublisherBalance).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/v1/publisher/zip", publisherH.GenerateAndDownloadZip).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/v1/publisher/stock", publisherH.GetPublisherStock).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/v1/publisher/books", publisherH.GetPublisherBooks).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/v1/publisher/books/search", publisherH.SearchPublisherBooks).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/v1/factory/create", factoryH.DeployBook).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/v1/publisher/deploy-book", factoryH.DeployBook).Methods("POST", "OPTIONS")

	// --- analytics (distribution + leaderboard)
	r.HandleFunc("/api/v1/analytics/distribution", relayH.GetDistribution).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/v1/analytics/leaderboard", relayH.GetLeaderboard).Methods("GET", "OPTIONS")

	// --- reward dispense
	r.HandleFunc("/api/v1/reward/dispense", rewardDispenseHandler(rewardSvc)).Methods("POST", "OPTIONS")

	// --- admin usdt recharge
	r.HandleFunc("/api/admin/usdt/recharge", adminRechargeUSDTHandler(cfg)).Methods("POST", "OPTIONS")

	// --- admin 清空 Redis 销量/统计（换链后清测试数据）
	r.HandleFunc("/api/admin/redis/clear-sales", adminClearSalesHandler(cfg, rdb)).Methods("POST", "GET", "OPTIONS")

	// --- SKU 售后策略与截止时间（管理员设置批次策略；按领取时间+天数算截止）
	r.HandleFunc("/api/v1/sku-policy", handlers.GetSKUPolicy(rdb)).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/v1/sku-deadlines", relayH.GetSKUDeadlines).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/v1/sku-deadlines-by-reader", relayH.GetSKUDeadlinesByReader).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/v1/admin/sku-policy", adminSKUPolicyHandler(cfg, rdb)).Methods("POST", "OPTIONS")

	// server
	fmt.Printf("🚀 Whale Vault 后端启动成功 (监听端口: %s)\n", cfg.Port)
	srv := &http.Server{
		Addr:    "0.0.0.0:" + cfg.Port,
		Handler: corsMiddleware(r),
	}
	log.Fatal(srv.ListenAndServe())
}

// ============================================================
// ============================================================
// Admin 设置 SKU 售后策略（免费换新天数、保修天数）
// POST /api/v1/admin/sku-policy
// Body: {"contract":"0x...","free_replacement_days":7,"warranty_days":365}
// ============================================================

func adminSKUPolicyHandler(cfg *Config, rdb *redis.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		var req struct {
			Contract             string `json:"contract"`
			FreeReplacementDays  int    `json:"free_replacement_days"`
			WarrantyDays         int    `json:"warranty_days"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, apiResp{Ok: false, Error: "invalid json: " + err.Error()})
			return
		}
		contract := strings.ToLower(strings.TrimSpace(req.Contract))
		contract = strings.TrimPrefix(contract, "0x")
		if contract == "" || !isHexAddress("0x"+contract) {
			writeJSON(w, http.StatusBadRequest, apiResp{Ok: false, Error: "contract 缺失或格式不正确（需 0x+40 位十六进制）"})
			return
		}
		if req.FreeReplacementDays < 0 || req.WarrantyDays < 0 {
			writeJSON(w, http.StatusBadRequest, apiResp{Ok: false, Error: "free_replacement_days 与 warranty_days 不能为负数"})
			return
		}
		key := "vault:sku:policy:" + contract
		if err := rdb.HSet(r.Context(), key, "free_replacement_days", strconv.Itoa(req.FreeReplacementDays), "warranty_days", strconv.Itoa(req.WarrantyDays)).Err(); err != nil {
			writeJSON(w, http.StatusInternalServerError, apiResp{Ok: false, Error: "Redis 写入失败: " + err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"ok": true, "contract": "0x" + contract,
			"free_replacement_days": req.FreeReplacementDays, "warranty_days": req.WarrantyDays,
		})
	}
}

// ============================================================
// Admin 清空 Redis 销量/统计（换链后清测试数据）
// ============================================================

func adminClearSalesHandler(cfg *Config, rdb *redis.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		if strings.TrimSpace(cfg.AdminAPIKey) != "" {
			got := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
			if subtle.ConstantTimeCompare([]byte(got), []byte(cfg.AdminAPIKey)) != 1 {
				writeJSON(w, http.StatusUnauthorized, apiResp{Ok: false, Error: "unauthorized"})
				return
			}
		}

		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()

		var deleted int
		// 1) 单 key：销量排行、书籍注册表、旧版地理位置
		for _, key := range []string{"vault:tickers:sales", "vault:books:registry", "vault:analytics:locations"} {
			if n, err := rdb.Del(ctx, key).Result(); err == nil && n > 0 {
				deleted += int(n)
			}
		}
		// 2) 按模式 SCAN 删除：每本书销量、NFT 统计、热力图（换链后一并清空）
		patterns := []string{"vault:book:sales:*", "vault:stats:nft:*", "vault:heatmap:*"}
		for _, pattern := range patterns {
			iter := rdb.Scan(ctx, 0, pattern, 200).Iterator()
			for iter.Next(ctx) {
				if err := rdb.Del(ctx, iter.Val()).Err(); err == nil {
					deleted++
				}
			}
			if err := iter.Err(); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"ok": false, "error": "scan: " + err.Error()})
				return
			}
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"ok":      true,
			"deleted": deleted,
			"message": "已清空销量、NFT 统计与热力图相关 Redis 数据",
		})
	}
}

// ============================================================
// Admin USDT Recharge
// ============================================================

type rechargeUSDTReq struct {
	To     string `json:"to"`
	Amount int64  `json:"amount"`
}

type apiResp struct {
	Ok     bool   `json:"ok"`
	Error  string `json:"error,omitempty"`
	TxHash string `json:"txHash,omitempty"`
}

func adminRechargeUSDTHandler(cfg *Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		if strings.TrimSpace(cfg.AdminAPIKey) != "" {
			got := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
			if subtle.ConstantTimeCompare([]byte(got), []byte(cfg.AdminAPIKey)) != 1 {
				writeJSON(w, http.StatusUnauthorized, apiResp{Ok: false, Error: "unauthorized"})
				return
			}
		}

		var req rechargeUSDTReq
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, apiResp{Ok: false, Error: "invalid json"})
			return
		}

		to := strings.TrimSpace(req.To)
		if !isHexAddress(to) {
			writeJSON(w, http.StatusBadRequest, apiResp{Ok: false, Error: "invalid 'to' address"})
			return
		}
		if req.Amount <= 0 {
			writeJSON(w, http.StatusBadRequest, apiResp{Ok: false, Error: "amount must be > 0"})
			return
		}
		if !isHexAddress(cfg.USDTContract) {
			writeJSON(w, http.StatusBadRequest, apiResp{Ok: false, Error: "USDT_CONTRACT not set or invalid"})
			return
		}
		if cfg.USDTAdminPrivKey == "" {
			writeJSON(w, http.StatusInternalServerError, apiResp{Ok: false, Error: "USDT_ADMIN_PRIVKEY not set"})
			return
		}

		c := blockchain.NewUSDTClient(cfg.USDTContract, cfg.RPCURL, cfg.USDTAdminPrivKey)
		tx, err := c.Recharge(to, req.Amount)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, apiResp{Ok: false, Error: err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, apiResp{Ok: true, TxHash: tx})
	}
}

// ============================================================
// Helpers + Middleware
// ============================================================

func isHexAddress(s string) bool {
	s = strings.TrimSpace(s)
	if !strings.HasPrefix(s, "0x") || len(s) != 42 {
		return false
	}
	for _, ch := range s[2:] {
		if !((ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F')) {
			return false
		}
	}
	return true
}

func isBytes32(s string) bool {
	s = strings.TrimSpace(s)
	if !strings.HasPrefix(s, "0x") || len(s) != 66 {
		return false
	}
	for _, ch := range s[2:] {
		if !((ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F')) {
			return false
		}
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func requestLoggerMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Printf("🔔 [REQ] %s %s | From: %s\n", r.Method, r.URL.Path, GetClientIP(r))
		next.ServeHTTP(w, r)
	})
}

func corsMiddleware(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		h.ServeHTTP(w, r)
	})
}

func GetClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}
	ip := r.RemoteAddr
	if colonIdx := strings.LastIndex(ip, ":"); colonIdx != -1 {
		ip = ip[:colonIdx]
	}
	return ip
}

func DeriveAddressFromPrivateKey(privateKeyHex string) string {
	privateKey, err := crypto.HexToECDSA(strings.TrimPrefix(strings.TrimSpace(privateKeyHex), "0x"))
	if err != nil {
		return ""
	}
	return crypto.PubkeyToAddress(privateKey.PublicKey).Hex()
}
