import express from 'express'
import { getArenaById, getArenaBets, getOddsHistory, listArenas } from '../services/arena.js'

const router = express.Router()

// GET /api/arenas — list arenas
router.get('/', async (req, res) => {
  try {
    const { status, limit = '20', offset = '0' } = req.query
    const parsedLimit = Math.max(1, Math.min(parseInt(limit as string, 10) || 20, 100))
    const parsedOffset = Math.max(0, parseInt(offset as string, 10) || 0)
    const parsedStatus = typeof status === 'string' ? Number(status) : undefined

    const { total, arenas } = await listArenas({
      limit: parsedLimit,
      offset: parsedOffset,
      status: typeof parsedStatus === 'number' && !Number.isNaN(parsedStatus) ? parsedStatus : undefined,
    })

    res.json({ data: arenas, meta: { total, limit: parsedLimit, offset: parsedOffset } })
  } catch (error) {
    console.error('Error fetching arenas:', error)
    res.status(500).json({ error: 'Failed to fetch arenas' })
  }
})

// GET /api/arenas/:id — single arena
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (Number.isNaN(id) || id < 0) return res.status(400).json({ error: 'Invalid arena id' })
    const arena = await getArenaById(id)
    if (!arena) return res.status(404).json({ error: 'Arena not found' })
    res.json({ data: arena })
  } catch (error) {
    console.error('Error fetching arena:', error)
    res.status(500).json({ error: 'Failed to fetch arena' })
  }
})

// GET /api/arenas/:id/bets — all bets for an arena
router.get('/:id/bets', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (Number.isNaN(id) || id < 0) return res.status(400).json({ error: 'Invalid arena id' })
    const bets = await getArenaBets(id)
    res.json({ data: bets })
  } catch (error) {
    console.error('Error fetching arena bets:', error)
    res.status(500).json({ error: 'Failed to fetch arena bets' })
  }
})

// GET /api/arenas/:id/odds-history — odds history via events
router.get('/:id/odds-history', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (Number.isNaN(id) || id < 0) return res.status(400).json({ error: 'Invalid arena id' })
    const history = await getOddsHistory(id)
    res.json({ data: history })
  } catch (error) {
    console.error('Error fetching odds history:', error)
    res.status(500).json({ error: 'Failed to fetch odds history' })
  }
})

console.log('🏟️  Arena Routes Loaded')

export default router
