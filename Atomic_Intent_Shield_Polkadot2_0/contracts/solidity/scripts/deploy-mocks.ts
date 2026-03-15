import * as dotenv from "dotenv";
import { ethers } from "hardhat";

dotenv.config();

function parseRecipients(defaultRecipient?: string): string[] {
  const fromList = (process.env.MINT_RECIPIENTS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const singleA = (process.env.USER_A_ADDRESS || "").trim();
  const singleB = (process.env.USER_B_ADDRESS || "").trim();

  const candidates = [...fromList, singleA, singleB].filter(Boolean);
  const deduped = Array.from(new Set(candidates));
  if (deduped.length > 0) return deduped;
  return defaultRecipient ? [defaultRecipient] : [];
}

async function mintToRecipients(
  token: any,
  recipients: string[],
  amountWhole: string,
  decimals: number
): Promise<void> {
  if (recipients.length === 0) return;
  const amount = ethers.utils.parseUnits(amountWhole, decimals);
  for (const to of recipients) {
    const tx = await token.mint(to, amount);
    await tx.wait();
    console.log(`Minted ${amountWhole} to ${to} on ${await token.symbol()}`);
  }
}

async function main(): Promise<void> {
  const signers = await ethers.getSigners();
  if (!signers.length) {
    throw new Error(
      "No deployer account available. Set REVIVE_PRIVATE_KEY in contracts/solidity/.env and retry."
    );
  }

  const [deployer] = signers;
  const recipients = parseRecipients(deployer.address);
  const usdcAmount = process.env.MOCK_USDC_MINT || "10000";
  const wethAmount = process.env.MOCK_WETH_MINT || "10";

  console.log(`Deploying mock tokens with account: ${deployer.address}`);

  const tokenFactory = await ethers.getContractFactory("MockERC20");

  const mockUsdc = await tokenFactory.deploy("Mock USD Coin", "mUSDC", 6);
  await mockUsdc.deployed();

  const mockWeth = await tokenFactory.deploy("Mock Wrapped Ether", "mWETH", 18);
  await mockWeth.deployed();

  await mintToRecipients(mockUsdc, recipients, usdcAmount, 6);
  await mintToRecipients(mockWeth, recipients, wethAmount, 18);

  const output = {
    network: process.env.HARDHAT_NETWORK || "unknown",
    deployer: deployer.address,
    recipients,
    mockUsdc: mockUsdc.address,
    mockWeth: mockWeth.address,
    minted: {
      usdc: usdcAmount,
      weth: wethAmount,
    },
  };

  console.log("Mock token deployment output:");
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
