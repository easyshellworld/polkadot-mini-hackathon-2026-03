import { useState, useEffect } from "react";
import { formatEther } from "viem";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUpgradePlane, useUpgradeCost } from "../hooks/useContract";
import type { PlaneStats } from "../game/types";

interface PlaneUpgradeModalProps {
  open: boolean;
  onClose: () => void;
  currentStats: PlaneStats;
  onSuccess?: () => void;
}

const COST_FALLBACK = 1_000_000_000_000_000n; // 0.001 PAS

export default function PlaneUpgradeModal({
  open,
  onClose,
  currentStats,
  onSuccess,
}: PlaneUpgradeModalProps) {
  const [moveSpeedDelta, setMoveSpeedDelta] = useState(0n);
  const [attackSpeedDelta, setAttackSpeedDelta] = useState(0n);
  const [firepowerDelta, setFirepowerDelta] = useState(0n);

  const { data: costPerPoint } = useUpgradeCost();
  const cost = (costPerPoint as bigint | undefined) ?? COST_FALLBACK;
  const { upgrade, isPending, isConfirming, isSuccess, error } =
    useUpgradePlane();

  // Reset on close
  useEffect(() => {
    if (!open) {
      setMoveSpeedDelta(0n);
      setAttackSpeedDelta(0n);
      setFirepowerDelta(0n);
    }
  }, [open]);

  // Close modal on success
  useEffect(() => {
    if (isSuccess) {
      onSuccess?.();
      setTimeout(onClose, 1500);
    }
  }, [isSuccess, onSuccess, onClose]);

  const totalPoints = moveSpeedDelta + attackSpeedDelta + firepowerDelta;
  const totalCost = totalPoints * cost;

  const handleUpgrade = () => {
    if (totalPoints === 0n) return;
    upgrade(moveSpeedDelta, attackSpeedDelta, firepowerDelta, totalCost);
  };

  const StatRow = ({
    label,
    current,
    delta,
    setDelta,
    color,
  }: {
    label: string;
    current: bigint;
    delta: bigint;
    setDelta: (v: bigint) => void;
    color: string;
  }) => (
    <div className="flex items-center justify-between gap-4 font-mono text-sm">
      <span className={`w-32 ${color} uppercase tracking-widest`}>{label}</span>
      <span className="w-12 text-right text-white">Lv.{current.toString()}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => delta > 0n && setDelta(delta - 1n)}
          disabled={delta === 0n}
          className="h-7 w-7 cursor-pointer rounded border border-gray-600 bg-gray-800 text-white hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          −
        </button>
        <span className="w-6 text-center text-cyan-400">{delta.toString()}</span>
        <button
          onClick={() => setDelta(delta + 1n)}
          className="h-7 w-7 cursor-pointer rounded border border-gray-600 bg-gray-800 text-white hover:border-cyan-400"
        >
          +
        </button>
      </div>
      <span className="w-16 text-right text-gray-400">
        → Lv.{(current + delta).toString()}
      </span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="border border-cyan-800 bg-gray-950 text-white">
        <DialogHeader>
          <DialogTitle className="font-mono tracking-widest text-cyan-400 uppercase">
            ✈ Upgrade Plane
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <StatRow
            label="Move Speed"
            current={currentStats.moveSpeed}
            delta={moveSpeedDelta}
            setDelta={setMoveSpeedDelta}
            color="text-blue-400"
          />
          <StatRow
            label="Attack Speed"
            current={currentStats.attackSpeed}
            delta={attackSpeedDelta}
            setDelta={setAttackSpeedDelta}
            color="text-yellow-400"
          />
          <StatRow
            label="Firepower"
            current={currentStats.firepower}
            delta={firepowerDelta}
            setDelta={setFirepowerDelta}
            color="text-red-400"
          />

          <div className="mt-4 border-t border-gray-800 pt-4">
            <div className="flex justify-between font-mono text-sm">
              <span className="text-gray-400">Total Points</span>
              <span className="text-white">{totalPoints.toString()}</span>
            </div>
            <div className="flex justify-between font-mono text-sm">
              <span className="text-gray-400">Total Cost</span>
              <span className="text-cyan-400">
                {formatEther(totalCost)} PAS
              </span>
            </div>
          </div>

          {error && (
            <p className="font-mono text-xs text-red-400">
              Error: {error.message.slice(0, 80)}
            </p>
          )}
          {isSuccess && (
            <p className="font-mono text-xs text-green-400">
              ✓ Upgrade successful!
            </p>
          )}

          <button
            onClick={handleUpgrade}
            disabled={
              totalPoints === 0n || isPending || isConfirming || isSuccess
            }
            className="mt-2 w-full cursor-pointer rounded border border-cyan-500 bg-transparent py-2 font-mono text-sm font-bold tracking-[0.2em] text-cyan-400 uppercase transition-all hover:bg-cyan-500 hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending || isConfirming ? "⏳ Confirming..." : "▶ Upgrade"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
