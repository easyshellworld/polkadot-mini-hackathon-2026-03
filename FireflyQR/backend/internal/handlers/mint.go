// mint.go
package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/big"
	"net"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/redis/go-redis/v9"
)

var (
	mintSemaphore = make(chan struct{}, 5) // 并发保护：最多 5 笔 mint 同时进行
)

// ==============================
// MintHandler
// ==============================
type MintHandler struct {
	RDB           *redis.Client
	Client        *ethclient.Client
	RelayForEcho  *RelayHandler // 可选：用于 CaptureEcho 时走纯真+GeoIP，热力图/榜单显示城市级
}

// ==============================
// HTTP Handler: Mint NFT
// POST /relay/mint
//
// 使用 Relayer 私钥（PRIVATE_KEY_0/RELAYER_PRIVATE_KEY）调用合约 mint(address)，与 cast send "mint(address)" 一致
//
// 其他保留：
// 1) 默认不回退 CONTRACT_ADDR（避免“幽灵合约”回来），仅当 ALLOW_CONTRACT_FALLBACK=1 才允许
// 2) 可选 preflight eth_call（cast call），仅当 PREFLIGHT_CALL=1 启用
//
// ✅ 新增：Mint 成功后加入热力图回响
//    go (&RelayHandler{RDB: h.RDB}).CaptureEcho(ip)
// ==============================
func (h *MintHandler) Mint(w http.ResponseWriter, r *http.Request) {
	type MintReq struct {
		BookAddress   string `json:"book_address"`
		ReaderAddress string `json:"reader_address"`
		CodeHash      string `json:"code_hash"` // 可选；传了则一码一领：仅首次扫码者可领，且该码只能 mint 一次
	}

	var req MintReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, "BAD_REQUEST", "invalid json body")
		return
	}

	bookAddr := strings.ToLower(strings.TrimSpace(req.BookAddress))
	readerAddr := strings.ToLower(strings.TrimSpace(req.ReaderAddress))
	codeHash := strings.ToLower(strings.TrimSpace(req.CodeHash))
	if codeHash != "" && strings.HasPrefix(codeHash, "0x") {
		codeHash = codeHash[2:]
	}

	// ✅ 默认不回退旧的 CONTRACT_ADDR，除非你明确允许
	if bookAddr == "" && strings.TrimSpace(os.Getenv("ALLOW_CONTRACT_FALLBACK")) == "1" {
		bookAddr = strings.ToLower(strings.TrimSpace(os.Getenv("CONTRACT_ADDR")))
	}

	if bookAddr == "" || readerAddr == "" {
		writeErr(w, "BAD_REQUEST", "missing book_address or reader_address")
		return
	}
	if !common.IsHexAddress(bookAddr) {
		writeErr(w, "BAD_REQUEST", "book_address format invalid")
		return
	}
	if !common.IsHexAddress(readerAddr) {
		writeErr(w, "BAD_REQUEST", "reader_address format invalid")
		return
	}

	// 一码一领：若带了 code_hash，校验该码未领过且当前读者为首次扫码者
	if codeHash != "" && h.RDB != nil {
		mintedKey := "vault:code:minted:" + codeHash
		_, err := h.RDB.Get(r.Context(), mintedKey).Result()
		if err == nil {
			writeErr(w, "ALREADY_CLAIMED", "该码已领取过 NFT，不可重复领取")
			return
		}
		scanKey := "vault:scan:" + codeHash
		scannerAddr, _ := h.RDB.HGet(r.Context(), scanKey, "scanner_address").Result()
		scannerAddr = strings.ToLower(strings.TrimSpace(scannerAddr))
		if scannerAddr == "" {
			writeErr(w, "SCAN_FIRST", "请先扫码再领取")
			return
		}
		if scannerAddr != readerAddr {
			writeErr(w, "ONLY_FIRST_SCAN", "仅首次扫码者可领取 NFT")
			return
		}
	}

	// 并发保护
	select {
	case mintSemaphore <- struct{}{}:
		defer func() { <-mintSemaphore }()
	default:
		writeErr(w, "BUSY", "mint service busy, retry later")
		return
	}

	// 超时控制
	ctx, cancel := context.WithTimeout(context.Background(), 35*time.Second)
	defer cancel()

	// 使用 Relayer 私钥（合约授权 mint 的地址）：PRIVATE_KEY_0 / RELAYER_PRIVATE_KEY，与 cast send "mint(address)" 一致
	relayerPriv := strings.TrimSpace(os.Getenv("PRIVATE_KEY_0"))
	if relayerPriv == "" {
		relayerPriv = strings.TrimSpace(os.Getenv("RELAYER_PRIVATE_KEY"))
	}
	if relayerPriv == "" {
		relayerPriv = strings.TrimSpace(os.Getenv("PUBLISHER_OWNER_PRIVKEY"))
	}
	relayerPriv = strings.TrimPrefix(relayerPriv, "0x")
	if relayerPriv == "" {
		writeErr(w, "CONFIG_MISSING", "PRIVATE_KEY_0 或 RELAYER_PRIVATE_KEY 或 PUBLISHER_OWNER_PRIVKEY 未设置")
		return
	}

	ownerAddr, err := deriveAddressFromPriv(relayerPriv)
	if err != nil {
		writeErr(w, "CONFIG_MISSING", "Relayer 私钥无效")
		return
	}
	log.Printf("[MINT] book=%s reader=%s relayer=%s (子合约只认部署时传入的 relayer，二者必须一致)", bookAddr, readerAddr, strings.ToLower(ownerAddr))

	// ✅ 可选：preflight eth_call，尽早发现 revert 原因
	if strings.TrimSpace(os.Getenv("PREFLIGHT_CALL")) == "1" {
		if err := preflightMintByCastCall(ctx, bookAddr, readerAddr, ownerAddr); err != nil {
			mapMintError(w, err, "")
			return
		}
	}

	txHash, castStderr, err := mintByCastSend(ctx, bookAddr, readerAddr, relayerPriv)
	if err != nil {
		// NotAuthorized 时把当前 relayer 地址写进响应，便于对比“手动 mint 用的地址”
		if err.Error() == "NOT_AUTHORIZED" {
			writeErr(w, "NOT_AUTHORIZED", fmt.Sprintf("合约未授权当前 Relayer。后端实际使用的 relayer 地址: %s；请确保该地址与部署子合约时传入的 relayer 一致（.env 中 PRIVATE_KEY_0 推导出的地址），或用手动 mint 成功的私钥配置 PRIVATE_KEY_0", strings.ToLower(ownerAddr)))
			return
		}
		mapMintError(w, err, castStderr)
		return
	}

	// ✅ 注册合约进统计集合（你之前的逻辑保留）
	if h.RDB != nil {
		_ = h.RDB.SAdd(r.Context(), "vault:nft:contracts", bookAddr).Err()
		_ = h.RDB.HSet(r.Context(), "vault:tx:mint:"+strings.ToLower(txHash),
			"book", bookAddr,
			"reader", readerAddr,
			"relayer", strings.ToLower(ownerAddr), // 字段名不改，值写 owner（方案A）
			"ts", fmt.Sprintf("%d", time.Now().Unix()),
		).Err()
		_ = h.RDB.Expire(r.Context(), "vault:tx:mint:"+strings.ToLower(txHash), 7*24*time.Hour).Err()
		// 一码一领：该码已用于 mint，标记为 used（GetBinding 会据此返回 status=used，仅可查看）
		if codeHash != "" {
			_ = h.RDB.Set(r.Context(), "vault:code:minted:"+codeHash, "1", 0).Err()
			_ = h.RDB.SAdd(r.Context(), "vault:codes:used", codeHash, "0x"+codeHash).Err()
			// 供 GET /api/v1/sku-deadlines-by-reader 按 (contract, reader) 查 code_hash 再算售后截止（key/field 均不用 0x 前缀，与查询一致）
			contractKey := strings.TrimPrefix(bookAddr, "0x")
			readerField := strings.TrimPrefix(readerAddr, "0x")
			_ = h.RDB.HSet(r.Context(), "vault:reader:code:"+contractKey, readerField, codeHash).Err()
		}
	}

	// ✅ Mint 成功后写一次“回响/热力图”；优先用 relayH（含纯真+GeoIP）以便榜单显示城市而非仅“中国”
	if h.RDB != nil {
		ip := extractClientIP(r)
		if h.RelayForEcho != nil {
			go h.RelayForEcho.CaptureEcho(ip)
		} else {
			go (&RelayHandler{RDB: h.RDB}).CaptureEcho(ip)
		}
	}

	writeOK(w, map[string]string{
		"tx_hash":     txHash,
		"book_addr":   bookAddr,
		"reader_addr": readerAddr,
		"relayer":     strings.ToLower(ownerAddr),
	})
}

func deriveAddressFromPriv(privHexNo0x string) (string, error) {
	pk, err := crypto.HexToECDSA(privHexNo0x)
	if err != nil {
		return "", err
	}
	return crypto.PubkeyToAddress(pk.PublicKey).Hex(), nil
}

// ==============================
// preflight: cast call (eth_call) with --from=owner
// ==============================
func preflightMintByCastCall(ctx context.Context, bookAddr, readerAddr, fromAddr string) error {
	castBin := foundryCastPath()
	rpcURL := strings.TrimSpace(os.Getenv("RPC_URL"))
	if rpcURL == "" {
		return errors.New("CONFIG_MISSING")
	}

	cmd := exec.CommandContext(
		ctx,
		castBin,
		"call",
		bookAddr,
		"mint(address)",
		readerAddr,
		"--from", fromAddr,
		"--rpc-url", rpcURL,
	)

	var stdout, stderr strings.Builder
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return parseCastError(stderr.String())
	}
	return nil
}

// ==============================
// send: cast send (signed by owner)
// ==============================
func mintByCastSend(ctx context.Context, bookAddr, readerAddr, privNo0x string) (txHash string, castStderr string, err error) {
	castBin := foundryCastPath()
	rpcURL := strings.TrimSpace(os.Getenv("RPC_URL"))
	if rpcURL == "" {
		return "", "", errors.New("CONFIG_MISSING")
	}

	// --async：只广播并立即返回 tx hash，不等待 receipt，避免 RPC 在等待确认时返回 null 导致 exit 1
	cmd := exec.CommandContext(
		ctx,
		castBin,
		"send",
		bookAddr,
		"mint(address)",
		readerAddr,
		"--private-key", "0x"+privNo0x,
		"--rpc-url", rpcURL,
		"--legacy",
		"--async",
	)

	var stdout, stderr strings.Builder
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if runErr := cmd.Run(); runErr != nil {
		stderrStr := stderr.String()
		stdoutStr := stdout.String()
		log.Printf("[MINT] cast send exit err: %v | stdout: %s | stderr: %s", runErr, stdoutStr, stderrStr)
		// 无论 exit 原因如何：只要 stdout 里已有 transactionHash，说明交易已广播，视为成功（链上可能已确认）
		if hash := extractTxHashFromCastOutput(stdoutStr); hash != "" {
			log.Printf("[MINT] tx hash found in stdout despite exit err, returning success: %s", hash)
			return hash, "", nil
		}
		// "already known" 也表示交易已在内存池
		if strings.Contains(strings.ToLower(stderrStr), "already known") {
			if hash := extractTxHashFromCastOutput(stdoutStr); hash != "" {
				return hash, "", nil
			}
		}
		return "", stderrStr, parseCastError(stderrStr)
	}

	out := stdout.String()
	if hash := extractTxHashFromCastOutput(out); hash != "" {
		return hash, "", nil
	}
	return "", stderr.String(), errors.New("TX_HASH_NOT_FOUND")
}

func extractTxHashFromCastOutput(stdout string) string {
	for _, line := range strings.Split(stdout, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		// --async 时 cast 只打一行 0x... hash
		if strings.HasPrefix(line, "0x") && len(line) == 66 {
			return line
		}
		// 非 async 时可能是 "transactionHash  0x..."
		if strings.HasPrefix(line, "transactionHash") {
			parts := strings.Fields(line)
			if len(parts) >= 2 {
				last := parts[len(parts)-1]
				if strings.HasPrefix(last, "0x") && len(last) == 66 {
					return last
				}
			}
		}
	}
	return ""
}

func foundryCastPath() string {
	if p := strings.TrimSpace(os.Getenv("CAST_BIN")); p != "" {
		return p
	}
	return "cast"
}

// parseCastError: 尽量把 stderr 归一化成你的 API code
func parseCastError(stderr string) error {
	s := strings.ToLower(stderr)

	switch {
	case strings.Contains(s, "already minted"):
		return errors.New("ALREADY_MINTED")
	case strings.Contains(s, "already known"):
		return errors.New("ALREADY_KNOWN")
	case strings.Contains(s, "insufficient funds"):
		return errors.New("INSUFFICIENT_GAS")
	case strings.Contains(s, "nonce"):
		return errors.New("NONCE_ERROR")
	case strings.Contains(s, "notauthorized") || strings.Contains(s, "not authorized"):
		return errors.New("NOT_AUTHORIZED")
	case strings.Contains(s, "revert"):
		return fmt.Errorf("EVM_REVERT: %s", strings.TrimSpace(stderr))
	default:
		return fmt.Errorf("CAST_ERROR: %s", strings.TrimSpace(stderr))
	}
}

// ==============================
// 购买挂售的 NFT（Step 9: buyWithPledge）
// POST /api/v1/nft/buy-listed
// Body: { "contract": "0x...", "token_id": "0" }，后端用 Relayer 私钥调用 buyWithPledge(tokenId)，value=0
// ==============================
func (h *MintHandler) BuyListed(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodPost {
		writeErr(w, "METHOD", "POST only")
		return
	}
	var body struct {
		Contract string `json:"contract"`
		TokenID  string `json:"token_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, "BAD_JSON", "invalid json")
		return
	}
	contract := strings.ToLower(strings.TrimSpace(body.Contract))
	if contract == "" {
		contract = strings.TrimSpace(body.Contract)
	}
	contract = strings.TrimPrefix(contract, "0x")
	if contract == "" || !common.IsHexAddress("0x"+contract) {
		writeErr(w, "BAD_CONTRACT", "missing or invalid contract")
		return
	}
	tokenID := strings.TrimSpace(body.TokenID)
	if tokenID == "" {
		writeErr(w, "BAD_TOKEN_ID", "missing token_id")
		return
	}
	relayerPriv := strings.TrimSpace(os.Getenv("PRIVATE_KEY_0"))
	if relayerPriv == "" {
		relayerPriv = strings.TrimSpace(os.Getenv("RELAYER_PRIVATE_KEY"))
	}
	if relayerPriv == "" {
		relayerPriv = strings.TrimSpace(os.Getenv("PUBLISHER_OWNER_PRIVKEY"))
	}
	relayerPriv = strings.TrimPrefix(relayerPriv, "0x")
	if relayerPriv == "" {
		writeErr(w, "CONFIG_MISSING", "PRIVATE_KEY_0 / RELAYER_PRIVATE_KEY not set")
		return
	}
	rpcURL := strings.TrimSpace(os.Getenv("RPC_URL"))
	if rpcURL == "" {
		writeErr(w, "CONFIG_MISSING", "RPC_URL not set")
		return
	}
	castBin := foundryCastPath()
	bookAddr := "0x" + contract
	cmd := exec.CommandContext(
		r.Context(),
		castBin,
		"send",
		bookAddr,
		"buyWithPledge(uint256)",
		tokenID,
		"--value", "0",
		"--private-key", "0x"+relayerPriv,
		"--rpc-url", rpcURL,
		"--legacy",
		"--async",
	)
	var stdout, stderr strings.Builder
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if runErr := cmd.Run(); runErr != nil {
		stderrStr := stderr.String()
		stdoutStr := stdout.String()
		log.Printf("[BUY_LISTED] cast send err: %v | stderr: %s", runErr, stderrStr)
		if hash := extractTxHashFromCastOutput(stdoutStr); hash != "" {
			writeOK(w, map[string]any{"tx_hash": hash})
			return
		}
		writeErrWithDebug(w, "CAST_FAILED", "buyWithPledge failed", stderrStr)
		return
	}
	hash := extractTxHashFromCastOutput(stdout.String())
	if hash == "" {
		writeErr(w, "TX_HASH_NOT_FOUND", "tx hash not in cast output")
		return
	}
	writeOK(w, map[string]any{"tx_hash": hash})
}

// 二次激活最小金额 1.1 PAS (wei) = 1.1 * 10^18
var secondaryActivateMinWei, _ = new(big.Int).SetString("1100000000000000000", 10)

// GetSecondaryActivateReceiver 返回二次激活时用户应转账的收款地址（须为当前链上的 EOA，否则会 missing revert data）
// GET /api/v1/nft/secondary-activate-receiver
func (h *MintHandler) GetSecondaryActivateReceiver(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.WriteHeader(http.StatusOK)
		return
	}
	addr := strings.TrimSpace(os.Getenv("SECONDARY_ACTIVATE_RECEIVER"))
	if addr == "" {
		addr = strings.TrimSpace(os.Getenv("TREASURY_ADDRESS"))
	}
	if addr != "" && !strings.HasPrefix(addr, "0x") {
		addr = "0x" + addr
	}
	if addr == "" || !common.IsHexAddress(addr) {
		writeErr(w, "NOT_CONFIGURED", "后端未配置 SECONDARY_ACTIVATE_RECEIVER 或 TREASURY_ADDRESS（须为当前链上的 EOA 地址）")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"ok":               true,
		"payment_receiver": strings.ToLower(addr),
	})
}

// SecondaryActivate 用户向子合约/工厂/平台地址转账 1.1 PAS 成功后，后端校验该笔转账并为该钱包铸造新 NFT（无需挂售/非持有者等条件）
// POST /api/v1/nft/secondary-activate
// Body: { "contract": "0x...", "payment_tx_hash": "0x...", "wallet_address": "0x..." }
func (h *MintHandler) SecondaryActivate(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodPost {
		writeErr(w, "METHOD", "POST only")
		return
	}
	var body struct {
		Contract       string `json:"contract"`
		PaymentTxHash  string `json:"payment_tx_hash"`
		WalletAddress string `json:"wallet_address"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, "BAD_JSON", "invalid json")
		return
	}
	contract := strings.ToLower(strings.TrimSpace(body.Contract))
	if !strings.HasPrefix(contract, "0x") {
		contract = "0x" + contract
	}
	if !common.IsHexAddress(contract) {
		writeErr(w, "BAD_CONTRACT", "missing or invalid contract")
		return
	}
	paymentHash := strings.TrimSpace(body.PaymentTxHash)
	if !strings.HasPrefix(paymentHash, "0x") {
		paymentHash = "0x" + paymentHash
	}
	if len(paymentHash) != 66 {
		writeErr(w, "BAD_PAYMENT_TX", "missing or invalid payment_tx_hash")
		return
	}
	walletAddr := strings.ToLower(strings.TrimSpace(body.WalletAddress))
	if !strings.HasPrefix(walletAddr, "0x") {
		walletAddr = "0x" + walletAddr
	}
	if !common.IsHexAddress(walletAddr) {
		writeErr(w, "BAD_WALLET", "missing or invalid wallet_address")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 25*time.Second)
	defer cancel()

	// 防重放：同一笔支付只能用于一次二次激活
	if h.RDB != nil {
		used, _ := h.RDB.Get(ctx, "vault:secondary:payment:"+strings.ToLower(paymentHash)).Result()
		if used != "" {
			writeErr(w, "ALREADY_USED", "该笔转账已用于二次激活，请勿重复提交")
			return
		}
	}

	// 链上校验：该笔交易为 wallet -> contract 转账且 value >= 1.1 ether
	txHash := common.HexToHash(paymentHash)
	tx, _, err := h.Client.TransactionByHash(ctx, txHash)
	if err != nil || tx == nil {
		writeErr(w, "TX_NOT_FOUND", "未找到该笔转账，请确认交易已上链")
		return
	}
	receipt, err := h.Client.TransactionReceipt(ctx, txHash)
	if err != nil || receipt == nil {
		writeErr(w, "TX_PENDING", "该笔转账尚未确认，请稍后再试")
		return
	}
	if receipt.Status != 1 {
		writeErr(w, "TX_FAILED", "该笔转账未成功，无法二次激活")
		return
	}
	if tx.To() == nil {
		writeErr(w, "TX_MISMATCH", "该笔交易不是向合约转账")
		return
	}
	// 允许收款方：子合约、工厂合约、或平台收款地址（Treasury 通常为 EOA，转 PAS 必成功，避免合约无 receive 导致 revert）
	paymentTo := strings.ToLower(tx.To().Hex())
	validTo := paymentTo == contract
	if !validTo {
		if factoryAddr := strings.ToLower(strings.TrimSpace(os.Getenv("FACTORY_ADDR"))); factoryAddr != "" {
			if !strings.HasPrefix(factoryAddr, "0x") {
				factoryAddr = "0x" + factoryAddr
			}
			factoryAddr = strings.ToLower(factoryAddr)
			if paymentTo == factoryAddr {
				validTo = true
			}
		}
	}
	if !validTo {
		for _, envKey := range []string{"SECONDARY_ACTIVATE_RECEIVER", "TREASURY_ADDRESS"} {
			addr := strings.ToLower(strings.TrimSpace(os.Getenv(envKey)))
			if addr != "" {
				if !strings.HasPrefix(addr, "0x") {
					addr = "0x" + addr
				}
				addr = strings.ToLower(addr)
				if paymentTo == addr {
					validTo = true
					break
				}
			}
		}
	}
	if !validTo {
		writeErr(w, "TX_MISMATCH", "该笔转账的收款地址须为子合约、工厂或配置的收款 EOA")
		return
	}
	if tx.Value().Cmp(secondaryActivateMinWei) < 0 {
		writeErr(w, "INSUFFICIENT_VALUE", "转账金额须不少于 1.1 PAS")
		return
	}
	sender, err := types.LatestSignerForChainID(tx.ChainId()).Sender(tx)
	if err != nil {
		writeErr(w, "TX_INVALID", "无法解析转账发起方")
		return
	}
	if strings.ToLower(sender.Hex()) != walletAddr {
		writeErr(w, "WALLET_MISMATCH", "转账发起方与提交的钱包地址不一致")
		return
	}

	// 并发保护 + 执行 mint
	relayerPriv := strings.TrimSpace(os.Getenv("PRIVATE_KEY_0"))
	if relayerPriv == "" {
		relayerPriv = strings.TrimSpace(os.Getenv("RELAYER_PRIVATE_KEY"))
	}
	relayerPriv = strings.TrimPrefix(relayerPriv, "0x")
	if relayerPriv == "" {
		writeErr(w, "CONFIG_MISSING", "PRIVATE_KEY_0 / RELAYER_PRIVATE_KEY not set")
		return
	}
	select {
	case mintSemaphore <- struct{}{}:
		defer func() { <-mintSemaphore }()
	default:
		writeErr(w, "BUSY", "mint 服务繁忙，请稍后重试")
		return
	}

	mintCtx, mintCancel := context.WithTimeout(context.Background(), 35*time.Second)
	defer mintCancel()
	mintHash, stderr, err := mintByCastSend(mintCtx, contract, walletAddr, relayerPriv)
	if err != nil {
		if err.Error() == "NOT_AUTHORIZED" {
			writeErr(w, "NOT_AUTHORIZED", "合约未授权当前 Relayer，无法代铸")
			return
		}
		log.Printf("[SECONDARY_ACTIVATE] mint err: %v stderr: %s", err, stderr)
		writeErrWithDebug(w, "MINT_FAILED", "铸造 NFT 失败", stderr)
		return
	}

	// 标记该笔支付已使用，防重放
	if h.RDB != nil {
		_ = h.RDB.Set(ctx, "vault:secondary:payment:"+strings.ToLower(paymentHash), walletAddr, 0).Err()
	}

	writeOK(w, map[string]any{
		"ok":       true,
		"tx_hash":  mintHash,
		"message":  "二次激活成功，新 NFT 已铸造至您的钱包",
	})
}

// ==============================
// 其他接口（保留，避免破坏 main.go）
// ==============================

func (h *MintHandler) GetTotalMinted(w http.ResponseWriter, r *http.Request) {
	writeOK(w, map[string]int{"total": 0})
}

func (h *MintHandler) GetReaderLocation(w http.ResponseWriter, r *http.Request) {
	writeOK(w, map[string]string{"location": "unknown"})
}

// ==============================
// HTTP 工具
// ==============================

func writeOK(w http.ResponseWriter, data any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"ok":   true,
		"data": data,
	})
}

func writeErr(w http.ResponseWriter, code string, msg string) {
	w.WriteHeader(http.StatusBadRequest)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"ok":    false,
		"code":  code,
		"error": msg,
	})
}

func writeErrWithDebug(w http.ResponseWriter, code string, msg string, castStderr string) {
	body := map[string]any{
		"ok":    false,
		"code":  code,
		"error": msg,
	}
	if castStderr != "" {
		// 截断避免响应过大；DEBUG_CAST=1 时带上完整 stderr 便于排查
		debug := strings.TrimSpace(castStderr)
		if len(debug) > 500 && os.Getenv("DEBUG_CAST") != "1" {
			debug = debug[:500] + "..."
		}
		body["cast_stderr"] = debug
	}
	// "null response" 多为 RPC 问题，加一句排查提示
	if strings.Contains(strings.ToLower(msg), "null response") {
		body["hint"] = "RPC 返回了空：请检查 .env 中 RPC_URL 是否可访问、链是否正确；在服务器上执行 cast chain-id --rpc-url $RPC_URL 和 cast send <book> mint(address) <reader> --rpc-url $RPC_URL --private-key 0x... 复现"
	}
	w.WriteHeader(http.StatusBadRequest)
	_ = json.NewEncoder(w).Encode(body)
}

func mapMintError(w http.ResponseWriter, err error, castStderr string) {
	msg := err.Error()
	switch {
	case msg == "ALREADY_MINTED":
		writeErr(w, "ALREADY_MINTED", "reader already minted this nft")
	case msg == "ALREADY_KNOWN":
		writeErr(w, "ALREADY_KNOWN", "transaction already in mempool, please wait")
	case msg == "INSUFFICIENT_GAS":
		writeErr(w, "INSUFFICIENT_GAS", "signer gas insufficient")
	case msg == "NONCE_ERROR":
		writeErr(w, "NONCE_ERROR", "nonce conflict, retry")
	case msg == "CONFIG_MISSING":
		writeErr(w, "CONFIG_MISSING", "PRIVATE_KEY_0 or RPC_URL not set")
	case msg == "NOT_AUTHORIZED":
		writeErr(w, "NOT_AUTHORIZED", "合约未授权当前 Relayer：部署子合约时传入的 relayer 必须与 PRIVATE_KEY_0 对应地址一致，请检查 .env 中 RELAYER_ADDRESS 与 PRIVATE_KEY_0 是否配对")
	case msg == "TX_HASH_NOT_FOUND":
		writeErr(w, "TX_HASH_NOT_FOUND", "tx hash not found in cast output")
	default:
		if strings.HasPrefix(msg, "EVM_REVERT:") {
			writeErr(w, "REVERT", strings.TrimSpace(strings.TrimPrefix(msg, "EVM_REVERT:")))
			return
		}
		if strings.HasPrefix(msg, "CAST_ERROR:") {
			writeErrWithDebug(w, "CAST_FAILED", strings.TrimSpace(strings.TrimPrefix(msg, "CAST_ERROR:")), castStderr)
			return
		}
		writeErrWithDebug(w, "MINT_FAILED", msg, castStderr)
	}
}

// ==============================
// 从请求里提取客户端真实 IP（用于 GeoIP 定位）
// 移动端扫码时请求若经 CDN/反向代理，必须由代理写入真实 IP，否则会拿到代理 IP 导致定位失败。
// ==============================
func extractClientIP(r *http.Request) string {
	try := func(ip string) string {
		ip = strings.TrimSpace(ip)
		// 去掉 IPv6 的 zone 后缀，如 fe80::1%eth0
		if idx := strings.Index(ip, "%"); idx > 0 {
			ip = ip[:idx]
		}
		if ip != "" && (net.ParseIP(ip) != nil) {
			return ip
		}
		return ""
	}

	// 1) Cloudflare
	if v := try(r.Header.Get("CF-Connecting-IP")); v != "" {
		return v
	}
	// 2) X-Forwarded-For: "client, proxy1, proxy2"（取第一个即真实客户端）
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		for _, part := range strings.Split(xff, ",") {
			if v := try(part); v != "" {
				return v
			}
		}
	}
	// 3) X-Real-IP（Nginx 等常用）
	if v := try(r.Header.Get("X-Real-IP")); v != "" {
		return v
	}
	// 4) True-Client-IP（Akamai 等）
	if v := try(r.Header.Get("True-Client-IP")); v != "" {
		return v
	}
	// 5) fallback: RemoteAddr
	addr := strings.TrimSpace(r.RemoteAddr)
	if host, _, err := net.SplitHostPort(addr); err == nil {
		return host
	}
	return addr
}
