import express from 'express'
import { ethers } from 'ethers'
import { getUserMatchesDetailed, getUserStats } from '../services/duelPlatform.js'

const router = express.Router()

const isValidAddress = (address: string) => {
  try {
    ethers.getAddress(address)
    return true
  } catch {
    return false
  }
}

// GET /api/users/:address/stats - Get user stats
router.get('/:address/stats', async (req, res) => {
  try {
    const { address } = req.params
    if (!isValidAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' })
    }

    const stats = await getUserStats(address)

    res.json({
      data: {
        address: stats.address,
        totalMatches: stats.totalMatches,
        wins: stats.wonMatches,
        losses: Math.max(stats.totalMatches - stats.wonMatches, 0),
        winRate:
          stats.totalMatches > 0
            ? Number(((stats.wonMatches / stats.totalMatches) * 100).toFixed(1))
            : 0,
        totalStakedWei: stats.totalStakedWei,
        totalWonWei: stats.totalWonWei
      }
    })
  } catch (error) {
    console.error('Error fetching user stats:', error)
    res.status(500).json({ error: 'Failed to fetch user stats' })
  }
})

// GET /api/users/:address/matches - Get user matches
router.get('/:address/matches', async (req, res) => {
  try {
    const { address } = req.params
    const { limit = '50', offset = '0' } = req.query

    if (!isValidAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' })
    }

    const parsedLimit = Math.max(1, Math.min(parseInt(limit as string, 10) || 50, 100))
    const parsedOffset = Math.max(0, parseInt(offset as string, 10) || 0)

    const { matches, total } = await getUserMatchesDetailed(address, parsedLimit, parsedOffset)

    res.json({
      data: matches,
      meta: {
        total,
        limit: parsedLimit,
        offset: parsedOffset
      }
    })
  } catch (error) {
    console.error('Error fetching user matches:', error)
    res.status(500).json({ error: 'Failed to fetch user matches' })
  }
})

console.log('👥 Users Routes Loaded - v0.6.0-mvp')

export default router

