import express from 'express'
import {
  getTournamentCount,
  getTournamentById,
  listTournaments,
  getTournamentBracket,
  getTournamentPredictions,
  getTournamentResults,
  getPlayerTournamentStats,
  getTournamentPlatformStats,
} from '../services/tournament.js'

const router = express.Router()

// GET /api/tournaments - List tournaments
router.get('/', async (req, res) => {
  try {
    const { status, limit = '20', offset = '0' } = req.query

    const parsedLimit = Math.max(1, Math.min(parseInt(limit as string, 10) || 20, 50))
    const parsedOffset = Math.max(0, parseInt(offset as string, 10) || 0)
    const parsedStatus = typeof status === 'string' ? Number(status) : undefined

    const { total, tournaments } = await listTournaments({
      limit: parsedLimit,
      offset: parsedOffset,
      status: typeof parsedStatus === 'number' && !Number.isNaN(parsedStatus) ? parsedStatus : undefined,
    })

    res.json({
      data: tournaments,
      meta: {
        total,
        limit: parsedLimit,
        offset: parsedOffset,
      },
    })
  } catch (error) {
    console.error('Error fetching tournaments:', error)
    res.status(500).json({ error: 'Failed to fetch tournaments' })
  }
})

// GET /api/tournaments/stats - Platform tournament stats
router.get('/stats', async (_req, res) => {
  try {
    const stats = await getTournamentPlatformStats()
    res.json({ data: stats })
  } catch (error) {
    console.error('Error fetching tournament stats:', error)
    res.status(500).json({ error: 'Failed to fetch tournament stats' })
  }
})

// GET /api/tournaments/:id - Get single tournament
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const tournamentId = Number(id)
    if (Number.isNaN(tournamentId) || tournamentId < 0) {
      return res.status(400).json({ error: 'Invalid tournament id' })
    }

    const tournament = await getTournamentById(tournamentId)
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' })
    }

    res.json({ data: tournament })
  } catch (error) {
    console.error('Error fetching tournament:', error)
    res.status(500).json({ error: 'Failed to fetch tournament' })
  }
})

// GET /api/tournaments/:id/bracket/:round - Get bracket for a round
router.get('/:id/bracket/:round', async (req, res) => {
  try {
    const tournamentId = Number(req.params.id)
    const round = Number(req.params.round)

    if (Number.isNaN(tournamentId) || Number.isNaN(round)) {
      return res.status(400).json({ error: 'Invalid parameters' })
    }

    const matches = await getTournamentBracket(tournamentId, round)
    res.json({ data: matches })
  } catch (error) {
    console.error('Error fetching bracket:', error)
    res.status(500).json({ error: 'Failed to fetch bracket' })
  }
})

// GET /api/tournaments/:id/predictions - Get predictions
router.get('/:id/predictions', async (req, res) => {
  try {
    const tournamentId = Number(req.params.id)
    if (Number.isNaN(tournamentId)) {
      return res.status(400).json({ error: 'Invalid tournament id' })
    }

    const predictions = await getTournamentPredictions(tournamentId)
    res.json({ data: predictions })
  } catch (error) {
    console.error('Error fetching predictions:', error)
    res.status(500).json({ error: 'Failed to fetch predictions' })
  }
})

// GET /api/tournaments/:id/results - Get tournament results
router.get('/:id/results', async (req, res) => {
  try {
    const tournamentId = Number(req.params.id)
    if (Number.isNaN(tournamentId)) {
      return res.status(400).json({ error: 'Invalid tournament id' })
    }

    const results = await getTournamentResults(tournamentId)
    if (!results) {
      return res.status(404).json({ error: 'Results not found' })
    }

    res.json({ data: results })
  } catch (error) {
    console.error('Error fetching results:', error)
    res.status(500).json({ error: 'Failed to fetch results' })
  }
})

// GET /api/tournaments/player/:address - Get player tournament stats
router.get('/player/:address', async (req, res) => {
  try {
    const { address } = req.params
    const stats = await getPlayerTournamentStats(address)
    if (!stats) {
      return res.status(404).json({ error: 'Player stats not found' })
    }
    res.json({ data: stats })
  } catch (error) {
    console.error('Error fetching player tournament stats:', error)
    res.status(500).json({ error: 'Failed to fetch player stats' })
  }
})

export default router
