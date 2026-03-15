#!/bin/bash
set -e

# ============================================================
# PolkaShield — Export Verification Key for On-Chain Use
# Converts snarkjs VK JSON to ink! compatible format
# ============================================================

CIRCUIT_NAME=${1:-intent_circuit}
BUILD_DIR="./build"
VK_FILE="$BUILD_DIR/${CIRCUIT_NAME}_vk.json"
OUTPUT_FILE="$BUILD_DIR/${CIRCUIT_NAME}_vk_ink.json"

echo "=== Export Verification Key for ink! ==="
echo "Circuit: $CIRCUIT_NAME"
echo ""

if [ ! -f "$VK_FILE" ]; then
    echo "Error: Verification key not found at $VK_FILE"
    echo "Run trusted_setup.sh first."
    exit 1
fi

# Parse VK and convert to ink!-compatible format
# The VK JSON from snarkjs has this structure:
# {
#   "protocol": "groth16",
#   "curve": "bn128",
#   "nPublic": N,
#   "vk_alpha_1": [x, y, "1"],
#   "vk_beta_2": [[x1,x2], [y1,y2], ["1","0"]],
#   "vk_gamma_2": [[x1,x2], [y1,y2], ["1","0"]],
#   "vk_delta_2": [[x1,x2], [y1,y2], ["1","0"]],
#   "IC": [[x, y, "1"], ...]
# }

node -e "
const fs = require('fs');
const vk = JSON.parse(fs.readFileSync('$VK_FILE', 'utf8'));

// Convert string numbers to hex bytes for ink! contract
function toHex256(numStr) {
    return '0x' + BigInt(numStr).toString(16).padStart(64, '0');
}

// G1 point: (x, y) — each 32 bytes
function encodeG1(point) {
    return {
        x: toHex256(point[0]),
        y: toHex256(point[1])
    };
}

// G2 point: (x1, x2, y1, y2) — each 32 bytes, twisted curve
function encodeG2(point) {
    return {
        x_c0: toHex256(point[0][0]),
        x_c1: toHex256(point[0][1]),
        y_c0: toHex256(point[1][0]),
        y_c1: toHex256(point[1][1])
    };
}

const inkVk = {
    protocol: vk.protocol,
    curve: vk.curve,
    nPublic: vk.nPublic,
    alpha: encodeG1(vk.vk_alpha_1),
    beta: encodeG2(vk.vk_beta_2),
    gamma: encodeG2(vk.vk_gamma_2),
    delta: encodeG2(vk.vk_delta_2),
    ic: vk.IC.map(encodeG1),
    // Raw bytes for direct contract storage
    alpha_bytes: toHex256(vk.vk_alpha_1[0]) + toHex256(vk.vk_alpha_1[1]).slice(2),
    beta_bytes: [
        toHex256(vk.vk_beta_2[0][0]),
        toHex256(vk.vk_beta_2[0][1]),
        toHex256(vk.vk_beta_2[1][0]),
        toHex256(vk.vk_beta_2[1][1])
    ].map(s => s.slice(2)).join(''),
};

fs.writeFileSync('$OUTPUT_FILE', JSON.stringify(inkVk, null, 2));
console.log('Exported ink! compatible VK to $OUTPUT_FILE');
console.log('  nPublic:', vk.nPublic);
console.log('  IC length:', vk.IC.length);
console.log('  Protocol:', vk.protocol);
console.log('  Curve:', vk.curve);
"

echo ""
echo "=== Export Complete ==="
echo "  Output: $OUTPUT_FILE"
echo ""
echo "Use this VK when deploying the IntentVerifier ink! contract."
