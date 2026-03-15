use anyhow::{Context, Result};
use ethers::abi::{decode, encode, ParamType, Token};
use ethers::middleware::SignerMiddleware;
use ethers::providers::{Http, Middleware, Provider};
use ethers::signers::{LocalWallet, Signer};
use ethers::types::{Address, BlockNumber, Bytes, H256, NameOrAddress, TransactionRequest};
use std::sync::Arc;
use std::time::Duration;
use tracing::{info, warn};

use crate::config::Config;

#[derive(Clone)]
pub struct SubstrateClient {
    rpc_url: String,
    dark_pool_address: Address,
    client: Arc<SignerMiddleware<Provider<Http>, LocalWallet>>,
}

impl SubstrateClient {
    pub async fn new(config: &Config) -> Result<Self> {
        let rpc_url = config.substrate_rpc.clone();
        let provider = Provider::<Http>::try_from(rpc_url.as_str())
            .context("Invalid EVM RPC URL")?
            .interval(Duration::from_millis(300));

        let key_hex = std::env::var("SOLVER_PRIVATE_KEY")
            .ok()
            .filter(|v| !v.trim().is_empty())
            .or_else(|| {
                std::env::var("SNOWBRIDGE_EVM_PRIVATE_KEY")
                    .ok()
                    .filter(|v| !v.trim().is_empty())
            });

        let wallet: LocalWallet = if let Some(k) = key_hex {
            k.parse().context("Invalid EVM private key format")?
        } else {
            warn!("SOLVER_PRIVATE_KEY not set; using fallback dev key for startup-only mode");
            "0x59c6995e998f97a5a0044966f0945387dc9e86dae88f2f9f8f3f8f5dbb5f5d4d"
                .parse()
                .context("Invalid fallback EVM private key format")?
        };

        let chain_id = match provider
            .get_chainid()
            .await
        {
            Ok(id) => id.as_u64(),
            Err(err) => {
                warn!("Failed to fetch chain id from EVM RPC ({}); using fallback chain id 11155111", err);
                11155111
            }
        };
        let wallet = wallet.with_chain_id(chain_id);

        let dark_pool_address: Address = match config.dark_pool_address.parse() {
            Ok(addr) => addr,
            Err(_) => {
                warn!(
                    "Invalid DARK_POOL_ADDRESS '{}'; using zero-address fallback",
                    config.dark_pool_address
                );
                Address::zero()
            }
        };

        info!("Connecting to EVM RPC: {}", rpc_url);
        info!("DarkPool address: {:?}", dark_pool_address);
        info!("Solver wallet: {:?}", wallet.address());

        let client = Arc::new(SignerMiddleware::new(provider, wallet));

        Ok(Self {
            rpc_url,
            dark_pool_address,
            client,
        })
    }

    pub async fn submit_intent_onchain(
        &self,
        user: Address,
        recipient: Address,
        intent_hash: &[u8; 32],
        nullifier: &[u8; 32],
        token_in: Address,
        token_out: Address,
        amount_in: ethers::types::U256,
        min_amount_out: ethers::types::U256,
        proof_data: &[u8],
        public_inputs: &[u8],
        deadline: u64,
    ) -> Result<String> {
        let selector = ethers::utils::id("submitIntent((address,address,bytes32,bytes32,address,address,uint256,uint256,bytes,bytes,uint64))");
        let payload = encode(&[Token::Tuple(vec![
            Token::Address(user),
            Token::Address(recipient),
            Token::FixedBytes(intent_hash.to_vec()),
            Token::FixedBytes(nullifier.to_vec()),
            Token::Address(token_in),
            Token::Address(token_out),
            Token::Uint(amount_in),
            Token::Uint(min_amount_out),
            Token::Bytes(proof_data.to_vec()),
            Token::Bytes(public_inputs.to_vec()),
            Token::Uint(deadline.into()),
        ])]);

        let mut data = selector[..4].to_vec();
        data.extend_from_slice(&payload);

        self.send_tx(Bytes::from(data), "submitIntent").await
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn settle_match_onchain(
        &self,
        _intent_a_hash_hex: &str,
        intent_a_nullifier_hex: &str,
        _intent_a_proof_data: &[u8],
        _intent_a_public_inputs: &[String],
        _intent_b_hash_hex: &str,
        intent_b_nullifier_hex: &str,
        _intent_b_proof_data: &[u8],
        _intent_b_public_inputs: &[String],
        _direct_swap: bool,
    ) -> Result<String> {
        let null_a = parse_h256(intent_a_nullifier_hex)?;
        let null_b = parse_h256(intent_b_nullifier_hex)?;

        let selector = ethers::utils::id("settleMatch(bytes32,bytes32)");
        let payload = encode(&[
            Token::FixedBytes(null_a.0.to_vec()),
            Token::FixedBytes(null_b.0.to_vec()),
        ]);

        let mut data = selector[..4].to_vec();
        data.extend_from_slice(&payload);

        self.send_tx(Bytes::from(data), "settleMatch").await
    }

    pub async fn get_intent_status_onchain(&self, nullifier: &[u8; 32]) -> Result<Option<u8>> {
        let selector = ethers::utils::id("getIntentStatus(bytes32)");
        let payload = encode(&[Token::FixedBytes(nullifier.to_vec())]);
        let mut data = selector[..4].to_vec();
        data.extend_from_slice(&payload);

        let req = TransactionRequest::new()
            .to(NameOrAddress::Address(self.dark_pool_address))
            .data(Bytes::from(data));

        let raw = self
            .client
            .provider()
            .call(&req.clone().into(), None)
            .await
            .context("Failed to call getIntentStatus")?;

        let decoded = decode(&[ParamType::Uint(8)], &raw)
            .context("Failed to decode getIntentStatus result")?;

        match decoded.first() {
            Some(Token::Uint(v)) => Ok(Some(v.as_u32() as u8)),
            _ => Ok(None),
        }
    }

    pub async fn subscribe_events(&self) -> Result<()> {
        info!("EVM mode: subscribe_events is not implemented in solver runtime");
        Ok(())
    }

    pub async fn get_current_timestamp(&self) -> Result<u64> {
        let block = self
            .client
            .provider()
            .get_block(BlockNumber::Latest)
            .await
            .context("Failed to query latest block")?
            .context("Latest block not found")?;
        Ok(block.timestamp.as_u64())
    }

    async fn send_tx(&self, data: Bytes, label: &str) -> Result<String> {
        let tx = TransactionRequest::new()
            .to(NameOrAddress::Address(self.dark_pool_address))
            .data(data);

        let pending = self
            .client
            .send_transaction(tx, None)
            .await
            .with_context(|| format!("Failed to send {} tx", label))?;

        let tx_hash = pending.tx_hash();
        let _ = pending
            .confirmations(1)
            .await
            .with_context(|| format!("Failed while waiting {} confirmation", label))?;

        Ok(format!("0x{}", hex::encode(tx_hash.0)))
    }

    #[allow(dead_code)]
    pub fn rpc_url(&self) -> &str {
        &self.rpc_url
    }
}

fn parse_h256(value: &str) -> Result<H256> {
    let trimmed = value.trim();
    let with_prefix = if trimmed.starts_with("0x") || trimmed.starts_with("0X") {
        trimmed.to_string()
    } else {
        format!("0x{}", trimmed)
    };
    with_prefix.parse::<H256>().context("Invalid bytes32 hex value")
}
