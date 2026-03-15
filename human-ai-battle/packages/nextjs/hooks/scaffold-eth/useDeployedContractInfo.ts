import { useEffect, useRef, useState } from "react";
import { useIsMounted } from "usehooks-ts";
import { usePublicClient } from "wagmi";
import { useSelectedNetwork } from "~~/hooks/scaffold-eth";
import {
  Contract,
  ContractCodeStatus,
  ContractName,
  UseDeployedContractConfig,
  contracts,
} from "~~/utils/scaffold-eth/contract";

type DeployedContractData<TContractName extends ContractName> = {
  data: Contract<TContractName> | undefined;
  isLoading: boolean;
};

/**
 * Gets the matching contract info for the provided contract name from the contracts present in deployedContracts.ts
 * and externalContracts.ts corresponding to targetNetworks configured in scaffold.config.ts
 */
export function useDeployedContractInfo<TContractName extends ContractName>(
  config: UseDeployedContractConfig<TContractName>,
): DeployedContractData<TContractName>;
/**
 * @deprecated Use object parameter version instead: useDeployedContractInfo({ contractName: "YourContract" })
 */
export function useDeployedContractInfo<TContractName extends ContractName>(
  contractName: TContractName,
): DeployedContractData<TContractName>;

export function useDeployedContractInfo<TContractName extends ContractName>(
  configOrName: UseDeployedContractConfig<TContractName> | TContractName,
): DeployedContractData<TContractName> {
  const isMounted = useIsMounted();

  const finalConfig: UseDeployedContractConfig<TContractName> =
    typeof configOrName === "string" ? { contractName: configOrName } : (configOrName as any);

  useEffect(() => {
    if (typeof configOrName === "string") {
      console.warn(
        "Using `useDeployedContractInfo` with a string parameter is deprecated. Please use the object parameter version instead.",
      );
    }
  }, [configOrName]);
  const { contractName, chainId } = finalConfig;
  const selectedNetwork = useSelectedNetwork(chainId);
  const deployedContract = contracts?.[selectedNetwork.id]?.[contractName as ContractName] as Contract<TContractName>;
  const [status, setStatus] = useState<ContractCodeStatus>(ContractCodeStatus.LOADING);
  const [retryNonce, setRetryNonce] = useState(0);
  const lastStableStatusRef = useRef<ContractCodeStatus>(ContractCodeStatus.LOADING);
  const publicClient = usePublicClient({ chainId: selectedNetwork.id });

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const checkContractDeployment = async () => {
      try {
        if (!isMounted() || !publicClient || cancelled) return;

        if (!deployedContract) {
          setStatus(ContractCodeStatus.NOT_FOUND);
          lastStableStatusRef.current = ContractCodeStatus.NOT_FOUND;
          return;
        }

        const code = await publicClient.getBytecode({
          address: deployedContract.address,
        });

        if (cancelled) return;

        // If contract code is `0x` => no contract deployed on that address
        if (code === "0x") {
          setStatus(ContractCodeStatus.NOT_FOUND);
          lastStableStatusRef.current = ContractCodeStatus.NOT_FOUND;
          return;
        }
        setStatus(ContractCodeStatus.DEPLOYED);
        lastStableStatusRef.current = ContractCodeStatus.DEPLOYED;
      } catch (e) {
        console.error(e);
        // Treat RPC hiccups as transient. Keep the last stable status and retry,
        // instead of collapsing the contract into a false "not found" state.
        if (lastStableStatusRef.current !== ContractCodeStatus.DEPLOYED) {
          setStatus(ContractCodeStatus.LOADING);
        }
        retryTimer = setTimeout(() => {
          if (!cancelled) {
            setRetryNonce(nonce => nonce + 1);
          }
        }, 3000);
      }
    };

    checkContractDeployment();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [isMounted, contractName, deployedContract, publicClient, retryNonce]);

  return {
    data: status === ContractCodeStatus.DEPLOYED ? deployedContract : undefined,
    isLoading: status === ContractCodeStatus.LOADING,
  };
}
