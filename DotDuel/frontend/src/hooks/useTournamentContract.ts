import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'

// Tournament contract address from env
export const TOURNAMENT_ADDRESS = import.meta.env.VITE_TOURNAMENT_ADDRESS as `0x${string}` || '0x0000000000000000000000000000000000000000'

// Minimal ABI for write operations
const TOURNAMENT_ABI = [
  {
    name: 'createTournament',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_name', type: 'string' },
      { name: '_description', type: 'string' },
      { name: '_bracketSize', type: 'uint8' },
      { name: '_entryFee', type: 'uint256' },
      { name: '_registrationDeadline', type: 'uint256' },
      { name: '_startTime', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'registerForTournament',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: '_tournamentId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'startTournament',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_tournamentId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'submitMatchResult',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_tournamentId', type: 'uint256' },
      { name: '_round', type: 'uint256' },
      { name: '_matchIndex', type: 'uint256' },
      { name: '_result', type: 'uint8' },
    ],
    outputs: [],
  },
  {
    name: 'placePrediction',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: '_tournamentId', type: 'uint256' },
      { name: '_predictedWinner', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'claimPrediction',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_tournamentId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'cancelTournament',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_tournamentId', type: 'uint256' },
      { name: '_reason', type: 'string' },
    ],
    outputs: [],
  },
] as const

export function useTournamentContract() {
  const { data: hash, writeContract, isPending, error } = useWriteContract()

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash })

  const createTournament = async (
    name: string,
    description: string,
    bracketSize: number,
    entryFee: bigint,
    registrationDeadline: number,
    startTime: number
  ) => {
    return writeContract({
      address: TOURNAMENT_ADDRESS,
      abi: TOURNAMENT_ABI,
      functionName: 'createTournament',
      args: [name, description, bracketSize, entryFee, BigInt(registrationDeadline), BigInt(startTime)],
    })
  }

  const registerForTournament = async (tournamentId: number, entryFee: bigint) => {
    return writeContract({
      address: TOURNAMENT_ADDRESS,
      abi: TOURNAMENT_ABI,
      functionName: 'registerForTournament',
      args: [BigInt(tournamentId)],
      value: entryFee,
    })
  }

  const startTournament = async (tournamentId: number) => {
    return writeContract({
      address: TOURNAMENT_ADDRESS,
      abi: TOURNAMENT_ABI,
      functionName: 'startTournament',
      args: [BigInt(tournamentId)],
    })
  }

  const submitMatchResult = async (
    tournamentId: number,
    round: number,
    matchIndex: number,
    result: number
  ) => {
    return writeContract({
      address: TOURNAMENT_ADDRESS,
      abi: TOURNAMENT_ABI,
      functionName: 'submitMatchResult',
      args: [BigInt(tournamentId), BigInt(round), BigInt(matchIndex), result],
    })
  }

  const placePrediction = async (
    tournamentId: number,
    predictedWinner: string,
    amount: bigint
  ) => {
    return writeContract({
      address: TOURNAMENT_ADDRESS,
      abi: TOURNAMENT_ABI,
      functionName: 'placePrediction',
      args: [BigInt(tournamentId), predictedWinner as `0x${string}`],
      value: amount,
    })
  }

  const claimPrediction = async (tournamentId: number) => {
    return writeContract({
      address: TOURNAMENT_ADDRESS,
      abi: TOURNAMENT_ABI,
      functionName: 'claimPrediction',
      args: [BigInt(tournamentId)],
    })
  }

  const cancelTournament = async (tournamentId: number, reason: string) => {
    return writeContract({
      address: TOURNAMENT_ADDRESS,
      abi: TOURNAMENT_ABI,
      functionName: 'cancelTournament',
      args: [BigInt(tournamentId), reason],
    })
  }

  return {
    createTournament,
    registerForTournament,
    startTournament,
    submitMatchResult,
    placePrediction,
    claimPrediction,
    cancelTournament,
    isPending,
    isConfirming,
    isConfirmed,
    error,
    hash,
  }
}
