import type { FieldRecord, StepResult } from '@mcthaydt/automata-sim'
import { Application, Container, Sprite, TextureSource } from 'pixi.js'
import { endesga } from '../art/palette.ts'
import {
  CHARACTER_FALL,
  CHARACTER_IDLE,
  CHARACTER_JUMP,
  CHARACTER_RUN_A,
  CHARACTER_RUN_B,
  GOAL_BUBBLE,
  TILE,
  TILE_TOP,
} from '../art/sprites.ts'
import type { Room } from '../content/room.ts'
import { isSolid } from '../content/room.ts'
import { HITBOX_H, HITBOX_W, SUB } from '../sim/tuning.ts'
import { drawBackdrop } from './backdrop.ts'
import { Dust } from './dust.ts'
import { textureFromPixels } from './pixels.ts'

// The base's renderer: Pixi 8 at the room's own resolution (320 × 192), scaled up whole pixels at a time and
// letterboxed. Stand-in for `render-pixi` (M1.7), set up the way FloorFifty sets up Pixi: WebGL preference (a
// WebGL2 context, AF's default; WebGPU is opt-in), no antialiasing, nearest scaling. It reads the sim's
// RenderDelta and events and never writes the sim.

interface PlayerView {
  x: number
  y: number
  vx: number
  vy: number
  facing: number
  grounded: boolean
}

export interface Renderer {
  /** Takes one sim step's render changes and events. */
  apply(result: StepResult): void
  /** One display frame. `time` is in milliseconds. */
  draw(time: number): void
  /** Forgets the old sim's entities (a new round starts with a fresh sim and a resync). */
  reset(): void
  /** Re-fits the canvas to its container. */
  fit(): void
  /** The character's hitbox top-left in pixels, for the page's data attributes. */
  playerPixel(): { x: number; y: number } | null
  destroy(): void
}

export async function createRenderer(host: HTMLElement, room: Room): Promise<Renderer> {
  const width = room.width * room.tileSize
  const height = room.height * room.tileSize
  TextureSource.defaultOptions.scaleMode = 'nearest'
  const app = new Application()
  await app.init({
    width,
    height,
    background: endesga(15),
    antialias: false,
    preference: 'webgl',
    resolution: 1,
    // The game loop draws each frame itself (src/loop.ts), so Pixi's own ticker stays off.
    autoStart: false,
  })
  app.ticker.stop()
  app.canvas.classList.add('stage')
  host.appendChild(app.canvas)

  const frames = {
    idle: textureFromPixels(CHARACTER_IDLE),
    runA: textureFromPixels(CHARACTER_RUN_A),
    runB: textureFromPixels(CHARACTER_RUN_B),
    jump: textureFromPixels(CHARACTER_JUMP),
    fall: textureFromPixels(CHARACTER_FALL),
  }
  const tileTop = textureFromPixels(TILE_TOP)
  const tileInner = textureFromPixels(TILE)

  app.stage.addChild(drawBackdrop(width, height))
  const tiles = new Container()
  for (let ty = 0; ty < room.height; ty++)
    for (let tx = 0; tx < room.width; tx++) {
      if (!isSolid(room, tx, ty)) continue
      const tile = new Sprite(isSolid(room, tx, ty - 1) ? tileInner : tileTop)
      tile.position.set(tx * room.tileSize, ty * room.tileSize)
      tiles.addChild(tile)
    }
  app.stage.addChild(tiles)

  const goal = new Sprite(textureFromPixels(GOAL_BUBBLE))
  goal.anchor.set(0.5)
  const goalX = room.goal.tx * room.tileSize + room.tileSize / 2
  const goalY = room.goal.ty * room.tileSize + room.tileSize / 2
  goal.position.set(goalX, goalY)
  app.stage.addChild(goal)

  const dustLayer = new Container()
  app.stage.addChild(dustLayer)
  const dust = new Dust(dustLayer)

  const character = new Sprite(frames.idle)
  character.anchor.set(0.5, 1) // bottom centre, on the hitbox's feet
  character.visible = false
  app.stage.addChild(character)

  let player: PlayerView | null = null
  let goalReached = false
  let stepCount = 0
  // Squash and stretch: the sprite's scale eases back to 1 each frame after a jump or landing.
  let squashX = 1
  let squashY = 1

  const fit = () => {
    const scale = Math.min(host.clientWidth / width, host.clientHeight / height)
    // Whole-pixel scaling keeps pixel art crisp; below 2× a phone gets the fractional fit instead of a tiny game.
    const shown = scale >= 2 ? Math.floor(scale) : Math.max(scale, 0.25)
    app.canvas.style.width = `${Math.round(width * shown)}px`
    app.canvas.style.height = `${Math.round(height * shown)}px`
  }
  fit()

  return {
    apply(result) {
      stepCount++
      const delta = result.render
      if (delta.resync) player = null
      for (const row of [...delta.added, ...delta.changed]) {
        const fields = row.components.player
        if (fields !== undefined) player = toPlayerView(fields)
      }
      for (const event of result.events) {
        const at = event.payload as { x: number; y: number }
        const feetX = at.x + HITBOX_W / 2
        const feetY = at.y + HITBOX_H
        if (event.type === 'player.jumped') {
          squashX = 0.7
          squashY = 1.35
          dust.burst(feetX, feetY, 4)
        } else if (event.type === 'player.landed') {
          squashX = 1.35
          squashY = 0.7
          dust.burst(feetX, feetY, 6)
        } else if (event.type === 'goal.reached') {
          goalReached = true
        }
      }
    },
    draw(time) {
      squashX += (1 - squashX) * 0.25
      squashY += (1 - squashY) * 0.25
      dust.update()
      goal.visible = !goalReached
      goal.y = goalY + Math.round(Math.sin(time / 300) * 2)
      if (player === null) {
        character.visible = false
      } else {
        character.visible = true
        character.texture = pickFrame(player, stepCount, frames)
        character.position.set(
          Math.floor(player.x / SUB) + HITBOX_W / 2,
          Math.floor(player.y / SUB) + HITBOX_H,
        )
        character.scale.set(squashX * player.facing, squashY)
      }
      app.render()
    },
    reset() {
      player = null
      goalReached = false
      squashX = 1
      squashY = 1
      dust.clear()
    },
    fit,
    playerPixel() {
      return player === null ? null : { x: Math.floor(player.x / SUB), y: Math.floor(player.y / SUB) }
    },
    destroy() {
      app.destroy(true, { children: true, texture: true })
    },
  }
}

function toPlayerView(fields: Readonly<FieldRecord>): PlayerView {
  return {
    x: Number(fields.x),
    y: Number(fields.y),
    vx: Number(fields.vx),
    vy: Number(fields.vy),
    facing: Number(fields.facing) < 0 ? -1 : 1,
    grounded: fields.grounded === true,
  }
}

/** Idle, a two-frame run (a new frame every 6 steps), or jump or fall by the vertical speed. */
function pickFrame<T>(
  player: PlayerView,
  step: number,
  frames: { idle: T; runA: T; runB: T; jump: T; fall: T },
): T {
  if (!player.grounded) return player.vy < 0 ? frames.jump : frames.fall
  if (player.vx === 0) return frames.idle
  return Math.floor(step / 6) % 2 === 0 ? frames.runA : frames.runB
}
