// The agent interpreter: the original game's `agents.test.ts` cases, re-pointed at the clinic
// fixture and run through the real sim (the toy watchman, the player as an entity, noises made by `hear`).
import { clinicGraph } from '@automata/nav/testing/clinic'
import { PuzzleState } from '@automata/puzzle/sim'
import type { Point } from '@automata/sectors/sim'
import type { Sim } from '@automata/sim'
import { afterEach, describe, expect, it } from 'vitest'
import type { AgentDef } from '#src/shared/sim/systems.schema.ts'
import { sceneOf, watchman } from '#src/testing/toy.ts'
import {
  agent,
  agentAt,
  createWardGame,
  fact,
  kinds,
  load,
  move,
  noise,
  place,
  run,
  stepWith,
} from '#src/testing/ward-game.ts'

const NODES = clinicGraph().nodes as Record<string, Point>
let sims: Sim[] = []
afterEach(() => {
  for (const sim of sims) sim.dispose()
  sims = []
})
async function setup(
  def: AgentDef = watchman(),
  at: Point = NODES.cmid as Point,
  player: Point = { x: 3, z: 5 },
) {
  const game = await createWardGame(sceneOf(def), {}, ['shriek'])
  sims.push(game.sim)
  stepWith(game.sim, [
    load({ watchman: at }),
    move(player.x, player.z),
    fact('power', false),
    fact('monitorSeen', false),
  ])
  return game
}

describe('agent interpreter', () => {
  it('takes the highest-priority transition whose probes hold', async () => {
    const { sim, log } = await setup()
    // The player in plain sight in the corridor: sight (20) wins.
    run(sim, 1 / 60, [move(0, -3.2)])
    expect(agent(sim, 'watchman').mode).toBe('hunt')
    // The power coming on (30) beats it, and runs its hook as the stunned watchman.
    run(sim, 1 / 60, [fact('power', true)])
    expect(agent(sim, 'watchman').mode).toBe('stunned')
    expect(log).toContain('hook:shriek:stunned')
  })

  it('hunts by sight, walks at its mode speed, and catches on touch', async () => {
    const { sim } = await setup()
    const events = run(sim, 3, [move(0, -2.4)])
    expect(agent(sim, 'watchman').mode).toBe('hunt')
    expect(kinds(events, 'systems.caught')).toContainEqual({ cause: 'nurse' })
  })

  it('does not see through a wall', async () => {
    // The watchman in the corridor, the player in the locked supply room 2.6 m east: in range, behind the wall.
    const { sim } = await setup(watchman(), { x: 0.6, z: -4.4 }, { x: 3.2, z: -4.4 })
    stepWith(sim)
    expect(agent(sim, 'watchman').mode).toBe('patrol')
    run(sim, 1 / 60, [move(0.6, -2.2)])
    expect(agent(sim, 'watchman').mode).toBe('hunt')
  })

  it('is out of range in the open', async () => {
    const { sim } = await setup(watchman(), { x: 0.6, z: -4.4 }, { x: 0, z: 1.5 })
    stepWith(sim)
    expect(agent(sim, 'watchman').mode).toBe('patrol')
  })

  it('hears a noise when it is made, goes to it, and gives up after waiting there', async () => {
    const { sim } = await setup(watchman(), NODES.end as Point)
    stepWith(sim, [noise(0, -2.2, 9)])
    expect(agent(sim, 'watchman').mode).toBe('investigate')
    expect(agent(sim, 'watchman').goal).toEqual({ x: 0, z: -2.2 })
    // 3.9 m at 1.5 m/s: there in 2.6 s, then 3 s of waiting.
    run(sim, 2.9)
    const at = agentAt(sim, 'watchman')
    expect(Math.hypot(at.x, at.z + 2.2)).toBeLessThan(0.1)
    run(sim, 2.5)
    expect(agent(sim, 'watchman').mode).toBe('investigate')
    run(sim, 0.8)
    expect(agent(sim, 'watchman').mode).toBe('patrol')
  })

  it('a noise out of earshot, or one heard while hunting, changes nothing', async () => {
    const { sim } = await setup(watchman(), NODES.end as Point)
    stepWith(sim, [noise(0, 4, 3)])
    expect(agent(sim, 'watchman').mode).toBe('patrol')
    run(sim, 1 / 60, [move(0, -4)])
    expect(agent(sim, 'watchman').mode).toBe('hunt')
    stepWith(sim, [noise(0, -6, 9)])
    expect(agent(sim, 'watchman').mode).toBe('hunt')
  })

  it('waits at a step it refuses, and a still mode does nothing', async () => {
    const def = {
      ...watchman(),
      transitions: [
        { from: '*', to: 'stunned', when: [{ fact: 'self.blocked', is: true }, { timer: 0.5 }], priority: 1 },
      ],
    }
    const game = await createWardGame(sceneOf(def), { refuses: () => true }, ['shriek'])
    sims.push(game.sim)
    const { sim } = game
    stepWith(sim, [load({ watchman: NODES.cmid as Point }), move(3, 5)])
    const record = agent(sim, 'watchman')
    record.path = [{ x: (NODES.end as Point).x, z: (NODES.end as Point).z }]
    record.timer = 0
    run(sim, 20 / 60)
    expect(agent(sim, 'watchman').mode).toBe('patrol')
    expect(agentAt(sim, 'watchman').x).toBe((NODES.cmid as Point).x)
    expect(agent(sim, 'watchman').timer).toBeCloseTo(20 / 60)
    run(sim, 20 / 60)
    expect(agent(sim, 'watchman').mode).toBe('stunned')
    const before = structuredClone(agent(sim, 'watchman'))
    const where = agentAt(sim, 'watchman')
    run(sim, 30 / 60, [move(0.3, -4.2)])
    expect(agent(sim, 'watchman')).toEqual({ ...before, path: agent(sim, 'watchman').path })
    expect(agentAt(sim, 'watchman')).toEqual(where)
  })

  it('walks its routine, dwells at each stop, acts, and moves on', async () => {
    const { sim } = await setup(watchman(), NODES.end as Point)
    const seen = () => sim.resource(PuzzleState).facts.monitorSeen
    run(sim, 0.9)
    // At `end`, dwelling (1 s), not yet acted.
    expect(seen()).toBe(false)
    expect(agent(sim, 'watchman').patrol).toBe(0)
    run(sim, 0.2)
    // Acted, and set off to `cmid` (2.1 m at 1 m/s).
    expect(seen()).toBe(true)
    expect(agent(sim, 'watchman').patrol).toBe(1)
    run(sim, 0.5)
    expect(agent(sim, 'watchman').moving).toBe(true)
    run(sim, 2.3)
    // At `cmid`, dwelt 0.5 s, and on the way back to `end`.
    expect(agent(sim, 'watchman').patrol).toBe(0)
    expect(agent(sim, 'watchman').moving).toBe(true)
  })

  it('emits a mode change for every switch', async () => {
    const { sim } = await setup()
    const events = run(sim, 1 / 60, [move(0, -3.2)])
    expect(kinds(events, 'systems.mode')).toEqual([{ agent: 'watchman', from: 'patrol', to: 'hunt' }])
  })
})

it('places an agent by `place` before a step', async () => {
  const { sim } = await setup()
  place(sim, 'watchman', { x: 0, z: -5 })
  expect(agentAt(sim, 'watchman')).toEqual({ x: 0, z: -5 })
})
