import express from 'express'
import { getOracleService } from '../services/oracle.js'

const router = express.Router()

// GET /api/oracle/status - Get Oracle status
router.get('/status', (req, res) => {
  try {
    const oracle = getOracleService()
    const status = oracle.getStatus()
    
    res.json({
      data: status,
      message: 'Oracle service status'
    })
  } catch (error) {
    console.error('Error getting oracle status:', error)
    res.status(500).json({ error: 'Failed to get oracle status' })
  }
})

// POST /api/oracle/start - Start Oracle service
router.post('/start', async (req, res) => {
  try {
    const oracle = getOracleService()
    await oracle.start()
    
    res.json({
      message: 'Oracle service started successfully'
    })
  } catch (error) {
    console.error('Error starting oracle:', error)
    res.status(500).json({ error: 'Failed to start oracle service' })
  }
})

// POST /api/oracle/stop - Stop Oracle service
router.post('/stop', async (req, res) => {
  try {
    const oracle = getOracleService()
    await oracle.stop()
    
    res.json({
      message: 'Oracle service stopped successfully'
    })
  } catch (error) {
    console.error('Error stopping oracle:', error)
    res.status(500).json({ error: 'Failed to stop oracle service' })
  }
})

// POST /api/oracle/settle - Manually trigger settlement
router.post('/settle', async (req, res) => {
  try {
    const { matchId, externalMatchId } = req.body

    if (!matchId || !externalMatchId) {
      return res.status(400).json({
        error: 'Missing required fields: matchId, externalMatchId'
      })
    }

    const oracle = getOracleService()
    const success = await oracle.manualSettle(matchId, externalMatchId)
    
    if (success) {
      res.json({
        message: 'Match settled successfully',
        matchId
      })
    } else {
      res.status(500).json({
        error: 'Failed to settle match'
      })
    }
  } catch (error) {
    console.error('Error settling match:', error)
    res.status(500).json({ error: 'Failed to settle match' })
  }
})

// POST /api/oracle/submit - Submit result directly
router.post('/submit', async (req, res) => {
  try {
    const { matchId, winner } = req.body

    if (!matchId || !winner) {
      return res.status(400).json({
        error: 'Missing required fields: matchId, winner'
      })
    }

    const oracle = getOracleService()
    const success = await oracle.submitResult(matchId, winner)
    
    if (success) {
      res.json({
        message: 'Result submitted successfully',
        matchId,
        winner
      })
    } else {
      res.status(500).json({
        error: 'Failed to submit result'
      })
    }
  } catch (error) {
    console.error('Error submitting result:', error)
    res.status(500).json({ error: 'Failed to submit result' })
  }
})

console.log('🔮 Oracle Routes Loaded - v0.5.0-mvp')

export default router

