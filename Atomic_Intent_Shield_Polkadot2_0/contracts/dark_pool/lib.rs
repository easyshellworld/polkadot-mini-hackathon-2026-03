#![cfg_attr(not(feature = "std"), no_std, no_main)]

//! # PolkaShield DarkPool Contract
//!
//! Main coordination contract for the ZK dark pool.
//! Handles intent submission, settlement, cancellation, and fee management.
//!
//! Ported from StarkShield's Cairo DarkPool contract to ink! (WASM).

#[ink::contract]
#[allow(clippy::arithmetic_side_effects)]
mod dark_pool {
    use ink::prelude::vec::Vec;
    use ink::storage::Mapping;
    use scale::{Decode, Encode};

    // ========== Data Structures ==========

    /// Status of a trade intent
    #[derive(Debug, Clone, Copy, PartialEq, Eq, Encode, Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout))]
    pub enum IntentStatus {
        Pending,
        Matched,
        Settled,
        Cancelled,
        Expired,
    }

    /// On-chain record of a submitted intent
    #[derive(Debug, Clone, Encode, Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout))]
    pub struct IntentRecord {
        pub user: AccountId,
        pub intent_hash: Hash,
        pub nullifier: Hash,
        pub status: IntentStatus,
        pub token_in: AccountId,
        pub token_out: AccountId,
        pub amount_in: u128,
        pub min_amount_out: u128,
        pub deadline: u64,
        pub created_at: u64,
    }

    /// ZK proof data submitted with an intent
    #[derive(Debug, Clone, Encode, Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct IntentProof {
        /// Poseidon hash of intent parameters
        pub intent_hash: Hash,
        /// Unique identifier to prevent double-spending
        pub nullifier: Hash,
        /// Groth16 proof data: [pi_a(2), pi_b(4), pi_c(2)] as serialized field elements
        pub proof_data: Vec<u8>,
        /// Public inputs: user, token_in, token_out, amount_in, min_amount_out, deadline
        pub public_inputs: Vec<u8>,
    }

    /// Settlement configuration
    #[derive(Debug, Clone, Encode, Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct SettlementData {
        /// DEX pool address (for future HydraDX integration)
        pub pool_address: Option<AccountId>,
        /// Direct settlement flag
        pub direct_swap: bool,
    }

    // ========== Events ==========

    #[ink(event)]
    pub struct IntentSubmitted {
        #[ink(topic)]
        user: AccountId,
        #[ink(topic)]
        nullifier: Hash,
        intent_hash: Hash,
    }

    #[ink(event)]
    pub struct IntentSettled {
        #[ink(topic)]
        nullifier_a: Hash,
        #[ink(topic)]
        nullifier_b: Hash,
        settlement_tx: Hash,
    }

    #[ink(event)]
    pub struct IntentCancelled {
        #[ink(topic)]
        nullifier: Hash,
        user: AccountId,
    }

    #[ink(event)]
    pub struct ProofVerified {
        #[ink(topic)]
        nullifier: Hash,
        verified: bool,
    }

    // ========== Errors ==========

    #[derive(Debug, PartialEq, Eq, Encode, Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum Error {
        /// Caller is not the contract owner
        NotOwner,
        /// Caller is not the authorized solver
        NotSolver,
        /// Caller is not the intent owner
        NotIntentOwner,
        /// Intent with this nullifier already exists
        DuplicateIntent,
        /// Intent not found
        IntentNotFound,
        /// Intent is not in pending status
        IntentNotPending,
        /// Intent has expired
        IntentExpired,
        /// Invalid ZK proof
        InvalidProof,
        /// Token pairs are not complementary
        TokenPairMismatch,
        /// Settlement amounts do not satisfy minimums
        AmountInsufficient,
        /// Contract is paused
        ContractPaused,
        /// Fee exceeds maximum
        FeeExceedsMax,
        /// Token transfer failed
        TransferFailed,
        /// Verifier contract call failed
        VerifierCallFailed,
    }

    pub type Result<T> = core::result::Result<T, Error>;

    // ========== Contract Storage ==========

    #[ink(storage)]
    pub struct DarkPool {
        /// Contract owner
        owner: AccountId,
        /// Authorized solver address
        solver: AccountId,
        /// IntentVerifier contract address
        verifier_contract: AccountId,
        /// Fee recipient address
        fee_recipient: AccountId,
        /// Protocol fee in basis points (max 1000 = 10%)
        protocol_fee_bps: u16,
        /// Intent records indexed by nullifier
        intents: Mapping<Hash, IntentRecord>,
        /// Used nullifiers (prevents replay)
        used_nullifiers: Mapping<Hash, bool>,
        /// Whether the contract is paused
        paused: bool,
        /// Total intents submitted
        total_intents: u64,
        /// Total intents settled
        total_settled: u64,
    }

    // ========== Constants ==========

    const MAX_FEE_BPS: u16 = 1000; // 10%
    const DEFAULT_FEE_BPS: u16 = 30; // 0.3%

    impl DarkPool {
        /// Constructor
        #[ink(constructor)]
        pub fn new(
            owner: AccountId,
            solver: AccountId,
            verifier_contract: AccountId,
            fee_recipient: AccountId,
            protocol_fee_bps: Option<u16>,
        ) -> Self {
            let fee = protocol_fee_bps.unwrap_or(DEFAULT_FEE_BPS);
            assert!(fee <= MAX_FEE_BPS, "Fee exceeds maximum");

            Self {
                owner,
                solver,
                verifier_contract,
                fee_recipient,
                protocol_fee_bps: fee,
                intents: Mapping::default(),
                used_nullifiers: Mapping::default(),
                paused: false,
                total_intents: 0,
                total_settled: 0,
            }
        }

        // ========== Core Functions ==========

        /// Submit a new trade intent with ZK proof
        #[ink(message)]
        pub fn submit_intent(&mut self, proof: IntentProof) -> Result<()> {
            self.ensure_not_paused()?;

            // Check nullifier not already used
            if self.used_nullifiers.get(proof.nullifier).unwrap_or(false) {
                return Err(Error::DuplicateIntent);
            }

            // Verify ZK proof via IntentVerifier cross-contract call
            let verified: bool = ink::env::call::build_call::<ink::env::DefaultEnvironment>()
                .call(self.verifier_contract)
                .transferred_value(0)
                .exec_input(
                    ink::env::call::ExecutionInput::new(ink::env::call::Selector::new(
                        ink::selector_bytes!("verify_intent_proof"),
                    ))
                    .push_arg(&proof.intent_hash)
                    .push_arg(&proof.nullifier)
                    .push_arg(&proof.proof_data)
                    .push_arg(&proof.public_inputs),
                )
                .returns::<core::result::Result<bool, u8>>()
                .invoke()
                .map_err(|_| Error::VerifierCallFailed)?;

            if !verified {
                return Err(Error::InvalidProof);
            }

            // Decode public inputs to extract intent parameters
            let params = self.decode_intent_params(&proof.public_inputs)?;
            let caller = self.env().caller();
            let now = self.env().block_timestamp();

            // Create intent record
            let record = IntentRecord {
                user: caller,
                intent_hash: proof.intent_hash,
                nullifier: proof.nullifier,
                status: IntentStatus::Pending,
                token_in: params.token_in,
                token_out: params.token_out,
                amount_in: params.amount_in,
                min_amount_out: params.min_amount_out,
                deadline: params.deadline,
                created_at: now,
            };

            // Store intent
            self.intents.insert(proof.nullifier, &record);
            self.used_nullifiers.insert(proof.nullifier, &true);
            self.total_intents += 1;

            // Emit event
            self.env().emit_event(IntentSubmitted {
                user: caller,
                nullifier: proof.nullifier,
                intent_hash: proof.intent_hash,
            });

            Ok(())
        }

        /// Settle a matched pair of intents atomically
        /// Access: Solver only (in MVP)
        #[ink(message)]
        pub fn settle_match(
            &mut self,
            intent_a: IntentProof,
            intent_b: IntentProof,
            _settlement_data: SettlementData,
        ) -> Result<()> {
            self.ensure_not_paused()?;
            self.ensure_solver()?;

            // Verify both intents are pending
            let record_a = self.intents.get(intent_a.nullifier)
                .ok_or(Error::IntentNotFound)?;
            let record_b = self.intents.get(intent_b.nullifier)
                .ok_or(Error::IntentNotFound)?;

            if record_a.status != IntentStatus::Pending {
                return Err(Error::IntentNotPending);
            }
            if record_b.status != IntentStatus::Pending {
                return Err(Error::IntentNotPending);
            }

            // Check deadlines
            let now = self.env().block_timestamp();
            if record_a.deadline > 0 && now > record_a.deadline {
                return Err(Error::IntentExpired);
            }
            if record_b.deadline > 0 && now > record_b.deadline {
                return Err(Error::IntentExpired);
            }

            // Verify token pairs are complementary:
            // A wants to swap token_in_a → token_out_a
            // B wants to swap token_in_b → token_out_b
            // They must be: A.token_in == B.token_out AND A.token_out == B.token_in
            if record_a.token_in != record_b.token_out || record_a.token_out != record_b.token_in {
                return Err(Error::TokenPairMismatch);
            }

            // Verify amounts satisfy minimum outputs
            // A sends amount_in_a of token_in_a; B needs at least min_amount_out_b of that token
            // B sends amount_in_b of token_in_b; A needs at least min_amount_out_a of that token
            if record_a.amount_in < record_b.min_amount_out {
                return Err(Error::AmountInsufficient);
            }
            if record_b.amount_in < record_a.min_amount_out {
                return Err(Error::AmountInsufficient);
            }

            // Calculate fees
            let fee_a = self.calculate_fee(record_b.amount_in); // fee on what A receives
            let fee_b = self.calculate_fee(record_a.amount_in); // fee on what B receives
            let amount_to_a = record_b.amount_in - fee_a;
            let amount_to_b = record_a.amount_in - fee_b;

            // Execute PSP22 transfers:
            // 1. Transfer token_in_a from user_a to user_b (minus fee)
            self.psp22_transfer_from(
                record_a.token_in,
                record_a.user,
                record_b.user,
                amount_to_b,
            )?;

            // 2. Transfer token_in_b from user_b to user_a (minus fee)
            self.psp22_transfer_from(
                record_b.token_in,
                record_b.user,
                record_a.user,
                amount_to_a,
            )?;

            // 3. Transfer fees to fee_recipient
            if fee_b > 0 {
                self.psp22_transfer_from(
                    record_a.token_in,
                    record_a.user,
                    self.fee_recipient,
                    fee_b,
                )?;
            }
            if fee_a > 0 {
                self.psp22_transfer_from(
                    record_b.token_in,
                    record_b.user,
                    self.fee_recipient,
                    fee_a,
                )?;
            }

            // Update statuses
            let mut updated_a = record_a;
            updated_a.status = IntentStatus::Settled;
            self.intents.insert(intent_a.nullifier, &updated_a);

            let mut updated_b = record_b;
            updated_b.status = IntentStatus::Settled;
            self.intents.insert(intent_b.nullifier, &updated_b);

            self.total_settled += 1;

            // Emit event
            self.env().emit_event(IntentSettled {
                nullifier_a: intent_a.nullifier,
                nullifier_b: intent_b.nullifier,
                settlement_tx: proof_to_hash(&intent_a, &intent_b),
            });

            Ok(())
        }

        /// Cancel a pending intent
        /// Access: Intent owner only
        #[ink(message)]
        pub fn cancel_intent(&mut self, nullifier: Hash) -> Result<()> {
            let record = self.intents.get(nullifier)
                .ok_or(Error::IntentNotFound)?;

            if record.user != self.env().caller() {
                return Err(Error::NotIntentOwner);
            }
            if record.status != IntentStatus::Pending {
                return Err(Error::IntentNotPending);
            }

            let mut updated = record;
            updated.status = IntentStatus::Cancelled;
            self.intents.insert(nullifier, &updated);

            self.env().emit_event(IntentCancelled {
                nullifier,
                user: self.env().caller(),
            });

            Ok(())
        }

        // ========== Query Functions ==========

        /// Get intent status by nullifier
        #[ink(message)]
        pub fn get_intent_status(&self, nullifier: Hash) -> Option<IntentStatus> {
            self.intents.get(nullifier).map(|r| r.status)
        }

        /// Get full intent record
        #[ink(message)]
        pub fn get_intent(&self, nullifier: Hash) -> Option<IntentRecord> {
            self.intents.get(nullifier)
        }

        /// Get contract statistics
        #[ink(message)]
        pub fn get_stats(&self) -> (u64, u64) {
            (self.total_intents, self.total_settled)
        }

        /// Check if contract is paused
        #[ink(message)]
        pub fn is_paused(&self) -> bool {
            self.paused
        }

        /// Get protocol fee in basis points
        #[ink(message)]
        pub fn get_protocol_fee_bps(&self) -> u16 {
            self.protocol_fee_bps
        }

        // ========== Admin Functions ==========

        /// Update solver address
        #[ink(message)]
        pub fn set_solver(&mut self, new_solver: AccountId) -> Result<()> {
            self.ensure_owner()?;
            self.solver = new_solver;
            Ok(())
        }

        /// Update fee recipient
        #[ink(message)]
        pub fn set_fee_recipient(&mut self, new_recipient: AccountId) -> Result<()> {
            self.ensure_owner()?;
            self.fee_recipient = new_recipient;
            Ok(())
        }

        /// Update protocol fee
        #[ink(message)]
        pub fn set_protocol_fee(&mut self, new_fee_bps: u16) -> Result<()> {
            self.ensure_owner()?;
            if new_fee_bps > MAX_FEE_BPS {
                return Err(Error::FeeExceedsMax);
            }
            self.protocol_fee_bps = new_fee_bps;
            Ok(())
        }

        /// Update verifier contract
        #[ink(message)]
        pub fn set_verifier(&mut self, new_verifier: AccountId) -> Result<()> {
            self.ensure_owner()?;
            self.verifier_contract = new_verifier;
            Ok(())
        }

        /// Pause the contract
        #[ink(message)]
        pub fn pause(&mut self) -> Result<()> {
            self.ensure_owner()?;
            self.paused = true;
            Ok(())
        }

        /// Unpause the contract
        #[ink(message)]
        pub fn unpause(&mut self) -> Result<()> {
            self.ensure_owner()?;
            self.paused = false;
            Ok(())
        }

        // ========== Internal Helpers ==========

        fn ensure_owner(&self) -> Result<()> {
            if self.env().caller() != self.owner {
                return Err(Error::NotOwner);
            }
            Ok(())
        }

        fn ensure_solver(&self) -> Result<()> {
            if self.env().caller() != self.solver {
                return Err(Error::NotSolver);
            }
            Ok(())
        }

        fn ensure_not_paused(&self) -> Result<()> {
            if self.paused {
                return Err(Error::ContractPaused);
            }
            Ok(())
        }

        /// Calculate fee amount
        fn calculate_fee(&self, amount: u128) -> u128 {
            (amount * self.protocol_fee_bps as u128) / 10_000
        }

        /// Decoded intent parameters from public inputs
        fn decode_intent_params(&self, public_inputs: &[u8]) -> Result<IntentParams> {
            // Public inputs layout (each 32 bytes, big-endian):
            // [0..32]   intent_hash (unused here, extracted from proof)
            // [32..64]  nullifier (unused here, extracted from proof)
            // [64..96]  current_time (unused here, metadata)
            // [96..128] token_in (AccountId as 32 bytes)
            // [128..160] token_out (AccountId as 32 bytes)
            // [160..192] amount_in (u128 in last 16 bytes)
            // [192..224] min_amount_out (u128 in last 16 bytes)
            // [224..256] deadline (u64 in last 8 bytes)
            if public_inputs.len() < 256 {
                return Err(Error::InvalidProof);
            }

            let mut token_in_bytes = [0u8; 32];
            token_in_bytes.copy_from_slice(&public_inputs[96..128]);
            let token_in = AccountId::from(token_in_bytes);

            let mut token_out_bytes = [0u8; 32];
            token_out_bytes.copy_from_slice(&public_inputs[128..160]);
            let token_out = AccountId::from(token_out_bytes);

            // amount_in: big-endian u128 in bytes [176..192] (last 16 bytes of 32-byte field)
            let mut amount_in_bytes = [0u8; 16];
            amount_in_bytes.copy_from_slice(&public_inputs[176..192]);
            let amount_in = u128::from_be_bytes(amount_in_bytes);

            // min_amount_out
            let mut min_amount_out_bytes = [0u8; 16];
            min_amount_out_bytes.copy_from_slice(&public_inputs[208..224]);
            let min_amount_out = u128::from_be_bytes(min_amount_out_bytes);

            // deadline: u64 in bytes [248..256] (last 8 bytes of 32-byte field)
            let mut deadline_bytes = [0u8; 8];
            deadline_bytes.copy_from_slice(&public_inputs[248..256]);
            let deadline = u64::from_be_bytes(deadline_bytes);

            Ok(IntentParams { token_in, token_out, amount_in, min_amount_out, deadline })
        }

        /// PSP22 transfer_from via cross-contract call
        fn psp22_transfer_from(
            &self,
            token: AccountId,
            from: AccountId,
            to: AccountId,
            value: u128,
        ) -> Result<()> {
            // PSP22::transfer_from(from, to, value, data)
            // Selector for PSP22::transfer_from = 0x54b3c76e
            ink::env::call::build_call::<ink::env::DefaultEnvironment>()
                .call(token)
                .transferred_value(0)
                .exec_input(
                    ink::env::call::ExecutionInput::new(ink::env::call::Selector::new([0x54, 0xb3, 0xc7, 0x6e]))
                        .push_arg(from)
                        .push_arg(to)
                        .push_arg(value)
                        .push_arg::<Vec<u8>>(Vec::new()), // data
                )
                .returns::<core::result::Result<(), u8>>()
                .invoke()
                .map_err(|_| Error::TransferFailed)?;
            Ok(())
        }
    }

    /// Decoded intent parameters
    struct IntentParams {
        token_in: AccountId,
        token_out: AccountId,
        amount_in: u128,
        min_amount_out: u128,
        deadline: u64,
    }

    /// Generate a settlement hash from two intent proofs
    fn proof_to_hash(a: &IntentProof, b: &IntentProof) -> Hash {
        let mut combined = [0u8; 32];
        for i in 0..32 {
            combined[i] = a.nullifier.as_ref()[i] ^ b.nullifier.as_ref()[i];
        }
        Hash::from(combined)
    }

    // ========== Tests ==========

    #[cfg(test)]
    mod tests {
        use super::*;

        fn default_accounts() -> ink::env::test::DefaultAccounts<ink::env::DefaultEnvironment> {
            ink::env::test::default_accounts::<ink::env::DefaultEnvironment>()
        }

        #[ink::test]
        fn constructor_works() {
            let accounts = default_accounts();
            let contract = DarkPool::new(
                accounts.alice,
                accounts.bob,
                accounts.charlie,
                accounts.django,
                Some(30),
            );
            assert_eq!(contract.get_protocol_fee_bps(), 30);
            assert!(!contract.is_paused());
        }

        #[ink::test]
        fn pause_unpause_works() {
            let accounts = default_accounts();
            let mut contract = DarkPool::new(
                accounts.alice,
                accounts.bob,
                accounts.charlie,
                accounts.django,
                None,
            );
            assert!(!contract.is_paused());
            assert!(contract.pause().is_ok());
            assert!(contract.is_paused());
            assert!(contract.unpause().is_ok());
            assert!(!contract.is_paused());
        }

        #[ink::test]
        fn fee_calculation() {
            let accounts = default_accounts();
            let contract = DarkPool::new(
                accounts.alice,
                accounts.bob,
                accounts.charlie,
                accounts.django,
                Some(30),
            );
            // 0.3% of 10000 = 30
            assert_eq!(contract.calculate_fee(10_000), 30);
            // 0.3% of 1_000_000 = 3000
            assert_eq!(contract.calculate_fee(1_000_000), 3_000);
        }

        #[ink::test]
        fn cancel_nonexistent_intent_fails() {
            let accounts = default_accounts();
            let mut contract = DarkPool::new(
                accounts.alice,
                accounts.bob,
                accounts.charlie,
                accounts.django,
                None,
            );
            let result = contract.cancel_intent(Hash::from([1u8; 32]));
            assert_eq!(result, Err(Error::IntentNotFound));
        }
    }
}
