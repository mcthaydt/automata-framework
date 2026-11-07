// The rule ticks (M6 spec §4.6, §5): the adventure source's `systems.test.ts` cases through the real sim, plus the
// halt: a catch in a rule ends the step before the agents.
import type { Sim } from '@automata/sim'
import { afterEach, describe, expect, it } from 'vitest'
import { alarmToy, sceneOf, watchman } from '../testing/toy'
import { agent, createWardGame, fact, kinds, load, run, stepWith } from '../testing/ward-game'
import { SystemsNoises } from './systems.resource'
import type { SystemsDef } from './systems.schema'

let sims: Sim[] = []
afterEach(() => {
  for (const sim of sims) sim.dispose()
  sims = []
})
async function setup(def: SystemsDef = alarmToy()) {
  const game = await createWardGame(def, {}, ['woke', 'shriek'])
  sims.push(game.sim)
  stepWith(game.sim, [load({ watchman: { x: 0, z: -4 } }), fact('power', false)])
  return game
}
const alarms = (events: readonly { type: string; payload: unknown }[]) =>
  kinds(events, 'systems.noise').filter((n) => (n as { kind: string }).kind === 'alarm')

describe('rule ticks', () => {
  it('a rule with `every` fires on its interval while its probes hold', async () => {
    const { sim } = await setup()
    // The load step's clock already counted one step.
    expect(alarms(run(sim, 1.9 - 1 / 60))).toHaveLength(0)
    expect(alarms(run(sim, 0.2))).toHaveLength(1)
    expect(alarms(run(sim, 2))).toHaveLength(1)
    expect(alarms(run(sim, 4, [fact('power', true)]))).toHaveLength(0)
  })

  it('rules run before agents and noises age after them, so each noise is heard once', async () => {
    const { sim, log } = await setup()
    run(sim, 2.01)
    // The ring woke him (a rule) and, in the same step, drew him (his transition).
    expect(log).toContain('hook:woke:world')
    expect(agent(sim, 'watchman').mode).toBe('investigate')
    expect(agent(sim, 'watchman').goal).toEqual({ x: 0, z: -6 })
    expect(sim.resource(SystemsNoises).noises.every((n) => n.age > 0)).toBe(true)
    expect(log.filter((e) => e.startsWith('hook:woke'))).toHaveLength(1)
  })

  it('the state lives in the sim, so a restored sim runs on identically', async () => {
    const a = await setup()
    run(a.sim, 1.3)
    const b = await createWardGame(alarmToy(), {}, ['woke', 'shriek'])
    sims.push(b.sim)
    b.sim.restore(a.sim.snapshot())
    const eventsA = run(a.sim, 3)
    const eventsB = run(b.sim, 3)
    expect(eventsB).toEqual(eventsA)
    expect(b.sim.hash()).toBe(a.sim.hash())
  })
})

it('a rule that catches the player halts the step: the agents wait for the next one', async () => {
  const def = sceneOf(watchman(), {
    rules: [
      {
        id: 'trap',
        text: 'The floor gives.',
        when: [{ fact: 'trap', is: true }],
        then: [{ emit: { caught: 'floor' } }],
      },
    ],
  })
  const { sim } = await setup(def)
  // In sight of the watchman, who would hunt; the trap catches first, so he does not move this step.
  const events = run(sim, 1 / 60, [fact('trap', true), { type: 'ward.move', payload: { x: 0, z: -3.2 } }])
  expect(kinds(events, 'systems.caught')).toEqual([{ cause: 'floor' }])
  expect(agent(sim, 'watchman').mode).toBe('patrol')
})
