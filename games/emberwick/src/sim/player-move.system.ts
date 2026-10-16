import { defineSystem, type SystemDef } from '@mcthaydt/automata-sim'
import { Player, PlayerControl } from './player.component.ts'
import { Jumped, Landed } from './player.event.ts'
import { hitsSolid, type RoomGrid, roomOf } from './tiles.ts'
import {
  AIR_ACCEL,
  BUFFER_TICKS,
  COYOTE_TICKS,
  GRAVITY,
  HALF_GRAVITY_BELOW,
  JUMP_SPEED,
  MAX_FALL,
  MAX_RUN,
  RUN_ACCEL,
  SUB,
  VAR_JUMP_TICKS,
} from './tuning.ts'

/**
 * Runs, jumps and collides the character, in Celeste's order: read the ground, set the jump timers, run,
 * fall, keep or cut a held jump, start a jump, then move one axis at a time.
 */
export const playerMove: SystemDef = defineSystem({
  name: 'player.move',
  phase: 'physics',
  run(ctx) {
    const room = roomOf(ctx.content)
    for (const entity of ctx.query(Player, PlayerControl)) {
      const p = { ...entity.get(Player) }
      const c = { ...entity.get(PlayerControl) }
      const onGround = standingOnSolid(room, p.x, p.y)

      // Coyote time: a jump stays possible for a few ticks after leaving the ground.
      if (onGround) c.coyote = COYOTE_TICKS
      else if (c.coyote > 0) c.coyote -= 1

      // Run toward the held direction; with nothing held, toward a stop. Slower to change in the air.
      if (c.moveX !== 0) p.facing = c.moveX
      p.vx = approach(p.vx, MAX_RUN * c.moveX, onGround ? RUN_ACCEL : AIR_ACCEL)

      // Fall. Near the top of a held jump gravity halves, which gives the jump its float.
      if (!onGround) {
        const half = c.jumpHeld && abs(p.vy) < HALF_GRAVITY_BELOW
        p.vy = approach(p.vy, MAX_FALL, half ? GRAVITY / 2 : GRAVITY)
      }

      // A held jump keeps its full speed for a while; letting go ends that early (variable jump height).
      if (c.varJump > 0) {
        if (c.jumpHeld) p.vy = Math.min(p.vy, JUMP_SPEED)
        else c.varJump = 0
      }

      // Jump buffer: a press is remembered for a few ticks, so pressing just before landing still jumps.
      if (c.jumpPressed) c.buffer = BUFFER_TICKS
      if (c.buffer > 0 && c.coyote > 0) {
        p.vy = JUMP_SPEED
        c.varJump = VAR_JUMP_TICKS
        c.buffer = 0
        c.coyote = 0
        ctx.emit(Jumped, { x: pixel(p.x), y: pixel(p.y) })
      } else if (c.buffer > 0) {
        c.buffer -= 1
      }
      if (c.varJump > 0) c.varJump -= 1

      const movedX = slide(room, p.x, p.y, p.vx, 'x')
      p.x = movedX.position
      if (movedX.hit) p.vx = 0

      const movedY = slide(room, p.x, p.y, p.vy, 'y')
      p.y = movedY.position
      if (movedY.hit) {
        if (p.vy < 0) c.varJump = 0 // head against a ceiling
        p.vy = 0
      }

      // Landing is the change from airborne to standing, whether the fall ended exactly on the floor's top
      // pixel or was stopped by it.
      p.grounded = standingOnSolid(room, p.x, p.y)
      if (p.grounded && p.vy > 0) p.vy = 0
      if (p.grounded && !onGround) ctx.emit(Landed, { x: pixel(p.x), y: pixel(p.y) })
      entity.set(Player, p)
      entity.set(PlayerControl, c)
    }
  },
})

function pixel(subpixels: number): number {
  return Math.floor(subpixels / SUB)
}

function abs(value: number): number {
  return value < 0 ? -value : value
}

/** Moves `value` toward `target` by at most `step`. */
function approach(value: number, target: number, step: number): number {
  return value < target ? Math.min(value + step, target) : Math.max(value - step, target)
}

function standingOnSolid(room: RoomGrid, x: number, y: number): boolean {
  return hitsSolid(room, pixel(x), pixel(y) + 1)
}

/**
 * Moves along one axis by `amount` subpixels, at most one pixel at a time, stopping at the first pixel that
 * would overlap a solid tile. A stop leaves the hitbox pressed against the tile: on the last subpixel of its
 * pixel when moving right or down, on the first when moving left or up. One pixel at a time means nothing can
 * pass through a wall, whatever its speed.
 */
function slide(
  room: RoomGrid,
  x: number,
  y: number,
  amount: number,
  axis: 'x' | 'y',
): { position: number; hit: boolean } {
  let position = axis === 'x' ? x : y
  let remaining = amount
  while (remaining !== 0) {
    const step = remaining > 0 ? Math.min(remaining, SUB) : Math.max(remaining, -SUB)
    const next = position + step
    const blocked =
      axis === 'x' ? hitsSolid(room, pixel(next), pixel(y)) : hitsSolid(room, pixel(x), pixel(next))
    if (blocked) {
      const pixelStart = pixel(position) * SUB
      return { position: step > 0 ? pixelStart + SUB - 1 : pixelStart, hit: true }
    }
    position = next
    remaining -= step
  }
  return { position, hit: false }
}
