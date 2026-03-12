import { Player } from "./Player";
import { Enemy } from "./Enemy";
import { Bullet } from "./Bullet";
import { PowerUp } from "./PowerUp";
import { Explosion } from "./Explosion";
import { Background } from "./Background";
import { CollisionSystem } from "./CollisionSystem";
import type { EnemyType, GameState, KeyState, PlaneStats } from "./types";
import { playShoot, playExplosion, playPowerUp } from "../utils/audio";

const WAVE_SIZES = [3, 5, 7, 9, 12]; // enemies per wave, then repeats with scale
const POWER_UP_DROP_CHANCE = 0.25;

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private player: Player;
  private enemies: Enemy[] = [];
  private playerBullets: Bullet[] = [];
  private enemyBullets: Bullet[] = [];
  private powerUps: PowerUp[] = [];
  private explosions: Explosion[] = [];
  private background: Background;
  private collision: CollisionSystem;
  private time: number = 0;
  private waveTimer: number = 0;
  private waveDelay: number = 3; // seconds between waves
  private waveInProgress: boolean = false;
  private enemiesSpawnedThisWave: number = 0;
  private spawnTimer: number = 0;
  private spawnInterval: number = 0.8;

  // Public state
  score: number = 0;
  kills: number = 0;
  wave: number = 1;
  paused: boolean = false;
  over: boolean = false;

  constructor(canvas: HTMLCanvasElement, planeStats?: PlaneStats) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2D context");
    this.ctx = ctx;
    this.player = new Player(canvas.width, canvas.height, planeStats);
    this.background = new Background(canvas.width, canvas.height);
    this.collision = new CollisionSystem();
    this.startWave(1);
  }

  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.player.resize(width, height);
    this.background.resize(width, height);
  }

  private startWave(waveNum: number) {
    this.wave = waveNum;
    this.waveInProgress = true;
    this.enemiesSpawnedThisWave = 0;
    this.spawnTimer = 0;
  }

  private waveSize(): number {
    const baseIdx = (this.wave - 1) % WAVE_SIZES.length;
    const cycle = Math.floor((this.wave - 1) / WAVE_SIZES.length);
    return WAVE_SIZES[baseIdx] + cycle * 2;
  }

  private waveFactor(): number {
    return 1 + (this.wave - 1) * 0.15;
  }

  private spawnEnemy() {
    const wf = this.waveFactor();
    let type: EnemyType = "normal";
    const r = Math.random();
    if (
      this.wave >= 3 &&
      r > 0.9 &&
      this.wave % 5 === 0 &&
      this.enemiesSpawnedThisWave === 0
    ) {
      type = "boss";
    } else if (this.wave >= 2 && r > 0.7) {
      type = "fast";
    } else if (r > 0.4) {
      type = "normal";
    }
    const x = 40 + Math.random() * (this.canvas.width - 80);
    this.enemies.push(new Enemy(x, this.canvas.width, type, wf));
    this.enemiesSpawnedThisWave++;
  }

  getState(): GameState {
    return {
      score: this.score,
      kills: this.kills,
      wave: this.wave,
      playerHp: this.player.hp,
      playerMaxHp: this.player.maxHp,
      shieldActive: this.player.shieldActive,
      rapidFireActive: this.player.rapidFireActive,
      paused: this.paused,
      over: this.over,
    };
  }

  togglePause() {
    this.paused = !this.paused;
  }

  update(delta: number, keys: KeyState) {
    if (this.paused || this.over) return;

    this.time += delta;

    // Update background
    this.background.update(delta);

    // Update player
    const newPlayerBullets = this.player.update(delta, keys);
    if (newPlayerBullets.length > 0) {
      playShoot();
      this.playerBullets.push(...newPlayerBullets);
    }

    // Wave management
    if (this.waveInProgress) {
      if (this.enemiesSpawnedThisWave < this.waveSize()) {
        this.spawnTimer -= delta;
        if (this.spawnTimer <= 0) {
          this.spawnEnemy();
          this.spawnTimer = this.spawnInterval / this.waveFactor();
        }
      }
      // Check if wave complete
      if (
        this.enemiesSpawnedThisWave >= this.waveSize() &&
        this.enemies.filter((e) => e.active).length === 0
      ) {
        this.waveInProgress = false;
        this.waveTimer = this.waveDelay;
      }
    } else {
      this.waveTimer -= delta;
      if (this.waveTimer <= 0) {
        this.startWave(this.wave + 1);
      }
    }

    // Update enemies
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      const bullets = enemy.update(delta, this.player.position.x);
      this.enemyBullets.push(...bullets);

      // Enemy off screen (missed)
      if (enemy.position.y > this.canvas.height + enemy.height) {
        enemy.active = false;
      }
    }

    // Update bullets
    for (const b of this.playerBullets) {
      b.update(delta, this.canvas.height);
    }
    for (const b of this.enemyBullets) {
      b.update(delta, this.canvas.height);
    }

    // Update power-ups
    for (const p of this.powerUps) {
      p.update(delta, this.canvas.height);
    }

    // Update explosions
    for (const e of this.explosions) {
      e.update(delta);
    }

    // Collision detection
    this.handleCollisions();

    // Cleanup inactive objects
    this.enemies = this.enemies.filter((e) => e.active);
    this.playerBullets = this.playerBullets.filter((b) => b.active);
    this.enemyBullets = this.enemyBullets.filter((b) => b.active);
    this.powerUps = this.powerUps.filter((p) => p.active);
    this.explosions = this.explosions.filter((e) => e.active);
  }

  private handleCollisions() {
    // Player bullets vs enemies
    for (const bullet of this.playerBullets) {
      if (!bullet.active) continue;
      for (const enemy of this.enemies) {
        if (!enemy.active) continue;
        if (this.collision.checkAABB(bullet, enemy)) {
          bullet.active = false;
          const killed = enemy.takeDamage(bullet.damage);
          if (killed) {
            this.score += enemy.score;
            this.kills++;
            const scale =
              enemy.type === "boss" ? 3 : enemy.type === "fast" ? 0.8 : 1;
            this.explosions.push(
              new Explosion(enemy.position.x, enemy.position.y, scale),
            );
            playExplosion();

            // Power-up drop
            if (Math.random() < POWER_UP_DROP_CHANCE) {
              const types = ["health", "rapidfire", "shield"] as const;
              const type = types[Math.floor(Math.random() * types.length)];
              this.powerUps.push(
                new PowerUp(enemy.position.x, enemy.position.y, type),
              );
            }
          }
        }
      }
    }

    // Enemy bullets vs player
    for (const bullet of this.enemyBullets) {
      if (!bullet.active) continue;
      if (this.collision.checkAABB(bullet, this.player)) {
        bullet.active = false;
        const dead = this.player.takeDamage(bullet.damage);
        if (dead) {
          this.over = true;
          this.explosions.push(
            new Explosion(this.player.position.x, this.player.position.y, 2),
          );
          playExplosion();
          return;
        }
        this.explosions.push(
          new Explosion(
            this.player.position.x + (Math.random() - 0.5) * 20,
            this.player.position.y + (Math.random() - 0.5) * 20,
            0.5,
          ),
        );
      }
    }

    // Enemies vs player (ramming)
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      if (this.collision.checkAABB(enemy, this.player)) {
        enemy.active = false;
        this.explosions.push(
          new Explosion(enemy.position.x, enemy.position.y, 1.5),
        );
        playExplosion();
        const dead = this.player.takeDamage(2);
        if (dead) {
          this.over = true;
          this.explosions.push(
            new Explosion(this.player.position.x, this.player.position.y, 2),
          );
          return;
        }
      }
    }

    // Player vs power-ups
    for (const pu of this.powerUps) {
      if (!pu.active) continue;
      if (this.collision.checkAABB(pu, this.player)) {
        pu.active = false;
        playPowerUp();
        switch (pu.type) {
          case "health":
            this.player.heal(2);
            break;
          case "rapidfire":
            this.player.activateRapidFire();
            break;
          case "shield":
            this.player.activateShield();
            break;
        }
      }
    }
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Background
    this.background.render(ctx);

    // Power-ups
    for (const p of this.powerUps) {
      p.render(ctx);
    }

    // Enemy bullets
    for (const b of this.enemyBullets) {
      b.render(ctx);
    }

    // Player bullets
    for (const b of this.playerBullets) {
      b.render(ctx);
    }

    // Enemies
    for (const e of this.enemies) {
      e.render(ctx);
    }

    // Player
    this.player.render(ctx, this.time);

    // Explosions (on top)
    for (const e of this.explosions) {
      e.render(ctx);
    }

    // Wave announcement
    if (!this.waveInProgress && this.waveTimer > 0) {
      const alpha = Math.min(1, this.waveTimer / (this.waveDelay * 0.5));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#00d4ff";
      ctx.font = 'bold 32px "Courier New"';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "#00d4ff";
      ctx.shadowBlur = 20;
      ctx.fillText(`WAVE ${this.wave + 1} INCOMING`, w / 2, h / 2);
      ctx.restore();
    }
  }
}
