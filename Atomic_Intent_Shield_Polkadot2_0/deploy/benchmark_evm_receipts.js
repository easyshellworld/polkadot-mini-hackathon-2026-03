#!/usr/bin/env node

/**
 * Benchmark helper: fetch tx receipts and export CSV metrics.
 *
 * Usage:
 *   node deploy/benchmark_evm_receipts.js \
 *     --rpc https://your-rpc \
 *     --in docs/tx_hashes.txt \
 *     --out docs/benchmark_samples.csv
 */

const fs = require('fs');
const http = require('http');
const https = require('https');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const next = argv[i + 1];
    if (key.startsWith('--') && next && !next.startsWith('--')) {
      args[key.slice(2)] = next;
      i += 1;
    }
  }
  return args;
}

function rpcCall(rpcUrl, method, params) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    });

    const lib = rpcUrl.startsWith('https://') ? https : http;
    const url = new URL(rpcUrl);

    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.error) {
              reject(new Error(`${method} failed: ${JSON.stringify(data.error)}`));
              return;
            }
            resolve(data.result);
          } catch (err) {
            reject(new Error(`Failed to parse ${method} response: ${err.message}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function hexToBigInt(hex) {
  if (!hex) return 0n;
  return BigInt(hex);
}

function weiToEth(wei) {
  const base = 10n ** 18n;
  const whole = wei / base;
  const frac = (wei % base).toString().padStart(18, '0').slice(0, 8);
  return `${whole}.${frac}`;
}

async function main() {
  const args = parseArgs(process.argv);
  const rpc = args.rpc;
  const inputPath = args.in;
  const outputPath = args.out || 'docs/benchmark_samples.csv';

  if (!rpc || !inputPath) {
    console.error('Usage: node deploy/benchmark_evm_receipts.js --rpc <url> --in <tx_file> [--out <csv>]');
    process.exit(1);
  }

  const lines = fs
    .readFileSync(inputPath, 'utf8')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('#'));

  const rows = ['tx_hash,block_number,status,gas_used,effective_gas_price_wei,cost_wei,cost_eth'];

  for (const hash of lines) {
    try {
      const receipt = await rpcCall(rpc, 'eth_getTransactionReceipt', [hash]);
      if (!receipt) {
        rows.push(`${hash},,,pending,,,`);
        continue;
      }

      const gasUsed = hexToBigInt(receipt.gasUsed);
      const gasPrice = hexToBigInt(receipt.effectiveGasPrice || receipt.gasPrice);
      const costWei = gasUsed * gasPrice;
      const status = receipt.status === '0x1' ? 'success' : 'failed';
      const blockNumber = parseInt(receipt.blockNumber, 16);

      rows.push([
        hash,
        blockNumber,
        status,
        gasUsed.toString(),
        gasPrice.toString(),
        costWei.toString(),
        weiToEth(costWei),
      ].join(','));
    } catch (err) {
      rows.push(`${hash},,,error,,,`);
      console.error(`Failed tx ${hash}: ${err.message}`);
    }
  }

  fs.writeFileSync(outputPath, `${rows.join('\n')}\n`, 'utf8');
  console.log(`Wrote ${rows.length - 1} rows to ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
