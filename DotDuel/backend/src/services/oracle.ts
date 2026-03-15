import { ethers } from 'ethers'
import dotenv from 'dotenv'

dotenv.config()

// Oracle Service class
export class OracleService {
  private provider: ethers.JsonRpcProvider
  private wallet: ethers.Wallet | ethers.HDNodeWallet
  private contract: ethers.Contract
  private isRunning: boolean = false

  constructor() {
    // Initialize provider
    this.provider = new ethers.JsonRpcProvider(
      process.env.RPC_URL || 'https://rpc.sepolia.mantle.xyz'
    )

    // Initialize wallet (requires private key)
    const privateKey = process.env.ORACLE_PRIVATE_KEY
    if (!privateKey) {
      console.warn('⚠️  Oracle private key not configured')
      // Use temporary wallet for development testing
  // createRandom returns HDNodeWallet in ethers v6, so keep the union type with Wallet
  this.wallet = ethers.Wallet.createRandom().connect(this.provider)
    } else {
      this.wallet = new ethers.Wallet(privateKey, this.provider)
    }

    // Initialize contract (requires ABI and address)
    const contractAddress = process.env.CONTRACT_ADDRESS || ethers.ZeroAddress
    // TODO: Load actual contract ABI
    const contractABI = [
      'function submitResultByOracle(uint256 matchId, address winner) external',
      'function getMatch(uint256 matchId) external view returns (tuple)',
      'event MatchCreated(uint256 indexed matchId, address indexed creator, uint8 mode)',
      'event MatchStarted(uint256 indexed matchId)',
    ]
    
    this.contract = new ethers.Contract(contractAddress, contractABI, this.wallet)

    console.log('🔮 Oracle Service initialized')
    console.log('📍 Oracle address:', this.wallet.address)
  }

  // Start Oracle service
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Oracle service is already running')
      return
    }

    this.isRunning = true
    console.log('🔮 Oracle Service started')

    // Listen to blockchain events
    this.listenToEvents()

    // Start scheduled tasks
    this.startScheduledTasks()
  }

  // Stop Oracle service
  async stop() {
    this.isRunning = false
    console.log('🔮 Oracle Service stopped')
  }

  // Listen to blockchain events
  private listenToEvents() {
    try {
      // Listen for match creation events (Oracle mode)
      this.contract.on('MatchCreated', async (matchId, creator, mode) => {
        if (mode === 1) { // Oracle mode
          console.log(`📢 New Oracle match created: ${matchId}`)
          // TODO: Handle new Oracle mode match
        }
      })

      // Listen for match start events
      this.contract.on('MatchStarted', async (matchId) => {
        console.log(`📢 Match started: ${matchId}`)
        // TODO: Start monitoring match results
      })

      console.log('👂 Listening to blockchain events...')
    } catch (error) {
      console.error('Error setting up event listeners:', error)
    }
  }

  // Scheduled tasks
  private startScheduledTasks() {
    // Check matches pending settlement every 5 minutes
    setInterval(() => {
      if (this.isRunning) {
        this.checkPendingMatches()
      }
    }, 5 * 60 * 1000) // 5 minutes

    console.log('⏰ Scheduled tasks started')
  }

  // Check pending matches for settlement
  private async checkPendingMatches() {
    try {
      console.log('🔍 Checking pending matches...')
      
      // TODO: Get pending matches from database or blockchain
      // TODO: Call fetchMatchResult for each match
      
    } catch (error) {
      console.error('Error checking pending matches:', error)
    }
  }

  // Fetch match result from mydupr API
  private async fetchMatchResult(externalMatchId: string): Promise<string | null> {
    try {
      const apiUrl = process.env.MYDUPR_API_URL || 'https://api.mydupr.com'
      
      // TODO: Actually call mydupr API
      console.log(`🔍 Fetching result for external match: ${externalMatchId}`)
      
      // Simulated API response
      // const response = await fetch(`${apiUrl}/matches/${externalMatchId}`)
      // const data = await response.json()
      // return data.winner
      
      return null
    } catch (error) {
      console.error('Error fetching match result:', error)
      return null
    }
  }

  // Submit result to blockchain
  async submitResult(matchId: number, winner: string): Promise<boolean> {
    try {
      console.log(`📤 Submitting result for match ${matchId}`)
      console.log(`🏆 Winner: ${winner}`)

      // Send transaction
      const tx = await this.contract.submitResultByOracle(matchId, winner)
      console.log(`⏳ Transaction sent: ${tx.hash}`)

      // Wait for confirmation
      const receipt = await tx.wait()
      console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`)

      return true
    } catch (error: any) {
      console.error('Error submitting result:', error)
      return false
    }
  }

  // Manually trigger settlement (for testing)
  async manualSettle(matchId: number, externalMatchId: string) {
    console.log(`🔧 Manual settle triggered for match ${matchId}`)
    
    // Get result
    const winner = await this.fetchMatchResult(externalMatchId)
    
    if (!winner) {
      console.log('❌ No winner found')
      return false
    }

    // Submit result
    return await this.submitResult(matchId, winner)
  }

  // Get Oracle status
  getStatus() {
    return {
      isRunning: this.isRunning,
      oracleAddress: this.wallet.address,
      contractAddress: this.contract.target,
      network: process.env.RPC_URL || 'https://rpc.sepolia.mantle.xyz'
    }
  }
}

// Create singleton
let oracleInstance: OracleService | null = null

export function getOracleService(): OracleService {
  if (!oracleInstance) {
    oracleInstance = new OracleService()
  }
  return oracleInstance
}

console.log('🔮 Oracle Service Module Loaded - v0.5.0-mvp')

