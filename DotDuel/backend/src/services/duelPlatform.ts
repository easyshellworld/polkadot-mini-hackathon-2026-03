import { ethers } from 'ethers'
import dotenv from 'dotenv'

dotenv.config()

// Default to Mantle Sepolia Testnet
const RPC_URL = process.env.RPC_URL || 'https://rpc.sepolia.mantle.xyz'
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS

if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === ethers.ZeroAddress) {
  console.warn('⚠️  CONTRACT_ADDRESS is not configured. Duel features will return empty data.')
}

const ABI = [
  'function matchCounter() view returns (uint256)',
  'function getMatch(uint256 matchId) view returns (tuple(uint256 matchId,uint8 mode,address referee,address[2] participants,uint256 stakeAmount,uint8 status,address winner,uint256 createdAt,uint256 startTime,uint256 endTime,string description,string externalMatchId,bool isSettled))',
  'function getUserStats(address user) view returns (uint256 totalMatches,uint256 wonMatches,uint256 totalStaked,uint256 totalWon)',
  'function getUserMatches(address user) view returns (uint256[])'
]

const provider = new ethers.JsonRpcProvider(RPC_URL)
const contract = CONTRACT_ADDRESS
  ? new ethers.Contract(CONTRACT_ADDRESS, ABI, provider)
  : null

const CACHE_TTL = 30_000 // 30 seconds

export interface MatchDTO {
  id: number
  mode: number
  referee: string
  creator: string
  participants: [string, string]
  stakeAmountWei: string
  status: number
  winner: string
  createdAt: number
  startTime: number
  endTime: number
  description: string
  externalMatchId: string
  isSettled: boolean
}

export interface UserStatsDTO {
  address: string
  totalMatches: number
  wonMatches: number
  totalStakedWei: string
  totalWonWei: string
}

export interface PlatformStatsDTO {
  totalMatches: number
  waitingMatches: number
  activeMatches: number
  completedMatches: number
  cancelledMatches: number
  totalUsers: number
  totalVolumeWei: string
  topPlayers: Array<{
    address: string
    wins: number
    losses: number
    winRate: number
    volumeWei: string
  }>
  recentMatches: Array<{
    id: number
    description: string
    stakeAmountWei: string
    status: number
    winner: string
    updatedAt: number
  }>
}

const matchCache = new Map<number, { data: MatchDTO; cachedAt: number }>()
let matchCounterCache: { value: number; cachedAt: number } | null = null

const normalizeAddress = (value: string | null | undefined): string => {
  if (!value) return ethers.ZeroAddress
  try {
    return ethers.getAddress(value)
  } catch {
    return value
  }
}

const normalizeMatch = (raw: any): MatchDTO => {
  const participantsRaw = raw?.participants ?? raw?.[3] ?? []
  const participants: [string, string] = [
    normalizeAddress(participantsRaw?.[0]),
    normalizeAddress(participantsRaw?.[1])
  ]

  const stakeAmount: bigint = BigInt(raw?.stakeAmount ?? raw?.[4] ?? 0n)
  const referee = normalizeAddress(raw?.referee ?? raw?.[2])
  const fallbackCreator = participants.find((addr) => addr !== ethers.ZeroAddress) || referee

  return {
    id: Number(raw?.matchId ?? raw?.[0] ?? 0),
    mode: Number(raw?.mode ?? raw?.[1] ?? 0),
    referee,
    creator: fallbackCreator,
    participants,
    stakeAmountWei: stakeAmount.toString(),
    status: Number(raw?.status ?? raw?.[5] ?? 0),
    winner: normalizeAddress(raw?.winner ?? raw?.[6]),
    createdAt: Number(raw?.createdAt ?? raw?.[7] ?? 0),
    startTime: Number(raw?.startTime ?? raw?.[8] ?? 0),
    endTime: Number(raw?.endTime ?? raw?.[9] ?? 0),
    description: String(raw?.description ?? raw?.[10] ?? ''),
    externalMatchId: String(raw?.externalMatchId ?? raw?.[11] ?? ''),
    isSettled: Boolean(raw?.isSettled ?? raw?.[12] ?? false)
  }
}

const cacheMatch = (matchId: number, match: MatchDTO) => {
  matchCache.set(matchId, { data: match, cachedAt: Date.now() })
}

export const getMatchCount = async (): Promise<number> => {
  if (!contract) return 0
  const now = Date.now()
  if (matchCounterCache && now - matchCounterCache.cachedAt < CACHE_TTL) {
    return matchCounterCache.value
  }

  const counter: bigint = await contract.matchCounter()
  const value = Number(counter)
  matchCounterCache = { value, cachedAt: now }
  return value
}

export const getMatchById = async (matchId: number): Promise<MatchDTO | null> => {
  if (!contract) return null
  const cached = matchCache.get(matchId)
  const now = Date.now()
  if (cached && now - cached.cachedAt < CACHE_TTL) {
    return cached.data
  }

  try {
    const raw = await contract.getMatch(matchId)
    const match = normalizeMatch(raw)
    cacheMatch(matchId, match)
    return match
  } catch (error) {
    console.error(`Failed to fetch match ${matchId}:`, error)
    return null
  }
}

export const getMatchesByIds = async (ids: number[]): Promise<MatchDTO[]> => {
  const uniqueIds = Array.from(new Set(ids)).filter((id) => !Number.isNaN(id) && id >= 0)
  if (uniqueIds.length === 0) return []

  const matches = await Promise.all(uniqueIds.map((id) => getMatchById(id)))
  return matches.filter((match): match is MatchDTO => Boolean(match))
}

interface ListMatchesOptions {
  limit: number
  offset: number
  status?: number
  mode?: number
}

export const listMatches = async ({ limit, offset, status, mode }: ListMatchesOptions) => {
  const total = await getMatchCount()
  const safeLimit = Math.max(1, Math.min(limit, 100))
  const safeOffset = Math.max(0, offset)

  if (total === 0) {
    return { total, matches: [] as MatchDTO[] }
  }

  const matches: MatchDTO[] = []
  let index = total - 1 - safeOffset

  while (index >= 0 && matches.length < safeLimit) {
    const match = await getMatchById(index)
    index -= 1
    if (!match) continue

    if (typeof status === 'number' && match.status !== status) {
      continue
    }
    if (typeof mode === 'number' && match.mode !== mode) {
      continue
    }

    matches.push(match)
  }

  return {
    total,
    matches
  }
}

export const getUserStats = async (address: string): Promise<UserStatsDTO> => {
  if (!contract) return { address: normalizeAddress(address), totalMatches: 0, wonMatches: 0, totalStakedWei: '0', totalWonWei: '0' }
  const stats = await contract.getUserStats(address)
  const totalMatches = Number(stats?.totalMatches ?? stats?.[0] ?? 0)
  const wonMatches = Number(stats?.wonMatches ?? stats?.[1] ?? 0)
  const totalStaked = BigInt(stats?.totalStaked ?? stats?.[2] ?? 0n)
  const totalWon = BigInt(stats?.totalWon ?? stats?.[3] ?? 0n)

  return {
    address: normalizeAddress(address),
    totalMatches,
    wonMatches,
    totalStakedWei: totalStaked.toString(),
    totalWonWei: totalWon.toString()
  }
}

export const getUserMatchIds = async (address: string): Promise<number[]> => {
  if (!contract) return []
  const matches: bigint[] = await contract.getUserMatches(address)
  return matches.map((id) => Number(id)).filter((id) => !Number.isNaN(id) && id >= 0)
}

export const getUserMatchesDetailed = async (address: string, limit = 50, offset = 0) => {
  const ids = await getUserMatchIds(address)
  const slicedIds = ids.slice(offset, offset + limit)
  const matches = await getMatchesByIds(slicedIds)
  const orderedMatches = matches.sort((a, b) => b.id - a.id)
  return {
    total: ids.length,
    matches: orderedMatches
  }
}

export const getPlatformStats = async (): Promise<PlatformStatsDTO> => {
  const total = await getMatchCount()
  if (total === 0) {
    return {
      totalMatches: 0,
      waitingMatches: 0,
      activeMatches: 0,
      completedMatches: 0,
      cancelledMatches: 0,
      totalUsers: 0,
      totalVolumeWei: '0',
      topPlayers: [],
      recentMatches: []
    }
  }

  const { matches } = await listMatches({ limit: total, offset: 0 })

  let waiting = 0
  let active = 0
  let completed = 0
  let cancelled = 0
  let totalVolume = 0n

  const participantSet = new Set<string>()
  const playerStats = new Map<string, { matches: number; wins: number; volumeWei: bigint }>()

  matches.forEach((match) => {
    if (match.status === 0) waiting += 1
    if (match.status === 0 || match.status === 1) active += 1
    if (match.status === 2) completed += 1
    if (match.status === 3) cancelled += 1

    const stake = BigInt(match.stakeAmountWei)
    const participantCount = match.participants.filter((p) => p !== ethers.ZeroAddress).length
    if (participantCount > 0) {
      totalVolume += stake * BigInt(participantCount)
    }

    match.participants.forEach((participant) => {
      if (participant === ethers.ZeroAddress) return
      participantSet.add(participant)
      const current = playerStats.get(participant) ?? { matches: 0, wins: 0, volumeWei: 0n }
      current.matches += 1
      current.volumeWei += stake
      playerStats.set(participant, current)
    })

    if (match.winner !== ethers.ZeroAddress) {
      const winnerStats = playerStats.get(match.winner) ?? { matches: 0, wins: 0, volumeWei: 0n }
      winnerStats.wins += 1
      playerStats.set(match.winner, winnerStats)
    }
  })

  const leaderboard = Array.from(playerStats.entries())
    .map(([address, data]) => ({
      address,
      wins: data.wins,
      losses: Math.max(data.matches - data.wins, 0),
      winRate: data.matches > 0 ? Number(((data.wins / data.matches) * 100).toFixed(1)) : 0,
      volumeWei: data.volumeWei.toString()
    }))
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins
      const aVol = BigInt(a.volumeWei)
      const bVol = BigInt(b.volumeWei)
      if (aVol === bVol) return 0
      return bVol > aVol ? 1 : -1
    })
    .slice(0, 5)

  const recentMatches = matches
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 10)
    .map((match) => ({
      id: match.id,
      description: match.description || `Match #${match.id}`,
      stakeAmountWei: match.stakeAmountWei,
      status: match.status,
      winner: match.winner,
      updatedAt: match.endTime || match.createdAt
    }))

  return {
    totalMatches: total,
    waitingMatches: waiting,
    activeMatches: active,
    completedMatches: completed,
    cancelledMatches: cancelled,
    totalUsers: participantSet.size,
    totalVolumeWei: totalVolume.toString(),
    topPlayers: leaderboard,
    recentMatches
  }
}
