import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { ARENA_ADDRESS } from '../config/wagmi'
import PredictionArenaABI from '../contracts/PredictionArena.json'

export function useArenaContract() {
  const { data: hash, writeContract, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash })

  const createArena = (
    title: string,
    sideA: string,
    sideB: string,
    description: string,
    bettingDeadline: bigint,
    resolveDeadline: bigint,
  ) => {
    return writeContract({
      address: ARENA_ADDRESS,
      abi: PredictionArenaABI.abi,
      functionName: 'createArena',
      args: [title, sideA, sideB, description, bettingDeadline, resolveDeadline],
    })
  }

  const placeBet = (arenaId: number, side: number, amount: bigint) => {
    return writeContract({
      address: ARENA_ADDRESS,
      abi: PredictionArenaABI.abi,
      functionName: 'placeBet',
      args: [BigInt(arenaId), side],
      value: amount,
    })
  }

  const resolveArena = (arenaId: number, winningSide: number) => {
    return writeContract({
      address: ARENA_ADDRESS,
      abi: PredictionArenaABI.abi,
      functionName: 'resolveArena',
      args: [BigInt(arenaId), winningSide],
    })
  }

  const claimWinnings = (arenaId: number) => {
    return writeContract({
      address: ARENA_ADDRESS,
      abi: PredictionArenaABI.abi,
      functionName: 'claimWinnings',
      args: [BigInt(arenaId)],
    })
  }

  const cancelArena = (arenaId: number) => {
    return writeContract({
      address: ARENA_ADDRESS,
      abi: PredictionArenaABI.abi,
      functionName: 'cancelArena',
      args: [BigInt(arenaId)],
    })
  }

  return {
    createArena,
    placeBet,
    resolveArena,
    claimWinnings,
    cancelArena,
    isPending,
    isConfirming,
    isConfirmed,
    error,
    hash,
  }
}
