import { type Container, Sprite, Texture } from 'pixi.js'
import { endesga } from '../../shared/art/palette.ts'

// Small particles: dust on jumps, landings and running, and sparks when the ember is reached. Directions come
// from the particle's index, not a random source, so a replay looks the same every time. Presentation only:
// the sim never reads any of it.

interface Particle {
  readonly sprite: Sprite
  vx: number
  vy: number
  gravity: number
  life: number
  readonly lifetime: number
}

export class Particles {
  private readonly live: Particle[] = []

  constructor(private readonly layer: Container) {}

  /** Puffs at a point (pixels): sideways along the ground and a little up. */
  dust(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -1 : 1
      this.spawn(x + side * (1 + (i >> 1)), y - 1, {
        vx: side * (0.35 + 0.22 * (i >> 1)),
        vy: -0.12 - 0.08 * (i % 3),
        gravity: 0,
        lifetime: 16 + (i % 4) * 2,
        color: i % 3 === 0 ? endesga(9) : endesga(10),
        size: 2,
      })
    }
  }

  /** Warm sparks flying out from a point in a ring, then falling. */
  sparks(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const speed = 0.8 + (i % 3) * 0.45
      this.spawn(x, y, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.6,
        gravity: 0.04,
        lifetime: 34 + (i % 5) * 4,
        color: [endesga(32), endesga(31), endesga(30), endesga(28)][i % 4] as string,
        size: 1 + (i % 2),
      })
    }
  }

  /** One display frame: move, fade and remove spent particles. */
  update(): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i] as Particle
      p.life -= 1
      p.vy += p.gravity
      p.vx *= 0.94
      p.sprite.x += p.vx
      p.sprite.y += p.vy
      p.sprite.alpha = p.life / p.lifetime
      if (p.life <= 0) {
        p.sprite.destroy()
        this.live.splice(i, 1)
      }
    }
  }

  clear(): void {
    for (const p of this.live) p.sprite.destroy()
    this.live.length = 0
  }

  private spawn(
    x: number,
    y: number,
    options: { vx: number; vy: number; gravity: number; lifetime: number; color: string; size: number },
  ): void {
    const sprite = new Sprite(Texture.WHITE)
    sprite.width = options.size
    sprite.height = options.size
    sprite.tint = options.color
    sprite.position.set(x, y)
    this.layer.addChild(sprite)
    this.live.push({
      sprite,
      vx: options.vx,
      vy: options.vy,
      gravity: options.gravity,
      life: options.lifetime,
      lifetime: options.lifetime,
    })
  }
}
