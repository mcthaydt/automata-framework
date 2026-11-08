// Fleeing picks the place to run to: far from what it flees, and by a way that does not go past it. A corridor whose
// farthest place lies beyond the player used to send the fleer straight at the player.
import { NavDoors, NavGraphResource } from '@automata/nav/sim'
import type { Point } from '@automata/sectors/sim'
import { stepWith } from '@automata/sectors/testing'
import { describe, expect, it } from 'vitest'
import { fleeNode } from '#src/shared/sim/effect.ts'
import { SystemsState } from '#src/shared/sim/systems.resource.ts'
import type { AgentDef } from '#src/shared/sim/systems.schema.ts'
import type { SystemsWorld } from '#src/shared/sim/world.ts'
import { sceneOf } from '#src/testing/toy.ts'
import { agent, agentAt, createWardGame, load, move, run } from '#src/testing/ward-game.ts'

type Edge = [string, string]

/** A world of open ground (nothing blocks a walk) with these nodes and edges, the fleer `runner` at `from`. */
function world(nodes: Record<string, Point>, edges: Edge[], from: Point): SystemsWorld {
  const resources = new Map<unknown, unknown>([
    [SystemsState, { reserved: {} }],
    [NavDoors, { open: {} }],
    [NavGraphResource, { nodes, edges }],
  ])
  return {
    ctx: { resource: (token: unknown) => resources.get(token) },
    graph: { nodes, edges },
    env: { lights: [] },
    at: { runner: from },
    walk: { segment: () => false, open: () => true },
  } as unknown as SystemsWorld
}

// a ---- b ---- c ------------ d, along z = 0, in metres.
const CORRIDOR = {
  a: { x: 0, z: 0 },
  b: { x: 4, z: 0 },
  c: { x: 8, z: 0 },
  d: { x: 20, z: 0 },
}
const LINE: Edge[] = [
  ['a', 'b'],
  ['b', 'c'],
  ['c', 'd'],
]

describe('fleeNode', () => {
  it('runs away from the player along the way that is clear', () => {
    // The player is east of the runner, so the west end is the way out, though the east end is the farthest place.
    const w = world(CORRIDOR, LINE, { x: 3, z: 0 })
    expect(fleeNode(w, 'runner', { x: 6, z: 0 })).toEqual({ x: 0, z: 0 })
  })

  it('still takes the farthest place when the way to it does not pass the player', () => {
    // The player stands off the corridor, 5 m to the side: the far east end is farthest, and nothing is in the way.
    const w = world(CORRIDOR, LINE, { x: 3, z: 0 })
    expect(fleeNode(w, 'runner', { x: 0, z: 5 })).toEqual({ x: 20, z: 0 })
  })

  it('is cornered when every way passes the player, and then runs as it always did', () => {
    // The only place to run to lies past the player.
    const w = world({ b: { x: 10, z: 0 } }, [['a', 'b']], { x: 0, z: 0 })
    expect(fleeNode(w, 'runner', { x: 5, z: 0 })).toEqual({ x: 10, z: 0 })
  })
})

// The same, in the clinic's own sim, with its walls and nav graph: a corridor runs north from the hall to a dead end, and
// the runner is in it with the player between it and the hall. The farthest place is the ward, past the player.
describe('a runner in the clinic corridor', () => {
  it('does not run through the player to get to the hall', async () => {
    const runner: AgentDef = {
      id: 'runner',
      modes: ['stand', 'flee'],
      initial: 'stand',
      speed: { stand: 0, flee: 2 },
      senses: [{ sight: { range: 8 } }],
      transitions: [
        { from: 'stand', to: 'flee', priority: 10, when: [{ sees: true }], do: [{ flee: 'player' }] },
      ],
    }
    const game = await createWardGame({ ...sceneOf(runner), agents: [runner] })
    try {
      stepWith(game.sim, [load({ runner: { x: 0.3, z: -4 } }), move(0, -1.9)])
      let nearest = Number.POSITIVE_INFINITY
      let southmost = Number.NEGATIVE_INFINITY
      for (let i = 0; i < 6 * 60; i++) {
        run(game.sim, 1 / 60)
        const at = agentAt(game.sim, 'runner')
        nearest = Math.min(nearest, Math.hypot(at.x - 0, at.z + 1.9))
        southmost = Math.max(southmost, at.z)
      }
      expect(agent(game.sim, 'runner').mode).toBe('flee')
      // It keeps its distance: never within the clearance, and never south of the player at the corridor's mouth.
      expect(nearest).toBeGreaterThanOrEqual(1.5)
      expect(southmost).toBeLessThan(-1.9)
    } finally {
      game.sim.dispose()
    }
  })
})
