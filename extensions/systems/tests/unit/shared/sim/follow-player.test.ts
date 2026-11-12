// A route made again on a clock. A rule has no agent of its own to send, and adding an `every` to the `goTo` effect would
// change the schema every systems snapshot carries, so a transition calls `followPlayer(every)`: a hook that routes the
// agent to the player now and again each `every` seconds while its mode holds. Without it `goTo` routes once, to where
// she was.
import { clinicGraph } from '@automataframework/nav/testing/clinic'
import type { Point } from '@automataframework/sectors/sim'
import { stepWith } from '@automataframework/sectors/testing'
import type { Sim } from '@automataframework/sim'
import { afterEach, describe, expect, it } from 'vitest'
import { followPlayer } from '#src/entries/sim.ts'
import type { AgentDef } from '#src/shared/sim/systems.schema.ts'
import { sceneOf } from '#src/testing/toy.ts'
import { agentAt, createWardGame, load, move, place } from '#src/testing/ward-game.ts'

const NODES = clinicGraph().nodes as Record<string, Point>
const HALL_N = NODES.hallN as Point
const STEP = 1 / 60
let sims: Sim[] = []
afterEach(() => {
  for (const sim of sims) sim.dispose()
  sims = []
})

const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.z - b.z)

/** A chaser that sets off for the player when the fact `go` holds: once (`goTo`), or on a clock (`followPlayer`). */
const chaser = (how: 'once' | 'clock'): AgentDef => ({
  id: 'chaser',
  modes: ['idle', 'hunt'],
  initial: 'idle',
  speed: { idle: 0, hunt: 2 },
  senses: [],
  ...(how === 'clock' ? { hooks: ['chase'] } : {}),
  transitions:
    how === 'once'
      ? [
          {
            from: 'idle',
            to: 'hunt',
            when: [{ fact: 'go', is: true }],
            priority: 2,
            do: [{ goTo: 'player' }],
          },
        ]
      : [
          {
            from: 'idle',
            to: 'hunt',
            when: [{ fact: 'go', is: true }],
            priority: 2,
            do: [{ call: 'chase' }],
          },
          { from: 'hunt', to: 'hunt', when: [], priority: 1, do: [{ call: 'chase' }] },
        ],
})

async function chase(how: 'once' | 'clock', every = 0.4) {
  const game = await createWardGame(sceneOf(chaser(how)), { hooks: { chase: followPlayer(every) } }, [], {})
  sims.push(game.sim)
  const { sim } = game
  stepWith(sim, [load({ chaser: NODES.hallS as Point }), move(HALL_N.x, HALL_N.z)])
  place(sim, 'chaser', NODES.hallS as Point)
  return {
    sim,
    /** Sets the chase off, lets the first route be made, moves the player to `then`, and runs on. */
    run(seconds: number, then: Point): Point {
      stepWith(sim, [{ type: 'ward.fact', payload: { name: 'go', value: true } }])
      for (let i = 0; i < 12; i++) stepWith(sim, [])
      stepWith(sim, [move(then.x, then.z)])
      for (let i = 0; i < Math.round(seconds / STEP); i++) stepWith(sim, [])
      return agentAt(sim, 'chaser')
    },
  }
}

describe('followPlayer', () => {
  const WARD = NODES.ward as Point

  it('without it the route is made once: the chaser walks to where she was', async () => {
    const at = await (await chase('once')).run(6, WARD)
    expect(dist(at, HALL_N)).toBeLessThan(0.3)
    expect(dist(at, WARD)).toBeGreaterThan(1)
  })

  it('with it the chaser follows a player who moved after the first route', async () => {
    const at = await (await chase('clock')).run(6, WARD)
    expect(dist(at, WARD)).toBeLessThan(0.5)
  })

  it('re-routes once for each `every` seconds, not each step', async () => {
    // Three seconds between routes: a second after she moved it has not yet turned for her new place, so it is where
    // the chaser that never re-routes is.
    const slow = await (await chase('clock', 3)).run(1, WARD)
    const once = await (await chase('once')).run(1, WARD)
    expect(dist(slow, once)).toBeLessThan(0.05)
    const quick = await (await chase('clock', 0.4)).run(1, WARD)
    expect(dist(quick, once)).toBeGreaterThan(0.3)
  })

  it('does nothing for a world rule, which has no agent to send', async () => {
    const hook = followPlayer(0.4)
    expect(() => hook({} as never, null)).not.toThrow()
  })
})
