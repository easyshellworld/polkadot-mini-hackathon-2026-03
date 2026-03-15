use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ========== Intent Models ==========

/// Intent submission request from frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitIntentRequest {
    pub intent_hash: String,
    pub nullifier: String,
    pub proof_data: Vec<String>,
    pub proof_public_inputs: Vec<String>,
    pub public_inputs: IntentPublicInputs,
    pub encrypted_details: Option<String>,
    pub signature: String,
}

/// Public inputs decoded from the ZK proof
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentPublicInputs {
    /// User's SS58 address
    pub user: String,
    /// Settlement recipient address on the source chain
    #[serde(default)]
    pub recipient: String,
    /// Input token contract address (SS58)
    pub token_in: String,
    /// Output token contract address (SS58)
    pub token_out: String,
    /// Amount of input token (as string to handle large numbers)
    pub amount_in: String,
    /// Minimum acceptable output amount
    pub min_amount_out: String,
    /// Unix timestamp deadline
    pub deadline: u64,
    /// Nonce for replay protection
    pub nonce: u64,
    /// Chain identifier
    pub chain_id: String,
    /// Domain separator
    pub domain_separator: String,
    /// Protocol version
    pub version: u32,
}

/// Intent submission response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitIntentResponse {
    pub intent_id: Uuid,
    pub status: String,
    pub estimated_match_time: String,
    pub correlation_id: String,
}

/// Stored intent record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredIntent {
    pub id: Uuid,
    pub intent_hash: String,
    pub nullifier: String,
    pub user: String,
    #[serde(default)]
    pub recipient: String,
    pub token_in: String,
    pub token_out: String,
    pub amount_in: String,
    pub min_amount_out: String,
    pub deadline: u64,
    pub nonce: u64,
    pub status: IntentStatusModel,
    pub proof_data: Vec<String>,
    pub proof_public_inputs: Vec<String>,
    pub encrypted_details: Option<String>,
    pub signature: String,
    pub created_at: DateTime<Utc>,
    pub matched_with: Option<String>,
    pub settlement_tx_hash: Option<String>,
    /// EVM / Snowbridge bridge tx hash (for cross-chain settlements)
    #[serde(default)]
    pub bridge_tx_hash: Option<String>,
}

/// Intent status enum
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum IntentStatusModel {
    Pending,
    Matched,
    Settled,
    Cancelled,
    Expired,
}

// ========== Query Models ==========

/// Intent query response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentQueryResponse {
    pub intent: IntentInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentInfo {
    pub id: Uuid,
    pub nullifier: String,
    pub status: IntentStatusModel,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub matched_with: Option<String>,
    pub settlement_tx_hash: Option<String>,
    pub bridge_tx_hash: Option<String>,
}

/// Pending intent summary (public info only)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingIntentSummary {
    pub id: Uuid,
    pub nullifier: String,
    pub status: IntentStatusModel,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

// ========== Match Models ==========

/// A matched pair of intents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchedPair {
    pub match_id: Uuid,
    pub intent_a: StoredIntent,
    pub intent_b: StoredIntent,
    pub matched_at: DateTime<Utc>,
    pub status: MatchStatus,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MatchStatus {
    Pending,
    Confirmed,
    Settling,
    Settled,
    Failed,
}

// ========== Stats Models ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolverStats {
    pub pending_intents: u64,
    pub matched_pairs: u64,
}

// ========== Health Models ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
    pub uptime_seconds: u64,
    pub pending_intents: u64,
    pub matched_pairs: u64,
}

// ========== Auth Models ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginResponse {
    pub token: String,
    pub expires_in: u64,
}

// ========== Error Models ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiError {
    pub success: bool,
    pub error: String,
    pub code: String,
    pub error_detail: ErrorDetail,
    pub correlation_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorDetail {
    pub code: String,
    pub message: String,
}
