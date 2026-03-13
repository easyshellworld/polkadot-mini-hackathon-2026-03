import { useEffect, useState } from "react";
import { formatEther, type Address } from "viem";
import type { GameResult } from "../App";
import {
  usePlayerInfo,
  usePrizePool,
  useSubmitScore,
  type PlayerContractData,
} from "../hooks/useContract";
import PlaneUpgradeModal from "./PlaneUpgradeModal";
import type { PlaneStats } from "../game/types";

interface GameOverScreenProps {
  result: GameResult;
  onRestart: () => void;
  address?: Address;
}

function GameOverScreen({ result, onRestart, address }: GameOverScreenProps) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const { data: playerData, refetch: refetchPlayer } = usePlayerInfo(address);
  const { data: prizePoolData } = usePrizePool();
  const {
    submit: submitScore,
    isPending: submitPending,
    isConfirming: submitConfirming,
    isSuccess: submitSuccess,
    error: submitError,
  } = useSubmitScore();

  const onChainScore: bigint = playerData
    ? (playerData as PlayerContractData)[1]
    : 0n;
  const isNewHighScore = BigInt(result.score) > onChainScore;

  useEffect(() => {
    if (submitSuccess) refetchPlayer();
  }, [submitSuccess, refetchPlayer]);

  const handleSubmitScore = () => {
    submitScore(BigInt(result.score));
  };

  const plane = playerData
    ? (playerData as PlayerContractData)[2]
    : { moveSpeed: 0n, attackSpeed: 0n, firepower: 0n };

  const currentStats: PlaneStats = {
    moveSpeed: plane?.moveSpeed ?? 0n,
    attackSpeed: plane?.attackSpeed ?? 0n,
    firepower: plane?.firepower ?? 0n,
  };

  const prizePool = (prizePoolData as bigint | undefined) ?? 0n;
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-black">
      {/* Background overlay */}
      <div className="pointer-events-none absolute inset-0 bg-red-950/20" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Title */}
        <div className="mb-2 font-mono text-sm tracking-[0.5em] text-red-500 uppercase">
          ◈ MISSION FAILED ◈
        </div>
        <h2
          className="mb-8 font-mono text-5xl font-black tracking-widest text-red-500 md:text-7xl"
          style={{ textShadow: "0 0 20px #ff0000, 0 0 40px #ff0000" }}
        >
          GAME OVER
        </h2>

        {/* Divider */}
        <div className="mb-8 h-px w-80 bg-linear-to-r from-transparent via-red-500 to-transparent" />

        {/* Stats */}
        <div className="mb-8 grid grid-cols-3 gap-8 text-center">
          <div>
            <div className="font-mono text-xs tracking-widest text-gray-500 uppercase">
              Score
            </div>
            <div
              className="mt-1 font-mono text-4xl font-bold text-yellow-400"
              style={{ textShadow: "0 0 10px #ffd700" }}
            >
              {result.score.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="font-mono text-xs tracking-widest text-gray-500 uppercase">
              Kills
            </div>
            <div
              className="mt-1 font-mono text-4xl font-bold text-cyan-400"
              style={{ textShadow: "0 0 10px #00d4ff" }}
            >
              {result.kills}
            </div>
          </div>
          <div>
            <div className="font-mono text-xs tracking-widest text-gray-500 uppercase">
              Wave
            </div>
            <div
              className="mt-1 font-mono text-4xl font-bold text-purple-400"
              style={{ textShadow: "0 0 10px #cc00ff" }}
            >
              {result.wave}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mb-8 h-px w-80 bg-linear-to-r from-transparent via-red-500 to-transparent" />

        {/* Rank */}
        <div className="mb-8 text-center">
          <div className="font-mono text-xs tracking-widest text-gray-500 uppercase">
            Combat Rating
          </div>
          <div
            className="mt-1 font-mono text-2xl font-bold text-white"
            style={{ textShadow: "0 0 15px #ffffff" }}
          >
            {getRank(result.score)}
          </div>
        </div>

        {/* Plane stats + upgrade (shown when connected) */}
        {address && (
          <div className="mb-6 w-72 rounded border border-cyan-800 bg-gray-950/80 p-3">
            <div className="mb-2 font-mono text-xs tracking-widest text-cyan-500 uppercase">
              Plane Stats
            </div>
            <div className="mb-3 grid grid-cols-3 gap-2 text-center font-mono text-xs">
              <div>
                <div className="text-blue-400">Speed</div>
                <div className="text-white">
                  Lv.{currentStats.moveSpeed.toString()}
                </div>
              </div>
              <div>
                <div className="text-yellow-400">Atk Spd</div>
                <div className="text-white">
                  Lv.{currentStats.attackSpeed.toString()}
                </div>
              </div>
              <div>
                <div className="text-red-400">Firepower</div>
                <div className="text-white">
                  Lv.{currentStats.firepower.toString()}
                </div>
              </div>
            </div>
            <div className="mb-2 flex justify-between font-mono text-xs">
              <span className="text-gray-400">Prize Pool</span>
              <span className="text-cyan-400">
                {formatEther(prizePool)} PAS
              </span>
            </div>
            <button
              onClick={() => setUpgradeOpen(true)}
              className="w-full cursor-pointer rounded border border-cyan-500 bg-transparent py-1.5 font-mono text-xs font-bold tracking-[0.2em] text-cyan-400 uppercase transition-all hover:bg-cyan-500 hover:text-black"
            >
              ✈ Upgrade Plane
            </button>
          </div>
        )}

        {/* Score Record panel (shown when connected) */}
        {address && (
          <div className="mb-4 w-72 rounded border border-yellow-800 bg-gray-950/80 p-3">
            <div className="mb-2 font-mono text-xs tracking-widest text-yellow-500 uppercase">
              Score Record
            </div>
            <div className="mb-2 flex justify-between font-mono text-xs">
              <span className="text-gray-400">This Run</span>
              <span className="text-yellow-400">
                {result.score.toLocaleString()}
              </span>
            </div>
            <div className="mb-2 flex justify-between font-mono text-xs">
              <span className="text-gray-400">On-Chain Best</span>
              <span className="text-green-400">{onChainScore.toString()}</span>
            </div>
            {isNewHighScore && (
              <div className="mb-2 font-mono text-xs text-yellow-400">
                🏆 New High Score!
              </div>
            )}
            {submitSuccess ? (
              <div className="font-mono text-xs text-green-400">
                ✓ Score submitted!
              </div>
            ) : (
              <button
                onClick={handleSubmitScore}
                disabled={
                  submitPending ||
                  submitConfirming ||
                  !isNewHighScore
                }
                className="w-full cursor-pointer rounded border border-yellow-500 bg-transparent py-1.5 font-mono text-xs font-bold tracking-[0.2em] text-yellow-400 uppercase transition-all hover:bg-yellow-500 hover:text-black disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-yellow-400"
              >
                {submitPending || submitConfirming
                  ? "⏳ Submitting…"
                  : "Submit Score"}
              </button>
            )}
            {submitError && (
              <div className="mt-1 font-mono text-xs text-red-400">
                {submitError.message.slice(0, 80)}
              </div>
            )}
          </div>
        )}

        {/* Restart button */}
        <button
          onClick={onRestart}
          className="cursor-pointer rounded border border-cyan-500 bg-transparent px-12 py-4 font-mono text-lg font-bold tracking-[0.3em] text-cyan-400 uppercase transition-all duration-200 hover:bg-cyan-500 hover:text-black hover:shadow-[0_0_30px_#00d4ff]"
          style={{ boxShadow: "0 0 15px rgba(0,212,255,0.3)" }}
        >
          ↺ RETRY
        </button>
      </div>

      {address && (
        <PlaneUpgradeModal
          open={upgradeOpen}
          onClose={() => setUpgradeOpen(false)}
          currentStats={currentStats}
          onSuccess={() => refetchPlayer()}
        />
      )}
    </div>
  );
}

function getRank(score: number): string {
  if (score >= 50000) return "◈ ACE PILOT ◈";
  if (score >= 20000) return "★ VETERAN ★";
  if (score >= 10000) return "◆ SKILLED ◆";
  if (score >= 5000) return "▲ AVERAGE ▲";
  if (score >= 1000) return "▽ ROOKIE ▽";
  return "○ RECRUIT ○";
}

export default GameOverScreen;
