/// Utility functions for the PolkaShield solver.

/// Convert a hex string (with or without 0x prefix) to bytes
pub fn hex_to_bytes(hex_str: &str) -> Result<Vec<u8>, hex::FromHexError> {
    let clean = hex_str.strip_prefix("0x").unwrap_or(hex_str);
    hex::decode(clean)
}

/// Convert bytes to a 0x-prefixed hex string
pub fn bytes_to_hex(bytes: &[u8]) -> String {
    format!("0x{}", hex::encode(bytes))
}

/// Truncate an address for display (e.g., "5Grw...tQY")
pub fn truncate_address(address: &str, prefix_len: usize, suffix_len: usize) -> String {
    if address.len() <= prefix_len + suffix_len + 3 {
        return address.to_string();
    }
    format!(
        "{}...{}",
        &address[..prefix_len],
        &address[address.len() - suffix_len..]
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hex_to_bytes() {
        assert_eq!(hex_to_bytes("0x01ff").unwrap(), vec![0x01, 0xff]);
        assert_eq!(hex_to_bytes("01ff").unwrap(), vec![0x01, 0xff]);
    }

    #[test]
    fn test_bytes_to_hex() {
        assert_eq!(bytes_to_hex(&[0x01, 0xff]), "0x01ff");
    }

    #[test]
    fn test_truncate_address() {
        let addr = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";
        assert_eq!(truncate_address(addr, 4, 4), "5Grw...utQY");
    }
}
