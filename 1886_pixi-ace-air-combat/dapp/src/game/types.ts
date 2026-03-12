// Core vector type
export interface Vec2 {
  x: number;
  y: number;
}

// Game entity base
export interface Entity {
  position: Vec2;
  velocity: Vec2;
  width: number;
  height: number;
  active: boolean;
}

// Bullet types
export type BulletOwner = "player" | "enemy";

export interface BulletData extends Entity {
  owner: BulletOwner;
  damage: number;
  color: string;
}

// Enemy types
export type EnemyType = "normal" | "fast" | "boss";

export interface EnemyData extends Entity {
  type: EnemyType;
  hp: number;
  maxHp: number;
  score: number;
  shootTimer: number;
  shootInterval: number;
  color: string;
}

// Player data
export interface PlayerData extends Entity {
  hp: number;
  maxHp: number;
  shieldActive: boolean;
  shieldTimer: number;
  rapidFireActive: boolean;
  rapidFireTimer: number;
  shootTimer: number;
  shootInterval: number;
  speed: number;
  invincibleTimer: number;
}

// Power-up types
export type PowerUpType = "health" | "rapidfire" | "shield";

export interface PowerUpData extends Entity {
  type: PowerUpType;
}

// Explosion particle
export interface ParticleData {
  position: Vec2;
  velocity: Vec2;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  active: boolean;
}

// Star background
export interface StarData {
  x: number;
  y: number;
  speed: number;
  size: number;
  brightness: number;
}

// Game state passed to React for HUD / game over
export interface GameState {
  score: number;
  kills: number;
  wave: number;
  playerHp: number;
  playerMaxHp: number;
  shieldActive: boolean;
  rapidFireActive: boolean;
  paused: boolean;
  over: boolean;
}

// Keyboard input state
export interface KeyState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  shoot: boolean;
}

// On-chain plane stats (from smart contract)
export interface PlaneStats {
  moveSpeed: bigint;
  attackSpeed: bigint;
  firepower: bigint;
}
