import { ethers } from 'ethers'
import dotenv from 'dotenv'

dotenv.config()

const RPC_URL = process.env.RPC_URL || 'https://rpc.sepolia.mantle.xyz'
const TOURNAMENT_ADDRESS = process.env.TOURNAMENT_ADDRESS

if (!TOURNAMENT_ADDRESS || TOURNAMENT_ADDRESS === ethers.ZeroAddress) {
  console.warn('⚠️  TOURNAMENT_ADDRESS is not configured. Tournament features disabled.')
}

const ABI = [
  'function tournamentCounter() view returns (uint256)',
  'function getTournament(uint256 tournamentId) view returns (tuple(uint256 id,string name,string description,address organizer,uint8 bracketSize,uint256 entryFee,uint256 prizePool,uint8 status,uint256 maxPlayers,uint256 registeredCount,uint256 currentRound,uint256 totalRounds,uint256 createdAt,uint256 registrationDeadline,uint256 startTime,bool prizesDistributed))',
  'function getTournamentPlayers(uint256 tournamentId) view returns (address[])',
  'function getBracketMatch(uint256 tournamentId, uint256 round, uint256 matchIndex) view returns (tuple(uint256 tournamentId,uint256 round,uint256 matchIndex,address playerOne,address playerTwo,address winner,uint8 result,bool isSettled))',
  'function getTournamentBracket(uint256 tournamentId, uint256 round) view returns (tuple(uint256 tournamentId,uint256 round,uint256 matchIndex,address playerOne,address playerTwo,address winner,uint8 result,bool isSettled)[])',
  'function getPredictions(uint256 tournamentId) view returns (tuple(address predictor,uint256 tournamentId,address predictedWinner,uint256 amount,bool claimed)[])',
  'function getPlayerStats(address player) view returns (tuple(uint256 tournamentsEntered,uint256 tournamentsWon,uint256 matchesWon,uint256 matchesLost,uint256 totalPrizeWon,uint256 totalEntryFees))',
  'function getPlayerTournaments(address player) view returns (uint256[])',
  'function getTournamentResults(uint256 tournamentId) view returns (address winner, address runnerUp, address thirdPlace, uint256 prizePool, bool distributed)',
  'function tournamentWinners(uint256 tournamentId) view returns (address)',
  'function tournamentRunnerUp(uint256 tournamentId) view returns (address)',
  'function tournamentThirdPlace(uint256 tournamentId) view returns (address)',
  'function predictionPool(uint256 tournamentId) view returns (uint256)',
  'function isRegistered(uint256 tournamentId, address player) view returns (bool)',
]

const provider = new ethers.JsonRpcProvider(RPC_URL)
const contract = TOURNAMENT_ADDRESS
  ? new ethers.Contract(TOURNAMENT_ADDRESS, ABI, provider)
  : null

const CACHE_TTL = 30_000

// ============ DTOs ============

export interface TournamentDTO {
  id: number
  name: string
  description: string
  organizer: string
  bracketSize: number
  entryFee: string
  prizePool: string
  predictionPool: string
  status: number
  maxPlayers: number
  registeredCount: number
  currentRound: number
  totalRounds: number
  createdAt: number
  registrationDeadline: number
  startTime: number
  prizesDistributed: boolean
  players?: string[]
}

export interface BracketMatchDTO {
  tournamentId: number
  round: number
  matchIndex: number
  playerOne: string
  playerTwo: string
  winner: string
  result: number
  isSettled: boolean
}

export interface PredictionDTO {
  predictor: string
  tournamentId: number
  predictedWinner: string
  amount: string
  claimed: boolean
}

export interface TournamentPlayerStatsDTO {
  address: string
  tournamentsEntered: number
  tournamentsWon: number
  matchesWon: number
  matchesLost: number
  totalPrizeWon: string
  totalEntryFees: string
}

export interface TournamentStatsDTO {
  totalTournaments: number
  activeTournaments: number
  completedTournaments: number
  totalPrizeDistributed: string
  totalPlayers: number
}

// ============ Cache ============

const tournamentCache = new Map<number, { data: TournamentDTO; cachedAt: number }>()
let counterCache: { value: number; cachedAt: number } | null = null

const normalizeAddress = (value: string | null | undefined): string => {
  if (!value) return ethers.ZeroAddress
  try {
    return ethers.getAddress(value)
  } catch {
    return value
  }
}

// ============ Service Functions ============

export const getTournamentCount = async (): Promise<number> => {
  if (!contract) return 0
  const now = Date.now()
  if (counterCache && now - counterCache.cachedAt < CACHE_TTL) {
    return counterCache.value
  }

  const counter: bigint = await contract.tournamentCounter()
  const value = Number(counter)
  counterCache = { value, cachedAt: now }
  return value
}

const normalizeTournament = (raw: any): TournamentDTO => {
  return {
    id: Number(raw?.id ?? raw?.[0] ?? 0),
    name: String(raw?.name ?? raw?.[1] ?? ''),
    description: String(raw?.description ?? raw?.[2] ?? ''),
    organizer: normalizeAddress(raw?.organizer ?? raw?.[3]),
    bracketSize: Number(raw?.bracketSize ?? raw?.[4] ?? 0),
    entryFee: BigInt(raw?.entryFee ?? raw?.[5] ?? 0n).toString(),
    prizePool: BigInt(raw?.prizePool ?? raw?.[6] ?? 0n).toString(),
    predictionPool: '0',
    status: Number(raw?.status ?? raw?.[7] ?? 0),
    maxPlayers: Number(raw?.maxPlayers ?? raw?.[8] ?? 0),
    registeredCount: Number(raw?.registeredCount ?? raw?.[9] ?? 0),
    currentRound: Number(raw?.currentRound ?? raw?.[10] ?? 0),
    totalRounds: Number(raw?.totalRounds ?? raw?.[11] ?? 0),
    createdAt: Number(raw?.createdAt ?? raw?.[12] ?? 0),
    registrationDeadline: Number(raw?.registrationDeadline ?? raw?.[13] ?? 0),
    startTime: Number(raw?.startTime ?? raw?.[14] ?? 0),
    prizesDistributed: Boolean(raw?.prizesDistributed ?? raw?.[15] ?? false),
  }
}

export const getTournamentById = async (id: number): Promise<TournamentDTO | null> => {
  if (!contract) return null
  const now = Date.now()
  const cached = tournamentCache.get(id)
  if (cached && now - cached.cachedAt < CACHE_TTL) {
    return cached.data
  }

  try {
    const raw = await contract.getTournament(id)
    const tournament = normalizeTournament(raw)

    // Fetch prediction pool for this tournament
    try {
      const predictionPool: bigint = await contract.predictionPool(id)
      tournament.predictionPool = predictionPool.toString()
    } catch {
      tournament.predictionPool = '0'
    }

    // Fetch players
    try {
      const players: string[] = await contract.getTournamentPlayers(id)
      tournament.players = players.map(normalizeAddress)
    } catch {
      tournament.players = []
    }

    tournamentCache.set(id, { data: tournament, cachedAt: now })
    return tournament
  } catch (error) {
    console.error(`Failed to fetch tournament ${id}:`, error)
    return null
  }
}

export const listTournaments = async (options: {
  limit: number
  offset: number
  status?: number
}): Promise<{ total: number; tournaments: TournamentDTO[] }> => {
  if (!contract) return { total: 0, tournaments: [] }

  const total = await getTournamentCount()
  if (total === 0) return { total: 0, tournaments: [] }

  const safeLimit = Math.max(1, Math.min(options.limit, 50))
  const safeOffset = Math.max(0, options.offset)

  const tournaments: TournamentDTO[] = []
  let index = total - 1 - safeOffset

  while (index >= 0 && tournaments.length < safeLimit) {
    const tournament = await getTournamentById(index)
    index -= 1
    if (!tournament) continue

    if (typeof options.status === 'number' && tournament.status !== options.status) {
      continue
    }

    tournaments.push(tournament)
  }

  return { total, tournaments }
}

export const getTournamentBracket = async (
  tournamentId: number,
  round: number
): Promise<BracketMatchDTO[]> => {
  if (!contract) return []

  try {
    const matches = await contract.getTournamentBracket(tournamentId, round)
    return matches.map((raw: any) => ({
      tournamentId: Number(raw?.tournamentId ?? raw?.[0] ?? 0),
      round: Number(raw?.round ?? raw?.[1] ?? 0),
      matchIndex: Number(raw?.matchIndex ?? raw?.[2] ?? 0),
      playerOne: normalizeAddress(raw?.playerOne ?? raw?.[3]),
      playerTwo: normalizeAddress(raw?.playerTwo ?? raw?.[4]),
      winner: normalizeAddress(raw?.winner ?? raw?.[5]),
      result: Number(raw?.result ?? raw?.[6] ?? 0),
      isSettled: Boolean(raw?.isSettled ?? raw?.[7] ?? false),
    }))
  } catch (error) {
    console.error(`Failed to fetch bracket for tournament ${tournamentId} round ${round}:`, error)
    return []
  }
}

export const getTournamentPredictions = async (
  tournamentId: number
): Promise<PredictionDTO[]> => {
  if (!contract) return []

  try {
    const preds = await contract.getPredictions(tournamentId)
    return preds.map((raw: any) => ({
      predictor: normalizeAddress(raw?.predictor ?? raw?.[0]),
      tournamentId: Number(raw?.tournamentId ?? raw?.[1] ?? 0),
      predictedWinner: normalizeAddress(raw?.predictedWinner ?? raw?.[2]),
      amount: BigInt(raw?.amount ?? raw?.[3] ?? 0n).toString(),
      claimed: Boolean(raw?.claimed ?? raw?.[4] ?? false),
    }))
  } catch (error) {
    console.error(`Failed to fetch predictions for tournament ${tournamentId}:`, error)
    return []
  }
}

export const getTournamentResults = async (
  tournamentId: number
): Promise<{
  winner: string
  runnerUp: string
  thirdPlace: string
  prizePool: string
  distributed: boolean
} | null> => {
  if (!contract) return null

  try {
    const result = await contract.getTournamentResults(tournamentId)
    return {
      winner: normalizeAddress(result.winner ?? result[0]),
      runnerUp: normalizeAddress(result.runnerUp ?? result[1]),
      thirdPlace: normalizeAddress(result.thirdPlace ?? result[2]),
      prizePool: BigInt(result.prizePool ?? result[3] ?? 0n).toString(),
      distributed: Boolean(result.distributed ?? result[4] ?? false),
    }
  } catch (error) {
    console.error(`Failed to fetch results for tournament ${tournamentId}:`, error)
    return null
  }
}

export const getPlayerTournamentStats = async (
  address: string
): Promise<TournamentPlayerStatsDTO | null> => {
  if (!contract) return null

  try {
    const raw = await contract.getPlayerStats(address)
    return {
      address: normalizeAddress(address),
      tournamentsEntered: Number(raw?.tournamentsEntered ?? raw?.[0] ?? 0),
      tournamentsWon: Number(raw?.tournamentsWon ?? raw?.[1] ?? 0),
      matchesWon: Number(raw?.matchesWon ?? raw?.[2] ?? 0),
      matchesLost: Number(raw?.matchesLost ?? raw?.[3] ?? 0),
      totalPrizeWon: BigInt(raw?.totalPrizeWon ?? raw?.[4] ?? 0n).toString(),
      totalEntryFees: BigInt(raw?.totalEntryFees ?? raw?.[5] ?? 0n).toString(),
    }
  } catch (error) {
    console.error(`Failed to fetch player stats for ${address}:`, error)
    return null
  }
}

export const getTournamentPlatformStats = async (): Promise<TournamentStatsDTO> => {
  if (!contract) {
    return {
      totalTournaments: 0,
      activeTournaments: 0,
      completedTournaments: 0,
      totalPrizeDistributed: '0',
      totalPlayers: 0,
    }
  }

  const total = await getTournamentCount()
  if (total === 0) {
    return {
      totalTournaments: 0,
      activeTournaments: 0,
      completedTournaments: 0,
      totalPrizeDistributed: '0',
      totalPlayers: 0,
    }
  }

  let active = 0
  let completed = 0
  let totalPrize = 0n
  const playerSet = new Set<string>()

  for (let i = 0; i < total; i++) {
    const t = await getTournamentById(i)
    if (!t) continue

    if (t.status === 0 || t.status === 1) active++
    if (t.status === 2) {
      completed++
      totalPrize += BigInt(t.prizePool)
    }

    if (t.players) {
      t.players.forEach((p) => {
        if (p !== ethers.ZeroAddress) playerSet.add(p)
      })
    }
  }

  return {
    totalTournaments: total,
    activeTournaments: active,
    completedTournaments: completed,
    totalPrizeDistributed: totalPrize.toString(),
    totalPlayers: playerSet.size,
  }
}
