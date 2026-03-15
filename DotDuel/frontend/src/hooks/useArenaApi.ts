import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'

export function useArenaList(params: { limit?: number; offset?: number; status?: number } = {}) {
  const [arenas, setArenas] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.listArenas(params)
      setArenas(res.data ?? [])
      setTotal(res.meta?.total ?? 0)
    } catch (e: any) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [params.limit, params.offset, params.status])

  useEffect(() => { refetch() }, [refetch])

  return { arenas, total, loading, error, refetch }
}

export function useArenaDetail(id: number) {
  const [arena, setArena] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getArena(id)
      setArena(res.data ?? null)
    } catch (e: any) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { refetch() }, [refetch])

  return { arena, loading, error, refetch }
}

export function useArenaBets(id: number) {
  const [bets, setBets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getArenaBets(id)
      setBets(res.data ?? [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { refetch() }, [refetch])

  return { bets, loading, refetch }
}

export function useArenaOddsHistory(id: number) {
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getArenaOddsHistory(id)
      setHistory(res.data ?? [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { refetch() }, [refetch])

  return { history, loading, refetch }
}
