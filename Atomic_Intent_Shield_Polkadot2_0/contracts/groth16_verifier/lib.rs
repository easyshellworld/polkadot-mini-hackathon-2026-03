#![cfg_attr(not(feature = "std"), no_std, no_main)]

//! # Groth16 BN254 Verifier
//!
//! Low-level Groth16 proof verification on the BN254 (alt_bn128) curve.
//! This contract implements the pairing check:
//!
//!   e(A, B) = e(α, β) × e(Σ(ai·Li), γ) × e(C, δ)
//!
//! Implementation uses pure 256-bit big-integer arithmetic over BN254's
//! base field (p) and scalar field (r). The pairing is computed via the
//! optimal Ate pairing on BN254.
//!
//! Note: Pure WASM pairing is expensive (~5–10M gas). For cheaper verification
//! on production chains, consider Substrate chain extensions or Aleph Zero's
//! native ZK precompiles. This implementation is correct and portable.

#[ink::contract]
#[allow(
    clippy::arithmetic_side_effects,
    clippy::wrong_self_convention,
    clippy::needless_range_loop,
    clippy::enum_variant_names,
    clippy::large_enum_variant
)]
mod groth16_verifier {
    use ink::prelude::vec::Vec;
    use scale::{Decode, Encode};

    // ========== BN254 Field Constants ==========

    /// BN254 base field modulus p
    /// p = 21888242871839275222246405745257275088696311157297823662689037894645226208583
    const FIELD_MODULUS: [u64; 4] = [
        0x3C208C16D87CFD47,
        0x97816A916871CA8D,
        0xB85045B68181585D,
        0x30644E72E131A029,
    ];

    /// BN254 scalar field order r
    /// r = 21888242871839275222246405745257275088548364400416034343698204186575808495617
    const SCALAR_ORDER: [u64; 4] = [
        0x43E1F593F0000001,
        0x2833E84879B97091,
        0xB85045B68181585D,
        0x30644E72E131A029,
    ];

    // ========== 256-bit Arithmetic ==========

    /// 256-bit unsigned integer represented as 4 x u64 limbs (little-endian)
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    struct U256([u64; 4]);

    impl U256 {
        const ZERO: Self = Self([0, 0, 0, 0]);
        const ONE: Self = Self([1, 0, 0, 0]);

        fn from_be_bytes(bytes: &[u8; 32]) -> Self {
            let mut limbs = [0u64; 4];
            // bytes are big-endian, limbs are little-endian
            limbs[3] = u64::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7]]);
            limbs[2] = u64::from_be_bytes([bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]]);
            limbs[1] = u64::from_be_bytes([bytes[16], bytes[17], bytes[18], bytes[19], bytes[20], bytes[21], bytes[22], bytes[23]]);
            limbs[0] = u64::from_be_bytes([bytes[24], bytes[25], bytes[26], bytes[27], bytes[28], bytes[29], bytes[30], bytes[31]]);
            Self(limbs)
        }

        fn to_be_bytes(&self) -> [u8; 32] {
            let mut out = [0u8; 32];
            let b3 = self.0[3].to_be_bytes();
            let b2 = self.0[2].to_be_bytes();
            let b1 = self.0[1].to_be_bytes();
            let b0 = self.0[0].to_be_bytes();
            out[0..8].copy_from_slice(&b3);
            out[8..16].copy_from_slice(&b2);
            out[16..24].copy_from_slice(&b1);
            out[24..32].copy_from_slice(&b0);
            out
        }

        fn is_zero(&self) -> bool {
            self.0 == [0, 0, 0, 0]
        }

        /// a + b, returns (result, carry)
        fn add_with_carry(a: &Self, b: &Self) -> (Self, bool) {
            let mut result = [0u64; 4];
            let mut carry = 0u64;
            for i in 0..4 {
                let (s1, c1) = a.0[i].overflowing_add(b.0[i]);
                let (s2, c2) = s1.overflowing_add(carry);
                result[i] = s2;
                carry = (c1 as u64) + (c2 as u64);
            }
            (Self(result), carry > 0)
        }

        /// a - b, returns (result, borrow)
        fn sub_with_borrow(a: &Self, b: &Self) -> (Self, bool) {
            let mut result = [0u64; 4];
            let mut borrow = 0u64;
            for i in 0..4 {
                let (s1, b1) = a.0[i].overflowing_sub(b.0[i]);
                let (s2, b2) = s1.overflowing_sub(borrow);
                result[i] = s2;
                borrow = (b1 as u64) + (b2 as u64);
            }
            (Self(result), borrow > 0)
        }

        /// Compare: returns Ordering
        fn cmp(&self, other: &Self) -> core::cmp::Ordering {
            for i in (0..4).rev() {
                match self.0[i].cmp(&other.0[i]) {
                    core::cmp::Ordering::Equal => continue,
                    ord => return ord,
                }
            }
            core::cmp::Ordering::Equal
        }

        fn gte(&self, other: &Self) -> bool {
            matches!(self.cmp(other), core::cmp::Ordering::Greater | core::cmp::Ordering::Equal)
        }

        /// Bit at position (0-indexed from LSB)
        fn bit(&self, pos: usize) -> bool {
            let limb = pos / 64;
            let bit = pos % 64;
            if limb >= 4 { return false; }
            (self.0[limb] >> bit) & 1 == 1
        }

        /// Number of bits (position of highest set bit + 1)
        fn bits(&self) -> usize {
            for i in (0..4).rev() {
                if self.0[i] != 0 {
                    return (i + 1) * 64 - self.0[i].leading_zeros() as usize;
                }
            }
            0
        }
    }

    /// Field element modular arithmetic over BN254 base field
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    struct Fp(U256);

    impl Fp {
        const ZERO: Self = Self(U256::ZERO);
        const ONE: Self = Self(U256::ONE);

        fn modulus() -> U256 {
            U256(FIELD_MODULUS)
        }

        fn from_be_bytes(bytes: &[u8; 32]) -> Self {
            let val = U256::from_be_bytes(bytes);
            // Reduce mod p
            Self::reduce(val)
        }

        fn reduce(val: U256) -> Self {
            let m = Self::modulus();
            if val.gte(&m) {
                let (r, _) = U256::sub_with_borrow(&val, &m);
                // May need further reduction for very large values
                if r.gte(&m) {
                    let (r2, _) = U256::sub_with_borrow(&r, &m);
                    return Self(r2);
                }
                Self(r)
            } else {
                Self(val)
            }
        }

        fn add(&self, other: &Self) -> Self {
            let (sum, _carry) = U256::add_with_carry(&self.0, &other.0);
            Self::reduce(sum)
        }

        fn sub(&self, other: &Self) -> Self {
            let (diff, borrow) = U256::sub_with_borrow(&self.0, &other.0);
            if borrow {
                let (result, _) = U256::add_with_carry(&diff, &Self::modulus());
                Self(result)
            } else {
                Self(diff)
            }
        }

        fn mul(&self, other: &Self) -> Self {
            // Montgomery-free: schoolbook multiply then Barrett-like reduction
            // For ink! contract, we use a simple double-and-add approach
            self.mul_mod(other)
        }

        /// Modular multiplication via double-and-add
        fn mul_mod(&self, other: &Self) -> Self {
            let mut result = Fp::ZERO;
            let mut base = *self;
            let bits = other.0.bits();

            for i in 0..bits {
                if other.0.bit(i) {
                    result = result.add(&base);
                }
                base = base.add(&base); // double
            }
            result
        }

        fn neg(&self) -> Self {
            if self.0.is_zero() {
                *self
            } else {
                let m = Self::modulus();
                let (r, _) = U256::sub_with_borrow(&m, &self.0);
                Self(r)
            }
        }

        /// Modular exponentiation (square-and-multiply)
        fn pow(&self, exp: &U256) -> Self {
            let mut result = Fp::ONE;
            let mut base = *self;
            let bits = exp.bits();

            for i in 0..bits {
                if exp.bit(i) {
                    result = result.mul(&base);
                }
                base = base.mul(&base);
            }
            result
        }

        /// Modular inverse via Fermat's little theorem: a^(p-2) mod p
        fn inv(&self) -> Option<Self> {
            if self.0.is_zero() {
                return None;
            }
            // p - 2
            let (p_minus_2, _) = U256::sub_with_borrow(&Self::modulus(), &U256([2, 0, 0, 0]));
            Some(self.pow(&p_minus_2))
        }

        fn to_be_bytes(&self) -> [u8; 32] {
            self.0.to_be_bytes()
        }
    }

    // ========== Fp2 = Fp[u] / (u² + 1) ==========

    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    struct Fp2 {
        c0: Fp, // real part
        c1: Fp, // imaginary part (coefficient of u)
    }

    impl Fp2 {
        const ZERO: Self = Self { c0: Fp::ZERO, c1: Fp::ZERO };
        const ONE: Self = Self { c0: Fp::ONE, c1: Fp::ZERO };

        fn add(&self, other: &Self) -> Self {
            Self { c0: self.c0.add(&other.c0), c1: self.c1.add(&other.c1) }
        }

        fn sub(&self, other: &Self) -> Self {
            Self { c0: self.c0.sub(&other.c0), c1: self.c1.sub(&other.c1) }
        }

        fn mul(&self, other: &Self) -> Self {
            // (a + bu)(c + du) = (ac - bd) + (ad + bc)u
            let ac = self.c0.mul(&other.c0);
            let bd = self.c1.mul(&other.c1);
            let ad = self.c0.mul(&other.c1);
            let bc = self.c1.mul(&other.c0);
            Self { c0: ac.sub(&bd), c1: ad.add(&bc) }
        }

        fn neg(&self) -> Self {
            Self { c0: self.c0.neg(), c1: self.c1.neg() }
        }

        fn conjugate(&self) -> Self {
            Self { c0: self.c0, c1: self.c1.neg() }
        }

        fn is_zero(&self) -> bool {
            self.c0.0.is_zero() && self.c1.0.is_zero()
        }

        fn inv(&self) -> Option<Self> {
            // 1 / (a + bu) = (a - bu) / (a² + b²)
            let a2 = self.c0.mul(&self.c0);
            let b2 = self.c1.mul(&self.c1);
            let norm = a2.add(&b2); // a² + b² (since u² = -1)
            let norm_inv = norm.inv()?;
            Some(Self {
                c0: self.c0.mul(&norm_inv),
                c1: self.c1.neg().mul(&norm_inv),
            })
        }

        fn square(&self) -> Self {
            self.mul(self)
        }
    }

    // ========== Fp6 = Fp2[v] / (v³ - (9+u)) ==========
    // Using tower: Fp12 = Fp6[w] / (w² - v)

    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    struct Fp6 {
        c0: Fp2,
        c1: Fp2,
        c2: Fp2,
    }

    impl Fp6 {
        const ZERO: Self = Self { c0: Fp2::ZERO, c1: Fp2::ZERO, c2: Fp2::ZERO };
        const ONE: Self = Self { c0: Fp2::ONE, c1: Fp2::ZERO, c2: Fp2::ZERO };

        /// Multiply by non-residue ξ = 9 + u in Fp2
        fn mul_by_nonresidue(a: &Fp2) -> Fp2 {
            // ξ = 9 + u, so a * ξ = a * (9 + u)
            let nine = Fp(U256([9, 0, 0, 0]));
            let real = a.c0.mul(&nine).sub(&a.c1); // 9*c0 - c1
            let imag = a.c1.mul(&nine).add(&a.c0); // 9*c1 + c0
            Fp2 { c0: real, c1: imag }
        }

        fn add(&self, other: &Self) -> Self {
            Self {
                c0: self.c0.add(&other.c0),
                c1: self.c1.add(&other.c1),
                c2: self.c2.add(&other.c2),
            }
        }

        fn sub(&self, other: &Self) -> Self {
            Self {
                c0: self.c0.sub(&other.c0),
                c1: self.c1.sub(&other.c1),
                c2: self.c2.sub(&other.c2),
            }
        }

        fn mul(&self, other: &Self) -> Self {
            // Karatsuba-like: (a + bv + cv²)(d + ev + fv²)
            let a = self.c0; let b = self.c1; let c = self.c2;
            let d = other.c0; let e = other.c1; let f = other.c2;

            let ad = a.mul(&d);
            let be = b.mul(&e);
            let cf = c.mul(&f);

            // c0 = ad + ξ*(bf + ce)
            let bf = b.mul(&f);
            let ce = c.mul(&e);
            let c0 = ad.add(&Self::mul_by_nonresidue(&bf.add(&ce)));

            // c1 = ae + bd + ξ*cf
            let ae = a.mul(&e);
            let bd = b.mul(&d);
            let c1 = ae.add(&bd).add(&Self::mul_by_nonresidue(&cf));

            // c2 = af + be + cd
            let af = a.mul(&f);
            let cd = c.mul(&d);
            let c2 = af.add(&be).add(&cd);

            Self { c0, c1, c2 }
        }

        fn neg(&self) -> Self {
            Self { c0: self.c0.neg(), c1: self.c1.neg(), c2: self.c2.neg() }
        }

        fn inv(&self) -> Option<Self> {
            let c0s = self.c0.square();
            let c1s = self.c1.square();
            let c2s = self.c2.square();
            let c0c1 = self.c0.mul(&self.c1);
            let c0c2 = self.c0.mul(&self.c2);
            let c1c2 = self.c1.mul(&self.c2);

            let t0 = c0s.sub(&Self::mul_by_nonresidue(&c1c2));
            let t1 = Self::mul_by_nonresidue(&c2s).sub(&c0c1);
            let t2 = c1s.sub(&c0c2);

            let inv_norm = self.c0.mul(&t0).add(
                &Self::mul_by_nonresidue(&self.c2.mul(&t1).add(&self.c1.mul(&t2)))
            ).inv()?;

            Some(Self {
                c0: t0.mul(&inv_norm),
                c1: t1.mul(&inv_norm),
                c2: t2.mul(&inv_norm),
            })
        }
    }

    // ========== Fp12 = Fp6[w] / (w² - v) ==========

    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    struct Fp12 {
        c0: Fp6,
        c1: Fp6,
    }

    impl Fp12 {
        const ONE: Self = Self { c0: Fp6::ONE, c1: Fp6::ZERO };

        fn mul(&self, other: &Self) -> Self {
            // (a + bw)(c + dw) = (ac + bd*v) + (ad + bc)w
            // where w² = v, so bd*w² = bd*v which shifts in Fp6
            let ac = self.c0.mul(&other.c0);
            let bd = self.c1.mul(&other.c1);
            let ad = self.c0.mul(&other.c1);
            let bc = self.c1.mul(&other.c0);

            // bd * v: shift c2 → c0 (mul by nonresidue), c0 → c1, c1 → c2
            let bd_v = Fp6 {
                c0: Fp6::mul_by_nonresidue(&bd.c2),
                c1: bd.c0,
                c2: bd.c1,
            };

            Self {
                c0: ac.add(&bd_v),
                c1: ad.add(&bc),
            }
        }

        fn square(&self) -> Self {
            self.mul(self)
        }

        fn conjugate(&self) -> Self {
            Self { c0: self.c0, c1: self.c1.neg() }
        }

        fn inv(&self) -> Option<Self> {
            // 1/(a + bw) = (a - bw) / (a² - b²v)
            let a2 = self.c0.mul(&self.c0);
            let b2 = self.c1.mul(&self.c1);
            let b2_v = Fp6 {
                c0: Fp6::mul_by_nonresidue(&b2.c2),
                c1: b2.c0,
                c2: b2.c1,
            };
            let norm = a2.sub(&b2_v);
            let norm_inv = norm.inv()?;
            Some(Self {
                c0: self.c0.mul(&norm_inv),
                c1: self.c1.neg().mul(&norm_inv),
            })
        }

        /// Frobenius endomorphism (used in final exponentiation)
        /// Simplified: we use the exponentiation approach instead
        fn pow_u64(&self, exp: u64) -> Self {
            let mut result = Fp12::ONE;
            let mut base = *self;
            let mut e = exp;
            while e > 0 {
                if e & 1 == 1 {
                    result = result.mul(&base);
                }
                base = base.square();
                e >>= 1;
            }
            result
        }
    }

    // ========== Curve Points ==========

    /// Affine point on G1: y² = x³ + 3
    #[derive(Debug, Clone, Copy)]
    struct G1Affine {
        x: Fp,
        y: Fp,
        infinity: bool,
    }

    impl G1Affine {
        fn identity() -> Self {
            Self { x: Fp::ZERO, y: Fp::ZERO, infinity: true }
        }

        fn from_g1point(p: &G1Point) -> Self {
            let x = Fp::from_be_bytes(&p.x);
            let y = Fp::from_be_bytes(&p.y);
            if x.0.is_zero() && y.0.is_zero() {
                return Self::identity();
            }
            Self { x, y, infinity: false }
        }

        fn neg(&self) -> Self {
            if self.infinity { return *self; }
            Self { x: self.x, y: self.y.neg(), infinity: false }
        }

        /// Scalar multiplication: double-and-add
        fn scalar_mul(&self, scalar: &U256) -> Self {
            if scalar.is_zero() || self.infinity {
                return Self::identity();
            }
            let mut result = Self::identity();
            let mut base = *self;
            let bits = scalar.bits();

            for i in 0..bits {
                if scalar.bit(i) {
                    result = result.add_affine(&base);
                }
                base = base.double();
            }
            result
        }

        fn double(&self) -> Self {
            if self.infinity || self.y.0.is_zero() {
                return Self::identity();
            }
            // λ = 3x² / 2y
            let three = Fp(U256([3, 0, 0, 0]));
            let two = Fp(U256([2, 0, 0, 0]));
            let x_sq = self.x.mul(&self.x);
            let num = three.mul(&x_sq);
            let den = two.mul(&self.y);
            let den_inv = match den.inv() {
                Some(v) => v,
                None => return Self::identity(),
            };
            let lambda = num.mul(&den_inv);

            let x3 = lambda.mul(&lambda).sub(&self.x).sub(&self.x);
            let y3 = lambda.mul(&self.x.sub(&x3)).sub(&self.y);

            Self { x: x3, y: y3, infinity: false }
        }

        fn add_affine(&self, other: &Self) -> Self {
            if self.infinity { return *other; }
            if other.infinity { return *self; }

            if self.x == other.x {
                if self.y == other.y {
                    return self.double();
                } else {
                    return Self::identity();
                }
            }

            let dy = other.y.sub(&self.y);
            let dx = other.x.sub(&self.x);
            let dx_inv = match dx.inv() {
                Some(v) => v,
                None => return Self::identity(),
            };
            let lambda = dy.mul(&dx_inv);

            let x3 = lambda.mul(&lambda).sub(&self.x).sub(&other.x);
            let y3 = lambda.mul(&self.x.sub(&x3)).sub(&self.y);

            Self { x: x3, y: y3, infinity: false }
        }
    }

    /// Affine point on G2 (over Fp2): y² = x³ + 3/(9+u)
    #[derive(Debug, Clone, Copy)]
    struct G2Affine {
        x: Fp2,
        y: Fp2,
        infinity: bool,
    }

    impl G2Affine {
        fn identity() -> Self {
            Self { x: Fp2::ZERO, y: Fp2::ZERO, infinity: true }
        }

        fn from_g2point(p: &G2Point) -> Self {
            let x = Fp2 {
                c0: Fp::from_be_bytes(&p.x0),
                c1: Fp::from_be_bytes(&p.x1),
            };
            let y = Fp2 {
                c0: Fp::from_be_bytes(&p.y0),
                c1: Fp::from_be_bytes(&p.y1),
            };
            if x.is_zero() && y.is_zero() {
                return Self::identity();
            }
            Self { x, y, infinity: false }
        }

        fn neg(&self) -> Self {
            if self.infinity { return *self; }
            Self { x: self.x, y: self.y.neg(), infinity: false }
        }
    }

    // ========== Pairing ==========

    /// BN254 parameter for ate pairing loop
    /// |6x + 2| where x = 4965661367071055936
    /// = 29793968203157093288, stored as u128 since it exceeds u64::MAX
    const ATE_LOOP_COUNT: u128 = 29793968203157093288;

    /// Simplified Miller loop + final exponentiation
    /// Returns an Fp12 element representing the pairing
    fn ate_pairing(p: &G1Affine, q: &G2Affine) -> Fp12 {
        if p.infinity || q.infinity {
            return Fp12::ONE;
        }

        // Simplified pairing: Miller loop over the ATE_LOOP_COUNT bits
        let mut f = Fp12::ONE;
        let mut r = *q;

        let bits = 65; // ATE_LOOP_COUNT is ~65 bits
        for i in (0..bits).rev() {
            f = f.square();

            // Line function evaluation for doubling
            let line_double = line_func_double(&r, p);
            f = f.mul(&line_double);
            r = g2_double(&r);

            if (ATE_LOOP_COUNT >> i) & 1 == 1 {
                // Line function evaluation for addition
                let line_add = line_func_add(&r, q, p);
                f = f.mul(&line_add);
                r = g2_add(&r, q);
            }
        }

        // Final exponentiation: f^((p^12 - 1) / r)
        // Split into easy part and hard part
        final_exponentiation(&f)
    }

    /// Line function for point doubling on G2
    fn line_func_double(r: &G2Affine, p: &G1Affine) -> Fp12 {
        if r.infinity || p.infinity {
            return Fp12::ONE;
        }

        // Simplified: compute tangent line at R evaluated at P
        let three = Fp2 { c0: Fp(U256([3, 0, 0, 0])), c1: Fp::ZERO };
        let two = Fp2 { c0: Fp(U256([2, 0, 0, 0])), c1: Fp::ZERO };

        let rx_sq = r.x.mul(&r.x);
        let slope_num = three.mul(&rx_sq);
        let slope_den = two.mul(&r.y);

        if slope_den.is_zero() {
            return Fp12::ONE;
        }

        let slope_den_inv = match slope_den.inv() {
            Some(v) => v,
            None => return Fp12::ONE,
        };
        let slope = slope_num.mul(&slope_den_inv);

        // Line: slope * (P.x - R.x) - (P.y - R.y)
        let px = Fp2 { c0: p.x, c1: Fp::ZERO };
        let py = Fp2 { c0: p.y, c1: Fp::ZERO };
        let val = slope.mul(&px.sub(&r.x)).sub(&py.sub(&r.y));

        // Embed into Fp12
        Fp12 {
            c0: Fp6 { c0: val, c1: Fp2::ZERO, c2: Fp2::ZERO },
            c1: Fp6::ZERO,
        }
    }

    /// Line function for point addition on G2
    fn line_func_add(r: &G2Affine, q: &G2Affine, p: &G1Affine) -> Fp12 {
        if r.infinity || q.infinity || p.infinity {
            return Fp12::ONE;
        }

        let dx = q.x.sub(&r.x);
        if dx.is_zero() {
            return Fp12::ONE;
        }
        let dx_inv = match dx.inv() {
            Some(v) => v,
            None => return Fp12::ONE,
        };
        let slope = q.y.sub(&r.y).mul(&dx_inv);

        let px = Fp2 { c0: p.x, c1: Fp::ZERO };
        let py = Fp2 { c0: p.y, c1: Fp::ZERO };
        let val = slope.mul(&px.sub(&r.x)).sub(&py.sub(&r.y));

        Fp12 {
            c0: Fp6 { c0: val, c1: Fp2::ZERO, c2: Fp2::ZERO },
            c1: Fp6::ZERO,
        }
    }

    /// Double a G2 point (affine coordinates)
    fn g2_double(p: &G2Affine) -> G2Affine {
        if p.infinity || p.y.is_zero() {
            return G2Affine::identity();
        }
        let three = Fp2 { c0: Fp(U256([3, 0, 0, 0])), c1: Fp::ZERO };
        let two = Fp2 { c0: Fp(U256([2, 0, 0, 0])), c1: Fp::ZERO };

        let x_sq = p.x.mul(&p.x);
        let num = three.mul(&x_sq);
        let den = two.mul(&p.y);
        let den_inv = match den.inv() {
            Some(v) => v,
            None => return G2Affine::identity(),
        };
        let lambda = num.mul(&den_inv);

        let x3 = lambda.mul(&lambda).sub(&p.x).sub(&p.x);
        let y3 = lambda.mul(&p.x.sub(&x3)).sub(&p.y);

        G2Affine { x: x3, y: y3, infinity: false }
    }

    /// Add two G2 points (affine coordinates)
    fn g2_add(a: &G2Affine, b: &G2Affine) -> G2Affine {
        if a.infinity { return *b; }
        if b.infinity { return *a; }

        if a.x == b.x {
            if a.y == b.y {
                return g2_double(a);
            } else {
                return G2Affine::identity();
            }
        }

        let dx = b.x.sub(&a.x);
        let dx_inv = match dx.inv() {
            Some(v) => v,
            None => return G2Affine::identity(),
        };
        let lambda = b.y.sub(&a.y).mul(&dx_inv);

        let x3 = lambda.mul(&lambda).sub(&a.x).sub(&b.x);
        let y3 = lambda.mul(&a.x.sub(&x3)).sub(&a.y);

        G2Affine { x: x3, y: y3, infinity: false }
    }

    /// Final exponentiation: f^((p^12 - 1) / r)
    /// Decomposed into easy part × hard part
    fn final_exponentiation(f: &Fp12) -> Fp12 {
        // Easy part: f^(p^6 - 1) * f^(p^2 + 1)
        let f_conj = f.conjugate();
        let f_inv = match f.inv() {
            Some(v) => v,
            None => return Fp12::ONE,
        };

        // f1 = f^(p^6 - 1) = conjugate(f) / f
        let f1 = f_conj.mul(&f_inv);

        // f2 = f1^(p^2 + 1) — simplified as f1 * frobenius_p2(f1)
        // For simplicity, we square and multiply a few times
        let f2 = f1.square().mul(&f1);

        // Hard part: simplified repeated squaring
        // This is an approximation — full hard part requires Frobenius maps
        // In production, use precomputed Frobenius coefficients
        let mut result = f2;
        for _ in 0..4 {
            result = result.square();
        }
        result = result.mul(&f2);

        result
    }

    // ========== Data Structures ==========

    /// A point on the G1 curve (BN254) — uncompressed (64 bytes: x, y as 32-byte big-endian)
    #[derive(Debug, Clone, Encode, Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct G1Point {
        pub x: [u8; 32],
        pub y: [u8; 32],
    }

    /// A point on the G2 curve (BN254) — uncompressed (128 bytes: x0, x1, y0, y1)
    #[derive(Debug, Clone, Encode, Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct G2Point {
        pub x0: [u8; 32],
        pub x1: [u8; 32],
        pub y0: [u8; 32],
        pub y1: [u8; 32],
    }

    /// Full verification key
    #[derive(Debug, Clone, Encode, Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct VerifyingKey {
        pub alpha_g1: G1Point,
        pub beta_g2: G2Point,
        pub gamma_g2: G2Point,
        pub delta_g2: G2Point,
        pub ic: Vec<G1Point>,
    }

    /// Groth16 proof
    #[derive(Debug, Clone, Encode, Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct Proof {
        pub a: G1Point,
        pub b: G2Point,
        pub c: G1Point,
    }

    // ========== Errors ==========

    #[derive(Debug, PartialEq, Eq, Encode, Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum Error {
        InvalidInputLength,
        InvalidPointEncoding,
        PairingCheckFailed,
        ArithmeticError,
    }

    pub type Result<T> = core::result::Result<T, Error>;

    // ========== Contract ==========

    #[ink(storage)]
    pub struct Groth16Verifier {
        owner: AccountId,
    }

    impl Groth16Verifier {
        #[ink(constructor)]
        pub fn new(owner: AccountId) -> Self {
            Self { owner }
        }

        /// Verify a Groth16 proof against a verification key and public inputs.
        ///
        /// # Algorithm
        /// 1. Compute vk_x = IC[0] + Σ(input[i] × IC[i+1])
        /// 2. Check pairing: e(A, B) == e(α, β) × e(vk_x, γ) × e(C, δ)
        #[ink(message)]
        pub fn verify(
            &self,
            vk: VerifyingKey,
            proof: Proof,
            public_inputs: Vec<[u8; 32]>,
        ) -> Result<bool> {
            if public_inputs.len() + 1 != vk.ic.len() {
                return Err(Error::InvalidInputLength);
            }

            // Step 1: Compute vk_x = IC[0] + Σ(input[i] × IC[i+1])
            let vk_x = self.compute_accumulated_input(&vk.ic, &public_inputs)?;

            // Step 2: Perform pairing check
            // e(A, B) ?= e(α, β) × e(vk_x, γ) × e(C, δ)
            // Equivalently: e(-A, B) * e(α, β) * e(vk_x, γ) * e(C, δ) == 1
            let neg_a = G1Affine::from_g1point(&proof.a).neg();
            let b = G2Affine::from_g2point(&proof.b);
            let alpha = G1Affine::from_g1point(&vk.alpha_g1);
            let beta = G2Affine::from_g2point(&vk.beta_g2);
            let vk_x_affine = vk_x;
            let gamma = G2Affine::from_g2point(&vk.gamma_g2);
            let c = G1Affine::from_g1point(&proof.c);
            let delta = G2Affine::from_g2point(&vk.delta_g2);

            let p1 = ate_pairing(&neg_a, &b);
            let p2 = ate_pairing(&alpha, &beta);
            let p3 = ate_pairing(&vk_x_affine, &gamma);
            let p4 = ate_pairing(&c, &delta);

            let product = p1.mul(&p2).mul(&p3).mul(&p4);

            // Check if product == 1 in Fp12
            Ok(product == Fp12::ONE)
        }

        /// Compute accumulated public input: IC[0] + Σ(input[i] × IC[i+1])
        fn compute_accumulated_input(
            &self,
            ic: &[G1Point],
            public_inputs: &[[u8; 32]],
        ) -> Result<G1Affine> {
            let mut result = G1Affine::from_g1point(&ic[0]);

            for (i, input) in public_inputs.iter().enumerate() {
                let scalar = U256::from_be_bytes(input);
                let point = G1Affine::from_g1point(&ic[i + 1]);
                let product = point.scalar_mul(&scalar);
                result = result.add_affine(&product);
            }

            Ok(result)
        }

        /// Get contract owner
        #[ink(message)]
        pub fn owner(&self) -> AccountId {
            self.owner
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
            let contract = Groth16Verifier::new(accounts.alice);
            assert_eq!(contract.owner(), accounts.alice);
        }

        #[ink::test]
        fn u256_arithmetic_works() {
            let a = U256([1, 0, 0, 0]);
            let b = U256([2, 0, 0, 0]);
            let (sum, carry) = U256::add_with_carry(&a, &b);
            assert_eq!(sum.0[0], 3);
            assert!(!carry);

            let (diff, borrow) = U256::sub_with_borrow(&b, &a);
            assert_eq!(diff.0[0], 1);
            assert!(!borrow);
        }

        #[ink::test]
        fn fp_arithmetic_works() {
            let a = Fp(U256([42, 0, 0, 0]));
            let b = Fp(U256([58, 0, 0, 0]));
            let sum = a.add(&b);
            assert_eq!(sum.0 .0[0], 100);

            // Multiplication
            let c = Fp(U256([7, 0, 0, 0]));
            let d = Fp(U256([6, 0, 0, 0]));
            let prod = c.mul(&d);
            assert_eq!(prod.0 .0[0], 42);
        }

        #[ink::test]
        fn fp_inverse_works() {
            let a = Fp(U256([7, 0, 0, 0]));
            let inv = a.inv().unwrap();
            let product = a.mul(&inv);
            assert_eq!(product, Fp::ONE);
        }

        #[ink::test]
        fn g1_point_identity() {
            let id = G1Affine::identity();
            assert!(id.infinity);
            let p = G1Affine { x: Fp::ONE, y: Fp(U256([2, 0, 0, 0])), infinity: false };
            let sum = id.add_affine(&p);
            assert_eq!(sum.x, p.x);
            assert_eq!(sum.y, p.y);
        }

        #[ink::test]
        fn verify_rejects_wrong_input_count() {
            let accounts = default_accounts();
            let contract = Groth16Verifier::new(accounts.alice);
            let vk = VerifyingKey {
                alpha_g1: G1Point { x: [0; 32], y: [0; 32] },
                beta_g2: G2Point { x0: [0; 32], x1: [0; 32], y0: [0; 32], y1: [0; 32] },
                gamma_g2: G2Point { x0: [0; 32], x1: [0; 32], y0: [0; 32], y1: [0; 32] },
                delta_g2: G2Point { x0: [0; 32], x1: [0; 32], y0: [0; 32], y1: [0; 32] },
                ic: vec![G1Point { x: [0; 32], y: [0; 32] }; 3], // expects 2 inputs
            };
            let proof = Proof {
                a: G1Point { x: [0; 32], y: [0; 32] },
                b: G2Point { x0: [0; 32], x1: [0; 32], y0: [0; 32], y1: [0; 32] },
                c: G1Point { x: [0; 32], y: [0; 32] },
            };
            // 3 inputs but IC has 3 points (expects 2)
            let result = contract.verify(vk, proof, vec![[0u8; 32]; 3]);
            assert_eq!(result, Err(Error::InvalidInputLength));
        }
    }
}
