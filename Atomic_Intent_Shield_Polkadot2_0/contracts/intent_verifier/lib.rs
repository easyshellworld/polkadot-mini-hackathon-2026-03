#![cfg_attr(not(feature = "std"), no_std, no_main)]

//! # PolkaShield IntentVerifier Contract
//!
//! Verifies Groth16 ZK proofs for trade intents.
//! Forwards proof data to the Groth16Verifier contract for pairing checks.
//!
//! Ported from StarkShield's Cairo IntentVerifier.
//! Original used Garaga verifier; this uses arkworks-based Groth16 verification.

#[ink::contract]
#[allow(clippy::arithmetic_side_effects)]
mod intent_verifier {
    use ink::prelude::vec::Vec;
    use ink::storage::Mapping;
    use scale::{Decode, Encode};

    // ========== Data Structures ==========

    /// Groth16 proof components (serialized BN254 curve points)
    #[derive(Debug, Clone, Encode, Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct Groth16Proof {
        /// Point A on G1 (compressed: 32 bytes)
        pub pi_a: Vec<u8>,
        /// Point B on G2 (compressed: 64 bytes)
        pub pi_b: Vec<u8>,
        /// Point C on G1 (compressed: 32 bytes)
        pub pi_c: Vec<u8>,
    }

    /// Verification key for the intent circuit (stored once on deployment)
    #[derive(Debug, Clone, Encode, Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo, ink::storage::traits::StorageLayout))]
    pub struct VerificationKey {
        /// Alpha point on G1
        pub alpha_g1: Vec<u8>,
        /// Beta point on G2
        pub beta_g2: Vec<u8>,
        /// Gamma point on G2
        pub gamma_g2: Vec<u8>,
        /// Delta point on G2
        pub delta_g2: Vec<u8>,
        /// IC (input commitment) points on G1, one per public input + 1
        pub ic: Vec<Vec<u8>>,
    }

    // ========== Events ==========

    #[ink(event)]
    pub struct ProofVerified {
        #[ink(topic)]
        nullifier: Hash,
        verified: bool,
    }

    #[ink(event)]
    pub struct VerificationKeyUpdated {
        updated_by: AccountId,
    }

    // ========== Errors ==========

    #[derive(Debug, PartialEq, Eq, Encode, Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum Error {
        NotOwner,
        NullifierAlreadyUsed,
        InvalidProofFormat,
        InvalidPublicInputs,
        VerificationFailed,
        VerificationKeyNotSet,
        Groth16VerifierCallFailed,
    }

    pub type Result<T> = core::result::Result<T, Error>;

    // ========== Groth16Verifier Cross-Contract Types ==========
    // These mirror the types in groth16_verifier contract for SCALE encoding

    #[derive(Debug, Clone, Encode, Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct G1PointCompat {
        pub x: [u8; 32],
        pub y: [u8; 32],
    }

    #[derive(Debug, Clone, Encode, Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct G2PointCompat {
        pub x0: [u8; 32],
        pub x1: [u8; 32],
        pub y0: [u8; 32],
        pub y1: [u8; 32],
    }

    #[derive(Debug, Clone, Encode, Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct Groth16VK {
        pub alpha_g1: G1PointCompat,
        pub beta_g2: G2PointCompat,
        pub gamma_g2: G2PointCompat,
        pub delta_g2: G2PointCompat,
        pub ic: Vec<G1PointCompat>,
    }

    #[derive(Debug, Clone, Encode, Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct Groth16ProofCompat {
        pub a: G1PointCompat,
        pub b: G2PointCompat,
        pub c: G1PointCompat,
    }

    // ========== Contract Storage ==========

    #[ink(storage)]
    pub struct IntentVerifier {
        /// Contract owner
        owner: AccountId,
        /// Groth16 verifier contract address (for pairing computation)
        groth16_verifier: AccountId,
        /// Verification key for the intent circuit
        vk: Option<VerificationKey>,
        /// Used nullifiers to prevent double-spending
        used_nullifiers: Mapping<Hash, bool>,
    }

    impl IntentVerifier {
        /// Constructor
        #[ink(constructor)]
        pub fn new(owner: AccountId, groth16_verifier: AccountId) -> Self {
            Self {
                owner,
                groth16_verifier,
                vk: None,
                used_nullifiers: Mapping::default(),
            }
        }

        /// Set the verification key for the intent circuit.
        /// This is generated from the Circom trusted setup.
        #[ink(message)]
        pub fn set_verification_key(&mut self, vk: VerificationKey) -> Result<()> {
            self.ensure_owner()?;
            self.vk = Some(vk);

            self.env().emit_event(VerificationKeyUpdated {
                updated_by: self.env().caller(),
            });

            Ok(())
        }

        /// Verify an intent ZK proof
        ///
        /// Verification steps:
        /// 1. Check nullifier not already used
        /// 2. Decode Groth16 proof components
        /// 3. Prepare public inputs
        /// 4. Call Groth16 verifier for pairing check:
        ///    e(A,B) = e(α,β) × e(Σ(ai·Li), γ) × e(C, δ)
        /// 5. Return verification result
        #[ink(message)]
        pub fn verify_intent_proof(
            &mut self,
            intent_hash: Hash,
            nullifier: Hash,
            proof_data: Vec<u8>,
            public_inputs: Vec<u8>,
        ) -> Result<bool> {
            // 1. Check nullifier not already used
            if self.used_nullifiers.get(nullifier).unwrap_or(false) {
                return Err(Error::NullifierAlreadyUsed);
            }

            // 2. Ensure verification key is set
            let vk = self.vk.as_ref().ok_or(Error::VerificationKeyNotSet)?;

            // 3. Decode Groth16 proof from proof_data
            let proof = self.decode_proof(&proof_data)?;

            // 4. Decode public inputs
            let inputs = self.decode_public_inputs(&public_inputs)?;

            // 5. Build verification key in Groth16Verifier format
            let g16_vk = self.build_groth16_vk(vk)?;
            let g16_proof = self.build_groth16_proof(&proof)?;

            // 6. Cross-contract call to Groth16Verifier.verify()
            let verified: bool = ink::env::call::build_call::<ink::env::DefaultEnvironment>()
                .call(self.groth16_verifier)
                .transferred_value(0)
                .exec_input(
                    ink::env::call::ExecutionInput::new(ink::env::call::Selector::new(
                        ink::selector_bytes!("verify"),
                    ))
                    .push_arg(&g16_vk)
                    .push_arg(&g16_proof)
                    .push_arg(&inputs),
                )
                .returns::<core::result::Result<bool, u8>>()
                .invoke()
                .map_err(|_| Error::Groth16VerifierCallFailed)?;

            if verified {
                // Mark nullifier as used
                self.used_nullifiers.insert(nullifier, &true);
            }

            // Emit event
            self.env().emit_event(ProofVerified {
                nullifier,
                verified,
            });

            let _ = intent_hash;

            Ok(verified)
        }

        /// Check if a nullifier has been used
        #[ink(message)]
        pub fn is_nullifier_used(&self, nullifier: Hash) -> bool {
            self.used_nullifiers.get(nullifier).unwrap_or(false)
        }

        /// Get the verification key status
        #[ink(message)]
        pub fn has_verification_key(&self) -> bool {
            self.vk.is_some()
        }

        // ========== Internal Helpers ==========

        fn ensure_owner(&self) -> Result<()> {
            if self.env().caller() != self.owner {
                return Err(Error::NotOwner);
            }
            Ok(())
        }

        fn decode_proof(&self, proof_data: &[u8]) -> Result<Groth16Proof> {
            // Expected format: pi_a (64 bytes) + pi_b (128 bytes) + pi_c (64 bytes) = 256 bytes
            // Using uncompressed points for BN254
            if proof_data.len() < 256 {
                return Err(Error::InvalidProofFormat);
            }

            Ok(Groth16Proof {
                pi_a: proof_data[0..64].to_vec(),
                pi_b: proof_data[64..192].to_vec(),
                pi_c: proof_data[192..256].to_vec(),
            })
        }

        fn decode_public_inputs(&self, public_inputs: &[u8]) -> Result<Vec<[u8; 32]>> {
            // Each public input is a 32-byte field element
            // Expected: intentHash (32) + nullifier (32) + currentTime (32) = 96 bytes minimum
            if public_inputs.len() < 96 || public_inputs.len() % 32 != 0 {
                return Err(Error::InvalidPublicInputs);
            }

            let inputs: Vec<[u8; 32]> = public_inputs
                .chunks_exact(32)
                .map(|chunk| {
                    let mut arr = [0u8; 32];
                    arr.copy_from_slice(chunk);
                    arr
                })
                .collect();

            Ok(inputs)
        }

        /// Convert our VerificationKey into Groth16Verifier-compatible SCALE-encoded format.
        /// The Groth16Verifier expects: VerifyingKey { alpha_g1: G1Point, beta_g2: G2Point, ... }
        fn build_groth16_vk(&self, vk: &VerificationKey) -> Result<Groth16VK> {
            let alpha_g1 = self.bytes_to_g1(&vk.alpha_g1)?;
            let beta_g2 = self.bytes_to_g2(&vk.beta_g2)?;
            let gamma_g2 = self.bytes_to_g2(&vk.gamma_g2)?;
            let delta_g2 = self.bytes_to_g2(&vk.delta_g2)?;
            let ic: core::result::Result<Vec<G1PointCompat>, Error> =
                vk.ic.iter().map(|p| self.bytes_to_g1(p)).collect();

            Ok(Groth16VK { alpha_g1, beta_g2, gamma_g2, delta_g2, ic: ic? })
        }

        fn build_groth16_proof(&self, proof: &Groth16Proof) -> Result<Groth16ProofCompat> {
            let a = self.bytes_to_g1(&proof.pi_a)?;
            let b = self.bytes_to_g2(&proof.pi_b)?;
            let c = self.bytes_to_g1(&proof.pi_c)?;
            Ok(Groth16ProofCompat { a, b, c })
        }

        fn bytes_to_g1(&self, data: &[u8]) -> Result<G1PointCompat> {
            if data.len() < 64 {
                return Err(Error::InvalidProofFormat);
            }
            let mut x = [0u8; 32];
            let mut y = [0u8; 32];
            x.copy_from_slice(&data[0..32]);
            y.copy_from_slice(&data[32..64]);
            Ok(G1PointCompat { x, y })
        }

        fn bytes_to_g2(&self, data: &[u8]) -> Result<G2PointCompat> {
            if data.len() < 128 {
                return Err(Error::InvalidProofFormat);
            }
            let mut x0 = [0u8; 32];
            let mut x1 = [0u8; 32];
            let mut y0 = [0u8; 32];
            let mut y1 = [0u8; 32];
            x0.copy_from_slice(&data[0..32]);
            x1.copy_from_slice(&data[32..64]);
            y0.copy_from_slice(&data[64..96]);
            y1.copy_from_slice(&data[96..128]);
            Ok(G2PointCompat { x0, x1, y0, y1 })
        }
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
            let contract = IntentVerifier::new(accounts.alice, accounts.bob);
            assert!(!contract.has_verification_key());
        }

        #[ink::test]
        fn set_verification_key_works() {
            let accounts = default_accounts();
            let mut contract = IntentVerifier::new(accounts.alice, accounts.bob);
            let vk = VerificationKey {
                alpha_g1: vec![1u8; 64],
                beta_g2: vec![2u8; 128],
                gamma_g2: vec![3u8; 128],
                delta_g2: vec![4u8; 128],
                ic: vec![vec![5u8; 64]; 4],
            };
            assert!(contract.set_verification_key(vk).is_ok());
            assert!(contract.has_verification_key());
        }

        #[ink::test]
        fn nullifier_tracking_works() {
            let accounts = default_accounts();
            let contract = IntentVerifier::new(accounts.alice, accounts.bob);
            let nullifier = Hash::from([1u8; 32]);
            assert!(!contract.is_nullifier_used(nullifier));
        }
    }
}
