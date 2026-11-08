import { InSector } from '@automata/sectors/sim'
import { defineSystem, sortedKeys } from '@automata/sim'
import { SystemsScene, SystemsState } from '@automata/systems/sim'
import { Actor } from './actor.component.ts'

/**
 * Puts every character the systems made on the screen's component, and keeps it where the systems say. A character is
 * given its `Actor` the first time this sees it, so a Save that adds one in Schematic shows up in play.
 */
export const syncActors = defineSystem('actors.sync', 'cleanup', (ctx) => {
  const agents = ctx.resource(SystemsState).agents
  const order = ctx.resource(SystemsScene).def?.agents.map((agent) => agent.id) ?? []
  for (const id of sortedKeys(agents)) {
    const record = agents[id]
    const entity = record === undefined ? undefined : ctx.entity(record.sid)
    if (record === undefined || entity === undefined) continue
    const at = entity.get(InSector)
    const values = {
      x: at.x,
      y: 0,
      z: at.z,
      yaw: record.facing,
      walking: record.moving,
      index: Math.max(0, order.indexOf(id)),
    }
    if (entity.has(Actor)) entity.set(Actor, values)
    else entity.add(Actor, values)
  }
})
