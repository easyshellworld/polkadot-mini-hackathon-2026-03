import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface MatchApiData {
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

const parseMatch = (raw: any): MatchApiData => ({
  id: Number(raw.id ?? raw.matchId ?? 0),
  mode: Number(raw.mode ?? 0),
  referee: raw.referee,
  creator: raw.creator,
  participants: raw.participants ?? ['0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000000'],
  stakeAmountWei: raw.stakeAmountWei ?? raw.stakeAmount ?? '0',
  status: Number(raw.status ?? 0),
  winner: raw.winner,
  createdAt: Number(raw.createdAt ?? 0),
  startTime: Number(raw.startTime ?? 0),
  endTime: Number(raw.endTime ?? 0),
  description: String(raw.description ?? ''),
  externalMatchId: String(raw.externalMatchId ?? ''),
  isSettled: Boolean(raw.isSettled ?? false)
})

export const useMatchList = (params: { limit?: number; status?: number; mode?: number } = {}) => {
  return useQuery({
    queryKey: ['matches', params],
    queryFn: async () => {
      const response = await api.listMatches(params)
      return {
        matches: response.data.map(parseMatch),
        meta: response.meta
      }
    },
    staleTime: 15_000
  })
}

export const useMatchDetail = (matchId: number, options?: UseQueryOptions<any, Error>) => {
  const enabled = Number.isInteger(matchId) && matchId >= 0
  return useQuery({
    queryKey: ['match', matchId],
    enabled,
    queryFn: async () => {
      const response = await api.getMatch(matchId)
      return parseMatch(response.data)
    },
    staleTime: 15_000,
    ...(options || {})
  })
}

export const usePlatformStats = () => {
  return useQuery({
    queryKey: ['stats', 'platform'],
    queryFn: async () => {
      const response = await api.getPlatformStats()
      return response.data
    },
    staleTime: 30_000
  })
}

export const useRecentMatches = (limit = 5) => {
  return useQuery({
    queryKey: ['stats', 'recent', limit],
    queryFn: async () => {
      const response = await api.getRecentMatches(limit)
      return response.data
    },
    staleTime: 15_000
  })
}

export const useUserStatsApi = (address?: string) => {
  return useQuery({
    queryKey: ['user', address, 'stats'],
    enabled: !!address,
    queryFn: async () => {
      const response = await api.getUserStats(address as string)
      return response.data
    },
    staleTime: 15_000
  })
}

export const useUserMatchesApi = (address?: string) => {
  return useQuery({
    queryKey: ['user', address, 'matches'],
    enabled: !!address,
    queryFn: async () => {
      const response = await api.getUserMatches(address as string)
      return response.data.map(parseMatch)
    },
    staleTime: 15_000
  })
}
