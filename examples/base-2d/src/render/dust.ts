import { type Container, Sprite, Texture } from 'pixi.js'
import { endesga } from '../art/palette.ts'

// Little puffs on jumps and landings (Celeste). Presentation only: never read back by the sim.

interface Puff {
  readonly sprite: Sprite
  vx: number
  vy: number
  life: number
}

const LIFE_FRAMES = 18

export class Dust {
  private readonly puffs: Puff[] = []

  constructor(private readonly layer: Container) {}

  /** A burst of puffs at a point (pixels): sideways along the ground, a little upward. */
  burst(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const sprite = new Sprite(Texture.WHITE)
      sprite.width = 2
      sprite.height = 2
      sprite.tint = i % 3 === 0 ? endesga(23) : endesga(9) // #f9e6cf, #c7cfdd
      sprite.position.set(x + side * (1 + (i >> 1)), y - 2)
      this.layer.addChild(sprite)
      this.puffs.push({
        sprite,
        vx: side * (0.4 + 0.25 * (i >> 1)),
        vy: -0.15 - 0.1 * (i % 3),
        life: LIFE_FRAMES,
      })
    }
  }

  /** One display frame: drift, fade, and remove spent puffs. */
  update(): void {
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const puff = this.puffs[i] as Puff
      puff.life -= 1
      puff.sprite.x += puff.vx
      puff.sprite.y += puff.vy
      puff.vx *= 0.9
      puff.sprite.alpha = puff.life / LIFE_FRAMES
      if (puff.life <= 0) {
        puff.sprite.destroy()
        this.puffs.splice(i, 1)
      }
    }
  }

  clear(): void {
    for (const puff of this.puffs) puff.sprite.destroy()
    this.puffs.length = 0
  }
}
