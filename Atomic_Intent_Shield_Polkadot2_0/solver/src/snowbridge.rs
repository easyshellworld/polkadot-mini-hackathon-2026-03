use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{info, warn};
use uuid::Uuid;

use ethers::middleware::SignerMiddleware;
use ethers::providers::{Http, Middleware, Provider};
use ethers::signers::{LocalWallet, Signer};
use ethers::types::{Address, Bytes, TransactionRequest, H256, U256, U64};
use ethers::utils::format_ether;

use crate::config::Config;

type EthSigner = SignerMiddleware<Provider<Http>, LocalWallet>;

/// Snowbridge cross-chain settlement client.
///
/// When `enabled`, connects to Sepolia testnet, holds a funded EVM wallet,
/// and submits real transactions for the bridge leg of cross-chain intents.
#[derive(Clone)]
pub struct SnowbridgeClient {
    signer: Option<Arc<EthSigner>>,
    settlement_address: Address,
    pub enabled: bool,
    chain_id: u64,
    supported_source_chain: String,
    supported_dest_chain: String,
    avg_eta_minutes: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeQuoteRequest {
    pub from_chain: String,
    pub to_chain: String,
    pub from_asset: String,
    pub to_asset: String,
    pub amount_in: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeQuoteResponse {
    pub supported: bool,
    pub route: String,
    pub estimated_eta_minutes: u32,
    pub estimated_amount_out: String,
    pub bridge_fee_bps: u16,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeStatusResponse {
    pub transfer_id: String,
    pub status: String,
    pub stage: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeRedeemRequest {
    pub transfer_id: String,
    pub recipient: String,
    pub target_chain: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeRedeemResponse {
    pub redeem_request_id: String,
    pub transfer_id: String,
    pub status: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeTransferStatus {
    pub tx_hash: String,
    pub status: String,
    pub block_number: Option<u64>,
}

impl SnowbridgeClient {
    /// Create a new client. When `snowbridge_enabled` is false the EVM
    /// provider is skipped and bridge transfers fall back to demo mode.
    pub async fn new(config: &Config) -> Result<Self> {
        let base = Self {
            signer: None,
            settlement_address: Address::zero(),
            enabled: false,
            chain_id: 11155111,
            supported_source_chain: "sepolia".into(),
            supported_dest_chain: "paseo-bridgehub".into(),
            avg_eta_minutes: 30,
        };

        if !config.snowbridge_enabled {
            info!("Snowbridge disabled — bridge settlements use demo mode");
            return Ok(base);
        }

        let provider = Provider::<Http>::try_from(&config.snowbridge_evm_rpc)
            .context("Invalid SNOWBRIDGE_EVM_RPC URL")?;

        let chain_id = match provider
            .get_chainid()
            .await
        {
            Ok(id) => id.as_u64(),
            Err(e) => {
                warn!("Cannot reach SNOWBRIDGE_EVM_RPC: {:?} — Snowbridge disabled", e);
                return Ok(base);
            }
        };
        info!("Snowbridge EVM connected: chain_id={}", chain_id);

        let wallet: LocalWallet = config
            .snowbridge_evm_private_key
            .parse::<LocalWallet>()
            .context("Invalid SNOWBRIDGE_EVM_PRIVATE_KEY")?
            .with_chain_id(chain_id);
        let addr = wallet.address();
        info!("Snowbridge wallet: {:?}", addr);

        let settlement_address: Address = config
            .snowbridge_settlement_address
            .parse()
            .context("Invalid SNOWBRIDGE_SETTLEMENT_ADDRESS")?;

        let signer = SignerMiddleware::new(provider, wallet);

        let bal = signer.get_balance(addr, None).await.unwrap_or_default();
        info!("Snowbridge wallet balance: {} ETH", format_ether(bal));
        if bal.is_zero() {
            warn!("Snowbridge wallet has 0 ETH — bridge txs will fail. Fund it on Sepolia.");
        }

        Ok(Self {
            signer: Some(Arc::new(signer)),
            settlement_address,
            enabled: true,
            chain_id,
            ..base
        })
    }

    /// Submit a real EVM transaction on Sepolia for the bridge leg of a
    /// cross-chain settlement. Sends dust ETH (0.000001) to the settlement
    /// address with `polkashield:settle:<match_id>` in calldata for
    /// Etherscan traceability.
    pub async fn initiate_bridge_transfer(
        &self,
        match_id: &str,
        _token: &str,
        _amount: &str,
    ) -> Result<String> {
        let signer = self
            .signer
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Snowbridge not enabled"))?;

        let calldata = format!("polkashield:settle:{}", match_id);

        let tx = TransactionRequest::new()
            .to(self.settlement_address)
            .value(U256::from(1_000_000_000_000u64)) // 0.000001 ETH
            .data(Bytes::from(calldata.into_bytes()));

        info!(
            "Sending bridge settlement tx for match {} -> {:?}",
            match_id, self.settlement_address
        );

        let pending = signer
            .send_transaction(tx, None)
            .await
            .context("Failed to send Snowbridge EVM transaction")?;

        let tx_hash = format!("{:#x}", pending.tx_hash());
        info!("Bridge tx submitted: {}", tx_hash);

        // Wait up to 60s for 1 confirmation (best-effort)
        match tokio::time::timeout(
            std::time::Duration::from_secs(60),
            pending.confirmations(1),
        )
        .await
        {
            Ok(Ok(Some(receipt))) => {
                let ok = receipt.status.map_or(false, |s| s == U64::from(1));
                if ok {
                    info!(
                        "Bridge tx confirmed block={:?}: {}",
                        receipt.block_number, tx_hash
                    );
                } else {
                    warn!("Bridge tx reverted: {}", tx_hash);
                }
            }
            Ok(Ok(None)) => info!("Bridge receipt not yet available: {}", tx_hash),
            Ok(Err(e)) => warn!("Bridge confirmation error: {:?}", e),
            Err(_) => info!(
                "Bridge confirmation timeout 60s — may still confirm: {}",
                tx_hash
            ),
        }

        Ok(tx_hash)
    }

    /// Query receipt of a previously-submitted bridge tx.
    pub async fn get_transfer_receipt(
        &self,
        tx_hash_str: &str,
    ) -> Result<BridgeTransferStatus> {
        let signer = self
            .signer
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Snowbridge not enabled"))?;

        let hash: H256 = tx_hash_str.parse().context("Invalid tx hash")?;

        match signer.get_transaction_receipt(hash).await? {
            Some(r) => {
                let ok = r.status.map_or(false, |s| s == U64::from(1));
                Ok(BridgeTransferStatus {
                    tx_hash: tx_hash_str.to_string(),
                    status: if ok { "confirmed" } else { "failed" }.to_string(),
                    block_number: r.block_number.map(|b| b.as_u64()),
                })
            }
            None => Ok(BridgeTransferStatus {
                tx_hash: tx_hash_str.to_string(),
                status: "pending".to_string(),
                block_number: None,
            }),
        }
    }

    // ---- API-compatible demo routes ----

    pub fn quote(&self, req: &BridgeQuoteRequest) -> BridgeQuoteResponse {
        let amount_in = req.amount_in.parse::<f64>().unwrap_or(0.0);
        let from_chain = req.from_chain.to_lowercase();
        let to_chain = req.to_chain.to_lowercase();
        let from_asset = req.from_asset.to_lowercase();
        let to_asset = req.to_asset.to_lowercase();

        let (supported, amount_out, route) = if from_chain == self.supported_source_chain
            && to_chain == self.supported_dest_chain
            && from_asset == "eth"
            && to_asset == "weth"
        {
            (true, amount_in * 1000.0, "Snowbridge: Sepolia ETH -> Paseo wETH")
        } else if from_chain == self.supported_dest_chain
            && to_chain == self.supported_source_chain
            && from_asset == "weth"
            && to_asset == "eth"
        {
            (true, amount_in / 1000.0, "Snowbridge: Paseo wETH -> Sepolia ETH")
        } else {
            (false, 0.0, "Unsupported route")
        };

        BridgeQuoteResponse {
            supported,
            route: route.to_string(),
            estimated_eta_minutes: self.avg_eta_minutes,
            estimated_amount_out: format!("{amount_out:.8}"),
            bridge_fee_bps: 30,
            notes: if self.enabled {
                "Live on Sepolia testnet via Snowbridge".to_string()
            } else {
                "Demo quote — enable SNOWBRIDGE_ENABLED for real settlement".to_string()
            },
        }
    }

    pub fn status(&self, transfer_id: &str) -> BridgeStatusResponse {
        BridgeStatusResponse {
            transfer_id: transfer_id.to_string(),
            status: if self.enabled {
                "check_via_api"
            } else {
                "pending"
            }
            .to_string(),
            stage: "relay".to_string(),
            message: if self.enabled {
                "Use GET /v1/bridge/transfer-status/:tx_hash for live EVM status".to_string()
            } else {
                "Snowbridge relayer is processing the cross-chain message".to_string()
            },
        }
    }

    pub fn redeem(&self, req: &BridgeRedeemRequest) -> BridgeRedeemResponse {
        BridgeRedeemResponse {
            redeem_request_id: Uuid::new_v4().to_string(),
            transfer_id: req.transfer_id.clone(),
            status: "queued".to_string(),
            message: format!(
                "Redeem request queued for recipient {} on {}",
                req.recipient, req.target_chain
            ),
        }
    }
}
