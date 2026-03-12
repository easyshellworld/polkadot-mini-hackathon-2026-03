import { useState } from "react";
import { formatEther, type Address } from "viem";
import { usePlayerInfo, usePrizePool, useRegisterPlayer, type PlayerContractData } from "../hooks/useContract";
import PlaneUpgradeModal from "./PlaneUpgradeModal";
import type { PlaneStats } from "../game/types";

interface PlayerProfileProps {
  address: Address;
}

export default function PlayerProfile({ address }: PlayerProfileProps) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const {
    data: playerData,
    isLoading: playerLoading,
    refetch: refetchPlayer,
  } = usePlayerInfo(address);

  const { data: prizePoolData } = usePrizePool();

  const { register, isPending, isConfirming, isSuccess, error } =
    useRegisterPlayer();

  // playerData is a tuple: [registered, score, plane { moveSpeed, attackSpeed, firepower }]
  const registered = playerData ? (playerData as PlayerContractData)[0] : false;
  const score = playerData ? (playerData as PlayerContractData)[1] : 0n;
  const plane = playerData
    ? (playerData as PlayerContractData)[2]
    : { moveSpeed: 0n, attackSpeed: 0n, firepower: 0n };

  const currentStats: PlaneStats = {
    moveSpeed: plane?.moveSpeed ?? 0n,
    attackSpeed: plane?.attackSpeed ?? 0n,
    firepower: plane?.firepower ?? 0n,
  };

  const prizePool = (prizePoolData as bigint | undefined) ?? 0n;

  const shortAddr = `${address.slice(0, 6)}…${address.slice(-4)}`;

  if (playerLoading) {
    return (
      <div className="font-mono text-xs text-gray-500">Loading profile…</div>
    );
  }

  return (
    <div className="rounded border border-cyan-800 bg-gray-950/80 p-4 text-white">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-4">
        <span className="font-mono text-xs text-cyan-400">{shortAddr}</span>
        {registered ? (
          <span className="font-mono text-xs text-green-400">✓ Registered</span>
        ) : (
          <button
            onClick={() => {
              register();
            }}
            disabled={isPending || isConfirming}
            className="cursor-pointer rounded border border-green-500 bg-transparent px-3 py-1 font-mono text-xs text-green-400 uppercase transition-all hover:bg-green-500 hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending || isConfirming ? "⏳ Registering…" : "Register"}
          </button>
        )}
      </div>

      {isSuccess && !registered && (
        <p
          className="mb-2 font-mono text-xs text-green-400"
          onAnimationEnd={() => refetchPlayer()}
        >
          ✓ Registration successful!
        </p>
      )}
      {error && (
        <p className="mb-2 font-mono text-xs text-red-400">
          {error.message.slice(0, 80)}
        </p>
      )}

      {/* Stats */}
      {registered && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 font-mono text-xs">
            <div>
              <span className="text-gray-400">Score</span>
              <span className="ml-2 text-yellow-400">{score.toString()}</span>
            </div>
            <div>
              <span className="text-gray-400">Prize Pool</span>
              <span className="ml-2 text-cyan-400">
                {formatEther(prizePool)} PAS
              </span>
            </div>
            <div>
              <span className="text-blue-400">Speed</span>
              <span className="ml-2 text-white">
                Lv.{currentStats.moveSpeed.toString()}
              </span>
            </div>
            <div>
              <span className="text-yellow-400">Atk Spd</span>
              <span className="ml-2 text-white">
                Lv.{currentStats.attackSpeed.toString()}
              </span>
            </div>
            <div>
              <span className="text-red-400">Firepower</span>
              <span className="ml-2 text-white">
                Lv.{currentStats.firepower.toString()}
              </span>
            </div>
          </div>

          <button
            onClick={() => setUpgradeOpen(true)}
            className="w-full cursor-pointer rounded border border-cyan-500 bg-transparent py-1.5 font-mono text-xs font-bold tracking-[0.2em] text-cyan-400 uppercase transition-all hover:bg-cyan-500 hover:text-black"
          >
            ✈ Upgrade Plane
          </button>
        </>
      )}

      <PlaneUpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        currentStats={currentStats}
        onSuccess={() => refetchPlayer()}
      />
    </div>
  );
}
