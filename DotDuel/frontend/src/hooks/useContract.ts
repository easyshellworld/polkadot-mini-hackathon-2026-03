import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACT_ADDRESS } from '../config/wagmi'
import DuelPlatformABI from '../contracts/DuelPlatform.json'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

export interface MatchData {
  matchId: number
  mode: number
  referee: `0x${string}`
  creator: `0x${string}`
  participants: [`0x${string}`, `0x${string}`]
  stakeAmount: bigint
  status: number
  winner: `0x${string}`
  createdAt: number
  startTime: number
  endTime: number
  description: string
  externalMatchId: string
  isSettled: boolean
}

export interface UserStatsData {
  totalMatches: bigint
  wonMatches: bigint
  totalStaked: bigint
  totalWon: bigint
}

const ensureAddress = (value: any): `0x${string}` => {
  if (typeof value === 'string' && value.startsWith('0x') && value.length === 42) {
    return value as `0x${string}`
  }
  return ZERO_ADDRESS
}

const normalizeMatch = (raw: any): MatchData => {
  const participantsRaw = raw?.participants ?? raw?.[3] ?? []
  const participants: [`0x${string}`, `0x${string}`] = [
    ensureAddress(participantsRaw?.[0]),
    ensureAddress(participantsRaw?.[1]),
  ]

  return {
    matchId: Number(raw?.matchId ?? raw?.[0] ?? 0),
    mode: Number(raw?.mode ?? raw?.[1] ?? 0),
    referee: ensureAddress(raw?.referee ?? raw?.[2]),
    creator: ensureAddress(raw?.creator ?? raw?.referee ?? raw?.[2]),
    participants,
    stakeAmount: BigInt(raw?.stakeAmount ?? raw?.[4] ?? 0),
    status: Number(raw?.status ?? raw?.[5] ?? 0),
    winner: ensureAddress(raw?.winner ?? raw?.[6]),
    createdAt: Number(raw?.createdAt ?? raw?.[7] ?? 0),
    startTime: Number(raw?.startTime ?? raw?.[8] ?? 0),
    endTime: Number(raw?.endTime ?? raw?.[9] ?? 0),
    description: String(raw?.description ?? raw?.[10] ?? ''),
    externalMatchId: String(raw?.externalMatchId ?? raw?.[11] ?? ''),
    isSettled: Boolean(raw?.isSettled ?? raw?.[12] ?? false),
  }
}

const normalizeUserStats = (raw: any): UserStatsData => ({
  totalMatches: BigInt(raw?.totalMatches ?? raw?.[0] ?? 0),
  wonMatches: BigInt(raw?.wonMatches ?? raw?.[1] ?? 0),
  totalStaked: BigInt(raw?.totalStaked ?? raw?.[2] ?? 0),
  totalWon: BigInt(raw?.totalWon ?? raw?.[3] ?? 0),
})

export function useContract() {
  // Write to contract
  const { data: hash, writeContract, isPending, error } = useWriteContract()
  
  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash })

  // Create match
  const createMatch = async (
    mode: number,
    stakeAmount: bigint,
    startTime: number,
    endTime: number,
    description: string,
    externalMatchId: string,
    includeStake: boolean = false
  ) => {
    return writeContract({
      address: CONTRACT_ADDRESS,
      abi: DuelPlatformABI.abi,
      functionName: 'createMatch',
      args: [mode, stakeAmount, BigInt(startTime), BigInt(endTime), description, externalMatchId],
      value: includeStake ? stakeAmount : 0n,
    })
  }

  // Join match
  const joinMatch = async (matchId: number, stakeAmount: bigint) => {
    return writeContract({
      address: CONTRACT_ADDRESS,
      abi: DuelPlatformABI.abi,
      functionName: 'joinMatch',
      args: [BigInt(matchId)],
      value: stakeAmount,
    })
  }

  // Submit result (referee)
  const submitResultByReferee = async (matchId: number, winner: string) => {
    return writeContract({
      address: CONTRACT_ADDRESS,
      abi: DuelPlatformABI.abi,
      functionName: 'submitResultByReferee',
      args: [BigInt(matchId), winner as `0x${string}`],
    })
  }

  // Cancel match
  const cancelMatch = async (matchId: number) => {
    return writeContract({
      address: CONTRACT_ADDRESS,
      abi: DuelPlatformABI.abi,
      functionName: 'cancelMatch',
      args: [BigInt(matchId)],
    })
  }

  return {
    createMatch,
    joinMatch,
    submitResultByReferee,
    cancelMatch,
    isPending,
    isConfirming,
    isConfirmed,
    error,
    hash,
  }
}

// Read contract data
export function useMatchData(matchId: number) {
  const enabled = Number.isInteger(matchId) && matchId >= 0
  const args = enabled ? ([BigInt(matchId)] as const) : undefined
  const { data, isLoading, error } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: DuelPlatformABI.abi,
    functionName: 'getMatch',
    args,
    query: { enabled },
  }) as {
    data: any
    isLoading: boolean
    error: Error | null
  }

  const match = data ? normalizeMatch(data) : undefined

  return { match, isLoading, error }
}

export function useUserStats(address: string | undefined) {
  const args = address ? ([address] as const) : undefined
  const { data, isLoading, error } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: DuelPlatformABI.abi,
    functionName: 'getUserStats',
    args,
    query: {
      enabled: !!address,
    },
  }) as {
    data: any
    isLoading: boolean
    error: Error | null
  }

  const stats = data ? normalizeUserStats(data) : undefined

  return { stats, isLoading, error }
}

export function useUserMatches(address: string | undefined) {
  const args = address ? ([address] as const) : undefined
  const { data, isLoading, error } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: DuelPlatformABI.abi,
    functionName: 'getUserMatches',
    args,
    query: {
      enabled: !!address,
    },
  }) as {
    data: readonly bigint[] | undefined
    isLoading: boolean
    error: Error | null
  }

  const matches = data ? [...data] : undefined

  return { matches, isLoading, error }
}

