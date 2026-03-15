import express from 'express'
import { ethers } from 'ethers'
import { getPlatformStats } from '../services/duelPlatform.js'

const router = express.Router()

// GET /api/stats/platform - Get platform stats
router.get('/platform', async (req, res) => {
  try {
    const stats = await getPlatformStats()

    res.json({
      data: {
        totalMatches: stats.totalMatches,
        waitingMatches: stats.waitingMatches,
        activeMatches: stats.activeMatches,
        completedMatches: stats.completedMatches,
        cancelledMatches: stats.cancelledMatches,
        totalUsers: stats.totalUsers,
        totalVolumeWei: stats.totalVolumeWei,
        topPlayers: stats.topPlayers,
        recentMatches: stats.recentMatches
      }
    })
  } catch (error) {
    console.error('Error fetching platform stats:', error)
    res.status(500).json({ error: 'Failed to fetch platform stats' })
  }
})

// GET /api/stats/recent - Get recent matches
router.get('/recent', async (req, res) => {
  try {
    const { limit = '10' } = req.query
    const parsedLimit = Math.max(1, Math.min(parseInt(limit as string, 10) || 10, 50))

    const stats = await getPlatformStats()
    const recent = stats.recentMatches.slice(0, parsedLimit).map((match) => ({
      id: match.id,
      description: match.description,
      stakeAmountWei: match.stakeAmountWei,
      status: match.status,
      winner: match.winner,
      updatedAt: match.updatedAt,
      stakeAmountDOT: Number(ethers.formatEther(match.stakeAmountWei)).toFixed(3)
    }))

    res.json({ data: recent })
  } catch (error) {
    console.error('Error fetching recent matches:', error)
    res.status(500).json({ error: 'Failed to fetch recent matches' })
  }
})

console.log('📊 Stats Routes Loaded - v0.6.0-mvp')

export default router

