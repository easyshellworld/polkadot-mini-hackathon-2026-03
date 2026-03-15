export interface ApiResponse<T> {
  data: T
  meta?: {
    total: number
    limit: number
    offset: number
  }
}

// Empty string = use relative path, so nginx proxy /api/ → backend works correctly
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    }
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody?.error || response.statusText)
  }

  return response.json()
}

export const api = {
  // Matches
  listMatches: (params: { limit?: number; offset?: number; status?: number; mode?: number } = {}) => {
    const query = new URLSearchParams()
    if (params.limit) query.append('limit', params.limit.toString())
    if (params.offset) query.append('offset', params.offset.toString())
    if (typeof params.status === 'number') query.append('status', params.status.toString())
    if (typeof params.mode === 'number') query.append('mode', params.mode.toString())

    return request<ApiResponse<any>>(`/api/matches?${query.toString()}`)
  },
  getMatch: (id: number) => request<ApiResponse<any>>(`/api/matches/${id}`),
  getPlatformStats: () => request<ApiResponse<any>>('/api/stats/platform'),
  getRecentMatches: (limit = 5) => request<ApiResponse<any>>(`/api/stats/recent?limit=${limit}`),
  getUserStats: (address: string) => request<ApiResponse<any>>(`/api/users/${address}/stats`),
  getUserMatches: (address: string) => request<ApiResponse<any>>(`/api/users/${address}/matches`),

  // Tournaments
  listTournaments: (params: { limit?: number; offset?: number; status?: number } = {}) => {
    const query = new URLSearchParams()
    if (params.limit) query.append('limit', params.limit.toString())
    if (params.offset) query.append('offset', params.offset.toString())
    if (typeof params.status === 'number') query.append('status', params.status.toString())
    return request<ApiResponse<any>>(`/api/tournaments?${query.toString()}`)
  },
  getTournament: (id: number) => request<ApiResponse<any>>(`/api/tournaments/${id}`),
  getTournamentBracket: (id: number, round: number) =>
    request<ApiResponse<any>>(`/api/tournaments/${id}/bracket/${round}`),
  getTournamentPredictions: (id: number) =>
    request<ApiResponse<any>>(`/api/tournaments/${id}/predictions`),
  getTournamentResults: (id: number) =>
    request<ApiResponse<any>>(`/api/tournaments/${id}/results`),
  getTournamentStats: () => request<ApiResponse<any>>('/api/tournaments/stats'),
  getPlayerTournamentStats: (address: string) =>
    request<ApiResponse<any>>(`/api/tournaments/player/${address}`),

  // Arenas
  listArenas: (params: { limit?: number; offset?: number; status?: number } = {}) => {
    const query = new URLSearchParams()
    if (params.limit) query.append('limit', params.limit.toString())
    if (params.offset) query.append('offset', params.offset.toString())
    if (typeof params.status === 'number') query.append('status', params.status.toString())
    return request<ApiResponse<any>>(`/api/arenas?${query.toString()}`)
  },
  getArena: (id: number) => request<ApiResponse<any>>(`/api/arenas/${id}`),
  getArenaBets: (id: number) => request<ApiResponse<any>>(`/api/arenas/${id}/bets`),
  getArenaOddsHistory: (id: number) => request<ApiResponse<any>>(`/api/arenas/${id}/odds-history`),
}
