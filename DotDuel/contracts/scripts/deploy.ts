import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying DotDuel Platform v2.0.0...\n");

  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    console.error("❌ DEPLOYER_PRIVATE_KEY not set in .env");
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();

  if (!deployer) {
    console.error("❌ Cannot get signer. Check DEPLOYER_PRIVATE_KEY.");
    process.exit(1);
  }

  console.log("👤 Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  const network = await ethers.provider.getNetwork();
  console.log("💰 Balance:", ethers.formatEther(balance), "MNT/ETH");
  console.log("🌐 Network:", network.name, `(chainId: ${network.chainId})\n`);

  if (balance === 0n) {
    console.warn("⚠️  Balance shows 0 — attempting deployment anyway (faucet may still be processing)...\n");
  }

  const platformWallet = process.env.PLATFORM_WALLET || deployer.address;
  const oracleAddress = process.env.ORACLE_ADDRESS || deployer.address;

  console.log("⚙️  Config:");
  console.log("   Platform Wallet:", platformWallet);
  console.log("   Oracle Address:", oracleAddress);
  console.log("");

  // Deploy DuelPlatform
  console.log("📦 Deploying DuelPlatform...");
  const DuelPlatform = await ethers.getContractFactory("DuelPlatform");
  const duelPlatform = await DuelPlatform.deploy(platformWallet, oracleAddress);
  await duelPlatform.waitForDeployment();
  const duelAddress = await duelPlatform.getAddress();
  console.log("✅ DuelPlatform deployed at:", duelAddress);

  // Deploy TournamentPlatform
  console.log("📦 Deploying TournamentPlatform...");
  const TournamentPlatform = await ethers.getContractFactory("TournamentPlatform");
  const tournamentPlatform = await TournamentPlatform.deploy(platformWallet, oracleAddress);
  await tournamentPlatform.waitForDeployment();
  const tournamentAddress = await tournamentPlatform.getAddress();
  console.log("✅ TournamentPlatform deployed at:", tournamentAddress);

  // Deploy PredictionArena
  console.log("📦 Deploying PredictionArena...");
  const PredictionArena = await ethers.getContractFactory("PredictionArena");
  const predictionArena = await PredictionArena.deploy(platformWallet);
  await predictionArena.waitForDeployment();
  const arenaAddress = await predictionArena.getAddress();
  console.log("✅ PredictionArena deployed at:", arenaAddress);

  // Verify versions
  const duelVersion = await duelPlatform.VERSION();
  const tournamentVersion = await tournamentPlatform.VERSION();
  const arenaVersion = await predictionArena.VERSION();
  console.log("\n📌 Versions:");
  console.log("   DuelPlatform:", duelVersion);
  console.log("   TournamentPlatform:", tournamentVersion);
  console.log("   PredictionArena:", arenaVersion);

  // Verify config
  const storedPlatformWallet = await duelPlatform.platformWallet();
  const storedOracleAddress = await duelPlatform.oracleAddress();
  console.log("\n✓ Platform Wallet:", storedPlatformWallet);
  console.log("✓ Oracle Address:", storedOracleAddress);

  console.log("\n" + "=".repeat(60));
  console.log("🎉 DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log("DuelPlatform:       ", duelAddress);
  console.log("TournamentPlatform: ", tournamentAddress);
  console.log("PredictionArena:    ", arenaAddress);
  console.log("Deployer:           ", deployer.address);
  console.log("Platform Wallet:    ", storedPlatformWallet);
  console.log("Oracle:             ", storedOracleAddress);
  console.log("=".repeat(60));
  console.log("\n🔧 Next steps:");
  console.log("1. Update frontend config (VITE_CONTRACT_ADDRESS, VITE_TOURNAMENT_ADDRESS, VITE_ARENA_ADDRESS)");
  console.log("2. Update backend config (CONTRACT_ADDRESS, TOURNAMENT_ADDRESS, ARENA_ADDRESS)");
  console.log("3. Verify contracts on block explorer (optional)");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });

