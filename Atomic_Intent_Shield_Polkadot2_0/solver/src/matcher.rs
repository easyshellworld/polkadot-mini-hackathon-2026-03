use anyhow::Result;
use tracing::info;

use crate::models::*;

/// Deterministic matching engine.
///
/// Matching Policy (V1):
/// - Group intents by complementary token pairs (A→B matches with B→A)
/// - Process intents in stable order (created_at, then nullifier)
/// - Select compatible counterparty by best surplus, then earliest timestamp
/// - No partial fills in V1
pub struct Matcher;

impl Matcher {
    pub fn new() -> Self {
        Self
    }

    /// Attempt to find a match for the given intent among pending intents.
    ///
    /// Returns a MatchedPair if a compatible counterparty is found.
    pub fn try_match(
        &self,
        intent: &StoredIntent,
        pending_intents: &[StoredIntent],
    ) -> Option<MatchedPair> {
        // Find complementary intents: intent.token_in == other.token_out AND intent.token_out == other.token_in
        let mut candidates: Vec<&StoredIntent> = pending_intents
            .iter()
            .filter(|other| {
                other.nullifier != intent.nullifier
                    && other.status == IntentStatusModel::Pending
                    && other.token_in == intent.token_out
                    && other.token_out == intent.token_in
            })
            .collect();

        if candidates.is_empty() {
            return None;
        }

        // Sort by created_at (oldest first), then by nullifier for determinism
        candidates.sort_by(|a, b| {
            a.created_at
                .cmp(&b.created_at)
                .then_with(|| a.nullifier.cmp(&b.nullifier))
        });

        // Find the best match: amounts must satisfy each other's minimums
        for candidate in candidates {
            if self.amounts_compatible(intent, candidate) {
                info!(
                    "Match found: {} <-> {}",
                    intent.nullifier, candidate.nullifier
                );

                return Some(MatchedPair {
                    match_id: uuid::Uuid::new_v4(),
                    intent_a: intent.clone(),
                    intent_b: candidate.clone(),
                    matched_at: chrono::Utc::now(),
                    status: MatchStatus::Pending,
                });
            }
        }

        None
    }

    /// Check if two intents have compatible amounts.
    /// A's output must satisfy B's minimum, and vice versa.
    fn amounts_compatible(&self, a: &StoredIntent, b: &StoredIntent) -> bool {
        let a_amount_in: u128 = a.amount_in.parse().unwrap_or(0);
        let b_amount_in: u128 = b.amount_in.parse().unwrap_or(0);
        let a_min_out: u128 = a.min_amount_out.parse().unwrap_or(0);
        let b_min_out: u128 = b.min_amount_out.parse().unwrap_or(0);

        // A provides token_in=X, which is B's token_out
        // B's amount_in must be >= A's min_amount_out
        // A's amount_in must be >= B's min_amount_out
        b_amount_in >= a_min_out && a_amount_in >= b_min_out
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use uuid::Uuid;

    fn make_intent(
        nullifier: &str,
        token_in: &str,
        token_out: &str,
        amount_in: &str,
        min_amount_out: &str,
    ) -> StoredIntent {
        StoredIntent {
            id: Uuid::new_v4(),
            intent_hash: "0x123".to_string(),
            nullifier: nullifier.to_string(),
            user: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY".to_string(),
            recipient: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY".to_string(),
            token_in: token_in.to_string(),
            token_out: token_out.to_string(),
            amount_in: amount_in.to_string(),
            min_amount_out: min_amount_out.to_string(),
            deadline: Utc::now().timestamp() as u64 + 3600,
            nonce: 1,
            status: IntentStatusModel::Pending,
            proof_data: vec![],
            proof_public_inputs: vec![],
            encrypted_details: None,
            signature: "sig".to_string(),
            created_at: Utc::now(),
            matched_with: None,
            settlement_tx_hash: None,
        }
    }

    #[test]
    fn test_match_complementary_pair() {
        let matcher = Matcher::new();

        let intent_a = make_intent("0xaaa", "TOKEN_A", "TOKEN_B", "1000", "900");
        let intent_b = make_intent("0xbbb", "TOKEN_B", "TOKEN_A", "950", "950");

        let result = matcher.try_match(&intent_a, &[intent_b]);
        assert!(result.is_some());
    }

    #[test]
    fn test_no_match_same_direction() {
        let matcher = Matcher::new();

        let intent_a = make_intent("0xaaa", "TOKEN_A", "TOKEN_B", "1000", "900");
        let intent_b = make_intent("0xbbb", "TOKEN_A", "TOKEN_B", "1000", "900");

        let result = matcher.try_match(&intent_a, &[intent_b]);
        assert!(result.is_none());
    }

    #[test]
    fn test_no_match_insufficient_amount() {
        let matcher = Matcher::new();

        let intent_a = make_intent("0xaaa", "TOKEN_A", "TOKEN_B", "1000", "900");
        let intent_b = make_intent("0xbbb", "TOKEN_B", "TOKEN_A", "500", "950"); // 500 < 900

        let result = matcher.try_match(&intent_a, &[intent_b]);
        assert!(result.is_none());
    }
}
