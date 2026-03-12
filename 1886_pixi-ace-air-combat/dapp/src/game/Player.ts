import type { PlayerData } from "./types";
import type { KeyState, PlaneStats } from "./types";
import { Bullet } from "./Bullet";

const BASE_SPEED = 5;
const BASE_SHOOT_INTERVAL = 0.25; // seconds
// Bonus per upgrade level
const SPEED_BONUS_PER_LEVEL = 0.5;
const SHOOT_INTERVAL_REDUCTION_PER_LEVEL = 0.02; // seconds faster per level
const DAMAGE_BONUS_PER_LEVEL = 0.5;

export class Player implements PlayerData {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  width: number;
  height: number;
  active: boolean;
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

  // Per-bullet damage (boosted by firepower upgrades)
  private bulletDamage: number;

  private canvasWidth: number;
  private canvasHeight: number;

  constructor(canvasWidth: number, canvasHeight: number, planeStats?: PlaneStats) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.position = { x: canvasWidth / 2, y: canvasHeight - 100 };
    this.velocity = { x: 0, y: 0 };
    this.width = 40;
    this.height = 50;
    this.active = true;
    this.hp = 5;
    this.maxHp = 5;
    this.shieldActive = false;
    this.shieldTimer = 0;
    this.rapidFireActive = false;
    this.rapidFireTimer = 0;
    this.shootTimer = 0;
    this.invincibleTimer = 0;

    // Apply on-chain plane stats
    const moveLevel = planeStats ? Number(planeStats.moveSpeed) : 0;
    const atkLevel = planeStats ? Number(planeStats.attackSpeed) : 0;
    const fpLevel = planeStats ? Number(planeStats.firepower) : 0;

    this.speed = BASE_SPEED + moveLevel * SPEED_BONUS_PER_LEVEL;
    this.shootInterval = Math.max(
      0.05,
      BASE_SHOOT_INTERVAL - atkLevel * SHOOT_INTERVAL_REDUCTION_PER_LEVEL,
    );
    this.bulletDamage = 1 + fpLevel * DAMAGE_BONUS_PER_LEVEL;
  }

  resize(canvasWidth: number, canvasHeight: number) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
  }

  update(delta: number, keys: KeyState): Bullet[] {
    const bullets: Bullet[] = [];

    // Movement
    let vx = 0;
    let vy = 0;
    if (keys.left) vx -= this.speed;
    if (keys.right) vx += this.speed;
    if (keys.up) vy -= this.speed;
    if (keys.down) vy += this.speed;

    // Normalize diagonal
    if (vx !== 0 && vy !== 0) {
      const factor = 1 / Math.sqrt(2);
      vx *= factor;
      vy *= factor;
    }

    this.velocity = { x: vx, y: vy };
    this.position.x += vx * delta * 60;
    this.position.y += vy * delta * 60;

    // Clamp to canvas bounds
    const hw = this.width / 2;
    const hh = this.height / 2;
    this.position.x = Math.max(
      hw,
      Math.min(this.canvasWidth - hw, this.position.x),
    );
    this.position.y = Math.max(
      hh,
      Math.min(this.canvasHeight - hh, this.position.y),
    );

    // Shooting
    this.shootTimer -= delta;
    if (keys.shoot && this.shootTimer <= 0) {
      const interval = this.rapidFireActive
        ? this.shootInterval / 3
        : this.shootInterval;
      this.shootTimer = interval;
      bullets.push(
        new Bullet(this.position.x, this.position.y - hh, 0, -10, "player", this.bulletDamage),
      );
      // Spread shot when rapid fire
      if (this.rapidFireActive) {
        bullets.push(
          new Bullet(
            this.position.x - 12,
            this.position.y - hh,
            -0.5,
            -10,
            "player",
            this.bulletDamage,
          ),
        );
        bullets.push(
          new Bullet(
            this.position.x + 12,
            this.position.y - hh,
            0.5,
            -10,
            "player",
            this.bulletDamage,
          ),
        );
      }
    }

    // Power-up timers
    if (this.shieldActive) {
      this.shieldTimer -= delta;
      if (this.shieldTimer <= 0) {
        this.shieldActive = false;
        this.shieldTimer = 0;
      }
    }
    if (this.rapidFireActive) {
      this.rapidFireTimer -= delta;
      if (this.rapidFireTimer <= 0) {
        this.rapidFireActive = false;
        this.rapidFireTimer = 0;
      }
    }

    // Invincibility frames after hit
    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= delta;
    }

    return bullets;
  }

  takeDamage(amount: number): boolean {
    if (this.invincibleTimer > 0 || this.shieldActive) return false;
    this.hp -= amount;
    this.invincibleTimer = 1.5;
    if (this.hp <= 0) {
      this.hp = 0;
      return true; // dead
    }
    return false;
  }

  heal(amount: number) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  activateShield(duration = 8) {
    this.shieldActive = true;
    this.shieldTimer = duration;
  }

  activateRapidFire(duration = 6) {
    this.rapidFireActive = true;
    this.rapidFireTimer = duration;
  }

  render(ctx: CanvasRenderingContext2D, time: number) {
    if (!this.active) return;

    const { x, y } = this.position;
    const hw = this.width / 2;
    const hh = this.height / 2;

    // Flash when invincible
    if (
      this.invincibleTimer > 0 &&
      Math.floor(this.invincibleTimer * 10) % 2 === 0
    )
      return;

    ctx.save();
    ctx.translate(x, y);

    // Shield
    if (this.shieldActive) {
      const pulse = 0.7 + 0.3 * Math.sin(time * 5);
      ctx.strokeStyle = `rgba(0,200,255,${pulse})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = "#00d4ff";
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.ellipse(0, 0, hw + 15, hh + 10, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Engine exhaust / thruster glow
    const flameLen = 15 + 8 * Math.sin(time * 20);
    const flameGrad = ctx.createLinearGradient(0, hh - 5, 0, hh + flameLen);
    flameGrad.addColorStop(0, "rgba(0,200,255,0.9)");
    flameGrad.addColorStop(0.5, "rgba(100,150,255,0.6)");
    flameGrad.addColorStop(1, "rgba(0,0,255,0)");
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.ellipse(0, hh + flameLen / 2, 6, flameLen / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Side thruster flames
    const sFlame = 10 + 4 * Math.sin(time * 15 + 1);
    ctx.fillStyle = "rgba(0,180,255,0.5)";
    ctx.beginPath();
    ctx.ellipse(-hw + 6, hh + sFlame / 2, 3, sFlame / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(hw - 6, hh + sFlame / 2, 3, sFlame / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Aircraft body
    ctx.shadowColor = "#00d4ff";
    ctx.shadowBlur = 12;

    // Main fuselage
    ctx.fillStyle = "#1a2a4a";
    ctx.beginPath();
    ctx.moveTo(0, -hh); // nose
    ctx.lineTo(8, -hh + 20); // right shoulder
    ctx.lineTo(10, hh - 8); // right tail
    ctx.lineTo(0, hh); // tail center
    ctx.lineTo(-10, hh - 8); // left tail
    ctx.lineTo(-8, -hh + 20); // left shoulder
    ctx.closePath();
    ctx.fill();

    // Wings
    ctx.fillStyle = "#0d3a6e";
    // Right wing
    ctx.beginPath();
    ctx.moveTo(8, -hh + 25);
    ctx.lineTo(hw + 12, hh - 5);
    ctx.lineTo(hw, hh + 2);
    ctx.lineTo(10, hh - 8);
    ctx.closePath();
    ctx.fill();
    // Left wing
    ctx.beginPath();
    ctx.moveTo(-8, -hh + 25);
    ctx.lineTo(-hw - 12, hh - 5);
    ctx.lineTo(-hw, hh + 2);
    ctx.lineTo(-10, hh - 8);
    ctx.closePath();
    ctx.fill();

    // Canopy
    ctx.fillStyle = "#00aaff";
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.ellipse(0, -hh + 18, 5, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Accent lines
    ctx.strokeStyle = "#00d4ff";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -hh);
    ctx.lineTo(0, hh);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.restore();
  }
}
