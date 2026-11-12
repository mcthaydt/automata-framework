import { NavGraphResource, NavRoutes } from '@automata/nav/sim'
import { PuzzleState } from '@automata/puzzle/sim'
import { InSector, sectorsPlaces } from '@automata/sectors/sim'
import { defineSystem, type SimContext, type SystemDef, sortedKeys } from '@automata/sim'
import { hypot } from '@automata/sim/math'
import { CarriedLight, SystemsPursuit, SystemsState } from '@automata/systems/sim'
import { Ada } from '../../shared/ada.component.ts'
import { Checkpoint } from './checkpoint.resource.ts'

/** The figure's id in the creature's file, and the mode she goes back to. */
const FIGURE = 'nurse'

/** The node of the walking graph farthest from `from`: the fair place to put her back (the old `resetFor`). */
function farthestNode(ctx: SimContext, from: { x: number; z: number }): { x: number; z: number } | undefined {
  let best: { x: number; z: number } | undefined
  let far = -1
  const nodes = ctx.resource(NavGraphResource).nodes
  for (const id of sortedKeys(nodes)) {
    const node = nodes[id] as { x: number; z: number }
    const apart = hypot(node.x - from.x, node.z - from.z)
    if (apart > far) {
      far = apart
      best = node
    }
  }
  return best
}

/** Puts everything back as the checkpoint had it: facts, items, Ada and her lamp, and the figure far away and patrolling. */
export function restoreCheckpoint(ctx: SimContext): void {
  const checkpoint = ctx.resource(Checkpoint)
  const state = ctx.resource(PuzzleState)
  state.facts = { ...checkpoint.facts }
  state.items = [...checkpoint.items]
  for (const ada of ctx.query(Ada, InSector)) {
    ada.set(InSector, { ...checkpoint.ada })
    // Standing where she was put: nothing she was walking to, nothing she was waiting to use.
    delete ctx.resource(NavRoutes)[String(ada.sid)]
    ada.set(Ada, { lastX: checkpoint.ada.x, lastZ: checkpoint.ada.z, walking: false })
  }
  for (const light of ctx.query(CarriedLight))
    if (checkpoint.lamp !== null) light.set(CarriedLight, checkpoint.lamp)
  const pursuit = ctx.resource(SystemsPursuit)
  pursuit.hidden = ''
  pursuit.hiddenFor = 0
  const figure = ctx.resource(SystemsState).agents[FIGURE]
  const node = farthestNode(ctx, checkpoint.ada)
  if (figure !== undefined && node !== undefined) {
    Object.assign(figure, { path: [], goal: null, timer: 0, mode: 'patrol' })
    sectorsPlaces.move(ctx, figure.sid, node)
  }
  checkpoint.pending = false
}

/**
 * When the `found` cutscene a practice catch started has ended, puts everything back. The cutscene is how the player is told
 * what happened; the checkpoint is what makes the night fair again.
 */
export const restoreAfterFound = (playing: (ctx: SimContext) => boolean): SystemDef =>
  defineSystem({
    name: 'catch.restore',
    phase: 'gameplay',
    after: ['systems.step'],
    run: (ctx) => {
      const checkpoint = ctx.resource(Checkpoint)
      if (checkpoint.pending && !playing(ctx)) restoreCheckpoint(ctx)
    },
  })
