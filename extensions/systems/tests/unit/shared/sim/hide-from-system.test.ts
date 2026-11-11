// `Systems.hide` and `unhide` are what the `systems.hide` and `systems.unhide` commands do, callable from a game's own
// system (the `interact` extension calls it for a hiding place): the same hiding gives the same state, hash and all.
import { stateHash, stepWith } from '@automata/sectors/testing'
import { defineCommand, definePlugin, defineSystem, type Sim } from '@automata/sim'
import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { Systems } from '#src/shared/sim/systems.plugin.ts'
import { SystemsPursuit } from '#src/shared/sim/systems.resource.ts'
import { sceneOf } from '#src/testing/toy.ts'
import { createWardGame, load, move } from '#src/testing/ward-game.ts'

const HideBySystem = defineCommand('test.hide', z.strictObject({ spot: z.string() }))
const UnhideBySystem = defineCommand('test.unhide', z.strictObject({}))

/** An agent that does nothing: a scene to load, and no behaviour to disturb the hiding. */
const quiet = sceneOf({
  id: 'quiet',
  modes: ['idle'],
  initial: 'idle',
  speed: { idle: 0 },
  senses: [],
  transitions: [],
})

let sims: Sim[] = []
afterEach(() => {
  for (const sim of sims) sim.dispose()
  sims = []
})

/** The plugin that hides from a system. Both games have it, so their snapshots carry the same systems (and streams). */
const hider = (systems: Systems) =>
  definePlugin({
    name: 'hider',
    dependsOn: ['systems'],
    commands: [HideBySystem, UnhideBySystem],
    systems: [
      defineSystem('hider.run', 'input', (ctx) => {
        for (const { payload } of ctx.commands.of(HideBySystem)) systems.hide(ctx, payload.spot)
        if (ctx.commands.of(UnhideBySystem).length > 0) systems.unhide(ctx)
      }),
    ],
  })

/** Two ward games, the same in everything but how they hide: by command, and by a system calling `Systems.hide`. */
async function pair() {
  const byCommand = await createWardGame(quiet, {}, [], { plugins: (systems) => [hider(systems)] })
  const bySystem = await createWardGame(quiet, {}, [], { plugins: (systems) => [hider(systems)] })
  sims.push(byCommand.sim, bySystem.sim)
  for (const game of [byCommand, bySystem]) stepWith(game.sim, [load({ quiet: { x: 3, z: 3 } }), move(0, 4)])
  return { byCommand: byCommand.sim, bySystem: bySystem.sim }
}

describe('hiding from a system', () => {
  it('hides as the command does: the same state', async () => {
    const { byCommand, bySystem } = await pair()
    stepWith(byCommand, [{ type: 'systems.hide', payload: { spot: 'locker' } }])
    stepWith(bySystem, [{ type: 'test.hide', payload: { spot: 'locker' } }])
    expect(bySystem.resource(SystemsPursuit).hidden).toBe('locker')
    expect(bySystem.resource(SystemsPursuit)).toEqual(byCommand.resource(SystemsPursuit))
    expect(stateHash(bySystem)).toBe(stateHash(byCommand))
  })

  it('comes out as the command does', async () => {
    const { byCommand, bySystem } = await pair()
    stepWith(byCommand, [{ type: 'systems.hide', payload: { spot: 'locker' } }])
    stepWith(bySystem, [{ type: 'test.hide', payload: { spot: 'locker' } }])
    stepWith(byCommand, [{ type: 'systems.unhide', payload: {} }])
    stepWith(bySystem, [{ type: 'test.unhide', payload: {} }])
    expect(bySystem.resource(SystemsPursuit).hidden).toBe('')
    expect(stateHash(bySystem)).toBe(stateHash(byCommand))
  })

  it('moves from one hiding place to another as the command does', async () => {
    const { byCommand, bySystem } = await pair()
    for (const spot of ['locker', 'cupboard']) {
      stepWith(byCommand, [{ type: 'systems.hide', payload: { spot } }])
      stepWith(bySystem, [{ type: 'test.hide', payload: { spot } }])
    }
    expect(bySystem.resource(SystemsPursuit).hidden).toBe('cupboard')
    expect(stateHash(bySystem)).toBe(stateHash(byCommand))
  })

  it('does nothing when no scene is loaded, as the command does', async () => {
    const game = await createWardGame(quiet, {}, [], { plugins: (systems) => [hider(systems)] })
    sims.push(game.sim)
    stepWith(game.sim, [{ type: 'test.hide', payload: { spot: 'locker' } }])
    expect(game.sim.resource(SystemsPursuit).hidden).toBe('')
  })
})
