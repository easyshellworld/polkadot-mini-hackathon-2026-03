import express from 'express'
import { getMatchById, getMatchesByIds, listMatches } from '../services/duelPlatform.js'

const router = express.Router()

// GET /api/matches - List matches
router.get('/', async (req, res) => {
  try {
    const { status, mode, limit = '20', offset = '0', ids } = req.query

    const parsedLimit = Math.max(1, Math.min(parseInt(limit as string, 10) || 20, 100))
    const parsedOffset = Math.max(0, parseInt(offset as string, 10) || 0)
    const parsedStatus = typeof status === 'string' ? Number(status) : undefined
    const parsedMode = typeof mode === 'string' ? Number(mode) : undefined

    if (typeof ids === 'string' && ids.trim().length > 0) {
      const requestedIds = ids
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => !Number.isNaN(value) && value >= 0)

      const matches = await getMatchesByIds(requestedIds)
      const ordered = requestedIds
        .map((id) => matches.find((match) => match.id === id))
        .filter((match): match is NonNullable<typeof match> => Boolean(match))

      return res.json({
        data: ordered,
        meta: {
          total: ordered.length,
          limit: ordered.length,
          offset: 0
        }
      })
    }

    const { total, matches } = await listMatches({
      limit: parsedLimit,
      offset: parsedOffset,
      status: typeof parsedStatus === 'number' && !Number.isNaN(parsedStatus) ? parsedStatus : undefined,
      mode: typeof parsedMode === 'number' && !Number.isNaN(parsedMode) ? parsedMode : undefined
    })

    res.json({
      data: matches,
      meta: {
        total,
        limit: parsedLimit,
        offset: parsedOffset
      }
    })
  } catch (error) {
    console.error('Error fetching matches:', error)
    res.status(500).json({ error: 'Failed to fetch matches' })
  }
})

// GET /api/matches/:id - Get single match
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const matchId = Number(id)
    if (Number.isNaN(matchId) || matchId < 0) {
      return res.status(400).json({ error: 'Invalid match id' })
    }

    const match = await getMatchById(matchId)
    if (!match) {
      return res.status(404).json({ error: 'Match not found' })
    }

    res.json({ data: match })
  } catch (error) {
    console.error('Error fetching match:', error)
    res.status(500).json({ error: 'Failed to fetch match' })
  }
})

console.log('📋 Matches Routes Loaded - v0.6.0-mvp')

export default router

