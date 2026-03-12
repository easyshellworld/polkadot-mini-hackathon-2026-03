import { useEffect, useRef, useState, useCallback } from "react";
import { GameEngine } from "../game/GameEngine";
import { useGameLoop } from "../hooks/useGameLoop";
import { useKeyboard } from "../hooks/useKeyboard";
import type { GameState, PlaneStats } from "../game/types";
import HUD from "./HUD";
import PauseOverlay from "./PauseOverlay";

interface GameCanvasProps {
  onGameOver: (state: GameState) => void;
  planeStats?: PlaneStats;
}

const INITIAL_HUD_STATE: GameState = {
  score: 0,
  kills: 0,
  wave: 1,
  playerHp: 5,
  playerMaxHp: 5,
  shieldActive: false,
  rapidFireActive: false,
  paused: false,
  over: false,
};

function GameCanvas({ onGameOver, planeStats }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const keysRef = useKeyboard();
  const [hudState, setHudState] = useState<GameState>(INITIAL_HUD_STATE);
  const [paused, setPaused] = useState(false);
  const gameOverCalledRef = useRef(false);

  // Initialize engine when canvas is ready.
  // planeStats is intentionally read once at mount time so the game engine
  // is constructed with the stats that were active when the player hit "start".
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    engineRef.current = new GameEngine(canvas, planeStats);
    gameOverCalledRef.current = false;

    const handleResize = () => {
      if (!canvas || !engineRef.current) return;
      engineRef.current.resize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pause on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        if (!engineRef.current) return;
        engineRef.current.togglePause();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleResume = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.togglePause();
    setPaused(false);
  }, []);

  // Game loop
  useGameLoop((delta) => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.update(delta, keysRef.current);
    engine.render();

    const state = engine.getState();
    setHudState(state);

    if (state.over && !gameOverCalledRef.current) {
      gameOverCalledRef.current = true;
      // Small delay so explosion renders
      setTimeout(() => onGameOver(state), 1200);
    }
  }, true);

  return (
    <div className="relative h-full w-full">
      <canvas ref={canvasRef} className="block h-full w-full" />
      <HUD state={hudState} />
      {paused && <PauseOverlay onResume={handleResume} />}
    </div>
  );
}

export default GameCanvas;
