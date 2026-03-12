import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { type Address } from "viem";
import AceAirCombatArtifact from "../../abis/AceAirCombat.json";
import { CONTRACT_ADDRESS } from "../config";

const abi = AceAirCombatArtifact.abi;

/**
 * Decoded return type of the `players(address)` contract function.
 * Tuple: [registered, score, plane { moveSpeed, attackSpeed, firepower }]
 */
export type PlayerContractData = readonly [
  boolean,
  bigint,
  { moveSpeed: bigint; attackSpeed: bigint; firepower: bigint },
];

// ─── Read: player info ──────────────────────────────────────────────────────

export function usePlayerInfo(address: Address | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: "players",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

// ─── Read: prize pool ───────────────────────────────────────────────────────

export function usePrizePool() {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: "prizePool",
  });
}

// ─── Read: upgrade cost per point ───────────────────────────────────────────

export function useUpgradeCost() {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: "UPGRADE_COST_PER_POINT",
  });
}

// ─── Write: register player ─────────────────────────────────────────────────

export function useRegisterPlayer() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const register = () =>
    writeContract({
      address: CONTRACT_ADDRESS,
      abi,
      functionName: "registerPlayer",
    });

  return { register, isPending, isConfirming, isSuccess, error };
}

// ─── Write: upgrade plane ────────────────────────────────────────────────────

export function useUpgradePlane() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const upgrade = (
    moveSpeed: bigint,
    attackSpeed: bigint,
    firepower: bigint,
    value: bigint,
  ) =>
    writeContract({
      address: CONTRACT_ADDRESS,
      abi,
      functionName: "upgradePlane",
      args: [moveSpeed, attackSpeed, firepower],
      value,
    });

  return { upgrade, isPending, isConfirming, isSuccess, error };
}
