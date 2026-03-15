import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import matchesRouter from './routes/matches.js'
import statsRouter from './routes/stats.js'
import usersRouter from './routes/users.js'
import oracleRouter from './routes/oracle.js'
import tournamentsRouter from './routes/tournaments.js'
import arenaRouter from './routes/arena.js'

dotenv.config()

const VERSION = 'v2.0.0'

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
const defaultOrigins = ['http://localhost:5173', 'http://localhost:5174']
const allowedOrigins = (process.env.ALLOWED_ORIGINS?.split(',') || defaultOrigins)
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, origin)
    }
    console.warn(`🚫 Blocked CORS request from ${origin}. Set ALLOWED_ORIGINS to permit it.`)
    return callback(new Error('Not allowed by CORS'))
  },
  credentials: true
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: VERSION,
    timestamp: new Date().toISOString()
  })
})

// API Routes
app.use('/api/matches', matchesRouter)
app.use('/api/stats', statsRouter)
app.use('/api/users', usersRouter)
app.use('/api/oracle', oracleRouter)
app.use('/api/tournaments', tournamentsRouter)
app.use('/api/arenas', arenaRouter)

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`
  })
})

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err)
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
})

// Start server
app.listen(PORT, () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`🚀 DotDuel Platform API - ${VERSION}`)
  console.log(`📡 Server running on port ${PORT}`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🔗 Health check: http://localhost:${PORT}/health`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
})

export default app

