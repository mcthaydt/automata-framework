// The area change (DESIGN.md §13): an exit, a fade, then the next area with Wick at its entry.
import { defineSystem, type SystemDef } from '@mcthaydt/automata-sim'
import { Hero } from '../components.ts'
import { AREA_FADE_TICKS } from '../constants.ts'
import { AreaEntered, AreaExit } from '../events.ts'
import { Location } from '../resources.ts'
import { worldOf } from './area.ts'
import { frozen } from './combat.ts'

/**
 * Wick's centre inside one of his area's exits starts a change: `area.exit` names the area it leads to, and
 * `AREA_FADE_TICKS` later (presentation's fade out) the sim makes that area his, places him at the entry and emits
 * `area.entered`; `hero.view`, after it, cuts the camera to the entry's view on the same tick. No exit is noticed
 * while a change is under way. Wick still walks during the fade: the swap places him wherever he got to.
 */
export const areaExit: SystemDef = defineSystem({
  name: 'area.exit',
  phase: 'postPhysics',
  before: ['hero.view'],
  run(ctx) {
    if (frozen(ctx)) return
    const { areas } = worldOf(ctx.content)
    const place = ctx.resource(Location)
    for (const entity of ctx.query(Hero)) {
      if (place.next >= 0) {
        if (ctx.tick < place.swapAt) continue
        // An area change lets go of the lock (DESIGN.md §11.2).
        entity.set(Hero, { x: place.entryX, z: place.entryZ, lockTarget: 0, lockHidden: 0 })
        // A fall in the new area's first room returns him to where he arrived (DESIGN.md §7.8).
        place.returnX = place.entryX
        place.returnZ = place.entryZ
        place.returnFacing = entity.get(Hero).facing
        place.area = place.next
        place.next = -1
        ctx.emit(AreaEntered, { area: place.area })
        continue
      }
      const { x, z } = entity.get(Hero)
      const exit = areas[place.area]?.exits.find(
        (box) => x >= box.minX && x < box.maxX && z >= box.minZ && z < box.maxZ,
      )
      if (exit === undefined) continue
      place.next = areas.findIndex((area) => area.id === exit.to)
      place.swapAt = ctx.tick + AREA_FADE_TICKS
      place.entryX = exit.entry.x
      place.entryZ = exit.entry.z
      ctx.emit(AreaExit, { area: place.next })
    }
  },
})
