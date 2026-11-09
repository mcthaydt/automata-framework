import { defineSystem, type SystemDef } from '@automata/sim'
import { Player } from '../../shared/player.component.ts'
import { GoalReached } from '../../shared/player.event.ts'
import { hitboxTouches, roomOf } from '../../shared/tiles.ts'
import { SUB } from '../../shared/tuning.ts'
import { Progress } from './progress.resource.ts'

/** Ends the round the first time the character touches the goal (the ember). */
export const goal: SystemDef = defineSystem({
  name: 'goal',
  phase: 'postPhysics',
  run(ctx) {
    const progress = ctx.resource(Progress)
    if (progress.reached) return
    const room = roomOf(ctx.content)
    for (const entity of ctx.query(Player)) {
      const p = entity.get(Player)
      const px = Math.floor(p.x / SUB)
      const py = Math.floor(p.y / SUB)
      if (hitboxTouches(room, px, py, (tx, ty) => tx === room.goal.tx && ty === room.goal.ty)) {
        progress.reached = true
        progress.tick = ctx.tick
        ctx.emit(GoalReached, { x: px, y: py })
        return
      }
    }
  },
})
