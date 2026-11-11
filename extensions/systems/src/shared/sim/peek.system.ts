// The peek's step, in `gameplay` after the systems' own: she peeks while she is still, not hiding, facing a doorway into
// another zone that is open to her, and no verb has been sent. The doorways are the crossings between the rooms of her
// zone and the rooms of any other (`places.crossing`); a doorway whose door is shut is blocked for the walk from her to its
// middle, so a shut door shows nothing without this file knowing any door.
import { NavDoors } from '@automata/nav/sim'
import type { Places } from '@automata/places'
import { VerbCommand } from '@automata/puzzle/sim'
import { sectorsPlaces } from '@automata/sectors/sim'
import { defineSystem, type SimContext, type SystemDef } from '@automata/sim'
import { advance, type Doorway, holds, type PeekDef, type PeekFile, peekDefOf, peekTarget } from './peek'
import { SystemsPeek } from './peek.event'
import { SystemsPeekState } from './peek.resource'
import { SystemsEnv, SystemsPursuit } from './systems.resource'
import type { SystemsOptions } from './world'

export interface PeekOptions {
  /** The player's facing now, in radians: the direction is (sin f, cos f). The game keeps it; the sim cannot see a heading. */
  readonly facing: (ctx: SimContext) => number
  /** Any of the numbers of a peek; the old game's where absent. */
  readonly def?: PeekFile | undefined
  /** Where the player stands and which rooms touch; by default sectors' 3D rooms. */
  readonly places?: Places | undefined
  /** The game's movement query, so its own doors and boxes shut a doorway; as `createSystems` takes it. */
  readonly blocked?: SystemsOptions['blocked']
  /** True when the game has taken a verb of its own this step, which ends a peek (a `puzzle.verb` command always does). */
  readonly interrupt?: ((ctx: SimContext) => boolean) | undefined
}

/** The peek's numbers: the options' over the defaults. A number that cannot be one is refused in words, when the plugin is made. */
export const defOf = (options: PeekOptions): PeekDef => peekDefOf(options.def)

/** The doorways from the zone of room `here` into the other zones. */
function doorways(ctx: SimContext, places: Places, here: number): Doorway[] {
  const rooms = places.rooms(ctx)
  const zone = rooms[here - 1]?.zone
  const found: Doorway[] = []
  for (const from of rooms) {
    if (from.zone !== zone) continue
    for (const to of rooms) {
      if (to.zone === zone) continue
      const through = places.crossing(ctx, from.id, to.id)
      if (through !== null)
        found.push({
          portal: `${from.id}>${to.id}`,
          into: to.id,
          at: { x: through.x, z: through.z },
          past: through.into,
        })
    }
  }
  return found
}

export const peekSystem = (options: PeekOptions): SystemDef => {
  const def = defOf(options)
  const places = options.places ?? sectorsPlaces
  return defineSystem({
    name: 'systems.peek',
    phase: 'gameplay',
    after: ['systems.step'],
    run: (ctx) => {
      const state = ctx.resource(SystemsPeekState)
      const env = ctx.resource(SystemsEnv)
      const stand = env.player === 0 ? undefined : places.at(ctx, env.player)
      const still =
        stand !== undefined &&
        !env.moving &&
        ctx.resource(SystemsPursuit).hidden === '' &&
        ctx.commands.of(VerbCommand).length === 0 &&
        options.interrupt?.(ctx) !== true
      let door: Doorway | undefined
      if (still) {
        const here = places.roomAt(ctx, stand)
        if (here !== 0) {
          const doors = ctx.resource(NavDoors).open
          const walk = options.blocked?.(ctx, doors) ?? places.walk(ctx, doors)
          door = peekTarget(
            stand,
            options.facing(ctx),
            doorways(ctx, places, here),
            def,
            (d) => !walk.segment(stand, d.at, 0),
          )
        }
      }
      const before = state.peek
      const after = advance(before, door, ctx.dt, def)
      state.peek = after
      const was = holds(before)
      const is = holds(after)
      if (was && !is && before !== null)
        ctx.emit(SystemsPeek, { portal: before.portal, into: before.into, on: false })
      else if (is && !was && after !== null)
        ctx.emit(SystemsPeek, { portal: after.portal, into: after.into, on: true })
    },
  })
}
