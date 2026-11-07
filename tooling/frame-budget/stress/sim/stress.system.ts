import { defineSystem, type SystemDef } from '@automata/sim'
import { Body, Pulse, WORLD } from './stress.component.ts'
import { BEAT_TICKS, Beat } from './stress.event.ts'

const MAX_X = WORLD.width * WORLD.sub
const MAX_Y = WORLD.height * WORLD.sub

/** Moves every body by its velocity and bounces it off the world's edges. */
export const stressMove: SystemDef = defineSystem({
  name: 'stress.move',
  phase: 'physics',
  run(ctx) {
    for (const entity of ctx.query(Body)) {
      const body = { ...entity.get(Body) }
      body.x += body.vx
      body.y += body.vy
      if (body.x < 0 || body.x >= MAX_X) {
        body.vx = -body.vx
        body.x = Math.min(Math.max(body.x, 0), MAX_X - 1)
      }
      if (body.y < 0 || body.y >= MAX_Y) {
        body.vy = -body.vy
        body.y = Math.min(Math.max(body.y, 0), MAX_Y - 1)
      }
      entity.set(Body, body)
    }
    if (ctx.tick % BEAT_TICKS === 0) ctx.emit(Beat, { tick: ctx.tick })
  },
})

/**
 * Worker `index`: reads every body and rewrites its pulse, so each worker costs one pass over all N entities
 * and the sim's cost grows as N × M. The arithmetic is only there to be deterministic and not optimized away.
 */
export function stressWorker(index: number): SystemDef {
  return defineSystem({
    name: `stress.work-${index}`,
    phase: 'gameplay',
    run(ctx) {
      for (const entity of ctx.query(Body, Pulse)) {
        const { x, y } = entity.get(Body)
        const { phase } = entity.get(Pulse)
        entity.set(Pulse, { phase: (Math.imul(phase, 31) + (x >> 8) + (y >> 8) + index) & 0xffff })
      }
    },
  })
}
