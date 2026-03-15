import { ethers } from "hardhat";

async function main() {
  const txHash = process.env.TX_HASH
  if (!txHash) {
    throw new Error("Please set TX_HASH env variable")
  }

  const tx = await ethers.provider.getTransaction(txHash)
  if (!tx) {
    throw new Error(`Transaction ${txHash} not found`)
  }

  console.log("Fetched transaction:")
  console.log({ to: tx.to, from: tx.from, value: tx.value.toString() })

  const data = tx.data
  try {
    const result = await ethers.provider.call({
      to: tx.to as string,
      from: tx.from,
      data,
      value: tx.value,
    })
    console.log("Call result:", result)
  } catch (error: any) {
    if (error?.error?.message) {
      console.error("Revert reason:", error.error.message)
    } else if (error?.message) {
      console.error("Revert reason:", error.message)
    } else {
      console.error("Call failed", error)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
