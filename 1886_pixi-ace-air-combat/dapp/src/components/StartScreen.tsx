import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { ReactNode } from "react";
import { useConnection } from "wagmi";
import PlayerProfile from "./PlayerProfile";

interface StartScreenProps {
  onStart: (isConnected: boolean) => void;
  children?: ReactNode;
  open?: boolean;
  setOpen?: (open: boolean) => void;
  playerDataLoading?: boolean;
}

// Pre-compute star positions so render stays pure
const STARS = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  width: 1 + ((i * 7 + 3) % 3),
  left: ((i * 13 + 5) % 100).toFixed(1),
  top: ((i * 17 + 11) % 100).toFixed(1),
  opacity: (0.2 + ((i * 11 + 1) % 8) * 0.1).toFixed(2),
}));

function StartScreen({
  onStart,
  children,
  open,
  setOpen,
  playerDataLoading,
}: StartScreenProps) {
  const { isConnected, address } = useConnection();

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-black">
      {/*{children}*/}

      {/* Animated background stars via CSS */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {STARS.map((s) => (
          <div
            key={s.id}
            className="absolute rounded-full bg-white"
            style={{
              width: `${s.width}px`,
              height: `${s.width}px`,
              left: `${s.left}%`,
              top: `${s.top}%`,
              opacity: s.opacity,
            }}
          />
        ))}
      </div>

      {/* Title */}
      <div className="mb-4 text-center">
        <div className="mb-2 font-mono text-sm tracking-[0.5em] text-cyan-400 uppercase">
          ◈ MISSION BRIEFING ◈
        </div>
        <h1
          className="font-mono text-6xl font-black tracking-widest text-white md:text-8xl"
          style={{
            textShadow: "0 0 30px #00d4ff, 0 0 60px #0066ff, 0 0 90px #0033ff",
          }}
        >
          ACE
        </h1>
        <h1
          className="font-mono text-6xl font-black tracking-widest text-cyan-400 md:text-8xl"
          style={{
            textShadow: "0 0 20px #00d4ff, 0 0 40px #00aaff",
          }}
        >
          COMBAT
        </h1>
        <div className="mt-3 font-mono text-xs tracking-[0.3em] text-blue-400 uppercase">
          王牌空战 · BROWSER EDITION
        </div>
      </div>

      {/* Divider */}
      <div className="my-6 h-px w-64 bg-linear-to-r from-transparent via-cyan-500 to-transparent" />

      {/* Player profile (shown when wallet connected) */}
      {isConnected && address && (
        <div className="mb-6 w-80">
          <PlayerProfile address={address} />
        </div>
      )}

      {/* Controls */}
      <div className="mb-8 grid grid-cols-2 gap-6 text-center">
        <div>
          <div className="mb-2 font-mono text-xs tracking-widest text-cyan-500 uppercase">
            Movement
          </div>
          <div className="space-y-1 font-mono text-sm text-gray-300">
            <div>
              <kbd className="rounded border border-gray-600 bg-gray-800 px-2 py-0.5">
                W
              </kbd>
              <kbd className="mx-1 rounded border border-gray-600 bg-gray-800 px-2 py-0.5">
                A
              </kbd>
              <kbd className="rounded border border-gray-600 bg-gray-800 px-2 py-0.5">
                S
              </kbd>
              <kbd className="ml-1 rounded border border-gray-600 bg-gray-800 px-2 py-0.5">
                D
              </kbd>
            </div>
            <div className="text-gray-500">or Arrow Keys</div>
          </div>
        </div>
        <div>
          <div className="mb-2 font-mono text-xs tracking-widest text-cyan-500 uppercase">
            Actions
          </div>
          <div className="space-y-1 font-mono text-sm text-gray-300">
            <div>
              <kbd className="rounded border border-gray-600 bg-gray-800 px-3 py-0.5">
                SPACE
              </kbd>
              <span className="ml-2 text-gray-400">Shoot</span>
            </div>
            <div>
              <kbd className="rounded border border-gray-600 bg-gray-800 px-2 py-0.5">
                ESC
              </kbd>
              <span className="ml-2 text-gray-400">Pause</span>
            </div>
          </div>
        </div>
      </div>

      {/* Power-ups legend */}
      <div className="mb-8 flex gap-6 font-mono text-xs">
        <div className="flex items-center gap-2">
          <span className="text-lg">♥</span>
          <span className="text-green-400">Health</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg">⚡</span>
          <span className="text-yellow-400">Rapid Fire</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg">⬡</span>
          <span className="text-cyan-400">Shield</span>
        </div>
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          {/* Start button */}
          <button
            onClick={() => onStart(isConnected)}
            disabled={playerDataLoading}
            className="relative cursor-pointer overflow-hidden rounded border border-cyan-500 bg-transparent px-12 py-4 font-mono text-lg font-bold tracking-[0.3em] text-cyan-400 uppercase transition-all duration-200 hover:bg-cyan-500 hover:text-black hover:shadow-[0_0_30px_#00d4ff]"
            style={{
              boxShadow: "0 0 15px rgba(0,212,255,0.3)",
            }}
          >
            {playerDataLoading ? "⏳ Loading..." : "▶ LAUNCH"}
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Connect Wallet</AlertDialogTitle>
            <AlertDialogDescription>
              Please connect your wallet to start the game. Don't worry, we
              won't ask for any permissions or transactions - it's just to
              verify your identity as a pilot.
            </AlertDialogDescription>
            {children}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="mt-6 font-mono text-xs text-gray-600">
        Survive as many waves as you can · Good luck, pilot
      </div>
    </div>
  );
}

export default StartScreen;
