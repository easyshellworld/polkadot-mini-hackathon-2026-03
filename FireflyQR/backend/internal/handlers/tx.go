//查交易结果 + 解析 NFT Mint 成功信息 + 写入 Redis 缓存
package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/gorilla/mux"
)

// ERC721 Transfer(address,address,uint256) 事件签名
const erc721TransferSig = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

// GET /relay/tx/{txHash}
func (h *MintHandler) GetTxResult(w http.ResponseWriter, r *http.Request) {
	txHashStr := strings.TrimPrefix(r.URL.Path, "/relay/tx/")
	txHashStr = strings.TrimSpace(txHashStr)

	txHash := common.HexToHash(txHashStr)

	ctx, cancel := context.WithTimeout(context.Background(), 6*time.Second)
	defer cancel()

	receipt, err := h.Client.TransactionReceipt(ctx, txHash)
	if err != nil {
		writeOK(w, map[string]any{"status": "PENDING"})
		return
	}

	if receipt.Status == types.ReceiptStatusFailed {
		writeOK(w, map[string]any{"status": "FAILED"})
		return
	}

	processedKey := "tx:processed:" + strings.ToLower(txHash.Hex())
	ok, _ := h.RDB.SetNX(ctx, processedKey, 1, 24*time.Hour).Result()
	if !ok {
		data, _ := h.RDB.HGetAll(ctx, "tx:mint:"+strings.ToLower(txHash.Hex())).Result()
		out := map[string]any{
			"status": "SUCCESS", "cached": true,
			"reader": data["reader"], "tokenId": data["token_id"],
			"contract": data["contract"], "txHash": txHash.Hex(),
		}
		if data["block_number"] != "" {
			out["blockNumber"] = data["block_number"]
		}
		if data["block_timestamp"] != "" {
			out["blockTimestamp"] = data["block_timestamp"]
		}
		if data["from"] != "" {
			out["from"] = data["from"]
		}
		if data["to"] != "" {
			out["to"] = data["to"]
		}
		writeOK(w, out)
		return
	}

	// 获取 tx 和 block，用于 from / to / blockTimestamp
	var fromAddr, toAddr string
	var blockTimestamp uint64
	if tx, _, err := h.Client.TransactionByHash(ctx, txHash); err == nil && tx != nil {
		if s, err := types.LatestSignerForChainID(tx.ChainId()).Sender(tx); err == nil {
			fromAddr = strings.ToLower(s.Hex())
		}
		if tx.To() != nil {
			toAddr = strings.ToLower(tx.To().Hex())
		}
	}
	if block, err := h.Client.BlockByNumber(ctx, receipt.BlockNumber); err == nil && block != nil {
		blockTimestamp = block.Time()
	}

	// 交易成功，解析 logs
	for _, lg := range receipt.Logs {
		if len(lg.Topics) != 4 || lg.Topics[0].Hex() != erc721TransferSig {
			continue
		}
		from := common.HexToAddress(lg.Topics[1].Hex())
		to := common.HexToAddress(lg.Topics[2].Hex())
		tokenId := lg.Topics[3].Big()
		if from != (common.Address{}) {
			continue
		}

		contractAddr := strings.ToLower(lg.Address.Hex())
		readerAddr := strings.ToLower(to.Hex())

		_ = h.RDB.HSet(ctx, "reader:nft:"+readerAddr, map[string]any{
			"status": "minted", "token_id": tokenId.String(),
			"contract": contractAddr, "tx_hash": strings.ToLower(txHash.Hex()),
			"block": receipt.BlockNumber.Uint64(), "minted_at": time.Now().Unix(),
		}).Err()

		txMintKey := "tx:mint:" + strings.ToLower(txHash.Hex())
		_ = h.RDB.HSet(ctx, txMintKey, map[string]any{
			"reader": readerAddr, "token_id": tokenId.String(),
			"contract": contractAddr, "status": "success",
			"block_number": strconv.FormatUint(receipt.BlockNumber.Uint64(), 10),
			"block_timestamp": strconv.FormatUint(blockTimestamp, 10),
			"from": fromAddr, "to": toAddr,
		}).Err()

		contractKey := "contract:mints:" + contractAddr
		rec := map[string]any{
			"reader": readerAddr, "token_id": tokenId.String(),
			"tx_hash": strings.ToLower(txHash.Hex()),
			"block": receipt.BlockNumber.Uint64(), "minted_at": time.Now().Unix(),
		}
		if b, err := json.Marshal(rec); err == nil {
			_ = h.RDB.LPush(ctx, contractKey, string(b)).Err()
			_ = h.RDB.LTrim(ctx, contractKey, 0, 499).Err()
		}

		writeOK(w, map[string]any{
			"status":         "SUCCESS",
			"reader":         to.Hex(),
			"tokenId":       tokenId.String(),
			"contract":      lg.Address.Hex(),
			"txHash":        txHash.Hex(),
			"blockNumber":   receipt.BlockNumber.Uint64(),
			"blockTimestamp": blockTimestamp,
			"from":          fromAddr,
			"to":            toAddr,
		})
		return
	}

	// 理论上不会走到这里（成功但没 Transfer）
	writeOK(w, map[string]any{
		"status": "SUCCESS",
	})
}

// GetContractMints 返回指定 SKU 子合约的链上 NFT 领取记录（从 Redis 索引读取）
// GET /api/v1/nft/contract/{address}/mints?limit=100
func (h *MintHandler) GetContractMints(w http.ResponseWriter, r *http.Request) {
	address := strings.ToLower(strings.TrimSpace(mux.Vars(r)["address"]))
	if address == "" || !strings.HasPrefix(address, "0x") || len(address) != 42 {
		writeOK(w, map[string]any{"ok": false, "error": "invalid contract address"})
		return
	}

	limit := 100
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, _ := strconv.Atoi(l); n > 0 && n <= 500 {
			limit = n
		}
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	key := "contract:mints:" + address
	vals, err := h.RDB.LRange(ctx, key, 0, int64(limit-1)).Result()
	if err != nil {
		writeOK(w, map[string]any{"ok": false, "error": err.Error(), "mints": []any{}})
		return
	}

	mints := make([]map[string]any, 0, len(vals))
	for _, s := range vals {
		var rec map[string]any
		if json.Unmarshal([]byte(s), &rec) == nil {
			mints = append(mints, rec)
		}
	}

	writeOK(w, map[string]any{
		"ok":       true,
		"contract": address,
		"mints":    mints,
	})
}

// GetContractOwners 返回指定子合约下所有领取过 NFT 的钱包地址（去重），与链上 totalSales + ownerOf(0..N-1) 等价，数据来自扫块写入的 Redis Set
// GET /api/v1/nft/contract/{address}/owners
func (h *MintHandler) GetContractOwners(w http.ResponseWriter, r *http.Request) {
	address := strings.ToLower(strings.TrimSpace(mux.Vars(r)["address"]))
	if address == "" || !strings.HasPrefix(address, "0x") || len(address) != 42 {
		writeOK(w, map[string]any{"ok": false, "error": "invalid contract address"})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	key := "vault:stats:nft:" + address + ":minters:set"
	owners, err := h.RDB.SMembers(ctx, key).Result()
	if err != nil {
		writeOK(w, map[string]any{"ok": false, "error": err.Error(), "owners": []string{}})
		return
	}

	writeOK(w, map[string]any{
		"ok":       true,
		"contract": address,
		"owners":   owners,
		"count":    len(owners),
	})
}
