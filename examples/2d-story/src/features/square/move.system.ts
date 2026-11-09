import { defineSystem } from '@automata/sim'
import { SPEED, SQUARE_SIZE } from '../../shared/constants.ts'
import { levelIn } from '../level/read-level.ts'
import { hitsWall } from '../level/walls.ts'
import { Hero } from './hero.component.ts'
import { Move } from './move.command.ts'
import { Square } from './square.component.ts'

/**
 * Moves the hero's square by what the player holds, unless a wall is in the way or the hero is frozen. Only the sim changes the game, so a replay
 * ends where play did.
 */
export const move = defineSystem('move', (ctx) => {
  const level = levelIn(ctx.content)
  for (const { payload } of ctx.commands.of(Move))
    for (const square of ctx.query(Square, Hero)) {
      if (square.get(Hero).frozen) continue
      const { x, y } = square.get(Square)
      // One axis at a time, so a square pushed into a wall at an angle slides along it instead of stopping.
      const nextX = x + payload.x * SPEED
      const movedX = hitsWall(level, nextX, y, SQUARE_SIZE) ? x : nextX
      const nextY = y + payload.y * SPEED
      const movedY = hitsWall(level, movedX, nextY, SQUARE_SIZE) ? y : nextY
      square.set(Square, { x: movedX, y: movedY })
    }
})
