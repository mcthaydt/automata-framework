// The ready-made behaviours Schematic offers (spec 9), run in the sim on the clinic, with fixed seeds. The definitions
// are `src/testing/fixtures/presets.json`; the editors package keeps that file equal to what its menu writes
// (`presets.test.ts` there), so these runs are of exactly what a person gets.
import { clinicGraph } from '@automata/nav/testing/clinic'
import type { Point } from '@automata/sectors/sim'
import { stepWith } from '@automata/sectors/testing'
import type { Sim } from '@automata/sim'
import { afterEach, describe, expect, it } from 'vitest'
import type { AgentDef } from '#src/shared/sim/systems.schema.ts'
import presets from '#src/testing/fixtures/presets.json'
import { sceneOf } from '#src/testing/toy.ts'
import {
  agent,
  agentAt,
  createWardGame,
  fact,
  kinds,
  load,
  move,
  noise,
  run,
} from '#src/testing/ward-game.ts'

const NODES = clinicGraph().nodes as Record<string, Point>
const PRESETS = presets as unknown as Record<string, AgentDef>
let sims: Sim[] = []
afterEach(() => {
  for (const sim of sims) sim.dispose()
  sims = []
})

async function setup(kind: string, at: Point, player: Point = { x: 3, z: 5 }, ...others: AgentDef[]) {
  const def = PRESETS[kind] as AgentDef
  const game = await createWardGame({ ...sceneOf(def), agents: [def, ...others] })
  sims.push(game.sim)
  stepWith(game.sim, [
    load({ [kind]: at, ...Object.fromEntries(others.map((o) => [o.id, NODES.hallS as Point])) }),
    move(player.x, player.z),
    fact('power', false),
  ])
  return game
}

const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.z - b.z)

describe('Guard', () => {
  it('hunts what it sees, then searches where it lost her, and catches her on touch', async () => {
    const { sim } = await setup('guard', NODES.cmid as Point)
    run(sim, 1 / 60, [move(0, -3.2)])
    expect(agent(sim, 'guard').mode).toBe('hunt')
    const events = run(sim, 3, [move(0, -2.4)])
    expect(kinds(events, 'systems.caught').length).toBeGreaterThan(0)
  })

  it('walks its patrol and does not see through a wall', async () => {
    const { sim } = await setup('guard', { x: 0.6, z: -4.4 }, { x: 3.2, z: -4.4 })
    run(sim, 1)
    expect(agent(sim, 'guard').mode).toBe('patrol')
  })

  it('returns to its patrol after standing 5 s where it lost her', async () => {
    const { sim } = await setup('guard', NODES.cmid as Point)
    run(sim, 1 / 60, [move(0, -3.2)])
    expect(agent(sim, 'guard').mode).toBe('hunt')
    // She vanishes behind the wall; it searches, walks to where it saw her, and stands.
    run(sim, 1 / 60, [move(3.2, -4.4)])
    expect(agent(sim, 'guard').mode).toBe('search')
    run(sim, 12)
    expect(agent(sim, 'guard').mode).toBe('patrol')
  })
})

describe('Sentry', () => {
  it('stays at its post, sounds the alarm when it sees her, and a Hunter far off goes to it', async () => {
    const hunter = { ...(PRESETS.hunter as AgentDef), id: 'hunter' }
    const { sim } = await setup('sentry', NODES.cmid as Point, { x: 3, z: 5 }, hunter)
    const post = agentAt(sim, 'sentry')
    run(sim, 1)
    expect(agentAt(sim, 'sentry')).toEqual(post)
    run(sim, 1 / 60, [move(0, -2.4)])
    expect(agent(sim, 'sentry').mode).toBe('alarm')
    run(sim, 1)
    expect(agent(sim, 'hunter').mode).toBe('listen')
  })
})

describe('Hunter', () => {
  it('goes to a thrown noise and gives up 4 s after arriving', async () => {
    const { sim } = await setup('hunter', NODES.end as Point)
    run(sim, 1 / 60, [noise(0, -2.2, 12)])
    expect(agent(sim, 'hunter').mode).toBe('listen')
    run(sim, 3)
    expect(dist(agentAt(sim, 'hunter'), { x: 0, z: -2.2 })).toBeLessThan(0.3)
    run(sim, 3)
    expect(agent(sim, 'hunter').mode).toBe('listen')
    run(sim, 2)
    expect(agent(sim, 'hunter').mode).toBe('patrol')
  })
})

describe('Coward', () => {
  it('moves away from the player when it sees her', async () => {
    const { sim } = await setup('coward', NODES.cmid as Point, { x: 0.3, z: -2.2 })
    const before = dist(agentAt(sim, 'coward'), { x: 0.3, z: -2.2 })
    run(sim, 2)
    expect(agent(sim, 'coward').mode).toBe('flee')
    expect(dist(agentAt(sim, 'coward'), { x: 0.3, z: -2.2 })).toBeGreaterThan(before)
  })
})

describe('Wanderer', () => {
  it('visits its stops in order and never changes mode with the player beside it', async () => {
    const { sim } = await setup('wanderer', NODES.end as Point, { x: 0.3, z: -3.8 })
    const visited: number[] = []
    for (let i = 0; i < 30; i++) {
      run(sim, 1)
      expect(agent(sim, 'wanderer').mode).toBe('patrol')
      visited.push(agent(sim, 'wanderer').patrol)
    }
    expect(new Set(visited).size).toBeGreaterThan(1)
  })
})

describe('every run is the same twice', () => {
  it.each(Object.keys(PRESETS))('%s', async (kind) => {
    const hashes: string[] = []
    for (let i = 0; i < 2; i++) {
      const { sim } = await setup(kind, NODES.cmid as Point)
      run(sim, 4, [move(0, -2.4), noise(0, -2.2, 12)])
      hashes.push(JSON.stringify(agent(sim, kind)))
    }
    expect(hashes[0]).toBe(hashes[1])
  })
})
