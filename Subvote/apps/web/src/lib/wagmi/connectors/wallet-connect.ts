import {
  ChainNotConfiguredError,
  createConnector,
  ProviderNotFoundError,
} from "wagmi";
import {
  getAddress,
  numberToHex,
  SwitchChainError,
  UserRejectedRequestError,
  type AddEthereumChainParameter,
  type Address,
  type Chain,
  type ProviderConnectInfo,
} from "viem";

type WalletConnectParameters = {
  isNewChainsStale?: boolean;
  metadata: {
    description: string;
    icons: string[];
    name: string;
    url: string;
  };
  projectId: string;
  showQrModal?: boolean;
};

type WalletConnectProvider = {
  accounts: string[];
  chainId: number;
  connect(parameters: {
    optionalChains: [number, ...number[]];
    pairingTopic?: string;
  }): Promise<void>;
  disconnect(): Promise<void>;
  enable(): Promise<string[]>;
  events: {
    setMaxListeners(maxListeners: number): void;
  };
  on(event: "accountsChanged", listener: (accounts: string[]) => void): void;
  on(event: "chainChanged", listener: (chainId: string) => void): void;
  on(event: "connect", listener: (connectInfo: ProviderConnectInfo) => void): void;
  on(event: "disconnect", listener: () => void): void;
  on(event: "display_uri", listener: (uri: string) => void): void;
  on(event: "session_delete", listener: (data: { topic: string }) => void): void;
  removeListener(
    event: "accountsChanged",
    listener: (accounts: string[]) => void,
  ): void;
  removeListener(
    event: "chainChanged",
    listener: (chainId: string) => void,
  ): void;
  removeListener(
    event: "connect",
    listener: (connectInfo: ProviderConnectInfo) => void,
  ): void;
  removeListener(event: "disconnect", listener: () => void): void;
  removeListener(event: "display_uri", listener: (uri: string) => void): void;
  removeListener(
    event: "session_delete",
    listener: (data: { topic: string }) => void,
  ): void;
  request(parameters: {
    method: string;
    params?: unknown[];
  }): Promise<unknown>;
  session?: {
    namespaces?: Record<string, { accounts?: string[] } | undefined>;
  };
};

type WalletConnectProviderModule = {
  EthereumProvider: {
    init(parameters: {
      disableProviderPing: boolean;
      metadata: WalletConnectParameters["metadata"];
      optionalChains: [number, ...number[]];
      projectId: string;
      rpcMap: Record<number, string>;
      showQrModal: boolean;
    }): Promise<WalletConnectProvider>;
  };
};

type WalletConnectProperties = {
  getNamespaceChainsIds(): number[];
  getRequestedChainsIds(): Promise<number[]>;
  isChainsStale(): Promise<boolean>;
  onDisplayUri(uri: string): void;
  onSessionDelete(data: { topic: string }): void;
  requestedChainsStorageKey: `${string}.requestedChains`;
  setRequestedChainsIds(chains: number[]): Promise<void>;
};

type WalletConnectStorage = Record<`${string}.requestedChains`, number[]>;

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

function isUserRejectedError(error: unknown) {
  return /(user rejected|connection request reset)/i.test(toError(error).message);
}

function getCauseMessage(error: Error) {
  if (!("cause" in error)) return "";

  const cause = error.cause;

  if (cause instanceof Error) return cause.message;
  if (typeof cause === "string") return cause;

  return "";
}

function getChainRpcUrl(chain: Chain) {
  const rpcUrl =
    chain.rpcUrls.default.http[0] ?? chain.rpcUrls.public?.http[0];

  if (!rpcUrl) throw new Error(`Missing RPC URL for chain ${chain.id}.`);

  return rpcUrl;
}

async function loadProviderModule() {
  try {
    return (await import(
      "@walletconnect/ethereum-provider"
    )) as WalletConnectProviderModule;
  } catch {
    throw new Error('dependency "@walletconnect/ethereum-provider" not found');
  }
}

export function walletConnect(parameters: WalletConnectParameters) {
  const isNewChainsStale = parameters.isNewChainsStale ?? true;
  const namespace = "eip155";

  let provider: WalletConnectProvider | undefined;
  let providerPromise: Promise<WalletConnectProvider> | undefined;
  let accountsChanged: ((accounts: string[]) => void) | undefined;
  let chainChanged: ((chainId: string) => void) | undefined;
  let connectListener: ((connectInfo: ProviderConnectInfo) => void) | undefined;
  let displayUri: ((uri: string) => void) | undefined;
  let sessionDelete: ((data: { topic: string }) => void) | undefined;
  let disconnectListener: (() => void) | undefined;

  return createConnector<
    WalletConnectProvider,
    WalletConnectProperties,
    WalletConnectStorage
  >((config) => {
    const requestedChainsStorageKey = "walletConnect.requestedChains" as const;

    async function setRequestedChainsIds(chains: number[]) {
      await config.storage?.setItem(requestedChainsStorageKey, chains);
    }

    async function getRequestedChainsIds() {
      return (
        (await config.storage?.getItem(requestedChainsStorageKey)) as
          | number[]
          | undefined
      ) ?? [];
    }

    function getNamespaceChainsIds() {
      return (
        provider?.session?.namespaces?.[namespace]?.accounts?.map((account) => {
          const [, chainId = ""] = account.split(":");
          return Number.parseInt(chainId, 10);
        }) ?? []
      );
    }

    async function isChainsStale() {
      if (!isNewChainsStale) return false;

      const connectorChains = config.chains.map((chain) => chain.id);
      const namespaceChains = getNamespaceChainsIds();

      if (
        namespaceChains.length > 0 &&
        !namespaceChains.some((chainId) => connectorChains.includes(chainId))
      ) {
        return false;
      }

      const requestedChains = await getRequestedChainsIds();

      return !connectorChains.every((chainId) => requestedChains.includes(chainId));
    }

    function onDisplayUri(uri: string) {
      config.emitter.emit("message", { type: "display_uri", data: uri });
    }

    function onAccountsChanged(accounts: string[]) {
      if (accounts.length === 0) {
        onDisconnect();
        return;
      }

      config.emitter.emit("change", {
        accounts: accounts.map((address) => getAddress(address)),
      });
    }

    function onChainChanged(chain: string) {
      config.emitter.emit("change", { chainId: Number(chain) });
    }

    function onConnect(connectInfo: ProviderConnectInfo) {
      const chainId = Number(connectInfo.chainId);

      void getAccounts().then((accounts) => {
        config.emitter.emit("connect", { accounts, chainId });
      });
    }

    function onSessionDelete(_data: { topic: string }) {
      onDisconnect();
    }

    function onDisconnect() {
      void (async () => {
        await setRequestedChainsIds([]);
        config.emitter.emit("disconnect");

        const provider = await getProvider().catch(() => undefined);

        if (accountsChanged) {
          provider?.removeListener("accountsChanged", accountsChanged);
          accountsChanged = undefined;
        }

        if (chainChanged) {
          provider?.removeListener("chainChanged", chainChanged);
          chainChanged = undefined;
        }

        if (disconnectListener) {
          provider?.removeListener("disconnect", disconnectListener);
          disconnectListener = undefined;
        }

        if (sessionDelete) {
          provider?.removeListener("session_delete", sessionDelete);
          sessionDelete = undefined;
        }

        if (!connectListener && provider) {
          connectListener = (connectInfo) => {
            onConnect(connectInfo);
          };
          provider.on("connect", connectListener);
        }
      })();
    }

    async function initProvider() {
      const optionalChains = config.chains.map((chain) => chain.id) as [
        number,
        ...number[],
      ];
      const rpcMap = Object.fromEntries(
        config.chains.map((chain) => [chain.id, getChainRpcUrl(chain)]),
      );
      const { EthereumProvider } = await loadProviderModule();

      return EthereumProvider.init({
        disableProviderPing: true,
        metadata: parameters.metadata,
        optionalChains,
        projectId: parameters.projectId,
        rpcMap,
        showQrModal: parameters.showQrModal ?? true,
      });
    }

    async function getProvider({ chainId }: { chainId?: number } = {}) {
      if (typeof window === "undefined") throw new ProviderNotFoundError();

      if (!provider) {
        providerPromise ??= initProvider();
        provider = await providerPromise;
        provider.events.setMaxListeners(Number.POSITIVE_INFINITY);
      }

      if (chainId) await switchChain({ chainId });

      return provider;
    }

    async function getAccounts() {
      const provider = await getProvider();

      return provider.accounts.map((address) => getAddress(address));
    }

    async function getChainId() {
      const provider = await getProvider();

      return provider.chainId;
    }

    async function switchChain({
      addEthereumChainParameter,
      chainId,
    }: {
      addEthereumChainParameter?: Partial<Omit<AddEthereumChainParameter, "chainId">>;
      chainId: number;
    }) {
      const provider = await getProvider();
      const chain = config.chains.find((supportedChain) => supportedChain.id === chainId);

      if (!chain) throw new SwitchChainError(new ChainNotConfiguredError());

      try {
        await Promise.all([
          new Promise<void>((resolve) => {
            const listener = ({ chainId: currentChainId }: { chainId?: number }) => {
              if (currentChainId === chainId) {
                config.emitter.off("change", listener);
                resolve();
              }
            };

            config.emitter.on("change", listener);
          }),
          provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: numberToHex(chainId) }],
          }),
        ]);

        const requestedChains = await getRequestedChainsIds();
        await setRequestedChainsIds([...requestedChains, chainId]);

        return chain;
      } catch (error) {
        if (isUserRejectedError(error)) {
          throw new UserRejectedRequestError(toError(error));
        }

        try {
          const blockExplorerUrls =
            addEthereumChainParameter?.blockExplorerUrls ??
            (chain.blockExplorers?.default.url
              ? [chain.blockExplorers.default.url]
              : []);
          const rpcUrls =
            addEthereumChainParameter?.rpcUrls?.length
              ? addEthereumChainParameter.rpcUrls
              : [...chain.rpcUrls.default.http];

          await provider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                blockExplorerUrls,
                chainId: numberToHex(chainId),
                chainName: addEthereumChainParameter?.chainName ?? chain.name,
                iconUrls: addEthereumChainParameter?.iconUrls,
                nativeCurrency:
                  addEthereumChainParameter?.nativeCurrency ?? chain.nativeCurrency,
                rpcUrls,
              },
            ],
          });

          const requestedChains = await getRequestedChainsIds();
          await setRequestedChainsIds([...requestedChains, chainId]);

          return chain;
        } catch (error) {
          throw new UserRejectedRequestError(toError(error));
        }
      }
    }

    async function connect<withCapabilities extends boolean = false>({
      chainId,
      pairingTopic,
      withCapabilities,
    }: {
      chainId?: number;
      isReconnecting?: boolean;
      pairingTopic?: string;
      withCapabilities?: withCapabilities | boolean;
    } = {}) {
      try {
        const provider = await getProvider();

        if (!displayUri) {
          displayUri = (uri) => {
            onDisplayUri(uri);
          };
          provider.on("display_uri", displayUri);
        }

        let targetChainId = chainId;

        if (!targetChainId) {
          const state =
            ((await config.storage?.getItem("state")) as { chainId?: number } | null) ??
            {};
          const isChainSupported = config.chains.some(
            (supportedChain) => supportedChain.id === state.chainId,
          );

          targetChainId = isChainSupported ? state.chainId : config.chains[0].id;
        }

        const chainsStale = await isChainsStale();

        if (provider.session && chainsStale) await provider.disconnect();

        if (!provider.session || chainsStale) {
          const optionalChains = [
            targetChainId,
            ...config.chains
              .filter((supportedChain) => supportedChain.id !== targetChainId)
              .map((supportedChain) => supportedChain.id),
          ] as [number, ...number[]];

          await provider.connect({
            optionalChains,
            ...(pairingTopic ? { pairingTopic } : {}),
          });

          await setRequestedChainsIds(config.chains.map((chain) => chain.id));
        }

        const accounts = (await provider.enable()).map((address) =>
          getAddress(address),
        );

        let currentChainId = await getChainId();

        if (chainId && currentChainId !== chainId) {
          const nextChain = await switchChain({ chainId }).catch((error) => {
            const normalizedError = toError(error);

            if (
              error instanceof UserRejectedRequestError &&
              getCauseMessage(normalizedError) !==
                "Missing or invalid. request() method: wallet_addEthereumChain"
            ) {
              throw error;
            }

            return { id: currentChainId };
          });

          currentChainId = nextChain.id;
        }

        if (displayUri) {
          provider.removeListener("display_uri", displayUri);
          displayUri = undefined;
        }

        if (connectListener) {
          provider.removeListener("connect", connectListener);
          connectListener = undefined;
        }

        if (!accountsChanged) {
          accountsChanged = (accounts) => {
            onAccountsChanged(accounts);
          };
          provider.on("accountsChanged", accountsChanged);
        }

        if (!chainChanged) {
          chainChanged = (chainId) => {
            onChainChanged(chainId);
          };
          provider.on("chainChanged", chainChanged);
        }

        if (!disconnectListener) {
          disconnectListener = () => {
            onDisconnect();
          };
          provider.on("disconnect", disconnectListener);
        }

        if (!sessionDelete) {
          sessionDelete = (data) => {
            onSessionDelete(data);
          };
          provider.on("session_delete", sessionDelete);
        }

        const result = withCapabilities
          ? {
              accounts: accounts.map((address) => ({
                address,
                capabilities: {},
              })),
              chainId: currentChainId,
            }
          : {
              accounts,
              chainId: currentChainId,
            };

        return result as unknown as {
          accounts: withCapabilities extends true
            ? readonly {
                address: Address;
                capabilities: Record<string, unknown>;
              }[]
            : readonly Address[];
          chainId: number;
        };
      } catch (error) {
        if (isUserRejectedError(error)) {
          throw new UserRejectedRequestError(toError(error));
        }

        throw error;
      }
    }

    async function disconnect() {
      const provider = await getProvider().catch(() => undefined);

      try {
        await provider?.disconnect();
      } catch (error) {
        if (!/No matching key/i.test(toError(error).message)) throw error;
      } finally {
        if (chainChanged) {
          provider?.removeListener("chainChanged", chainChanged);
          chainChanged = undefined;
        }

        if (disconnectListener) {
          provider?.removeListener("disconnect", disconnectListener);
          disconnectListener = undefined;
        }

        if (!connectListener && provider) {
          connectListener = (connectInfo) => {
            onConnect(connectInfo);
          };
          provider.on("connect", connectListener);
        }

        if (accountsChanged) {
          provider?.removeListener("accountsChanged", accountsChanged);
          accountsChanged = undefined;
        }

        if (sessionDelete) {
          provider?.removeListener("session_delete", sessionDelete);
          sessionDelete = undefined;
        }

        await setRequestedChainsIds([]);
      }
    }

    async function isAuthorized() {
      if (typeof window === "undefined") return false;

      try {
        const [accounts, provider] = await Promise.all([
          getAccounts(),
          getProvider(),
        ]);

        if (accounts.length === 0) return false;

        const chainsStale = await isChainsStale();

        if (chainsStale && provider.session) {
          await provider.disconnect().catch(() => undefined);
          return false;
        }

        return true;
      } catch {
        return false;
      }
    }

    async function setup() {
      if (typeof window === "undefined" || !provider) return;

      if (!connectListener) {
        connectListener = (connectInfo) => {
          onConnect(connectInfo);
        };
        provider.on("connect", connectListener);
      }

      if (!sessionDelete) {
        sessionDelete = (data) => {
          onSessionDelete(data);
        };
        provider.on("session_delete", sessionDelete);
      }
    }

    return {
      id: "walletConnect",
      name: "WalletConnect",
      type: "walletConnect",
      connect,
      disconnect,
      getAccounts,
      getChainId,
      getNamespaceChainsIds,
      getProvider,
      getRequestedChainsIds,
      isAuthorized,
      isChainsStale,
      onAccountsChanged,
      onChainChanged,
      onConnect,
      onDisconnect,
      onDisplayUri,
      onSessionDelete,
      get requestedChainsStorageKey() {
        return requestedChainsStorageKey;
      },
      setRequestedChainsIds,
      setup,
      switchChain,
    };
  });
}
