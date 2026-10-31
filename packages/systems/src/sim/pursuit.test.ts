// Pursuit (M6 spec §4.6, the source's WP-19): the adventure source's `pursuit.test.ts` cases on the clinic through the
// real sim: zone crossings, door-follow, hiding and ambushes, and footfalls no agent hears. Not ported: `wallRing`
// (presentation, M6.4b) and `withHiding` (the game's verb wrapper, SY-D7). A crossing is seen one step after the
// player's move, since sectors decides her sector in `cleanup` (SY-D6).
import { clinicGraph, resolvedClinic } from '@mcthaydt/automata-nav/testing/clinic'
import type { Point } from '@mcthaydt/automata-sectors/sim'
import type { Sim, SimEvent } from '@mcthaydt/automata-sim'
import { afterEach, describe, expect, it } from 'vitest'
import { sceneOf } from '../testing/toy'
import { agent, agentAt, createWardGame, fact, kinds, load, move, stepWith } from '../testing/ward-game'
import { SystemsEnv, SystemsPursuit } from './systems.resource'
import type { Rule, SystemsDef } from './systems.schema'

const NODES = clinicGraph().nodes as Record<string, Point>
const STEP = 1 / 60
let sims: Sim[] = []
afterEach(() => {
  for (const sim of sims) sim.dispose()
  sims = []
})

/** A chaser that hunts what it sees, follows the player through doors, finds her if it saw her hide, else gives up. */
const toy = (o: { delay?: number; rules?: Rule[] } = {}): SystemsDef =>
  sceneOf(
    {
      id: 'chaser',
      modes: ['patrol', 'hunt', 'follow', 'ambush'],
      initial: 'hunt',
      speed: { patrol: 1, hunt: 2.2, follow: 2.2, ambush: 0 },
      senses: [
        { sight: { range: 4.5, wallsOnly: true } },
        { sound: { reach: 20 } },
        { touch: { radius: 0.62 } },
      ],
      transitions: [
        {
          from: '*',
          to: 'hunt',
          when: [{ sawHide: { radius: 4, los: true } }],
          priority: 95,
          do: [{ set: 'pursuit.hidden', to: '' }, { goTo: 'player' }],
        },
        {
          from: 'hunt',
          to: 'follow',
          when: [{ crossed: true }],
          priority: 90,
          do: [{ followThrough: { portal: 'crossed', delay: o.delay ?? 2, then: 'hunt' } }],
        },
        {
          from: 'follow',
          to: 'follow',
          when: [{ crossed: true }],
          priority: 89,
          do: [{ followThrough: { portal: 'crossed', delay: o.delay ?? 2, then: 'hunt' } }],
        },
        { from: 'hunt', to: 'hunt', when: [{ sees: true }], priority: 70, do: [{ goTo: 'player' }] },
        {
          from: 'hunt',
          to: 'hunt',
          when: [{ touching: true }],
          priority: 60,
          do: [{ emit: { caught: 'nurse' } }],
        },
        {
          from: 'hunt',
          to: 'patrol',
          when: [{ fact: 'self.idle', is: true }, { not: { sees: true } }, { timer: 1.5 }],
          priority: 30,
          do: [{ set: 'self.timer', to: 0 }],
        },
        {
          from: 'patrol',
          to: 'patrol',
          when: [{ heard: '*', reach: 20 }],
          priority: 20,
          do: [{ goTo: 'noise' }],
        },
      ],
    },
    { rules: o.rules ?? [] },
  )

async function setup(
  def: SystemsDef = toy(),
  at: Point = NODES.hallS as Point,
  player: Point = NODES.hallN as Point,
) {
  const game = await createWardGame(def)
  sims.push(game.sim)
  const { sim } = game
  const events: SimEvent[] = []
  let ada = { ...player }
  stepWith(sim, [
    load({ chaser: at }),
    move(player.x, player.z),
    { type: 'nav.door', payload: { door: 'closetDoor', open: true } },
  ])
  const chaser = () => agent(sim, 'chaser')
  const where = () => agentAt(sim, 'chaser')
  /** One step with the player at `p`. */
  const tick = (p: Point = ada) => {
    ada = { ...p }
    events.push(...stepWith(sim, [move(p.x, p.z)]).events)
  }
  const runFor = (seconds: number, p?: Point) => {
    for (let i = 0; i < Math.round(seconds / STEP); i++) tick(p)
  }
  /** Walks the player to `to` at 3 m/s, a step at a time. */
  const walk = (to: Point) => {
    const from = { ...ada }
    const n = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / (3 * STEP))
    for (let i = 1; i <= n; i++)
      tick({ x: from.x + ((to.x - from.x) * i) / n, z: from.z + ((to.z - from.z) * i) / n })
  }
  tick()
  return { sim, events, chaser, where, tick, run: runFor, walk, ada: () => ada }
}
const MAP = resolvedClinic()
const zoneAt = (p: Point) => MAP.sectorAt(p)?.zone
const pursuit = (sim: Sim) => sim.resource(SystemsPursuit)

describe('portals (B1)', () => {
  it('a crossing into another zone is noted for one step, with the portal and the spot just past it', async () => {
    const s = await setup(toy(), NODES.wardSouth as Point, { x: 0, z: -0.5 })
    expect(pursuit(s.sim)).toMatchObject({ sector: 'hall', crossed: null })
    s.tick({ x: 0, z: -1.0 })
    // Sectors places her in the mouth at the end of this step; the systems see it on the next.
    s.tick({ x: 0, z: -1.05 })
    expect(pursuit(s.sim).crossed).toMatchObject({ portal: 'hall>mouth', zone: 'corridor', x: 0, z: -0.875 })
    expect(zoneAt(pursuit(s.sim).crossed?.into as Point)).toBe('corridor')
    s.tick({ x: 0, z: -1.1 })
    expect(pursuit(s.sim).crossed).toBeNull()
    expect(pursuit(s.sim).last?.portal).toBe('hall>mouth')
  })

  it('a portal inside one zone (the hall into the ward alcove), or a teleport, is not a crossing', async () => {
    const s = await setup(toy(), NODES.wardSouth as Point, { x: -3, z: -0.5 })
    s.tick({ x: -3, z: -1.2 })
    s.tick()
    expect(pursuit(s.sim)).toMatchObject({ sector: 'ward', crossed: null })
    s.tick({ x: 3, z: -4.5 })
    s.tick()
    expect(pursuit(s.sim)).toMatchObject({ sector: 'closet', crossed: null })
  })
})

describe('door-follow (B1)', () => {
  /** The player runs from the hall up the corridor at 3 m/s; when the chaser starts following, and each step's chaser. */
  function flee(s: Awaited<ReturnType<typeof setup>>, to: number, seconds: number) {
    let crossed = -1
    const seen: { t: number; x: number; z: number }[] = []
    for (let t = 0; t < seconds; t += STEP) {
      s.tick({ x: 0, z: Math.max(to, s.ada().z - 3 * STEP) })
      if (crossed < 0 && s.chaser().mode === 'follow') crossed = t
      seen.push({ t, ...s.where() })
    }
    const jumps = seen
      .slice(1)
      .map((p, i) => ({ t: p.t, d: Math.hypot(p.x - (seen[i] as Point).x, p.z - (seen[i] as Point).z) }))
    return { crossed, jumps }
  }

  it('hunting, she follows the player through the door she took, and comes through it after the delay', async () => {
    // The chaser hunts from the ward's far side, too far behind to walk it in time.
    const s = await setup(toy(), NODES.wardSouth as Point, NODES.hallN as Point)
    const { crossed, jumps } = flee(s, -4.5, 3)
    expect(crossed).toBeGreaterThan(0)
    const appeared = jumps.find((j) => j.d > 0.5)
    expect((appeared?.t ?? 0) - crossed).toBeCloseTo(2, 1)
    // On the player's side of the door, just past it, hunting again.
    expect(zoneAt(s.where())).toBe('corridor')
    expect(s.chaser().mode).toBe('hunt')
    expect(jumps.filter((j) => j.d > 0.5)).toHaveLength(1)
  })

  it('never comes through within 1.5 m of the player: she waits at the door until the player is clear', async () => {
    // A slow follower, so she cannot walk through either.
    const def = structuredClone(toy()) as { agents: { speed: Record<string, number> }[] } & SystemsDef
    ;(def.agents[0] as { speed: Record<string, number> }).speed.follow = 0.05
    const s = await setup(def, NODES.wardSouth as Point, NODES.hallN as Point)
    const { crossed } = flee(s, -1.9, 1)
    expect(crossed).toBeGreaterThan(0)
    // The player lingers just inside the door: no appearance however long she stays.
    for (let i = 0; i < 5 / STEP; i++) {
      s.tick({ x: 0.4, z: -1.9 })
      expect(zoneAt(s.where())).toBe('hall')
    }
    expect(s.chaser().mode).toBe('follow')
    // She goes on up the corridor: the chaser comes through, never within 1.5 m of her.
    const { jumps } = flee(s, -4.5, 1.5)
    expect(jumps.find((j) => j.d > 0.5)).toBeDefined()
    expect(zoneAt(s.where())).toBe('corridor')
    expect(Math.hypot(s.ada().x, s.ada().z + 1.375)).toBeGreaterThanOrEqual(1.5)
  })

  it('close behind, she walks through on her own and takes up the hunt without appearing', async () => {
    const s = await setup(toy(), { x: 0, z: 0.9 }, { x: 0, z: -0.3 })
    s.chaser().goal = { x: 0, z: -0.3 }
    s.chaser().path = [{ x: 0, z: -0.3 }]
    const { crossed, jumps } = flee(s, -6, 2.5)
    expect(crossed).toBeGreaterThan(0)
    expect(Math.max(...jumps.map((j) => j.d))).toBeLessThan(2.2 * STEP + 1e-6)
    expect(s.chaser().mode).toBe('hunt')
    expect(zoneAt(s.where())).toBe('corridor')
  })

  it('a crossing she is not hunting for (patrolling) starts nothing', async () => {
    const s = await setup(toy(), NODES.wardSouth as Point, NODES.hallN as Point)
    s.chaser().mode = 'patrol'
    s.walk({ x: 0, z: -2.5 })
    expect(s.chaser().mode).toBe('patrol')
    expect(s.chaser().pending).toBeUndefined()
  })
})

const hide = (spot: string) => ({ type: 'systems.hide', payload: { spot } })

describe('hiding (B2)', () => {
  it('hidden unseen, the player is safe: the chaser cannot see or touch her, and leaves within 12 s', async () => {
    // The player in the supply room, the chaser hunting in the corridor, out of sight.
    const s = await setup(toy(), NODES.end as Point, { x: 4, z: -3.3 })
    s.chaser().mode = 'hunt'
    s.chaser().goal = { x: 4, z: -3.3 }
    stepWith(s.sim, [hide('toyLocker')])
    expect(pursuit(s.sim).hidden).toBe('toyLocker')
    let left = -1
    for (let t = 0; t < 14; t += STEP) {
      s.tick({ x: 4, z: -3.3 })
      if (left < 0 && s.chaser().mode === 'patrol') left = t
    }
    expect(kinds(s.events, 'systems.caught')).toEqual([])
    expect(left).toBeGreaterThan(0)
    expect(left).toBeLessThan(12)
    expect(pursuit(s.sim).hidden).toBe('toyLocker')
  })

  it('seen going in, she brings the player out and catches her', async () => {
    const s = await setup(toy(), { x: 3, z: -4.6 }, { x: 4, z: -3.3 })
    s.chaser().mode = 'hunt'
    stepWith(s.sim, [hide('toyLocker')])
    s.run(4, { x: 4, z: -3.3 })
    expect(pursuit(s.sim).hidden).toBe('')
    expect(kinds(s.events, 'systems.caught')).toContainEqual({ cause: 'nurse' })
  })

  it('a still agent (asleep) as she hid did not see her go in', async () => {
    const def = structuredClone(toy()) as {
      agents: { modes: string[]; speed: Record<string, number> }[]
    } & SystemsDef
    const chaser = def.agents[0] as { modes: string[]; speed: Record<string, number> }
    chaser.modes.push('dormant')
    chaser.speed.dormant = 0
    const s = await setup(def, { x: 3, z: -4.6 }, { x: 4, z: -3.3 })
    s.chaser().mode = 'dormant'
    stepWith(s.sim, [hide('toyLocker')])
    s.chaser().mode = 'hunt'
    s.run(1, { x: 4, z: -3.3 })
    expect(pursuit(s.sim).hidden).toBe('toyLocker')
  })

  it('moving brings the player out, as does systems.unhide', async () => {
    const s = await setup(toy(), NODES.end as Point, { x: 4, z: -3.3 })
    stepWith(s.sim, [hide('toyLocker')])
    s.sim.resource(SystemsEnv).moving = true
    s.tick()
    expect(pursuit(s.sim).hidden).toBe('')
    s.sim.resource(SystemsEnv).moving = false
    stepWith(s.sim, [hide('toyLocker')])
    expect(pursuit(s.sim).hiddenFor).toBeCloseTo(STEP)
    stepWith(s.sim, [{ type: 'systems.unhide', payload: {} }])
    expect(pursuit(s.sim).hidden).toBe('')
  })
})

describe('ambushes (B3)', () => {
  const ambushRule = (): Rule[] => [
    {
      id: 'doorAmbush',
      text: 'Once the trigger is set, she is in the supply room door.',
      when: [{ fact: 'monitorSeen', is: true }],
      then: [
        {
          ambush: {
            id: 'door',
            agent: 'chaser',
            mode: 'ambush',
            at: 'closet',
            sting: 0.6,
            grace: 2,
            then: 'hunt',
          },
        },
      ],
    },
  ]

  it('the sting comes 0.6 s before she appears; she holds for a 2 s grace, cannot catch in it, then hunts; once', async () => {
    const s = await setup(toy({ rules: ambushRule() }), NODES.wardSouth as Point, { x: 1.2, z: -4 })
    s.chaser().mode = 'patrol'
    stepWith(s.sim, [fact('monitorSeen', true), move(1.2, -4)])
    expect(s.chaser().mode).toBe('ambush')
    const at = s.where()
    s.run(0.55)
    expect(s.where()).toEqual(at)
    s.run(0.1)
    const closet = NODES.closet as Point
    expect(Math.hypot(s.where().x - closet.x, s.where().z - closet.z)).toBeLessThan(1e-9)
    // The player walks right up to her in the grace (0.47 s at 3 m/s): nothing happens.
    s.walk({ x: 2.6, z: -4 })
    s.run(2.6 - 0.65 - 0.47 - 0.05, { x: 2.6, z: -4 })
    expect(s.chaser().mode).toBe('ambush')
    expect(kinds(s.events, 'systems.caught')).toEqual([])
    s.run(0.2, { x: 2.6, z: -4 })
    expect(s.chaser().mode).toBe('hunt')
    expect(kinds(s.events, 'systems.caught').length).toBeGreaterThan(0)
    // Once only.
    s.chaser().mode = 'patrol'
    s.run(1, { x: -3, z: 4 })
    expect(s.chaser().mode).not.toBe('ambush')
    expect(pursuit(s.sim).ambushes).toEqual({ door: true })
  })
})

describe('steps through walls (B3)', () => {
  it('her footfalls are noises at her feet that no agent hears', async () => {
    const footfalls: Rule[] = [
      {
        id: 'footfalls',
        text: 'Her steps carry 9 m, through walls.',
        every: 0.5,
        when: [{ mode: 'patrol', agent: 'chaser' }],
        then: [{ noise: { at: 'chaser', loudness: 9, kind: 'footfall' } }],
      },
    ]
    const s = await setup(toy({ rules: footfalls }), NODES.closetN as Point, NODES.hallN as Point)
    s.chaser().mode = 'patrol'
    s.chaser().path = []
    s.chaser().goal = null
    const before = s.events.length
    s.run(1.1)
    const steps = kinds(s.events.slice(before), 'systems.noise') as { at: Point; kind: string }[]
    expect(steps.filter((n) => n.kind === 'footfall')).toHaveLength(2)
    expect(steps[0]?.at).toEqual({ x: (NODES.closetN as Point).x, z: (NODES.closetN as Point).z })
    // Heard by no agent: the patrolling chaser's noise transition never took it anywhere.
    expect(s.chaser().path).toEqual([])
  })
})
