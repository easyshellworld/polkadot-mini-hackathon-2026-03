import React, { useEffect, useMemo, useState } from 'react';
import { useEvm } from '../providers/EvmProvider';
import { generateProof } from '../utils/prover';
import { SolverApiError, getPendingIntents, submitIntent } from '../utils/solver-api';

interface LatencyMetrics {
  proofMs: number;
  signMs: number;
  submitMs: number;
}

const TradePanel: React.FC = () => {
  const { evmAddress, isEvmConnected, isEvmConnecting, connectEvm, evmChainId } = useEvm();

  const [sellToken, setSellToken] = useState<'WETH' | 'USDC'>('WETH');
  const [amountIn, setAmountIn] = useState('');
  const [minAmountOut, setMinAmountOut] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<string>('Waiting for intent submission...');
  const [error, setError] = useState<string | null>(null);
  const [lastNullifier, setLastNullifier] = useState<string | null>(null);
  const [lastIntentHash, setLastIntentHash] = useState<string | null>(null);
  const [lastIntentStatus, setLastIntentStatus] = useState<string | null>(null);
  const [reversePendingCount, setReversePendingCount] = useState(0);
  const [sellBalanceBase, setSellBalanceBase] = useState<bigint>(0n);
  const [buyBalanceBase, setBuyBalanceBase] = useState<bigint>(0n);
  const [allowanceBase, setAllowanceBase] = useState<bigint>(0n);
  const [isApproving, setIsApproving] = useState(false);
  const [mintingToken, setMintingToken] = useState<'WETH' | 'USDC' | null>(null);
  const [metrics, setMetrics] = useState<LatencyMetrics | null>(null);

  const evmWethAddress = (import.meta.env.VITE_EVM_WETH_TOKEN_ADDRESS as string | undefined)?.trim() || '';
  const evmUsdcAddress = (import.meta.env.VITE_EVM_USDC_TOKEN_ADDRESS as string | undefined)?.trim() || '';
  const darkPoolAddress = (import.meta.env.VITE_DARK_POOL_ADDRESS as string | undefined)?.trim() || '';
  const mintAmountWeth = (import.meta.env.VITE_TEST_MINT_WETH as string | undefined)?.trim() || '1000';
  const mintAmountUsdc = (import.meta.env.VITE_TEST_MINT_USDC as string | undefined)?.trim() || '1000';
  const configuredChainId = ((import.meta.env.VITE_EVM_CHAIN_ID_HEX as string | undefined) || '').toLowerCase();
  const configuredChainName = (import.meta.env.VITE_EVM_CHAIN_NAME as string | undefined) || 'Revive Network';

  const tokenMap = useMemo(
    () => ({
      WETH: { symbol: 'wETH', decimals: 18, address: evmWethAddress },
      USDC: { symbol: 'USDC', decimals: 6, address: evmUsdcAddress },
    }),
    [evmUsdcAddress, evmWethAddress],
  );

  const buyToken: 'WETH' | 'USDC' = sellToken === 'WETH' ? 'USDC' : 'WETH';
  const sellMeta = tokenMap[sellToken];
  const buyMeta = tokenMap[buyToken];
  const isChainMismatch = !!configuredChainId && !!evmChainId && configuredChainId !== evmChainId.toLowerCase();
  const hasAllowance = allowanceBase > 0n;

  const canSubmit = isEvmConnected && !!sellMeta.address && !!buyMeta.address;

  useEffect(() => {
    if (!lastNullifier) return;

    let timer: number | null = null;
    const poll = async () => {
      try {
        const pending = await getPendingIntents();
        const own = pending.find((item: any) => item.nullifier === lastNullifier);
        if (own) {
          setLastIntentStatus('pending');
        } else if (lastIntentStatus === 'pending') {
          setLastIntentStatus('matched');
          setStatus('Matched and forwarded for settlement.');
        }

        const reverse = pending.filter((item: any) => (
          sameAddress(item.token_in, buyMeta.address) &&
          sameAddress(item.token_out, sellMeta.address)
        ));
        setReversePendingCount(reverse.length);
      } catch {
        // Ignore polling errors in demo mode.
      }
    };

    poll();
    timer = window.setInterval(poll, 3000);
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [buyMeta.address, lastIntentStatus, lastNullifier, sellMeta.address]);

  useEffect(() => {
    const loadReversePool = async () => {
      if (!sellMeta.address || !buyMeta.address) {
        setReversePendingCount(0);
        return;
      }
      try {
        const pending = await getPendingIntents();
        const reverse = pending.filter((item: any) => (
          sameAddress(item.token_in, buyMeta.address) &&
          sameAddress(item.token_out, sellMeta.address)
        ));
        setReversePendingCount(reverse.length);
      } catch {
        setReversePendingCount(0);
      }
    };
    loadReversePool();
  }, [buyMeta.address, sellMeta.address]);

  useEffect(() => {
    const loadTokenState = async () => {
      if (!isEvmConnected || !evmAddress || !sellMeta.address || !buyMeta.address || !darkPoolAddress) {
        setSellBalanceBase(0n);
        setBuyBalanceBase(0n);
        setAllowanceBase(0n);
        return;
      }
      try {
        const provider = (window as any).ethereum;
        if (!provider) return;

        const [sellBalHex, buyBalHex, allowanceHex] = await Promise.all([
          provider.request({
            method: 'eth_call',
            params: [{ to: sellMeta.address, data: encodeBalanceOf(evmAddress) }, 'latest'],
          }),
          provider.request({
            method: 'eth_call',
            params: [{ to: buyMeta.address, data: encodeBalanceOf(evmAddress) }, 'latest'],
          }),
          provider.request({
            method: 'eth_call',
            params: [{ to: sellMeta.address, data: encodeAllowance(evmAddress, darkPoolAddress) }, 'latest'],
          }),
        ]);

        setSellBalanceBase(hexToBigInt(sellBalHex || '0x0'));
        setBuyBalanceBase(hexToBigInt(buyBalHex || '0x0'));
        setAllowanceBase(hexToBigInt(allowanceHex || '0x0'));
      } catch {
        setSellBalanceBase(0n);
        setBuyBalanceBase(0n);
        setAllowanceBase(0n);
      }
    };

    loadTokenState();
  }, [buyMeta.address, darkPoolAddress, evmAddress, isEvmConnected, sellMeta.address]);

  const handleApprove = async () => {
    setError(null);
    try {
      if (!isEvmConnected || !evmAddress) throw new Error('Please connect EVM wallet first.');
      if (!sellMeta.address) throw new Error('Missing sell token address.');
      if (!darkPoolAddress) throw new Error('Missing dark pool address.');

      const provider = (window as any).ethereum;
      if (!provider) throw new Error('EVM provider unavailable.');

      setIsApproving(true);
      setStatus(`Approving ${sellMeta.symbol} for settlement...`);
      const txHash = await requestApproveTx(provider, evmAddress, sellMeta.address, darkPoolAddress);
      await waitForReceipt(provider, txHash);
      setStatus(`Approve confirmed: ${txHash}`);

      const refreshed = await readAllowance(provider, evmAddress, sellMeta.address, darkPoolAddress);
      setAllowanceBase(refreshed);
    } catch (err: any) {
      setError(err?.message || 'Approve failed');
    } finally {
      setIsApproving(false);
    }
  };

  const handleMint = async (token: 'WETH' | 'USDC') => {
    setError(null);
    try {
      if (!isEvmConnected || !evmAddress) throw new Error('Please connect EVM wallet first.');
      const provider = (window as any).ethereum;
      if (!provider) throw new Error('EVM provider unavailable.');

      const tokenMeta = tokenMap[token];
      if (!tokenMeta.address) throw new Error(`Missing ${tokenMeta.symbol} token address.`);

      const mintAmountHuman = token === 'WETH' ? mintAmountWeth : mintAmountUsdc;
      const mintAmountBase = decimalToBaseUnits(mintAmountHuman, tokenMeta.decimals);

      setMintingToken(token);
      setStatus(`Minting ${mintAmountHuman} ${tokenMeta.symbol}...`);
      const txHash = await requestMintTx(provider, evmAddress, tokenMeta.address, mintAmountBase);
      await waitForReceipt(provider, txHash);

      const refreshedBal = await readBalance(provider, evmAddress, tokenMeta.address);
      if (token === sellToken) {
        setSellBalanceBase(refreshedBal);
      }
      if (token === buyToken) {
        setBuyBalanceBase(refreshedBal);
      }
      setStatus(`Mint confirmed: ${txHash}`);
    } catch (err: any) {
      setError(err?.message || 'Mint failed');
    } finally {
      setMintingToken(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus('Preparing intent...');

    try {
      if (!isEvmConnected || !evmAddress) {
        throw new Error('Please connect EVM wallet first.');
      }
      if (!sellMeta.address || !buyMeta.address) {
        throw new Error('Missing token contract addresses in environment.');
      }
      if (!darkPoolAddress) {
        throw new Error('Missing dark pool address.');
      }
      const provider = (window as any).ethereum;
      if (!provider) throw new Error('EVM provider unavailable.');

      const amountInBase = decimalToBaseUnits(amountIn, sellMeta.decimals);
      const minAmountOutBase = decimalToBaseUnits(minAmountOut, buyMeta.decimals);
      if (BigInt(amountInBase) <= 0n) throw new Error('Amount in must be greater than 0.');
      if (BigInt(minAmountOutBase) <= 0n) throw new Error('Min amount out must be greater than 0.');

      if (sellBalanceBase < BigInt(amountInBase)) {
        throw new Error(`Insufficient ${sellMeta.symbol} balance. Please top up token first.`);
      }
      if (allowanceBase < BigInt(amountInBase)) {
        setStatus(`Insufficient ${sellMeta.symbol} allowance. Requesting wallet approval...`);
        const approved = await ensureAllowanceForAmount({
          provider,
          owner: evmAddress,
          tokenAddress: sellMeta.address,
          spenderAddress: darkPoolAddress,
          requiredAmount: BigInt(amountInBase),
        });
        if (!approved) {
          throw new Error(`Insufficient ${sellMeta.symbol} allowance after approval attempt.`);
        }
      }

      setIsSubmitting(true);

      setStatus('Generating ZK proof...');
      const proofStart = performance.now();
      const proof = await generateProof({
        user: evmAddress,
        tokenIn: sellMeta.address,
        tokenOut: buyMeta.address,
        amountIn: amountInBase,
        minAmountOut: minAmountOutBase,
      });
      const proofMs = Math.round(performance.now() - proofStart);

      setStatus('Signing intent...');
      const payload = JSON.stringify({
        intentHash: proof.intentHash,
        nullifier: proof.nullifier,
        user: evmAddress,
        recipient: evmAddress,
        tokenIn: sellMeta.address,
        tokenOut: buyMeta.address,
        amountIn: amountInBase,
        minAmountOut: minAmountOutBase,
      });
      const msgHex = `0x${Array.from(new TextEncoder().encode(payload)).map((b) => b.toString(16).padStart(2, '0')).join('')}`;
      const signStart = performance.now();
      const signature = await requestPersonalSign(provider, evmAddress, msgHex);
      const signMs = Math.round(performance.now() - signStart);

      setStatus('Submitting intent to solver...');
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const submitStart = performance.now();
      await submitIntent({
        intentHash: proof.intentHash,
        nullifier: proof.nullifier,
        proofData: proof.proofData,
        proofPublicInputs: proof.publicInputs,
        publicInputs: {
          user: evmAddress,
          recipient: evmAddress,
          tokenIn: sellMeta.address,
          tokenOut: buyMeta.address,
          amountIn: amountInBase,
          minAmountOut: minAmountOutBase,
          deadline,
          nonce: Date.now(),
          chainId: evmChainId || '0x190f1b41',
          domainSeparator: 'polkashield-v1',
          version: 1,
        },
        signature,
      });
      const submitMs = Math.round(performance.now() - submitStart);
      setMetrics({ proofMs, signMs, submitMs });

      setLastNullifier(proof.nullifier);
      setLastIntentHash(proof.intentHash);
      setLastIntentStatus('pending');
      setStatus('Intent submitted. Waiting for opposite-side intent to match...');
    } catch (err: any) {
      if (err instanceof SolverApiError) {
        setError(`${err.message} (${err.code || 'SOLVER_ERROR'})`);
      } else {
        setError(err?.message || 'Failed to submit intent');
      }
      setLastIntentStatus(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-2xl p-6 shadow-xl">
      <h2 className="text-xl font-bold mb-3">Live Intent Swap Demo</h2>
      <p className="text-sm text-gray-400 mb-5">
        Track 1 Migration Demo on Revive-compatible EVM flow. Your order executes only after an opposite-side intent appears.
      </p>

      <div className="mb-4 text-xs bg-emerald-900/20 text-emerald-300 border border-emerald-800 rounded-lg px-3 py-2">
        Track 1 goal: demonstrate Ethereum-toolchain migration on Revive and compare runtime performance.
      </div>

      {isChainMismatch && (
        <div className="mb-4 text-xs bg-red-900/20 text-red-300 border border-red-800 rounded-lg px-3 py-2">
          Connected chain {evmChainId} does not match configured {configuredChainName} ({configuredChainId}).
          Please switch wallet network before submitting intent.
        </div>
      )}

      <div className="bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-3 text-sm mb-4">
        <div className="text-gray-400 font-semibold mb-1">Trader Wallet (EVM)</div>
        {isEvmConnected && evmAddress ? (
          <>
            <div className="text-gray-200 break-all font-mono text-xs">{evmAddress}</div>
            <div className="mt-1 text-yellow-300">
              Reverse intents available for {buyMeta.symbol} -&gt; {sellMeta.symbol}: {reversePendingCount}
            </div>
            <div className="mt-2 text-xs text-gray-300 space-y-1">
              <div>Sell balance ({sellMeta.symbol}): {formatUnits(sellBalanceBase, sellMeta.decimals, 4)}</div>
              <div>Buy balance ({buyMeta.symbol}): {formatUnits(buyBalanceBase, buyMeta.decimals, 4)}</div>
              <div>Allowance to DarkPool ({sellMeta.symbol}): {formatUnits(allowanceBase, sellMeta.decimals, 4)}</div>
            </div>
            <div className="mt-3">
              <div className="text-[11px] text-gray-400 mb-1">Demo Faucet (Mock Tokens)</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleMint('WETH')}
                  disabled={mintingToken !== null || !tokenMap.WETH.address}
                  className="px-3 py-1.5 bg-teal-700 hover:bg-teal-600 rounded-lg text-xs font-semibold disabled:bg-gray-700"
                >
                  {mintingToken === 'WETH' ? 'Minting wETH...' : `Mint ${mintAmountWeth} wETH`}
                </button>
                <button
                  type="button"
                  onClick={() => handleMint('USDC')}
                  disabled={mintingToken !== null || !tokenMap.USDC.address}
                  className="px-3 py-1.5 bg-teal-700 hover:bg-teal-600 rounded-lg text-xs font-semibold disabled:bg-gray-700"
                >
                  {mintingToken === 'USDC' ? 'Minting USDC...' : `Mint ${mintAmountUsdc} USDC`}
                </button>
              </div>
            </div>
            <div className="mt-2">
              <button
                type="button"
                onClick={handleApprove}
                disabled={isApproving || !darkPoolAddress || hasAllowance}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold disabled:bg-gray-700"
              >
                {isApproving ? `Approving ${sellMeta.symbol}...` : hasAllowance ? `${sellMeta.symbol} Approved` : `Approve ${sellMeta.symbol}`}
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={connectEvm}
            disabled={isEvmConnecting}
            className="mt-1 px-4 py-2 bg-pink-600 hover:bg-pink-500 rounded-lg text-sm font-semibold disabled:bg-gray-700"
          >
            {isEvmConnecting ? 'Connecting...' : 'Connect EVM Wallet'}
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Sell Token</label>
          <select
            value={sellToken}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSellToken(e.target.value as 'WETH' | 'USDC')}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-pink-500"
          >
            <option value="WETH">wETH</option>
            <option value="USDC">USDC</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Amount In ({sellMeta.symbol})</label>
          <input
            type="text"
            value={amountIn}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmountIn(e.target.value)}
            placeholder="0.0"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Min Amount Out ({buyMeta.symbol})</label>
          <input
            type="text"
            value={minAmountOut}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMinAmountOut(e.target.value)}
            placeholder="0.0"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
            required
          />
        </div>

        <div className="text-xs text-gray-400 bg-gray-900/40 p-3 rounded-lg border border-gray-700">
          Matching rule: your {sellMeta.symbol} -&gt; {buyMeta.symbol} intent will stay pending until someone submits
          the opposite {buyMeta.symbol} -&gt; {sellMeta.symbol} intent with compatible amounts.
        </div>
        {reversePendingCount === 0 && (
          <div className="text-xs text-amber-300 bg-amber-900/20 p-3 rounded-lg border border-amber-800">
            No opposite intent yet. Ask another wallet to submit {buyMeta.symbol} -&gt; {sellMeta.symbol}.
          </div>
        )}

        {error && <div className="text-red-400 text-sm bg-red-900/20 p-3 rounded-lg">{error}</div>}
        {status && <div className="text-blue-400 text-sm bg-blue-900/20 p-3 rounded-lg">{status}</div>}
        {metrics && (
          <div className="text-xs text-emerald-300 bg-emerald-900/20 p-3 rounded-lg border border-emerald-800">
            Revive migration metrics: proof {metrics.proofMs}ms, sign {metrics.signMs}ms, solver submit {metrics.submitMs}ms
          </div>
        )}
        {lastIntentHash && <div className="text-cyan-300 text-xs bg-cyan-900/20 p-3 rounded-lg break-all">Intent Hash: {lastIntentHash}</div>}
        {lastNullifier && <div className="text-cyan-300 text-xs bg-cyan-900/20 p-3 rounded-lg break-all">Nullifier: {lastNullifier}</div>}
        {lastIntentStatus && <div className="text-xs text-amber-300 bg-amber-900/20 p-3 rounded-lg">Current status: {lastIntentStatus}</div>}

        <button
          type="submit"
          disabled={!canSubmit || isSubmitting || isChainMismatch}
          className="w-full py-3 rounded-lg font-bold text-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed bg-pink-600 hover:bg-pink-500"
        >
          {!isEvmConnected ? 'Connect EVM Wallet' : isSubmitting ? 'Submitting...' : `Submit ${sellMeta.symbol} -> ${buyMeta.symbol} Intent`}
        </button>
      </form>
    </div>
  );
};

function sameAddress(a: string, b: string): boolean {
  return a?.toLowerCase?.() === b?.toLowerCase?.();
}

function hexToBigInt(value: string): bigint {
  if (!value || value === '0x') return 0n;
  return BigInt(value);
}

function encodeBalanceOf(account: string): string {
  const selector = '70a08231';
  const acct = account.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  return `0x${selector}${acct}`;
}

function encodeAllowance(owner: string, spender: string): string {
  const selector = 'dd62ed3e';
  const o = owner.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const s = spender.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  return `0x${selector}${o}${s}`;
}

function encodeApprove(spender: string, amount: string): string {
  const selector = '095ea7b3';
  const s = spender.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const a = BigInt(amount).toString(16).padStart(64, '0');
  return `0x${selector}${s}${a}`;
}

function encodeMint(to: string, amount: string): string {
  const selector = '40c10f19';
  const t = to.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const a = BigInt(amount).toString(16).padStart(64, '0');
  return `0x${selector}${t}${a}`;
}

async function requestApproveTx(
  provider: any,
  owner: string,
  tokenAddress: string,
  spenderAddress: string,
): Promise<string> {
  const amountToApprove = (2n ** 256n - 1n).toString();
  return provider.request({
    method: 'eth_sendTransaction',
    params: [{
      from: owner,
      to: tokenAddress,
      data: encodeApprove(spenderAddress, amountToApprove),
      value: '0x0',
    }],
  });
}

async function requestMintTx(
  provider: any,
  owner: string,
  tokenAddress: string,
  amount: string,
): Promise<string> {
  return provider.request({
    method: 'eth_sendTransaction',
    params: [{
      from: owner,
      to: tokenAddress,
      data: encodeMint(owner, amount),
      value: '0x0',
    }],
  });
}

async function readBalance(provider: any, owner: string, tokenAddress: string): Promise<bigint> {
  const balanceHex = await provider.request({
    method: 'eth_call',
    params: [{ to: tokenAddress, data: encodeBalanceOf(owner) }, 'latest'],
  });
  return hexToBigInt(balanceHex || '0x0');
}

async function readAllowance(
  provider: any,
  owner: string,
  tokenAddress: string,
  spenderAddress: string,
): Promise<bigint> {
  const allowanceHex = await provider.request({
    method: 'eth_call',
    params: [{ to: tokenAddress, data: encodeAllowance(owner, spenderAddress) }, 'latest'],
  });
  return hexToBigInt(allowanceHex || '0x0');
}

async function ensureAllowanceForAmount(args: {
  provider: any;
  owner: string;
  tokenAddress: string;
  spenderAddress: string;
  requiredAmount: bigint;
}): Promise<boolean> {
  const initial = await readAllowance(args.provider, args.owner, args.tokenAddress, args.spenderAddress);
  if (initial >= args.requiredAmount) return true;

  const approveTx = await requestApproveTx(
    args.provider,
    args.owner,
    args.tokenAddress,
    args.spenderAddress,
  );

  try {
    await waitForReceipt(args.provider, approveTx, 90000);
  } catch {
    // Some RPCs delay receipts; fallback to allowance polling below.
  }

  for (let i = 0; i < 12; i += 1) {
    const latest = await readAllowance(args.provider, args.owner, args.tokenAddress, args.spenderAddress);
    if (latest >= args.requiredAmount) return true;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return false;
}

async function waitForReceipt(provider: any, txHash: string, timeoutMs = 120000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const receipt = await provider.request({ method: 'eth_getTransactionReceipt', params: [txHash] });
    if (receipt) {
      if (receipt.status && receipt.status !== '0x1') {
        throw new Error(`Transaction reverted: ${txHash}`);
      }
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('Timeout waiting for transaction confirmation.');
}

async function requestPersonalSign(
  provider: any,
  address: string,
  messageHex: string,
  timeoutMs = 45000,
): Promise<string> {
  const withTimeout = <T,>(promise: Promise<T>, label: string) => Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} timed out. Open wallet and confirm, then retry.`)), timeoutMs);
    }),
  ]);

  try {
    return await withTimeout(
      provider.request({ method: 'personal_sign', params: [messageHex, address] }),
      'Wallet signature',
    );
  } catch (firstErr) {
    try {
      // Some wallets expect parameters in reverse order.
      return await withTimeout(
        provider.request({ method: 'personal_sign', params: [address, messageHex] }),
        'Wallet signature',
      );
    } catch {
      throw firstErr;
    }
  }
}

function formatUnits(value: bigint, decimals: number, precision = 4): string {
  const base = 10n ** BigInt(decimals);
  const i = value / base;
  const f = value % base;
  if (f === 0n) return i.toString();
  const padded = f.toString().padStart(decimals, '0');
  const trimmed = padded.slice(0, precision).replace(/0+$/, '');
  return trimmed ? `${i}.${trimmed}` : i.toString();
}

function decimalToBaseUnits(input: string, decimals: number): string {
  const normalized = input.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`Amount "${input}" is invalid. Use a number like 1 or 0.01.`);
  }
  const [wholePart, fractionPart = ''] = normalized.split('.');
  if (fractionPart.length > decimals) {
    throw new Error(`Amount "${input}" has too many decimal places (max ${decimals}).`);
  }
  const paddedFraction = fractionPart.padEnd(decimals, '0');
  const base = `${wholePart}${paddedFraction}`.replace(/^0+/, '') || '0';
  return BigInt(base).toString();
}

export default TradePanel;
