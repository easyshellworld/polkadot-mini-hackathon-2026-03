"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { formatUnits } from "viem";
import {
  useAccount,
  useBalance,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi";

import {
  polkadotHubTestnet,
  supportedWalletChainId,
  supportedWalletChainName,
} from "@/lib/wagmi/chains";

type FloatingPosition = {
  x: number;
  y: number;
};

type DragState = {
  height: number;
  moved: boolean;
  originX: number;
  originY: number;
  pointerId: number;
  startX: number;
  startY: number;
  width: number;
};

const walletPanelCollapsedStorageKey = "subvote.walletPanel.isCollapsed";

function formatAddress(address?: string) {
  if (!address) return "No wallet";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatConnectorName(id: string, name: string) {
  if (id === "injected") return "Browser Wallet";
  return name;
}

function formatBalance(formatted?: string) {
  const value = Number(formatted);

  if (!Number.isFinite(value)) return "—";

  if (value >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  if (value >= 1) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
  }

  return value.toLocaleString(undefined, { maximumFractionDigits: 5 });
}

function getErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return null;
}

export function WalletConnectPanel() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hasHydratedCollapsedState, setHasHydratedCollapsedState] =
    useState(false);
  const [floatingPosition, setFloatingPosition] =
    useState<FloatingPosition | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);

  const {
    address,
    chain,
    chainId,
    connector,
    isConnected,
    status: connectionStatus,
  } = useAccount();
  const {
    connect,
    connectors,
    error: connectError,
    status: connectStatus,
  } = useConnect();
  const {
    disconnect,
    error: disconnectError,
    status: disconnectStatus,
  } = useDisconnect();
  const {
    switchChain,
    error: switchChainError,
    status: switchChainStatus,
  } = useSwitchChain();
  const balance = useBalance({
    address,
    chainId: supportedWalletChainId,
    query: {
      enabled: isConnected && Boolean(address) && chainId === supportedWalletChainId,
    },
  });

  const isWrongChain = isConnected && chainId !== supportedWalletChainId;
  const isBusy =
    connectionStatus === "connecting" ||
    connectionStatus === "reconnecting" ||
    connectStatus === "pending" ||
    disconnectStatus === "pending" ||
    switchChainStatus === "pending";
  const networkLabel = chain?.name ?? polkadotHubTestnet.name;
  const connectorLabel = connector
    ? formatConnectorName(connector.id, connector.name)
    : null;
  const feedbackMessage =
    getErrorMessage(connectError) ??
    getErrorMessage(switchChainError) ??
    getErrorMessage(disconnectError);
  const balanceErrorMessage = getErrorMessage(balance.error);

  useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(
        walletPanelCollapsedStorageKey,
      );

      if (storedValue === "true") {
        setIsCollapsed(true);
      }
    } catch {
      // Ignore storage read failures so the panel still works normally.
    } finally {
      setHasHydratedCollapsedState(true);
    }
  }, []);

  useEffect(() => {
    if (!hasHydratedCollapsedState) {
      return;
    }

    try {
      window.localStorage.setItem(
        walletPanelCollapsedStorageKey,
        String(isCollapsed),
      );
    } catch {
      // Ignore storage write failures so the panel still works normally.
    }
  }, [hasHydratedCollapsedState, isCollapsed]);

  useEffect(() => {
    if (!isConnected) {
      setIsCollapsed(false);
      setFloatingPosition(null);
    }
  }, [isConnected]);

  const clampFloatingPosition = (
    nextX: number,
    nextY: number,
    width: number,
    height: number,
  ) => {
    const padding = 16;

    return {
      x: Math.min(
        Math.max(padding, nextX),
        window.innerWidth - width - padding,
      ),
      y: Math.min(
        Math.max(padding, nextY),
        window.innerHeight - height - padding,
      ),
    };
  };

  const handleFloatingPointerDown = (
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();

    dragStateRef.current = {
      height: rect.height,
      moved: false,
      originX: rect.left,
      originY: rect.top,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      width: rect.width,
    };

    suppressClickRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleFloatingPointerMove = (
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    const dragState = dragStateRef.current;

    if (dragState?.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;

    if (!dragState.moved && Math.hypot(deltaX, deltaY) > 6) {
      dragState.moved = true;
    }

    if (!dragState.moved) {
      return;
    }

    suppressClickRef.current = true;
    setFloatingPosition(
      clampFloatingPosition(
        dragState.originX + deltaX,
        dragState.originY + deltaY,
        dragState.width,
        dragState.height,
      ),
    );
  };

  const finishFloatingDrag = (
    event: PointerEvent<HTMLButtonElement>,
    shouldResetClick: boolean,
  ) => {
    const dragState = dragStateRef.current;

    if (dragState?.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragStateRef.current = null;

    if (shouldResetClick) {
      suppressClickRef.current = false;
    }
  };

  if (!isConnected) {
    const helperCopy =
      connectionStatus === "reconnecting"
        ? "Reconnecting to your last wallet session."
        : connectStatus === "pending"
          ? "Approve the request in your wallet to continue."
          : "Connect to preview address, network, and wallet balance.";

    return (
      <section className="w-full max-w-[20rem] rounded-[2rem] border border-black/8 bg-[rgba(247,243,236,0.84)] p-3 shadow-[0_24px_70px_rgba(24,27,32,0.12)] backdrop-blur-xl">
        <div className="rounded-[1.6rem] border border-black/6 bg-[rgba(255,255,255,0.74)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-[1.25rem] bg-neutral-950 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
              <WalletIcon />
            </div>

            <div className="min-w-0">
              <p className="text-[0.68rem] font-medium tracking-[0.18em] text-neutral-500 uppercase">
                Wallet
              </p>
              <p className="text-sm leading-snug font-medium text-neutral-700">
                {helperCopy}
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-2">
            {connectors.length > 0 ? (
              connectors.map((connector, index) => {
                const connectorName = formatConnectorName(
                  connector.id,
                  connector.name,
                );
                const isPrimary = index === 0;

                return (
                  <button
                    key={connector.uid}
                    type="button"
                    onClick={() =>
                      connect({
                        chainId: supportedWalletChainId,
                        connector,
                      })
                    }
                    disabled={isBusy}
                    className={
                      isPrimary
                        ? "flex h-12 w-full items-center justify-center gap-2 rounded-[1.3rem] border border-neutral-950 bg-neutral-950 px-4 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(15,17,17,0.18)] transition-[background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-neutral-950/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(247,243,236,0.92)] focus-visible:outline-none disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-neutral-800/80"
                        : "flex h-11 w-full items-center justify-center gap-2 rounded-[1.2rem] border border-black/8 bg-[rgba(255,255,255,0.76)] px-4 text-sm font-semibold text-neutral-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition-[background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:bg-white focus-visible:ring-2 focus-visible:ring-neutral-950/12 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(247,243,236,0.92)] focus-visible:outline-none disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-white/70 disabled:text-neutral-500"
                    }
                  >
                    {isBusy ? "Check Wallet" : `Connect ${connectorName}`}
                    <ChevronIcon direction="right" />
                  </button>
                );
              })
            ) : (
              <button
                type="button"
                disabled
                className="flex h-12 w-full items-center justify-center rounded-[1.3rem] border border-black/8 bg-[rgba(255,255,255,0.76)] px-4 text-sm font-semibold text-neutral-500"
              >
                No Wallet Available
              </button>
            )}
          </div>

          {feedbackMessage ? (
            <p className="mt-3 text-sm leading-snug text-rose-600">
              {feedbackMessage}
            </p>
          ) : null}
        </div>
      </section>
    );
  }

  if (isCollapsed) {
    const floatingStyle = floatingPosition
      ? {
          left: floatingPosition.x,
          top: floatingPosition.y,
        }
      : {
          right: 16,
          top: 16,
        };

    return (
      <button
        type="button"
        onClick={() => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }

          setIsCollapsed(false);
        }}
        onPointerDown={handleFloatingPointerDown}
        onPointerMove={handleFloatingPointerMove}
        onPointerUp={(event) => finishFloatingDrag(event, false)}
        onPointerCancel={(event) => finishFloatingDrag(event, true)}
        className="fixed z-30 flex size-[4.35rem] cursor-grab touch-none items-center justify-center rounded-[1.65rem] border border-black/8 bg-neutral-950 text-white shadow-[0_22px_45px_rgba(15,17,17,0.2)] transition-[box-shadow,transform] duration-200 select-none [-webkit-tap-highlight-color:transparent] hover:-translate-y-0.5 hover:shadow-[0_26px_50px_rgba(15,17,17,0.24)] focus-visible:ring-2 focus-visible:ring-neutral-950/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(247,243,236,0.92)] focus-visible:outline-none active:cursor-grabbing"
        aria-label="Expand wallet details"
        style={floatingStyle}
      >
        <span className="pointer-events-none absolute inset-0 rounded-[1.65rem] border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]" />
        <WalletIcon />
      </button>
    );
  }

  const formattedBalance = balance.data
    ? formatUnits(balance.data.value, balance.data.decimals)
    : undefined;
  const balanceSymbol = balance.data?.symbol ?? "PAS";
  const balanceValue =
    isWrongChain
      ? "—"
      : balance.status === "pending"
        ? "Loading"
        : balance.status === "error"
          ? "Error"
          : formatBalance(formattedBalance);
  const balanceFootnote = isWrongChain
    ? `switch to ${supportedWalletChainName}`
    : balance.status === "pending"
      ? `fetching ${balanceSymbol}`
      : balance.status === "error"
        ? "RPC unavailable"
        : balanceSymbol;

  return (
    <section className="w-full max-w-[22rem] rounded-[2rem] border border-black/8 bg-[rgba(247,243,236,0.84)] p-3 shadow-[0_24px_70px_rgba(24,27,32,0.12)] backdrop-blur-xl">
      <div className="rounded-[1.6rem] border border-black/6 bg-[rgba(255,255,255,0.74)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
        <div className="flex items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-[1.25rem] bg-neutral-950 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
            <WalletIcon />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[0.68rem] font-medium tracking-[0.18em] text-neutral-500 uppercase">
              {connectorLabel ?? "Connected wallet"}
            </p>
            <p className="truncate text-base font-semibold tracking-[-0.03em] text-neutral-950">
              {formatAddress(address)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            className="flex size-10 shrink-0 items-center justify-center rounded-[1.1rem] border border-black/8 bg-neutral-950 text-white shadow-[0_12px_24px_rgba(15,17,17,0.16)] transition-[background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-neutral-950/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(247,243,236,0.92)] focus-visible:outline-none"
            aria-label="Collapse wallet details"
          >
            <ChevronIcon direction="up" />
          </button>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
          <div className="rounded-[1.45rem] border border-black/8 bg-[rgba(255,255,255,0.84)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
            <p className="text-[0.68rem] font-medium tracking-[0.18em] text-neutral-500 uppercase">
              Network
            </p>
            <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-neutral-950">
              <span
                className={
                  isWrongChain
                    ? "size-2.5 rounded-full bg-amber-400 shadow-[0_0_0_4px_rgba(251,191,36,0.18)]"
                    : "size-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.14)]"
                }
              />
              <span className="truncate">{networkLabel}</span>
            </div>

            {isWrongChain ? (
              <button
                type="button"
                onClick={() => switchChain({ chainId: supportedWalletChainId })}
                disabled={switchChainStatus === "pending"}
                className="mt-3 inline-flex h-9 items-center justify-center rounded-[1rem] border border-black/8 bg-neutral-950 px-3 text-xs font-semibold text-white transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-neutral-950/20 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-neutral-800/80"
              >
                {switchChainStatus === "pending"
                  ? "Switching..."
                  : `Switch to ${supportedWalletChainName}`}
              </button>
            ) : null}
          </div>

          <div className="rounded-[1.45rem] border border-neutral-950 bg-neutral-950 p-3 text-white shadow-[0_18px_36px_rgba(15,17,17,0.18)]">
            <p className="text-[0.68rem] font-medium tracking-[0.18em] text-white/55 uppercase">
              Wallet Balance
            </p>
            <p className="mt-2 text-[1.45rem] leading-none font-semibold tracking-[-0.05em]">
              {balanceValue}
            </p>
            <p className="mt-1 text-xs font-medium text-white/55">
              {balanceFootnote}
            </p>
            {balance.status === "error" && balanceErrorMessage ? (
              <p className="mt-2 text-[0.7rem] leading-snug text-white/60">
                {balanceErrorMessage}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-[1.35rem] border border-black/8 bg-[rgba(255,255,255,0.82)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-medium tracking-[0.18em] text-neutral-500 uppercase">
              Session
            </p>
            <p className="truncate text-sm font-semibold text-neutral-950">
              {connectorLabel ?? "Wallet"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => disconnect()}
            disabled={disconnectStatus === "pending"}
            className="inline-flex h-9 items-center justify-center rounded-[1rem] border border-black/8 bg-white px-3 text-xs font-semibold text-neutral-950 transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-neutral-950/12 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none disabled:translate-y-0 disabled:cursor-not-allowed disabled:text-neutral-400"
          >
            {disconnectStatus === "pending" ? "Disconnecting..." : "Disconnect"}
          </button>
        </div>

        {feedbackMessage ? (
          <p className="mt-3 text-sm leading-snug text-rose-600">
            {feedbackMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function WalletIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5.75 7.25H18.25C19.35 7.25 20.25 8.15 20.25 9.25V16.25C20.25 17.35 19.35 18.25 18.25 18.25H5.75C4.65 18.25 3.75 17.35 3.75 16.25V9.25C3.75 8.15 4.65 7.25 5.75 7.25Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M16.25 12.75H20.25"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="16.5" cy="12.75" r="1" fill="currentColor" />
      <path
        d="M6.5 7.25V5.75C6.5 5.2 6.95 4.75 7.5 4.75H16.25"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: "up" | "down" | "right" }) {
  const rotation =
    direction === "up" ? "-rotate-90" : direction === "down" ? "rotate-90" : "";

  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={rotation}
    >
      <path
        d="M9 6.75L14.25 12L9 17.25"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
