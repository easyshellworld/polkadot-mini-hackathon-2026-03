import * as dotenv from "dotenv";
import { ethers } from "hardhat";

dotenv.config();

function parseRecipients(): string[] {
  const raw = (process.env.MINT_RECIPIENTS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set(raw));
}

async function mintToken(
  tokenAddress: string,
  amountWhole: string,
  decimals: number,
  recipients: string[]
): Promise<void> {
  const token = await ethers.getContractAt("MockERC20", tokenAddress);
  const symbol = await token.symbol();
  const amount = ethers.utils.parseUnits(amountWhole, decimals);

  for (const to of recipients) {
    const tx = await token.mint(to, amount);
    await tx.wait();
    console.log(`Minted ${amountWhole} ${symbol} to ${to}`);
  }
}

async function main(): Promise<void> {
  const recipients = parseRecipients();
  if (recipients.length === 0) {
    throw new Error("MINT_RECIPIENTS is required (comma-separated EVM addresses)");
  }

  const usdcAddress = (process.env.MOCK_USDC_ADDRESS || "").trim();
  const wethAddress = (process.env.MOCK_WETH_ADDRESS || "").trim();
  if (!usdcAddress || !wethAddress) {
    throw new Error("MOCK_USDC_ADDRESS and MOCK_WETH_ADDRESS are required");
  }

  const usdcAmount = process.env.MOCK_USDC_MINT || "10000";
  const wethAmount = process.env.MOCK_WETH_MINT || "10";

  const [signer] = await ethers.getSigners();
  console.log(`Mint signer: ${signer.address}`);
  console.log(`Recipients: ${recipients.join(", ")}`);

  await mintToken(usdcAddress, usdcAmount, 6, recipients);
  await mintToken(wethAddress, wethAmount, 18, recipients);

  console.log("Mint complete.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
