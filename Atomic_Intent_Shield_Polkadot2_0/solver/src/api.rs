use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use redis::AsyncCommands;
use std::sync::Arc;
use std::time::Instant;
use std::str::FromStr;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use uuid::Uuid;
use ethers::types::{Address, U256};

use crate::config::Config;
use crate::matcher::Matcher;
use crate::models::*;
use crate::snowbridge::{
    BridgeQuoteRequest, BridgeRedeemRequest, SnowbridgeClient,
};
use crate::storage::Storage;
use crate::substrate::SubstrateClient;

const PAS_NATIVE_MARKER: &str = "PAS_NATIVE";

/// Shared application state
#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub storage: Storage,
    pub substrate_client: SubstrateClient,
    pub snowbridge_client: SnowbridgeClient,
}

/// Create the Axum router with all routes
pub fn create_router(state: AppState) -> Router {
    let state = Arc::new(state);
    let start_time = Instant::now();

    Router::new()
        // Health
        .route("/health", get({
            let start = start_time;
            move |s: State<Arc<AppState>>| health_handler(s, start)
        }))
        .route("/v1/health", get({
            let start = start_time;
            move |s: State<Arc<AppState>>| health_handler(s, start)
        }))
        // Intents
        .route("/v1/intents", post(submit_intent_handler))
        .route("/intent", post(submit_intent_handler)) // legacy alias
        .route("/v1/intents/:nullifier", get(query_intent_handler))
        .route("/intent/:nullifier", get(query_intent_handler)) // legacy alias
        .route("/v1/intents/:nullifier/cancel", post(cancel_intent_handler))
        // Matching
        .route("/v1/matches/:match_id/confirm", post(confirm_match_handler))
        // Pending & Stats
        .route("/v1/intents/pending", get(pending_intents_handler))
        .route("/intents/pending", get(pending_intents_handler)) // legacy alias
        .route("/v1/intents/recent", get(recent_intents_handler))
        .route("/v1/stats", get(stats_handler))
        .route("/stats", get(stats_handler)) // legacy alias
        // Auth
        .route("/v1/auth/login", post(login_handler))
        // Snowbridge cross-chain endpoints
        .route("/v1/bridge/quote", post(bridge_quote_handler))
        .route("/v1/bridge/status/:transfer_id", get(bridge_status_handler))
        .route("/v1/bridge/transfer-status/:tx_hash", get(bridge_transfer_status_handler))
        .route("/v1/bridge/redeem", post(bridge_redeem_handler))
        // Middleware
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

// ========== Handlers ==========

async fn health_handler(
    State(state): State<Arc<AppState>>,
    start_time: Instant,
) -> impl IntoResponse {
    let stats = state.storage.get_stats().await.unwrap_or(SolverStats {
        pending_intents: 0,
        matched_pairs: 0,
    });

    Json(HealthResponse {
        status: "healthy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        uptime_seconds: start_time.elapsed().as_secs(),
        pending_intents: stats.pending_intents,
        matched_pairs: stats.matched_pairs,
    })
}

async fn submit_intent_handler(
    State(state): State<Arc<AppState>>,
    Json(req): Json<SubmitIntentRequest>,
) -> impl IntoResponse {
    let correlation_id = Uuid::new_v4().to_string();

    // Validate request
    if req.intent_hash.is_empty() || req.nullifier.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "success": false,
                "error": "Missing required fields",
                "code": "INVALID_REQUEST",
                "correlation_id": correlation_id,
            })),
        );
    }

    // Check deadline
    let now = chrono::Utc::now().timestamp() as u64;
    if req.public_inputs.deadline > 0 && req.public_inputs.deadline < now {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "success": false,
                "error": "Intent has already expired",
                "code": "INTENT_EXPIRED",
                "correlation_id": correlation_id,
            })),
        );
    }

    // Check duplicate
    if state.storage.get_intent(&req.nullifier).await.is_ok() {
        return (
            StatusCode::CONFLICT,
            Json(serde_json::json!({
                "success": false,
                "error": "Intent with this nullifier already exists",
                "code": "DUPLICATE_INTENT",
                "correlation_id": correlation_id,
            })),
        );
    }

    let normalized_token_in = normalize_token_symbol(&req.public_inputs.token_in);
    let normalized_token_out = normalize_token_symbol(&req.public_inputs.token_out);

    // Enforce on-chain source of truth before intent enters local matching queue.
    let intent_hash_bytes = match parse_hex_32(&req.intent_hash) {
        Ok(v) => v,
        Err(msg) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "success": false,
                    "error": msg,
                    "code": "INVALID_INTENT_HASH",
                    "correlation_id": correlation_id,
                })),
            );
        }
    };

    let nullifier_bytes = match parse_hex_32(&req.nullifier) {
        Ok(v) => v,
        Err(msg) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "success": false,
                    "error": msg,
                    "code": "INVALID_NULLIFIER",
                    "correlation_id": correlation_id,
                })),
            );
        }
    };

    let proof_bytes = match encode_field_elements_32(&req.proof_data) {
        Ok(v) => v,
        Err(msg) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "success": false,
                    "error": msg,
                    "code": "INVALID_PROOF_DATA",
                    "correlation_id": correlation_id,
                })),
            );
        }
    };

    let onchain_public_inputs = match build_onchain_public_inputs_from_submit(&req) {
        Ok(v) => v,
        Err(msg) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "success": false,
                    "error": msg,
                    "code": "INVALID_PUBLIC_INPUTS",
                    "correlation_id": correlation_id,
                })),
            );
        }
    };

    let onchain_user = match parse_evm_address(&req.public_inputs.user) {
        Ok(v) => v,
        Err(msg) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "success": false,
                    "error": msg,
                    "code": "INVALID_USER_ADDRESS",
                    "correlation_id": correlation_id,
                })),
            );
        }
    };

    let recipient_input = if req.public_inputs.recipient.trim().is_empty() {
        req.public_inputs.user.as_str()
    } else {
        req.public_inputs.recipient.as_str()
    };

    let onchain_recipient = match parse_evm_address(recipient_input) {
        Ok(v) => v,
        Err(msg) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "success": false,
                    "error": msg,
                    "code": "INVALID_RECIPIENT_ADDRESS",
                    "correlation_id": correlation_id,
                })),
            );
        }
    };

    let onchain_token_in = match parse_evm_address(&req.public_inputs.token_in) {
        Ok(v) => v,
        Err(msg) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "success": false,
                    "error": msg,
                    "code": "INVALID_TOKEN_IN_ADDRESS",
                    "correlation_id": correlation_id,
                })),
            );
        }
    };

    let onchain_token_out = match parse_evm_address(&req.public_inputs.token_out) {
        Ok(v) => v,
        Err(msg) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "success": false,
                    "error": msg,
                    "code": "INVALID_TOKEN_OUT_ADDRESS",
                    "correlation_id": correlation_id,
                })),
            );
        }
    };

    let amount_in_u256 = match parse_u256_from_string(&req.public_inputs.amount_in) {
        Ok(v) => v,
        Err(msg) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "success": false,
                    "error": msg,
                    "code": "INVALID_AMOUNT_IN",
                    "correlation_id": correlation_id,
                })),
            );
        }
    };

    let min_amount_out_u256 = match parse_u256_from_string(&req.public_inputs.min_amount_out) {
        Ok(v) => v,
        Err(msg) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "success": false,
                    "error": msg,
                    "code": "INVALID_MIN_AMOUNT_OUT",
                    "correlation_id": correlation_id,
                })),
            );
        }
    };

    let submit_tx_hash = match state
        .substrate_client
        .submit_intent_onchain(
            onchain_user,
            onchain_recipient,
            &intent_hash_bytes,
            &nullifier_bytes,
            onchain_token_in,
            onchain_token_out,
            amount_in_u256,
            min_amount_out_u256,
            &proof_bytes,
            &onchain_public_inputs,
            req.public_inputs.deadline,
        )
        .await
    {
        Ok(tx) => tx,
        Err(e) => {
            tracing::warn!("on-chain submit_intent failed for {}: {:?}", req.nullifier, e);
            return (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({
                    "success": false,
                    "error": "Failed to submit intent on-chain",
                    "code": "ONCHAIN_SUBMIT_FAILED",
                    "error_detail": format!("{:?}", e),
                    "correlation_id": correlation_id,
                })),
            );
        }
    };

    // Store intent
    let intent_id = Uuid::new_v4();
    let stored = StoredIntent {
        id: intent_id,
        intent_hash: req.intent_hash,
        nullifier: req.nullifier.clone(),
        user: req.public_inputs.user.clone(),
        recipient: recipient_input.to_string(),
        token_in: normalized_token_in,
        token_out: normalized_token_out,
        amount_in: req.public_inputs.amount_in.clone(),
        min_amount_out: req.public_inputs.min_amount_out.clone(),
        deadline: req.public_inputs.deadline,
        nonce: req.public_inputs.nonce,
        status: IntentStatusModel::Pending,
        proof_data: req.proof_data,
        proof_public_inputs: req.proof_public_inputs,
        encrypted_details: req.encrypted_details,
        signature: req.signature,
        created_at: chrono::Utc::now(),
        matched_with: None,
        settlement_tx_hash: None,
        bridge_tx_hash: None,
    };

    if let Err(_e) = state.storage.store_intent(&stored).await {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "success": false,
                "error": "Failed to store intent",
                "code": "STORAGE_ERROR",
                "correlation_id": correlation_id,
            })),
        );
    }

    // Trigger matching engine after storing the new intent.
    let pending_intents = match state.storage.get_pending_intents().await {
        Ok(intents) => intents,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "success": false,
                    "error": "Failed to load pending intents",
                    "code": "MATCHER_INPUT_ERROR",
                    "correlation_id": correlation_id,
                })),
            );
        }
    };

    let matcher = Matcher::new();
    if let Some(matched_pair) = matcher.try_match(&stored, &pending_intents) {
        if state.storage.store_match(&matched_pair).await.is_err()
            || state
                .storage
                .mark_matched(&matched_pair.intent_a.nullifier, &matched_pair.intent_b.nullifier)
                .await
                .is_err()
            || state
                .storage
                .mark_matched(&matched_pair.intent_b.nullifier, &matched_pair.intent_a.nullifier)
                .await
                .is_err()
        {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "success": false,
                    "error": "Failed to persist match",
                    "code": "MATCH_STORE_ERROR",
                    "correlation_id": correlation_id,
                })),
            );
        }

        // Auto-settlement: attempt on-chain settlement asynchronously
        let settlement_state = state.clone();
        let pair_a_nullifier = matched_pair.intent_a.nullifier.clone();
        let pair_b_nullifier = matched_pair.intent_b.nullifier.clone();
        let counterparty_nullifier = matched_pair.intent_b.nullifier.clone();
        let is_cross_chain = is_cross_chain_intent(&matched_pair.intent_a)
            || is_cross_chain_intent(&matched_pair.intent_b);
        let match_id_str = matched_pair.match_id.to_string();
        tokio::spawn(async move {
            tracing::info!("Auto-settlement started for match {}", match_id_str);
            let proof_a = match encode_field_elements_32(&matched_pair.intent_a.proof_data) {
                Ok(v) => v,
                Err(e) => {
                    tracing::warn!("Auto-settlement encode proof A failed: {}", e);
                    return;
                }
            };
            let proof_b = match encode_field_elements_32(&matched_pair.intent_b.proof_data) {
                Ok(v) => v,
                Err(e) => {
                    tracing::warn!("Auto-settlement encode proof B failed: {}", e);
                    return;
                }
            };

            match settlement_state
                .substrate_client
                .settle_match_onchain(
                    &matched_pair.intent_a.intent_hash,
                    &matched_pair.intent_a.nullifier,
                    &proof_a,
                    &matched_pair.intent_a.proof_public_inputs,
                    &matched_pair.intent_b.intent_hash,
                    &matched_pair.intent_b.nullifier,
                    &proof_b,
                    &matched_pair.intent_b.proof_public_inputs,
                    true,
                )
                .await
            {
                Ok(tx_hash) => {
                    tracing::info!(
                        "Settlement succeeded for match {}: tx={}",
                        match_id_str,
                        tx_hash
                    );

                    // For cross-chain intents, submit real bridge transfer via Snowbridge
                    let bridge_tx = if is_cross_chain {
                        match settlement_state
                            .snowbridge_client
                            .initiate_bridge_transfer(&match_id_str, "ETH", "0")
                            .await
                        {
                            Ok(hash) => {
                                tracing::info!(
                                    "Cross-chain bridge tx for match {}: {}",
                                    match_id_str,
                                    hash
                                );
                                Some(hash)
                            }
                            Err(e) => {
                                tracing::warn!(
                                    "Bridge transfer failed for match {}: {:?}",
                                    match_id_str,
                                    e
                                );
                                None
                            }
                        }
                    } else {
                        None
                    };

                    // Mark both intents as settled
                    let _ = settlement_state
                        .storage
                        .mark_settled_with_bridge(
                            &pair_a_nullifier,
                            &tx_hash,
                            bridge_tx.as_deref(),
                        )
                        .await;
                    let _ = settlement_state
                        .storage
                        .mark_settled_with_bridge(
                            &pair_b_nullifier,
                            &tx_hash,
                            bridge_tx.as_deref(),
                        )
                        .await;
                }
                Err(e) => {
                    tracing::warn!(
                        "Settlement failed for match {}: {:?}",
                        match_id_str,
                        e
                    );
                    // Intents remain in matched status — can retry later
                }
            }
        });

        return (
            StatusCode::OK,
            Json(serde_json::json!({
                "intent_id": intent_id.to_string(),
                "status": "matched",
                "code": "MATCH_FOUND",
                "match_id": matched_pair.match_id.to_string(),
                "counterparty_nullifier": counterparty_nullifier,
                "settlement_status": "settling",
                "onchain_submit_tx_hash": submit_tx_hash,
                "correlation_id": correlation_id,
            })),
        );
    }

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "intent_id": intent_id.to_string(),
            "status": "pending",
            "code": "PENDING_NO_MATCH",
            "message": "Intent accepted and queued; no compatible counterparty yet.",
            "estimated_match_time": "< 30 seconds",
            "onchain_submit_tx_hash": submit_tx_hash,
            "correlation_id": correlation_id,
        })),
    )
}

fn normalize_token_symbol(input: &str) -> String {
    let trimmed = input.trim();
    if trimmed.eq_ignore_ascii_case("pas")
        || trimmed.eq_ignore_ascii_case("native_pas")
        || trimmed.eq_ignore_ascii_case(PAS_NATIVE_MARKER)
    {
        return PAS_NATIVE_MARKER.to_string();
    }
    trimmed.to_string()
}

async fn query_intent_handler(
    State(state): State<Arc<AppState>>,
    Path(nullifier): Path<String>,
) -> impl IntoResponse {
    match state.storage.get_intent(&nullifier).await {
        Ok(intent) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "intent": {
                    "id": intent.id.to_string(),
                    "nullifier": intent.nullifier,
                    "status": intent.status,
                    "created_at": intent.created_at.to_rfc3339(),
                    "matched_with": intent.matched_with,
                    "settlement_tx_hash": intent.settlement_tx_hash,
                    "bridge_tx_hash": intent.bridge_tx_hash,
                }
            })),
        ),
        Err(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "success": false,
                "error": "Intent not found",
                "code": "INTENT_NOT_FOUND",
            })),
        ),
    }
}

async fn cancel_intent_handler(
    State(state): State<Arc<AppState>>,
    Path(nullifier): Path<String>,
) -> impl IntoResponse {
    match state.storage.cancel_intent(&nullifier).await {
        Ok(_) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "success": true,
                "nullifier": nullifier,
                "status": "cancelled",
            })),
        ),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "success": false,
                "error": e.to_string(),
                "code": "CANCEL_FAILED",
            })),
        ),
    }
}

async fn confirm_match_handler(
    State(state): State<Arc<AppState>>,
    Path(match_id): Path<String>,
) -> impl IntoResponse {
    // Look up the match from storage and trigger settlement
    let match_key = format!("polkashield:match:{}", match_id);
    let mut conn = state.storage.pool_clone();
    let match_json: Result<String, _> = conn.get(&match_key).await;

    match match_json {
        Ok(json) => {
            match serde_json::from_str::<MatchedPair>(&json) {
                Ok(matched_pair) => {
                    let settlement_state = (*state).clone();
                    let mid = match_id.clone();
                    let is_cross = is_cross_chain_intent(&matched_pair.intent_a)
                        || is_cross_chain_intent(&matched_pair.intent_b);
                    tokio::spawn(async move {
                        let proof_a = match encode_field_elements_32(&matched_pair.intent_a.proof_data) {
                            Ok(v) => v,
                            Err(e) => {
                                tracing::warn!("Manual settlement encode proof A failed: {}", e);
                                return;
                            }
                        };
                        let proof_b = match encode_field_elements_32(&matched_pair.intent_b.proof_data) {
                            Ok(v) => v,
                            Err(e) => {
                                tracing::warn!("Manual settlement encode proof B failed: {}", e);
                                return;
                            }
                        };
                        match settlement_state
                            .substrate_client
                            .settle_match_onchain(
                                &matched_pair.intent_a.intent_hash,
                                &matched_pair.intent_a.nullifier,
                                &proof_a,
                                &matched_pair.intent_a.proof_public_inputs,
                                &matched_pair.intent_b.intent_hash,
                                &matched_pair.intent_b.nullifier,
                                &proof_b,
                                &matched_pair.intent_b.proof_public_inputs,
                                true,
                            )
                            .await
                        {
                            Ok(tx_hash) => {
                                tracing::info!("Manual settlement for match {}: tx={}", mid, tx_hash);
                                let bridge_tx = if is_cross {
                                    match settlement_state
                                        .snowbridge_client
                                        .initiate_bridge_transfer(&mid, "ETH", "0")
                                        .await
                                    {
                                        Ok(h) => Some(h),
                                        Err(e) => {
                                            tracing::warn!("Bridge transfer failed: {:?}", e);
                                            None
                                        }
                                    }
                                } else {
                                    None
                                };
                                let _ = settlement_state
                                    .storage
                                    .mark_settled_with_bridge(
                                        &matched_pair.intent_a.nullifier,
                                        &tx_hash,
                                        bridge_tx.as_deref(),
                                    )
                                    .await;
                                let _ = settlement_state
                                    .storage
                                    .mark_settled_with_bridge(
                                        &matched_pair.intent_b.nullifier,
                                        &tx_hash,
                                        bridge_tx.as_deref(),
                                    )
                                    .await;
                            }
                            Err(e) => {
                                tracing::warn!("Manual settlement failed for match {}: {:?}", mid, e);
                            }
                        }
                    });

                    (
                        StatusCode::OK,
                        Json(serde_json::json!({
                            "success": true,
                            "match_id": match_id,
                            "status": "settling",
                        })),
                    )
                }
                Err(_) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({
                        "success": false,
                        "error": "Failed to parse match data",
                    })),
                ),
            }
        }
        Err(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "success": false,
                "error": "Match not found",
            })),
        ),
    }
}

async fn pending_intents_handler(
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    match state.storage.get_pending_intents().await {
        Ok(intents) => {
            let summaries: Vec<serde_json::Value> = intents
                .iter()
                .map(|i| {
                    serde_json::json!({
                        "id": i.id.to_string(),
                        "nullifier": i.nullifier,
                        "status": i.status,
                        "created_at": i.created_at.to_rfc3339(),
                        "token_in": i.token_in,
                        "token_out": i.token_out,
                        "amount_in": i.amount_in,
                        "min_amount_out": i.min_amount_out,
                    })
                })
                .collect();
            (StatusCode::OK, Json(serde_json::json!(summaries)))
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "success": false,
                "error": "Failed to retrieve pending intents",
                "code": "QUERY_ERROR",
            })),
        ),
    }
}

async fn stats_handler(
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    match state.storage.get_stats().await {
        Ok(stats) => Json(serde_json::json!(stats)),
        Err(_) => Json(serde_json::json!({
            "pending_intents": 0,
            "matched_pairs": 0,
        })),
    }
}

async fn recent_intents_handler(
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    match state.storage.get_recent_intents(20).await {
        Ok(intents) => {
            let summaries: Vec<serde_json::Value> = intents
                .iter()
                .map(|i| {
                    serde_json::json!({
                        "id": i.id.to_string(),
                        "nullifier": i.nullifier,
                        "status": i.status,
                        "created_at": i.created_at.to_rfc3339(),
                        "token_in": i.token_in,
                        "token_out": i.token_out,
                        "amount_in": i.amount_in,
                        "min_amount_out": i.min_amount_out,
                        "matched_with": i.matched_with,
                        "settlement_tx_hash": i.settlement_tx_hash,
                        "bridge_tx_hash": i.bridge_tx_hash,
                    })
                })
                .collect();
            (StatusCode::OK, Json(serde_json::json!(summaries)))
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "success": false,
                "error": "Failed to retrieve recent intents",
                "code": "QUERY_ERROR",
            })),
        ),
    }
}

async fn login_handler(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<LoginRequest>,
) -> impl IntoResponse {
    // TODO: Implement proper authentication
    let _ = req;
    (
        StatusCode::OK,
        Json(serde_json::json!({
            "token": "placeholder-jwt-token",
            "expires_in": 3600,
        })),
    )
}

async fn bridge_quote_handler(
    State(state): State<Arc<AppState>>,
    Json(req): Json<BridgeQuoteRequest>,
) -> impl IntoResponse {
    let quote = state.snowbridge_client.quote(&req);
    (StatusCode::OK, Json(serde_json::json!(quote)))
}

async fn bridge_status_handler(
    State(state): State<Arc<AppState>>,
    Path(transfer_id): Path<String>,
) -> impl IntoResponse {
    let status = state.snowbridge_client.status(&transfer_id);
    (StatusCode::OK, Json(serde_json::json!(status)))
}

async fn bridge_transfer_status_handler(
    State(state): State<Arc<AppState>>,
    Path(tx_hash): Path<String>,
) -> impl IntoResponse {
    if !state.snowbridge_client.enabled {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({
                "error": "Snowbridge not enabled — set SNOWBRIDGE_ENABLED=true",
            })),
        );
    }
    match state.snowbridge_client.get_transfer_receipt(&tx_hash).await {
        Ok(status) => (StatusCode::OK, Json(serde_json::json!(status))),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        ),
    }
}

async fn bridge_redeem_handler(
    State(state): State<Arc<AppState>>,
    Json(req): Json<BridgeRedeemRequest>,
) -> impl IntoResponse {
    let response = state.snowbridge_client.redeem(&req);
    (StatusCode::OK, Json(serde_json::json!(response)))
}

/// Check if an intent involves cross-chain tokens (Snowbridge wETH / USDC).
fn is_cross_chain_intent(intent: &StoredIntent) -> bool {
    let cross_chain_tokens = ["WETH_PASEO", "USDC", "ETH"];
    cross_chain_tokens
        .iter()
        .any(|t| intent.token_in.eq_ignore_ascii_case(t) || intent.token_out.eq_ignore_ascii_case(t))
}

fn parse_hex_32(value: &str) -> Result<[u8; 32], String> {
    let trimmed = value.trim();
    let hex_part = trimmed.strip_prefix("0x").unwrap_or(trimmed);
    if hex_part.len() != 64 {
        return Err(format!("Expected 32-byte hex value, got length {}", hex_part.len()));
    }
    let decoded = hex::decode(hex_part).map_err(|_| "Invalid hex value".to_string())?;
    let mut out = [0u8; 32];
    out.copy_from_slice(&decoded);
    Ok(out)
}

fn parse_u256_from_string(value: &str) -> Result<U256, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err("Empty numeric field".to_string());
    }

    if trimmed.starts_with("0x") || trimmed.starts_with("0X") {
        U256::from_str_radix(trimmed.trim_start_matches("0x").trim_start_matches("0X"), 16)
            .map_err(|_| format!("Invalid hex number: {}", value))
    } else {
        U256::from_dec_str(trimmed).map_err(|_| format!("Invalid decimal number: {}", value))
    }
}

fn u256_to_be32(value: U256) -> [u8; 32] {
    let mut out = [0u8; 32];
    value.to_big_endian(&mut out);
    out
}

fn encode_field_elements_32(elements: &[String]) -> Result<Vec<u8>, String> {
    let mut out = Vec::with_capacity(elements.len() * 32);
    for element in elements {
        let n = parse_u256_from_string(element)?;
        out.extend_from_slice(&u256_to_be32(n));
    }
    Ok(out)
}

fn parse_account_id32_or_native_marker(value: &str) -> Result<[u8; 32], String> {
    let trimmed = value.trim();
    if trimmed.eq_ignore_ascii_case("pas_native")
        || trimmed.eq_ignore_ascii_case("native_pas")
        || trimmed.eq_ignore_ascii_case("pas")
    {
        // Use a deterministic 32-byte marker for native PAS in EVM-mode on-chain payload.
        return Ok([0u8; 32]);
    }

    if let Ok(addr) = parse_evm_address(trimmed) {
        let mut out = [0u8; 32];
        out[12..].copy_from_slice(addr.as_bytes());
        return Ok(out);
    }

    let account: subxt::utils::AccountId32 = value
        .parse()
        .map_err(|_| format!("Invalid AccountId32/SS58 value: {}", value))?;
    Ok(account.0)
}

fn parse_evm_address(value: &str) -> Result<Address, String> {
    let trimmed = value.trim();
    Address::from_str(trimmed).map_err(|_| format!("Invalid EVM address: {}", value))
}

fn build_onchain_public_inputs_from_submit(req: &SubmitIntentRequest) -> Result<Vec<u8>, String> {
    let mut out = Vec::with_capacity(32 * 8);

    out.extend_from_slice(&parse_hex_32(&req.intent_hash)?);
    out.extend_from_slice(&parse_hex_32(&req.nullifier)?);

    let now = chrono::Utc::now().timestamp().max(0) as u64;
    out.extend_from_slice(&u256_to_be32(U256::from(now)));
    out.extend_from_slice(&parse_account_id32_or_native_marker(&req.public_inputs.token_in)?);
    out.extend_from_slice(&parse_account_id32_or_native_marker(&req.public_inputs.token_out)?);
    out.extend_from_slice(&u256_to_be32(parse_u256_from_string(&req.public_inputs.amount_in)?));
    out.extend_from_slice(&u256_to_be32(parse_u256_from_string(&req.public_inputs.min_amount_out)?));
    out.extend_from_slice(&u256_to_be32(U256::from(req.public_inputs.deadline)));

    Ok(out)
}
