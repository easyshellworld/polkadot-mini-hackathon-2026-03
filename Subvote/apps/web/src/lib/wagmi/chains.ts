import { defineChain } from "viem";

export const polkadotHubTestnet = defineChain({
  id: 420420417,
  name: "Polkadot Hub TestNet",
  nativeCurrency: {
    decimals: 18,
    name: "Paseo",
    symbol: "PAS",
  },
  rpcUrls: {
    default: {
      http: ["https://services.polkadothub-rpc.com/testnet"],
    },
    public: {
      http: ["https://eth-rpc-testnet.polkadot.io/"],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://blockscout-testnet.polkadot.io/",
    },
  },
  testnet: true,
});

export const supportedWalletChains = [polkadotHubTestnet] as const;
export const supportedWalletChainId = polkadotHubTestnet.id;
export const supportedWalletChainName = polkadotHubTestnet.name;
