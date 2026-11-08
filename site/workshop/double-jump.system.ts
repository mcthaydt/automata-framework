import { defineSystem } from '../../automata-framework/packages/sim/src/index'
import { hitsSolid, Jumped, Player, PlayerControl, type RoomGrid, tuning } from '../../automata-framework/games/emberwick/src/sim/index'
import { AirJump } from './air-jump.component'

export const doubleJump = defineSystem({
  name: 'player.double-jump',
  phase: 'prePhysics',
  run(ctx) {
    const room = (ctx.content as { room: RoomGrid }).room
    for (const entity of ctx.query(Player, PlayerControl)) {
      if (!entity.has(AirJump)) entity.add(AirJump, { available: true })
      const player = entity.get(Player)
      const control = entity.get(PlayerControl)
      const x = Math.floor(player.x / tuning.SUB)
      const y = Math.floor(player.y / tuning.SUB)
      // Use the starter's collision helper, including on the first tick before grounded is set.
      if (hitsSolid(room, x, y + 1)) {
        entity.set(AirJump, { available: true })
        continue
      }
      // The movement system decrements coyote time before testing it.
      if (!control.jumpPressed || control.coyote > 1 || !entity.get(AirJump).available) continue
      entity.set(AirJump, { available: false })
      entity.set(Player, { vy: tuning.JUMP_SPEED })
      // Consume this edge so the original jump buffer cannot queue another jump on landing.
      entity.set(PlayerControl, { jumpPressed: false, buffer: 0, coyote: 0, varJump: tuning.VAR_JUMP_TICKS })
      ctx.emit(Jumped, { x, y })
    }
  },
})
