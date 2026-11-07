// The systems plugin: the env the game writes drives light and warmth, facts go through puzzle's
// state and mapped facts, every event's payload, a bad load fails with the scene's name, and reserved nodes.
import { PuzzleState, type Value } from '@automata/puzzle/sim'
import type { Sim } from '@automata/sim'
import { afterEach, expect, it } from 'vitest'
import { reachable, reserveNodes } from '#src/shared/sim/reserve.ts'
import { SystemsEnv } from '#src/shared/sim/systems.resource.ts'
import type { Rule } from '#src/shared/sim/systems.schema.ts'
import type { SystemsWorld } from '#src/shared/sim/world.ts'
import { sceneOf, watchman } from '#src/testing/toy.ts'
import { createWardGame, fact, kinds, load, move, run, stepWith } from '#src/testing/ward-game.ts'

let sims: Sim[] = []
afterEach(() => {
  for (const sim of sims) sim.dispose()
  sims = []
})
const rule = (id: string, when: Rule['when'], then: Rule['then']): Rule => ({ id, text: id, when, then })
async function game(
  rules: Rule[],
  options: Parameters<typeof createWardGame>[1] = {},
  hooks: string[] = ['shriek'],
) {
  const g = await createWardGame(sceneOf(watchman(), { rules }), options, hooks)
  sims.push(g.sim)
  stepWith(g.sim, [load({ watchman: { x: 0, z: -6 } }), move(3, 5)])
  return g
}

it('lights and warm things the game writes in systems.env answer inLight and warmthWithin', async () => {
  const { sim } = await game([
    rule('lit', [{ inLight: true }], [{ set: 'lit', to: true }]),
    rule('warm', [{ warmthWithin: 2 }], [{ set: 'warm', to: true }]),
  ])
  stepWith(sim)
  expect(sim.resource(PuzzleState).facts).not.toHaveProperty('lit')
  const env = sim.resource(SystemsEnv)
  env.lights = [{ x: 3, z: 4.5, radius: 1 }]
  env.warmth = [{ x: 2, z: 5, kind: 'drum' }]
  stepWith(sim)
  expect(sim.resource(PuzzleState).facts).toMatchObject({ lit: true, warm: true })
})

it('reads and sets facts through puzzle: its state, and the game’s mapped facts first', async () => {
  const mapped: Record<string, Value> = { lever: 'down' }
  const facts = {
    get: (_ctx: unknown, name: string) => mapped[name],
    set: (_ctx: unknown, name: string, value: Value) => {
      if (!(name in mapped)) return false
      mapped[name] = value
      return true
    },
  }
  const { sim } = await game(
    [
      rule(
        'pull',
        [
          { fact: 'lever', is: 'down' },
          { fact: 'armed', is: true },
        ],
        [
          { set: 'lever', to: 'up' },
          { set: 'fired', to: 1 },
        ],
      ),
    ],
    { facts },
  )
  stepWith(sim)
  expect(mapped.lever).toBe('down')
  stepWith(sim, [fact('armed', true)])
  expect(mapped.lever).toBe('up')
  expect(sim.resource(PuzzleState).facts).toMatchObject({ armed: true, fired: 1 })
  expect(sim.resource(PuzzleState).facts).not.toHaveProperty('lever')
})

it('says lines and cutscenes as events; a cutscene halts the step', async () => {
  const { sim } = await game([
    rule('say', [{ fact: 'go', is: true }], [{ emit: { line: 'nurseHums' } }]),
    rule('cut', [{ fact: 'go', is: true }], [{ emit: { cutscene: 'grapple' } }, { set: 'after', to: true }]),
  ])
  const events = run(sim, 1 / 60, [fact('go', true)])
  expect(kinds(events, 'systems.line')).toEqual([{ by: 'world', line: 'nurseHums' }])
  expect(kinds(events, 'systems.cutscene')).toEqual([{ id: 'grapple' }])
  expect(sim.resource(PuzzleState).facts).not.toHaveProperty('after')
})

it('fails to load a def that names a node the scene’s graph lacks, with the scene’s name', async () => {
  const bad = { ...watchman(), routine: [{ node: 'nowhere', dwell: 1 }] }
  const g = await createWardGame(sceneOf(bad), {}, ['shriek'])
  sims.push(g.sim)
  expect(() => stepWith(g.sim, [load()])).toThrow(/invalid systems for clinic[\s\S]*unknown node nowhere/)
})

it('keeps a reserved node for its agent: unreachable for another, through a restore', async () => {
  const seen: boolean[] = []
  const hooks = {
    reserve: (w: SystemsWorld) => {
      reserveNodes(w.ctx, 'porter', ['closet'])
      seen.push(
        reachable(w.ctx, 'closet', 'watchman'),
        reachable(w.ctx, 'closet', 'porter'),
        reachable(w.ctx, 'cmid'),
      )
    },
  }
  const { sim } = await game([rule('keep', [{ fact: 'keep', is: true }], [{ call: 'reserve' }])], { hooks })
  stepWith(sim, [fact('keep', true)])
  expect(seen.slice(0, 3)).toEqual([false, true, true])
  const restored = await createWardGame(
    sceneOf(watchman(), { rules: [rule('keep', [{ fact: 'keep', is: true }], [{ call: 'reserve' }])] }),
    { hooks },
    ['shriek'],
  )
  sims.push(restored.sim)
  restored.sim.restore(sim.snapshot())
  stepWith(restored.sim)
  expect(seen.slice(3, 6)).toEqual([false, true, true])
})
