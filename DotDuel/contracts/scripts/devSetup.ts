import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const provider = ethers.provider;

  // User's MetaMask address
  const userAddr = "0xDc2112EC7200d1C85D3d696915569773d3381F42";

  // Fund user with 100 ETH
  console.log("Sending 100 ETH to", userAddr);
  const tx = await deployer.sendTransaction({
    to: userAddr,
    value: ethers.parseEther("100"),
  });
  await tx.wait();
  const bal = await provider.getBalance(userAddr);
  console.log("User balance:", ethers.formatEther(bal), "ETH");

  // Create a test match
  console.log("\nCreating test match via DuelPlatform...");
  const DuelPlatform = await ethers.getContractAt(
    "DuelPlatform",
    "0x5FbDB2315678afecb367f032d93F642f64180aa3"
  );

  const now = Math.floor(Date.now() / 1000);
  const tx2 = await DuelPlatform.createMatch(
    0, // Referee mode
    ethers.parseEther("0.1"), // stake 0.1 ETH
    now + 3600, // start in 1h
    now + 86400, // end in 24h
    "Test Duel: Alice vs Bob",
    "", // no external match ID
    { value: ethers.parseEther("0.1") }
  );
  const receipt = await tx2.wait();
  console.log("Match created! tx:", receipt?.hash);

  const count = await DuelPlatform.matchCounter();
  console.log("matchCounter:", count.toString());

  // Read match details
  const match = await DuelPlatform.getMatch(1);
  console.log("\nMatch #1 details:");
  console.log("  Creator:", match[0]);
  console.log("  Stake:", ethers.formatEther(match[3]), "ETH");
  console.log("  Description:", match[8]);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
