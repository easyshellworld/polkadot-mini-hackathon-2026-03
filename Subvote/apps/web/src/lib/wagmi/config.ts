import { createConfig, http, injected } from "wagmi";

import { polkadotHubTestnet, supportedWalletChains } from "@/lib/wagmi/chains";
import { walletConnect } from "@/lib/wagmi/connectors/wallet-connect";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const connectors = [
  injected({ shimDisconnect: true }),
  ...(walletConnectProjectId
    ? [
        walletConnect({
          metadata: {
            description: "Community governance, voting, and proposal staging.",
            icons: [`${appUrl}/favicon.ico`],
            name: "subvote",
            url: appUrl,
          },
          projectId: walletConnectProjectId,
          showQrModal: true,
        }),
      ]
    : []),
];

export const wagmiConfig = createConfig({
  chains: supportedWalletChains,
  connectors,
  multiInjectedProviderDiscovery: true,
  syncConnectedChain: true,
  transports: {
    [polkadotHubTestnet.id]: http(polkadotHubTestnet.rpcUrls.default.http[0]),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
