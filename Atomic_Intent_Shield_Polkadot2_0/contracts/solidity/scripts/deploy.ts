import * as dotenv from "dotenv";
import { ethers } from "hardhat";

dotenv.config();

async function main(): Promise<void> {
  const signers = await ethers.getSigners();
  if (!signers.length) {
    throw new Error(
      'No deployer account available. Set REVIVE_PRIVATE_KEY in contracts/solidity/.env and retry.'
    );
  }
  const [deployer] = signers;
  const solverAddress = process.env.SOLVER_ADDRESS || deployer.address;
  const feeRecipient = process.env.FEE_RECIPIENT || deployer.address;

  console.log(`Deploying with account: ${deployer.address}`);

  const verifierFactory = await ethers.getContractFactory("IntentVerifierMock");
  const verifier = await verifierFactory.deploy();
  await verifier.deployed();

  const darkPoolFactory = await ethers.getContractFactory("DarkPool");
  const darkPool = await darkPoolFactory.deploy(
    verifier.address,
    solverAddress,
    feeRecipient
  );
  await darkPool.deployed();

  const output = {
    network: process.env.HARDHAT_NETWORK || "unknown",
    deployer: deployer.address,
    solver: solverAddress,
    feeRecipient,
    intentVerifier: verifier.address,
    darkPool: darkPool.address,
  };

  console.log("Deployment output:");
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
