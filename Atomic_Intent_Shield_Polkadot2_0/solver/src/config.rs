use anyhow::Result;
use serde::Deserialize;

/// Solver configuration, loaded from environment variables
#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    // Server
    pub host: String,
    pub port: u16,

    // Substrate
    pub substrate_rpc: String,
    pub dark_pool_address: String,
    pub verifier_address: String,

    // Solver identity
    pub solver_seed_phrase: String,

    // Redis
    pub redis_url: String,

    // Auth
    pub jwt_secret: String,
    pub admin_username: String,
    pub admin_password_hash: String,

    // Matching parameters
    pub min_match_amount: u128,
    pub max_slippage_bps: u16,
    pub match_timeout_seconds: u64,
    pub batch_size: usize,

    // Protocol
    pub chain_id: String,
    pub domain_separator: String,

    // Snowbridge (cross-chain EVM settlement)
    pub snowbridge_enabled: bool,
    pub snowbridge_evm_rpc: String,
    pub snowbridge_evm_private_key: String,
    pub snowbridge_settlement_address: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            // Server
            host: std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            port: std::env::var("PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()?,

            // Substrate
            substrate_rpc: std::env::var("SUBSTRATE_RPC")
                .unwrap_or_else(|_| "ws://127.0.0.1:9944".to_string()),
            dark_pool_address: std::env::var("DARK_POOL_ADDRESS")
                .unwrap_or_default(),
            verifier_address: std::env::var("VERIFIER_ADDRESS")
                .unwrap_or_default(),

            // Solver identity
            solver_seed_phrase: std::env::var("SOLVER_SEED_PHRASE")
                .unwrap_or_else(|_| "//Alice".to_string()),

            // Redis
            redis_url: std::env::var("REDIS_URL")
                .unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string()),

            // Auth
            jwt_secret: std::env::var("JWT_SECRET")
                .unwrap_or_else(|_| "dev-secret-change-in-production".to_string()),
            admin_username: std::env::var("ADMIN_USERNAME")
                .unwrap_or_else(|_| "admin".to_string()),
            admin_password_hash: std::env::var("ADMIN_PASSWORD_HASH")
                .unwrap_or_default(),

            // Matching parameters
            min_match_amount: std::env::var("MIN_MATCH_AMOUNT")
                .unwrap_or_else(|_| "0".to_string())
                .parse()?,
            max_slippage_bps: std::env::var("MAX_SLIPPAGE_BPS")
                .unwrap_or_else(|_| "50".to_string())
                .parse()?,
            match_timeout_seconds: std::env::var("MATCH_TIMEOUT_SECONDS")
                .unwrap_or_else(|_| "300".to_string())
                .parse()?,
            batch_size: std::env::var("BATCH_SIZE")
                .unwrap_or_else(|_| "10".to_string())
                .parse()?,

            // Protocol
            chain_id: std::env::var("CHAIN_ID")
                .unwrap_or_else(|_| "polkashield-testnet".to_string()),
            domain_separator: std::env::var("DOMAIN_SEPARATOR")
                .unwrap_or_else(|_| "polkashield-v1".to_string()),

            // Snowbridge
            snowbridge_enabled: std::env::var("SNOWBRIDGE_ENABLED")
                .unwrap_or_else(|_| "false".to_string())
                .parse()
                .unwrap_or(false),
            snowbridge_evm_rpc: std::env::var("SNOWBRIDGE_EVM_RPC")
                .unwrap_or_else(|_| "https://ethereum-sepolia-rpc.publicnode.com".to_string()),
            snowbridge_evm_private_key: std::env::var("SNOWBRIDGE_EVM_PRIVATE_KEY")
                .unwrap_or_default(),
            snowbridge_settlement_address: std::env::var("SNOWBRIDGE_SETTLEMENT_ADDRESS")
                .unwrap_or_else(|_| "0x000000000000000000000000000000000000dEaD".to_string()),
        })
    }
}
