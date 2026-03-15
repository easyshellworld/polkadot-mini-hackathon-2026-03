import { ethers } from 'ethers'
import dotenv from 'dotenv'

dotenv.config()

const RPC_URL = process.env.RPC_URL || 'https://eth-rpc-testnet.polkadot.io/'
const ARENA_ADDRESS = process.env.ARENA_ADDRESS

if (!ARENA_ADDRESS || ARENA_ADDRESS === ethers.ZeroAddress) {
  console.warn('⚠️  ARENA_ADDRESS is not configured. Arena features will return empty data.')
}

const ABI = [
  'function arenaCounter() view returns (uint256)',
  'function getArena(uint256 arenaId) view returns (tuple(uint256 arenaId,address creator,string title,string sideA,string sideB,string description,uint256 bettingDeadline,uint256 resolveDeadline,uint256 totalSideA,uint256 totalSideB,uint8 status,uint8 winningSide,uint256 createdAt,uint256 resolvedAt,uint256 betCount))',
  'function getArenaBets(uint256 arenaId) view returns (tuple(address bettor,uint8 side,uint256 amount,uint256 timestamp,bool claimed)[])',
  'function getArenaBetCount(uint256 arenaId) view returns (uint256)',
  'function getUserBet(uint256 arenaId, address user) view returns (uint256 sideAAmount, uint256 sideBAmount)',
  'function getOdds(uint256 arenaId) view returns (uint256 totalA, uint256 totalB, uint256 percentA, uint256 percentB)',
  'event BetPlaced(uint256 indexed arenaId, address indexed bettor, uint8 side, uint256 amount, uint256 newTotalA, uint256 newTotalB, uint256 betIndex)',
]

const provider = new ethers.JsonRpcProvider(RPC_URL)
const contract = ARENA_ADDRESS
  ? new ethers.Contract(ARENA_ADDRESS, ABI, provider)
  : null

const CACHE_TTL = 15_000

export interface ArenaDTO {
  id: number
  creator: string
  title: string
  sideA: string
  sideB: string
  description: string
  bettingDeadline: number
  resolveDeadline: number
  totalSideAWei: string
  totalSideBWei: string
  status: number
  winningSide: number
  createdAt: number
  resolvedAt: number
  betCount: number
  percentA: number
  percentB: number
}

export interface ArenaBetDTO {
  bettor: string
  side: number
  amountWei: string
  timestamp: number
  claimed: boolean
}

export interface OddsHistoryPoint {
  timestamp: number
  totalAWei: string
  totalBWei: string
  percentA: number
  percentB: number
  bettor: string
  side: number
  amountWei: string
}

const arenaCache = new Map<number, { data: ArenaDTO; cachedAt: number }>()
let counterCache: { value: number; cachedAt: number } | null = null

const normalizeAddress = (value: any): string => {
  if (!value) return ethers.ZeroAddress
  try { return ethers.getAddress(String(value)) } catch { return String(value) }
}

const normalizeArena = (raw: any): ArenaDTO => {
  const totalA = BigInt(raw?.totalSideA ?? raw?.[8] ?? 0)
  const totalB = BigInt(raw?.totalSideB ?? raw?.[9] ?? 0)
  const total = totalA + totalB
  const percentA = total > 0n ? Number((totalA * 10000n) / total) / 100 : 50
  const percentB = total > 0n ? Number((totalB * 10000n) / total) / 100 : 50

  return {
    id: Number(raw?.arenaId ?? raw?.[0] ?? 0),
    creator: normalizeAddress(raw?.creator ?? raw?.[1]),
    title: String(raw?.title ?? raw?.[2] ?? ''),
    sideA: String(raw?.sideA ?? raw?.[3] ?? ''),
    sideB: String(raw?.sideB ?? raw?.[4] ?? ''),
    description: String(raw?.description ?? raw?.[5] ?? ''),
    bettingDeadline: Number(raw?.bettingDeadline ?? raw?.[6] ?? 0),
    resolveDeadline: Number(raw?.resolveDeadline ?? raw?.[7] ?? 0),
    totalSideAWei: totalA.toString(),
    totalSideBWei: totalB.toString(),
    status: Number(raw?.status ?? raw?.[10] ?? 0),
    winningSide: Number(raw?.winningSide ?? raw?.[11] ?? 0),
    createdAt: Number(raw?.createdAt ?? raw?.[12] ?? 0),
    resolvedAt: Number(raw?.resolvedAt ?? raw?.[13] ?? 0),
    betCount: Number(raw?.betCount ?? raw?.[14] ?? 0),
    percentA,
    percentB,
  }
}

export const getArenaCount = async (): Promise<number> => {
  if (!contract) return 0
  const now = Date.now()
  if (counterCache && now - counterCache.cachedAt < CACHE_TTL) return counterCache.value
  const counter: bigint = await contract.arenaCounter()
  const value = Number(counter)
  counterCache = { value, cachedAt: now }
  return value
}

export const getArenaById = async (id: number): Promise<ArenaDTO | null> => {
  if (!contract) return null
  const cached = arenaCache.get(id)
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) return cached.data
  try {
    const raw = await contract.getArena(id)
    const arena = normalizeArena(raw)
    arenaCache.set(id, { data: arena, cachedAt: Date.now() })
    return arena
  } catch (e) {
    console.error(`Failed to fetch arena ${id}:`, e)
    return null
  }
}

export const listArenas = async (opts: { limit: number; offset: number; status?: number }) => {
  const total = await getArenaCount()
  if (total === 0) return { total, arenas: [] as ArenaDTO[] }

  const arenas: ArenaDTO[] = []
  let idx = total - 1 - opts.offset

  while (idx >= 0 && arenas.length < opts.limit) {
    const arena = await getArenaById(idx)
    idx--
    if (!arena) continue
    if (typeof opts.status === 'number' && arena.status !== opts.status) continue
    arenas.push(arena)
  }

  return { total, arenas }
}

export const getArenaBets = async (id: number): Promise<ArenaBetDTO[]> => {
  if (!contract) return []
  try {
    const raw = await contract.getArenaBets(id)
    return raw.map((b: any) => ({
      bettor: normalizeAddress(b.bettor ?? b[0]),
      side: Number(b.side ?? b[1]),
      amountWei: BigInt(b.amount ?? b[2]).toString(),
      timestamp: Number(b.timestamp ?? b[3]),
      claimed: Boolean(b.claimed ?? b[4]),
    }))
  } catch (e) {
    console.error(`Failed to fetch bets for arena ${id}:`, e)
    return []
  }
}

export const getOddsHistory = async (id: number): Promise<OddsHistoryPoint[]> => {
  if (!contract || !ARENA_ADDRESS) return []
  try {
    const filter = contract.filters.BetPlaced(id)
    const events = await contract.queryFilter(filter, 0, 'latest')
    return events.map((ev: any) => {
      const args = ev.args
      return {
        timestamp: 0, // will be enriched client-side if needed
        totalAWei: args.newTotalA.toString(),
        totalBWei: args.newTotalB.toString(),
        percentA: Number((args.newTotalA * 10000n) / (args.newTotalA + args.newTotalB)) / 100,
        percentB: Number((args.newTotalB * 10000n) / (args.newTotalA + args.newTotalB)) / 100,
        bettor: normalizeAddress(args.bettor),
        side: Number(args.side),
        amountWei: args.amount.toString(),
      }
    })
  } catch (e) {
    console.error(`Failed to fetch odds history for arena ${id}:`, e)
    return []
  }
}

console.log('🏟️  Arena Service Loaded', ARENA_ADDRESS ? `(${ARENA_ADDRESS.slice(0, 10)}...)` : '(no address)')
