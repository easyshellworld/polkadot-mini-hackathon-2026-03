import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface TournamentApiData {
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

export interface BracketMatchData {
  tournamentId: number
  round: number
  matchIndex: number
  playerOne: string
  playerTwo: string
  winner: string
  result: number
  isSettled: boolean
}

export interface PredictionData {
  predictor: string
  tournamentId: number
  predictedWinner: string
  amount: string
  claimed: boolean
}

const parseTournament = (raw: any): TournamentApiData => ({
  id: Number(raw.id ?? 0),
  name: String(raw.name ?? ''),
  description: String(raw.description ?? ''),
  organizer: String(raw.organizer ?? ''),
  bracketSize: Number(raw.bracketSize ?? 0),
  entryFee: String(raw.entryFee ?? '0'),
  prizePool: String(raw.prizePool ?? '0'),
  predictionPool: String(raw.predictionPool ?? '0'),
  status: Number(raw.status ?? 0),
  maxPlayers: Number(raw.maxPlayers ?? 0),
  registeredCount: Number(raw.registeredCount ?? 0),
  currentRound: Number(raw.currentRound ?? 0),
  totalRounds: Number(raw.totalRounds ?? 0),
  createdAt: Number(raw.createdAt ?? 0),
  registrationDeadline: Number(raw.registrationDeadline ?? 0),
  startTime: Number(raw.startTime ?? 0),
  prizesDistributed: Boolean(raw.prizesDistributed ?? false),
  players: raw.players ?? [],
})

export const useTournamentList = (params: { limit?: number; status?: number } = {}) => {
  return useQuery({
    queryKey: ['tournaments', params],
    queryFn: async () => {
      const response = await api.listTournaments(params)
      return {
        tournaments: (response.data ?? []).map(parseTournament),
        meta: response.meta,
      }
    },
    staleTime: 15_000,
  })
}

export const useTournamentDetail = (tournamentId: number) => {
  const enabled = Number.isInteger(tournamentId) && tournamentId >= 0
  return useQuery({
    queryKey: ['tournament', tournamentId],
    enabled,
    queryFn: async () => {
      const response = await api.getTournament(tournamentId)
      return parseTournament(response.data)
    },
    staleTime: 15_000,
  })
}

export const useTournamentBracket = (tournamentId: number, round: number) => {
  const enabled = Number.isInteger(tournamentId) && tournamentId >= 0 && round > 0
  return useQuery({
    queryKey: ['tournament', tournamentId, 'bracket', round],
    enabled,
    queryFn: async () => {
      const response = await api.getTournamentBracket(tournamentId, round)
      return (response.data ?? []) as BracketMatchData[]
    },
    staleTime: 15_000,
  })
}

export const useTournamentPredictions = (tournamentId: number) => {
  const enabled = Number.isInteger(tournamentId) && tournamentId >= 0
  return useQuery({
    queryKey: ['tournament', tournamentId, 'predictions'],
    enabled,
    queryFn: async () => {
      const response = await api.getTournamentPredictions(tournamentId)
      return (response.data ?? []) as PredictionData[]
    },
    staleTime: 15_000,
  })
}

export const useTournamentResults = (tournamentId: number) => {
  const enabled = Number.isInteger(tournamentId) && tournamentId >= 0
  return useQuery({
    queryKey: ['tournament', tournamentId, 'results'],
    enabled,
    queryFn: async () => {
      const response = await api.getTournamentResults(tournamentId)
      return response.data as {
        winner: string
        runnerUp: string
        thirdPlace: string
        prizePool: string
        distributed: boolean
      }
    },
    staleTime: 30_000,
  })
}

export const useTournamentStats = () => {
  return useQuery({
    queryKey: ['tournament', 'stats'],
    queryFn: async () => {
      const response = await api.getTournamentStats()
      return response.data
    },
    staleTime: 30_000,
  })
}
