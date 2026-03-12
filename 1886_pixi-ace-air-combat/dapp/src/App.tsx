import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { WagmiProvider, useConnection } from "wagmi";
import { type Address } from "viem";
import { Connection } from "./components/Connection";
import GameCanvas from "./components/GameCanvas";
import GameOverScreen from "./components/GameOverScreen";
import StartScreen from "./components/StartScreen";
import { WalletOptions } from "./components/WalletOptions";
import { config } from "./config";
import type { GameState, PlaneStats } from "./game/types";
import { usePlayerInfo, type PlayerContractData } from "./hooks/useContract";

export type AppScreen = "start" | "playing" | "gameover";

export interface GameResult {
  score: number;
  kills: number;
  wave: number;
}

const queryClient = new QueryClient();

function ConnectWallet() {
  const { isConnected } = useConnection();
  if (isConnected) return <Connection />;
  return <WalletOptions />;
}

function AppInner() {
  const { isConnected, address } = useConnection();
  const [screen, setScreen] = useState<AppScreen>("start");
  const [gameResult, setGameResult] = useState<GameResult>({
    score: 0,
    kills: 0,
    wave: 1,
  });
  const [open, setOpen] = useState(false);

  // Read on-chain plane stats for current player
  const { data: playerData } = usePlayerInfo(
    isConnected ? (address as Address) : undefined,
  );

  const plane = playerData
    ? (playerData as PlayerContractData)[2]
    : undefined;

  const planeStats: PlaneStats | undefined = plane
    ? {
        moveSpeed: plane.moveSpeed,
        attackSpeed: plane.attackSpeed,
        firepower: plane.firepower,
      }
    : undefined;

  const handleStart = (connected: boolean) => {
    if (!connected) {
      setOpen(true);
      return;
    }
    setScreen("playing");
  };

  const handleGameOver = (state: GameState) => {
    setGameResult({ score: state.score, kills: state.kills, wave: state.wave });
    setScreen("gameover");
  };

  const handleRestart = () => setScreen("playing");

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      {screen === "start" && (
        <StartScreen onStart={handleStart} open={open} setOpen={setOpen}>
          <ConnectWallet />
        </StartScreen>
      )}
      {screen === "playing" && (
        <GameCanvas onGameOver={handleGameOver} planeStats={planeStats} />
      )}
      {screen === "gameover" && (
        <GameOverScreen
          result={gameResult}
          onRestart={handleRestart}
          address={isConnected ? (address as Address) : undefined}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <AppInner />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
