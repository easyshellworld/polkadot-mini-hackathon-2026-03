use anyhow::{anyhow, Result};
use redis::AsyncCommands;
use tracing::error;

use crate::models::*;

/// Redis-backed storage for intents and matches.
#[derive(Clone)]
pub struct Storage {
    pool: redis::aio::ConnectionManager,
}

// Redis key prefixes
const INTENT_PREFIX: &str = "polkashield:intent:";
const PENDING_SET: &str = "polkashield:pending";
const MATCH_PREFIX: &str = "polkashield:match:";
const STATS_KEY: &str = "polkashield:stats";

impl Storage {
    pub async fn new(redis_url: &str) -> Result<Self> {
        let client = redis::Client::open(redis_url)?;
        let pool = redis::aio::ConnectionManager::new(client).await?;
        Ok(Self { pool })
    }

    /// Get a cloned Redis connection manager for direct use
    pub fn pool_clone(&self) -> redis::aio::ConnectionManager {
        self.pool.clone()
    }

    /// Store a new intent
    pub async fn store_intent(&self, intent: &StoredIntent) -> Result<()> {
        let mut conn = self.pool.clone();
        let key = format!("{}{}", INTENT_PREFIX, intent.nullifier);
        let json = serde_json::to_string(intent)?;

        let _: () = conn.set(&key, &json).await?;
        let _: () = conn.sadd(PENDING_SET, &intent.nullifier).await?;

        // Update stats
        let _: () = conn.hincr(STATS_KEY, "pending_intents", 1i64).await?;

        Ok(())
    }

    /// Get intent by nullifier
    pub async fn get_intent(&self, nullifier: &str) -> Result<StoredIntent> {
        let mut conn = self.pool.clone();
        let key = format!("{}{}", INTENT_PREFIX, nullifier);
        let json: String = conn.get(&key).await.map_err(|_| anyhow!("Intent not found"))?;
        let intent: StoredIntent = serde_json::from_str(&json)?;
        Ok(intent)
    }

    /// Cancel an intent
    pub async fn cancel_intent(&self, nullifier: &str) -> Result<()> {
        let mut conn = self.pool.clone();
        let key = format!("{}{}", INTENT_PREFIX, nullifier);

        let json: String = conn
            .get(&key)
            .await
            .map_err(|_| anyhow!("Intent not found"))?;
        let mut intent: StoredIntent = serde_json::from_str(&json)?;

        if intent.status != IntentStatusModel::Pending {
            return Err(anyhow!("Intent is not pending"));
        }

        intent.status = IntentStatusModel::Cancelled;
        let updated_json = serde_json::to_string(&intent)?;

        let _: () = conn.set(&key, &updated_json).await?;
        let _: () = conn.srem(PENDING_SET, nullifier).await?;
        let _: () = conn.hincr(STATS_KEY, "pending_intents", -1i64).await?;

        Ok(())
    }

    /// Get all pending intents
    pub async fn get_pending_intents(&self) -> Result<Vec<StoredIntent>> {
        let mut conn = self.pool.clone();
        let nullifiers: Vec<String> = conn.smembers(PENDING_SET).await?;

        let mut intents = Vec::new();
        for nullifier in nullifiers {
            match self.get_intent(&nullifier).await {
                Ok(intent) if intent.status == IntentStatusModel::Pending => {
                    intents.push(intent);
                }
                Ok(_) => {} // Non-pending intent in set, skip
                Err(e) => {
                    error!("Failed to load intent {}: {}", nullifier, e);
                }
            }
        }

        // Sort by created_at for deterministic ordering
        intents.sort_by(|a, b| a.created_at.cmp(&b.created_at));

        Ok(intents)
    }

    /// Get recent intents regardless of status (newest first).
    pub async fn get_recent_intents(&self, limit: usize) -> Result<Vec<StoredIntent>> {
        let mut conn = self.pool.clone();
        let pattern = format!("{}*", INTENT_PREFIX);
        let keys: Vec<String> = conn.keys(pattern).await?;

        let mut intents = Vec::new();
        for key in keys {
            let json: Result<String, _> = conn.get(&key).await;
            if let Ok(payload) = json {
                if let Ok(intent) = serde_json::from_str::<StoredIntent>(&payload) {
                    intents.push(intent);
                }
            }
        }

        intents.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        intents.truncate(limit);
        Ok(intents)
    }

    /// Update intent status to matched
    pub async fn mark_matched(
        &self,
        nullifier: &str,
        matched_with: &str,
    ) -> Result<()> {
        let mut conn = self.pool.clone();
        let key = format!("{}{}", INTENT_PREFIX, nullifier);

        let json: String = conn.get(&key).await?;
        let mut intent: StoredIntent = serde_json::from_str(&json)?;

        intent.status = IntentStatusModel::Matched;
        intent.matched_with = Some(matched_with.to_string());
        let updated_json = serde_json::to_string(&intent)?;

        let _: () = conn.set(&key, &updated_json).await?;
        let _: () = conn.srem(PENDING_SET, nullifier).await?;
        let _: () = conn.hincr(STATS_KEY, "pending_intents", -1i64).await?;
        let _: () = conn.hincr(STATS_KEY, "matched_pairs", 1i64).await?;

        Ok(())
    }

    /// Store a matched pair
    pub async fn store_match(&self, matched: &MatchedPair) -> Result<()> {
        let mut conn = self.pool.clone();
        let key = format!("{}{}", MATCH_PREFIX, matched.match_id);
        let json = serde_json::to_string(matched)?;

        let _: () = conn.set(&key, &json).await?;

        Ok(())
    }

    /// Get solver statistics
    pub async fn get_stats(&self) -> Result<SolverStats> {
        let mut conn = self.pool.clone();

        let pending: i64 = conn.hget(STATS_KEY, "pending_intents").await.unwrap_or(0);
        let matched: i64 = conn.hget(STATS_KEY, "matched_pairs").await.unwrap_or(0);

        Ok(SolverStats {
            pending_intents: pending.max(0) as u64,
            matched_pairs: matched.max(0) as u64,
        })
    }

    /// Mark an intent as settled with a settlement tx hash and optional bridge tx hash
    pub async fn mark_settled(&self, nullifier: &str, tx_hash: &str) -> Result<()> {
        self.mark_settled_with_bridge(nullifier, tx_hash, None).await
    }

    /// Mark an intent as settled with both Polkadot and bridge (EVM) tx hashes
    pub async fn mark_settled_with_bridge(
        &self,
        nullifier: &str,
        tx_hash: &str,
        bridge_tx_hash: Option<&str>,
    ) -> Result<()> {
        let mut conn = self.pool.clone();
        let key = format!("{}{}", INTENT_PREFIX, nullifier);

        let json: String = conn.get(&key).await?;
        let mut intent: StoredIntent = serde_json::from_str(&json)?;

        intent.status = IntentStatusModel::Settled;
        intent.settlement_tx_hash = Some(tx_hash.to_string());
        if let Some(btx) = bridge_tx_hash {
            intent.bridge_tx_hash = Some(btx.to_string());
        }
        let updated_json = serde_json::to_string(&intent)?;

        let _: () = conn.set(&key, &updated_json).await?;

        Ok(())
    }
}
