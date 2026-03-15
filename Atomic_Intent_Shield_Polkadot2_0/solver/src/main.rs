use anyhow::Result;
use tracing::info;
use tracing_subscriber::EnvFilter;

mod api;
mod auth;
mod config;
mod matcher;
mod models;
mod snowbridge;
mod storage;
mod substrate;
mod utils;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("atomic_intent_polkadot_solver=info".parse()?))
        .json()
        .init();

    // Load configuration
    dotenvy::dotenv().ok();
    let config = config::Config::from_env()?;

    info!("Starting Atomic Intent for Polkadot Solver v{}", env!("CARGO_PKG_VERSION"));
    info!("Substrate RPC: {}", config.substrate_rpc);
    info!("Redis URL: {}", config.redis_url);

    // Initialize storage (Redis)
    let storage = storage::Storage::new(&config.redis_url).await?;

    // Initialize Substrate client
    let substrate_client = substrate::SubstrateClient::new(&config).await?;

    // Build application state
    let state = api::AppState {
        config: config.clone(),
        storage,
        substrate_client,
        snowbridge_client: snowbridge::SnowbridgeClient::new(&config).await?,
    };

    // Build router
    let app = api::create_router(state);

    // Start server
    let bind_addr = format!("{}:{}", config.host, config.port);
    info!("Solver listening on {}", bind_addr);

    let listener = tokio::net::TcpListener::bind(&bind_addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
