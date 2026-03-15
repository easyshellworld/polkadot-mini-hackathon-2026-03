import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";

dotenv.config();

const PRIVATE_KEY = process.env.REVIVE_PRIVATE_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {},
    revive: {
      url: process.env.REVIVE_RPC_URL || "http://127.0.0.1:8545",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: process.env.REVIVE_CHAIN_ID ? Number(process.env.REVIVE_CHAIN_ID) : undefined,
    },
  },
};

export default config;
