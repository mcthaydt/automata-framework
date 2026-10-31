import { createSim, type Sim } from '@mcthaydt/automata-sim'
import { recordGoldenEvidence } from '@mcthaydt/evidence/golden'
import { describe, expect, it } from 'vitest'
import { Drop, Enemy, Fighter, Target } from './components.ts'
import {
  angerSkip,
  BrainState,
  DropKind,
  dropOf,
  ENEMIES,
  ENEMY_MOVES,
  MAX_TOKENS,
  RING_FAR,
  RING_NEAR,
} from './constants/enemies.ts'
import { CombatState, type MoveDef, metres } from './constants/index.ts'
import { Location, Progress } from './resources.ts'
import { base3dSim, spawnArea } from './state/index.ts'
import { type Area, type AreaSource, compileArea, compileWorld } from './systems/index.ts'
import { FIGHT_YARD } from './testing/fight-yard.ts'
import {
  distance,
  enemy,
  enemyKind,
  fighter,
  foeArea,
  foes,
  hitKinds,
  kindOf,
  MOVES,
  place,
  slashes,
  startFoes,
  stepUntil,
  wickSid,
} from './testing/foes.ts'
import {
  commandsFor,
  GAME_PLUGINS,
  GAME_SIM,
  hero,
  run,
  startSim,
  type TickInput,
  UP,
} from './testing/sim.ts'

// base-3d's enemies (GAME-3D.1d, DESIGN.md §8): the three types' brains, the attack tokens and the drops, in the sim.
// The browsers project runs this file in Chromium, WebKit and Firefox too, so its scenes hold in four engines.

describe('the enemy tables (DESIGN.md §8.1, §8.2)', () => {
  it('gives every attack an enemy opens with a windup of at least 24 ticks, even angry (G3-l)', () => {
    const followUps = new Set(ENEMY_MOVES.map((move) => move.next))
    for (const type of ENEMIES)
      for (const id of type.attacks) {
        const move = ENEMY_MOVES.find((candidate) => candidate.id === id) as MoveDef
        expect(followUps.has(id), id).toBe(false)
        const shortened = type.anger === undefined ? 0 : angerSkip(move, true)
        expect(move.active[0] - 1 - shortened, `${type.id}: ${id}`).toBeGreaterThanOrEqual(24)
      }
    // Angry, the Captain's chop and its combo's first chop lose 4 ticks (26); its bash keeps its 24.
    const windup = (id: string) => {
      const move = ENEMY_MOVES.find((candidate) => candidate.id === id) as MoveDef
      return move.active[0] - 1 - angerSkip(move, true)
    }
    expect(['captain-chop-1', 'knight-chop', 'knight-bash'].map(windup)).toEqual([26, 26, 24])
  })

  it('chains a combo’s second chop with a windup of its own: 20 ticks, 16 angry (§8.3)', () => {
    const second = ENEMY_MOVES.find((move) => move.id === 'captain-chop-2') as MoveDef
    expect(ENEMY_MOVES.find((move) => move.id === 'captain-chop-1')?.next).toBe('captain-chop-2')
    expect(second.active[0] - 1).toBe(20)
    expect(second.active[0] - 1 - angerSkip(second, false)).toBe(16)
  })

  it('names only moves in the table, each with a hit', () => {
    for (const enemy of ENEMIES)
      for (const id of enemy.attacks) {
        const move = ENEMY_MOVES.find((candidate) => candidate.id === id)
        expect(move?.hit, `${enemy.id}: ${id}`).toBeDefined()
      }
  })

  it('has the three types with §8.2’s health (in damage units: two slashes kill a Sootling)', () => {
    expect(ENEMIES.map(({ id, health }) => [id, health])).toEqual([
      ['sootling', 2],
      ['ash-knight', 6],
      ['wisp', 2],
      ['ash-captain', 14],
      ['warden', 24],
    ])
  })
})

describe('an area’s foes', () => {
  it('spawn with their type’s health and cylinder, lockable, facing as authored', async () => {
    const sim = await startFoes([
      { kind: 'sootling', x: 2, z: 9 },
      { kind: 'wisp', x: -3, z: 9, facing: 90 },
    ])
    const [sootling, wisp] = foes(sim)
    expect(sootling?.get(Enemy)).toMatchObject({
      kind: kindOf('sootling'),
      brain: BrainState.idle,
      token: false,
    })
    expect(sootling?.get(Fighter)).toMatchObject({
      side: 1,
      health: 2,
      radius: metres(0.3),
      height: metres(0.9),
      lift: 0,
    })
    expect(sootling?.get(Target)).toEqual({ x: metres(2), z: metres(9), facing: 0 })
    expect(wisp?.get(Fighter)).toMatchObject({ health: 2, lift: metres(2.2) })
    expect(wisp?.get(Target)?.facing).toBe(16_384)
    sim.dispose()
  })

  it('reject an unknown kind', () => {
    expect(() => foeArea([{ kind: 'dragon', x: 2, z: 2 }])).toThrow(/unknown enemy "dragon"/)
  })
})

describe('a brain (DESIGN.md §8.1 rule 5)', () => {
  it('paces at home while Wick is farther than it notices', async () => {
    // 6.5 m away, facing +x: it paces 1 m along x and back, and never turns to him.
    const sim = await startFoes([{ kind: 'sootling', x: 0, z: 6.5, facing: 90 }])
    const [sid] = foes(sim).map((entity) => entity.sid) as [number]
    run(sim, {}, 60)
    expect(enemy(sim, sid)?.brain).toBe(BrainState.idle)
    expect(place(sim, sid)).toMatchObject({ x: metres(1), z: metres(6.5), facing: 16_384 })
    run(sim, {}, 120)
    expect(place(sim, sid)).toMatchObject({ x: 0, z: metres(6.5) })
    run(sim, {}, 60)
    expect(enemy(sim, sid)?.brain).toBe(BrainState.idle)
    sim.dispose()
  })

  it('notices Wick at 6 m, turns to him, closes to its reach and attacks', async () => {
    const sim = await startFoes([{ kind: 'sootling', x: 0, z: 5.9 }])
    const [sid] = foes(sim).map((entity) => entity.sid) as [number]
    run(sim, {})
    expect(enemy(sim, sid)?.brain).toBe(BrainState.notice)
    stepUntil(sim, () => enemy(sim, sid)?.brain === BrainState.attack)
    expect(place(sim, sid)?.facing).toBe(32_768)
    expect(distance(sim, sid)).toBeLessThanOrEqual(metres(1.61))
    expect(distance(sim, sid)).toBeGreaterThan(metres(1.5))
    expect(enemy(sim, sid)?.token).toBe(true)
    expect(MOVES[(fighter(sim, sid)?.move ?? 0) - 1]?.id).toBe('sootling-lunge')
    sim.dispose()
  })

  it('does not notice Wick behind a wall', async () => {
    const sim = await startFoes([{ kind: 'sootling', x: 0, z: 4 }], [{ min: [-3, 1.9], max: [3, 2.1] }])
    const [sid] = foes(sim).map((entity) => entity.sid) as [number]
    run(sim, {}, 30)
    expect(enemy(sim, sid)?.brain).toBe(BrainState.idle)
    sim.dispose()
  })
})

describe('attacks (DESIGN.md §8.1 rule 1, §8.2)', () => {
  /** A Sootling at 1.6 m ahead of Wick, facing him, stepped until its brain starts its bite; returns that tick. */
  const biting = async () => {
    const sim = await startFoes([{ kind: 'sootling', x: 0, z: 1.6, facing: 180 }])
    const [sid] = foes(sim).map((entity) => entity.sid) as [number]
    stepUntil(sim, () => enemy(sim, sid)?.brain === BrainState.attack)
    return { sim, sid }
  }

  it('lands the Sootling’s bite on its 31st frame, after a 30-tick windup, for a half-heart', async () => {
    const { sim } = await biting()
    // Frame 1 played on the tick the bite started; 29 more windup frames, then the first active one.
    run(sim, {}, 29)
    expect(fighter(sim, wickSid(sim))?.health).toBe(8)
    const events = run(sim, {})
    expect(events).toContain(`hit.landed@${sim.tick}`)
    expect(fighter(sim, wickSid(sim))?.health).toBe(7)
    sim.dispose()
  })

  it('carries the Sootling a metre forward over the bite’s active frames', async () => {
    const { sim, sid } = await biting()
    const before = place(sim, sid)?.z as number
    // Its 33 frames, and the bite's 3 ticks of hitstop.
    run(sim, {}, 36)
    expect(before - (place(sim, sid)?.z as number)).toBeGreaterThanOrEqual(metres(1) - 3)
    expect(before - (place(sim, sid)?.z as number)).toBeLessThanOrEqual(metres(1))
    sim.dispose()
  })

  it('stops a bite Wick blocks: no damage, the Sootling stunned, its move over and its token given up', async () => {
    const { sim, sid } = await biting()
    const events = run(sim, { act: { guard: true } }, 30)
    expect(events.filter((event) => event.startsWith('hit.landed'))).toHaveLength(1)
    expect(fighter(sim, wickSid(sim))?.health).toBe(8)
    expect(fighter(sim, sid)).toMatchObject({ state: CombatState.stun, move: 0 })
    // Past the block's hitstop, its brain sees it reeling.
    run(sim, { act: { guard: true } }, 5)
    expect(enemy(sim, sid)).toMatchObject({ token: false, brain: BrainState.recover })
    sim.dispose()
  })

  it('kills a Sootling with two slashes (G3-m)', async () => {
    const sim = await startFoes([{ kind: 'sootling', x: 0, z: 1.2, facing: 180 }])
    const [sid] = foes(sim).map((entity) => entity.sid) as [number]
    const events = [...run(sim, { act: { slash: true } }), ...run(sim, {}, 9)]
    expect(fighter(sim, sid)?.health).toBe(1)
    events.push(...run(sim, { act: { slash: true } }), ...run(sim, {}, 20))
    expect(events.filter((event) => event.startsWith('foe.defeated'))).toHaveLength(1)
    expect(sim.entity(sid)).toBeUndefined()
    sim.dispose()
  })
})

describe('attack tokens (DESIGN.md §8.1 rules 2 and 3, G3-l)', () => {
  /** Steps `ticks` of `input`, checking on every tick that at most 2 hold a token and none attacks without one. */
  const watched = (sim: Sim, ticks: number, input: TickInput = {}) => {
    for (let i = 0; i < ticks; i++) {
      run(sim, input)
      const rows = foes(sim).map((entity) => ({ ...entity.get(Enemy), ...entity.get(Fighter) }))
      expect(rows.filter((row) => row.token).length).toBeLessThanOrEqual(MAX_TOKENS)
      for (const row of rows) if (row.state === CombatState.act) expect(row.token).toBe(true)
    }
  }

  it('lets two of three Sootlings attack; the third keeps the ring until a holder is hit, then takes its token', async () => {
    const sim = await startFoes([
      { kind: 'sootling', x: 0, z: 1.5, facing: 180 },
      { kind: 'sootling', x: -2, z: -1.5 },
      { kind: 'sootling', x: 2.5, z: -2.5 },
    ])
    const [first, second, third] = foes(sim).map((entity) => entity.sid) as [number, number, number]
    watched(sim, 24)
    expect([first, second, third].map((sid) => enemy(sim, sid)?.token)).toEqual([true, true, false])
    expect(enemy(sim, third)?.brain).toBe(BrainState.circle)
    expect(distance(sim, third)).toBeGreaterThanOrEqual(RING_NEAR - metres(0.05))
    expect(distance(sim, third)).toBeLessThanOrEqual(RING_FAR + metres(0.05))
    // Wick cuts the first one in its windup: it loses its token on the first tick after the hitstop, and the third
    // takes it on that same tick.
    watched(sim, 1, { act: { slash: true } })
    watched(sim, 10)
    expect(fighter(sim, first)?.state).toBe(CombatState.stun)
    expect([first, second, third].map((sid) => enemy(sim, sid)?.token)).toEqual([false, true, true])
    watched(sim, 300)
    sim.dispose()
  })
})

describe('the Ash Knight (DESIGN.md §8.2, G3-m)', () => {
  const knight = async (facing: number) => {
    const sim = await startFoes([{ kind: 'ash-knight', x: 0, z: 1.2, facing }])
    return { sim, sid: foes(sim)[0]?.sid as number }
  }

  it('blocks a frontal slash with its shield: no damage', async () => {
    const { sim, sid } = await knight(180)
    expect(slashes(sim)).toEqual(['block'])
    expect(fighter(sim, sid)).toMatchObject({ health: 6, state: CombatState.idle })
    sim.dispose()
  })

  it('takes a slash from behind', async () => {
    const { sim, sid } = await knight(0)
    expect(slashes(sim)).toEqual(['hit'])
    expect(fighter(sim, sid)?.health).toBe(5)
    sim.dispose()
  })

  it('staggers 28 ticks when its chop is parried, and takes double from the next slash', async () => {
    const { sim, sid } = await knight(180)
    stepUntil(sim, () => enemy(sim, sid)?.brain === BrainState.attack)
    expect(MOVES[(fighter(sim, sid)?.move ?? 0) - 1]?.id).toBe('knight-chop')
    // The chop's contact is on frame 31; the shield goes up 5 ticks before it.
    hitKinds(sim, {}, 24)
    expect(hitKinds(sim, { act: { guard: true } }, 6)).toEqual(['parry'])
    expect(fighter(sim, sid)).toMatchObject({ state: CombatState.stagger, stun: 28 })
    hitKinds(sim, {}, 14) // the parry's hitstop
    expect(slashes(sim)).toEqual(['hit'])
    expect(fighter(sim, sid)?.health).toBe(4)
    expect(fighter(sim, wickSid(sim))?.health).toBe(8)
    sim.dispose()
  })

  it('bashes Wick about 3 m back, without damage', async () => {
    const { sim, sid } = await knight(180)
    // Its third attack is the bash.
    sim.entity(sid)?.set(Enemy, { attacks: 2 })
    stepUntil(sim, () => enemy(sim, sid)?.brain === BrainState.attack)
    expect(MOVES[(fighter(sim, sid)?.move ?? 0) - 1]?.id).toBe('knight-bash')
    const before = hero(sim).z
    expect(hitKinds(sim, {}, 60)).toEqual(['hit'])
    expect(fighter(sim, wickSid(sim))?.health).toBe(8)
    expect(before - hero(sim).z).toBeGreaterThan(metres(2.8))
    expect(before - hero(sim).z).toBeLessThan(metres(3.2))
    sim.dispose()
  })
})

describe('the Wisp (DESIGN.md §8.2, G3-m)', () => {
  // A stand-in for 1e's sling pellet: a hit reaching 3 m ahead and 3 m up, without damage.
  const PELLET: MoveDef = {
    id: 'test-pellet',
    total: 10,
    active: [1, 1],
    hit: { near: 0, far: metres(3), bottom: 0, top: metres(3), dmg: 0, stop: 2, stun: 10, kb: 0, power: 1 },
  }
  const wisp = async (z: number) => {
    const sim = await startSim(foeArea([{ kind: 'wisp', x: 0, z, facing: 180 }]), [...MOVES, PELLET])
    return { sim, sid: foes(sim)[0]?.sid as number }
  }

  it('hovers out of the sword’s reach', async () => {
    const { sim, sid } = await wisp(1.2)
    expect(hitKinds(sim, { act: { slash: true } }, 12)).toEqual([])
    expect(fighter(sim, sid)?.health).toBe(2)
    sim.dispose()
  })

  it('drops to the floor for 120 ticks when a shot hits it, where two slashes finish it', async () => {
    const { sim, sid } = await wisp(1.2)
    // A sling stand-in beside Wick, on his side, shooting ahead.
    const sling = sim.spawn([
      [Target, { x: metres(0.2), z: 0, facing: 0 }],
      [Fighter, { side: 0, health: 6, radius: metres(0.3), height: metres(1.6) }],
    ])
    sim.entity(sling)?.set(Fighter, {
      move: [...MOVES, PELLET].length,
      moveTick: 0,
      moveStart: sim.tick,
      state: CombatState.act,
    })
    expect(hitKinds(sim, {})).toEqual(['hit'])
    expect(fighter(sim, sid)).toMatchObject({ state: CombatState.stun, stun: 120, lift: 0 })
    hitKinds(sim, {}, 2) // the pellet's hitstop
    const kinds = [...hitKinds(sim, { act: { slash: true } }), ...hitKinds(sim, {}, 9)]
    kinds.push(...hitKinds(sim, { act: { slash: true } }), ...hitKinds(sim, {}, 20))
    expect(kinds).toEqual(['hit', 'hit'])
    expect(sim.entity(sid)).toBeUndefined()
    sim.dispose()
  })

  it('dives onto an open Wick, and a block stops the dive', async () => {
    const open = await wisp(2.5)
    stepUntil(open.sim, () => enemy(open.sim, open.sid)?.brain === BrainState.attack)
    expect(hitKinds(open.sim, {}, 60)).toEqual(['hit'])
    expect(fighter(open.sim, wickSid(open.sim))?.health).toBe(7)
    open.sim.dispose()

    const guarded = await wisp(2.5)
    stepUntil(guarded.sim, () => enemy(guarded.sim, guarded.sid)?.brain === BrainState.attack)
    expect(hitKinds(guarded.sim, { act: { guard: true } }, 60)).toEqual(['block'])
    expect(fighter(guarded.sim, wickSid(guarded.sim))?.health).toBe(8)
    guarded.sim.dispose()
  })
})

describe('drops (DESIGN.md §8.1 rule 6)', () => {
  it('maps a roll of 0 to 9 onto the table: 30% nothing, 40% an ember, 20% five, 10% a heart', () => {
    const table = Array.from({ length: 10 }, (_, roll) => dropOf(roll))
    expect(table).toEqual([
      undefined,
      undefined,
      undefined,
      ...Array.from({ length: 4 }, () => ({ kind: DropKind.ember, amount: 1 })),
      { kind: DropKind.ember, amount: 5 },
      { kind: DropKind.ember, amount: 5 },
      { kind: DropKind.heart, amount: 1 },
    ])
  })

  it('leaves what the seeded roll names where the foe fell, and the same for the same seed', async () => {
    const outcomes = new Set<string>()
    const killed = async (seed: number) => {
      const sim = await createSim({
        ...GAME_SIM,
        seed,
        content: { areas: [foeArea([{ kind: 'sootling', x: 0, z: 1.2, facing: 180 }])], moves: MOVES },
      })
      spawnArea(sim, foeArea([{ kind: 'sootling', x: 0, z: 1.2, facing: 180 }]))
      const at = foes(sim)[0]?.get(Target)
      run(sim, { act: { slash: true } })
      run(sim, {}, 9)
      run(sim, { act: { slash: true } })
      run(sim, {}, 20)
      const drops = sim.query(Drop).map((entity) => entity.get(Drop))
      sim.dispose()
      return { at, drops }
    }
    for (let seed = 1; seed <= 40; seed++) {
      const { at, drops } = await killed(seed)
      expect(drops.length).toBeLessThanOrEqual(1)
      const [drop] = drops
      if (drop !== undefined) expect(Math.abs(drop.z - (at?.z ?? 0))).toBeLessThan(metres(0.5))
      outcomes.add(drop === undefined ? 'none' : `${drop.kind}x${drop.amount}`)
    }
    expect([...outcomes].sort()).toEqual(['1x1', '1x5', '2x1', 'none'])
    expect(await killed(7)).toEqual(await killed(7))
  })

  it('gives Wick an ember he walks over, and heals a heart up to his 4', async () => {
    const sim = await startFoes([])
    sim.spawn([[Drop, { x: 0, z: metres(1), kind: DropKind.ember, amount: 5 }]])
    sim.spawn([[Drop, { x: 0, z: metres(2), kind: DropKind.heart, amount: 1 }]])
    sim.spawn([[Drop, { x: 0, z: metres(3), kind: DropKind.heart, amount: 1 }]])
    sim.entity(wickSid(sim))?.set(Fighter, { health: 5 })
    const events = run(sim, { stick: UP }, 50)
    expect(events.filter((event) => event.startsWith('drop.taken'))).toHaveLength(3)
    expect(sim.resource(Progress).embers).toBe(5)
    expect(fighter(sim, wickSid(sim))?.health).toBe(8)
    expect(sim.query(Drop)).toHaveLength(0)
    sim.dispose()
  })
})

describe('the area swap (DESIGN.md §13)', () => {
  it('clears the old area’s dummies, foes and drops, and stands the new area’s foes', async () => {
    const room: Pick<AreaSource, 'views' | 'rooms'> = {
      views: [{ id: 'open', yawDeg: 0 }],
      rooms: [{ view: 'open', min: [-10, -10], max: [10, 10] }],
    }
    const world = compileWorld(
      [
        {
          id: 'here',
          spawn: { x: 0, z: 0 },
          ...room,
          walls: [],
          targets: [{ x: -5, z: -5 }],
          foes: [{ kind: 'wisp', x: 5, z: -8 }],
          ember: { x: 9, z: 9 },
          exits: [{ min: [-1, 2], max: [1, 3], to: 'there', entry: { x: 0, z: -5 } }],
        },
        {
          id: 'there',
          spawn: { x: 0, z: 0 },
          ...room,
          walls: [],
          targets: [],
          foes: [{ kind: 'ash-knight', x: 0, z: 8 }],
          ember: { x: 9, z: 9 },
        },
      ],
      MOVES,
    )
    const sim = await createSim({ ...GAME_SIM, content: world })
    spawnArea(sim, world.areas[0] as Area)
    sim.spawn([[Drop, { x: metres(8), z: 0, kind: DropKind.ember, amount: 1 }]])
    stepUntil(sim, () => sim.resource(Location).area === 1, 120, { stick: UP })
    // Only the knight stands, where it was authored (it has just noticed Wick: it may have taken a step).
    const targets = sim.query(Target).map((entity) => entity.get(Target))
    expect(targets).toHaveLength(1)
    expect(Math.abs((targets[0]?.z ?? 0) - metres(8))).toBeLessThan(metres(0.1))
    expect(foes(sim).map((entity) => enemyKind(entity.get(Enemy).kind))).toEqual(['ash-knight'])
    expect(sim.query(Drop)).toHaveLength(0)
    sim.dispose()
  })
})

// The fights golden (B-a, G3-b's two fights and its parry until GAME-3D.1i authors D1 and D2): a scripted run through
// the fight yard, from the game's own sim spec, which Node records and Chromium, WebKit and Firefox must end on bit
// for bit. Investigate a change; never rebaseline it per engine.
type RouteSegment = readonly [input: TickInput, ticks: number]
const TOWARD_MINUS_X = { x: 50, y: -110 } // ahead and toward −x: the stick's x runs opposite to the world's here
const FIGHTS_ROUTE: readonly RouteSegment[] = [
  [{}, 60], // the Sootling notices Wick and closes in
  [{ act: { guard: true } }, 40], // its bite is blocked (the shield up 33 ticks: a block, not a parry)
  [{}, 12], // blockstun
  [{ stick: TOWARD_MINUS_X }, 4], // turned toward it, reeling
  [{ act: { slash: true } }, 1], // slash-1
  [{}, 9],
  [{ act: { slash: true } }, 1], // slash-2 on slash-1's frame 10: the Sootling falls and leaves an ember
  [{}, 30],
  [{ stick: UP }, 40], // north, until the Ash Knight notices him
  [{ lock: true }, 178], // locked on, waiting while it closes in and raises its sword
  [{ lock: true, act: { guard: true } }, 6], // the shield up 5 ticks before the chop: a parry
  [{ lock: true }, 14], // the parry's hitstop
  [{ lock: true, act: { slash: true } }, 1], // slash-1 on the staggered knight: double damage
  [{ lock: true }, 8],
  [{ lock: true, act: { slash: true } }, 1], // slash-2
  [{ lock: true }, 10],
  [{ lock: true, act: { slash: true } }, 1], // the thrust knocks it down at 1 health
  [{ lock: true }, 230], // it rises, recovers, closes in and chops again
  [{ lock: true, act: { guard: true } }, 6], // a second parry
  [{ lock: true }, 14],
  [{ lock: true, act: { slash: true } }, 1], // and the slash that ends it: five embers fall
  [{}, 30],
  [{ stick: { x: -40, y: -110 } }, 16], // over the knight's embers
  [{ stick: { x: 60, y: 115 } }, 40], // and back over the Sootling's
  [{}, 10],
]
/**
 * The fights golden's hash after the whole route, with seed 1 (recorded in Node). Re-recorded for GAME-3D.1d part 2
 * (was `e230d634075f5dde`): the content gained the Captain (its type, its two chops, `vents`) and the schema the
 * `enemy` fields `follow`, `calls`, `called` and the `captain.defeated` event. The yard has no Captain and no vent,
 * so its events, tokens, embers, health and ticks are unchanged, and still asserted below. Re-recorded for part 3
 * (was `a41116f82fa68a84`): the Warden's type and moves in the content, `enemy.phase` and the `boss.*` events in
 * the schema; the yard has no Warden, so the same assertions hold unchanged. Re-recorded for part 4 (was
 * `276ca92fcddd55ea`): the enemy moves' `clip` names in the content and `foe.defeated`'s `x` and `z` in the schema;
 * the same events, tokens, embers, health and ticks, still asserted below. Re-recorded for GAME-3D.1e part 1 (was
 * `72f569192c8c293d`): the schema gained `act.item`, the `inventory` resource, the `pellet` component, the `shot.fired` event and the `item.use` and `pellet.fly` systems, and the content the sling's move; nothing on the route fires it, so the same assertions hold. Re-recorded for part 2 (was `bf79815307dba14c`):
 * the schema gained the `bomb` component, the `bomb.blast` event and the `bomb.fuse` system, and the content the bomb's blast move and `wickDmg`; Wick owns no items in the yard, so the drops roll as before (6 embers) and the same assertions hold. Re-recorded for
 * part 3 (was `b8c81523f5712ca5`) and part 4 (was `b7d6c15114c2ba92`, the schema gained `progress.maxHealth`, the `equip` command and the `item.equip` system): the schema gained the `chain` component, the `chain.hooked` event, `shot.fired`'s `hookchain` and the `chain.fly` system, and each area's content its `posts`; the same assertions hold. Re-recorded for GAME-3D.1f part 1 (was `59b84ddde6bfeb94`): the schema gained the `sling-target` component and the `sling-target.hit` event, and each area's content its `entities` in place of `posts` (the first slice has none); every other assertion is unchanged. Re-recorded for GAME-3D.1f part 2 (was `7dd808482d9dd9bc`): the schema gained the `door` component, the `dungeon` resource, the `door.opened` event and the `dungeon.doors` and `dungeon.visit` systems (the walls now include closed doors; there are none here); every other assertion is unchanged. Re-recorded for GAME-3D.1f part 3 (was `309c87cc6b57a8d2`): the schema gained the `switch` and `block` components, the `switch.changed` and `block.moved` events, the `dungeon.switches` and `dungeon.blocks` systems and the `dungeon` resource's `room` (none stand here); every other assertion is unchanged. Re-recorded for GAME-3D.1f part 4 (was `979e36f60d306703`): the schema gained the `chest`, `breakable` and `gate` components, the `chest.opened`, `piece.broke`, `ledge.dropped`, `npc.talk` and `shop.open` events, the `dungeon.pieces` and `dungeon.gates` systems and the `dungeon` resource's `heartPieces` (none stand here; the content is unchanged, `d894381c47fd70d8`); every other assertion is unchanged.
 */
const FIGHTS_HASH = 'ba6fe5d1044ff0c8'

async function runFights() {
  const spec = base3dSim(compileWorld([FIGHT_YARD]))
  const sim = await createSim({ ...spec, plugins: GAME_PLUGINS })
  spec.setup(sim)
  const startTick = sim.tick
  let rejected = 0
  let maxTokens = 0
  let attacksWithoutToken = 0
  const events: string[] = []
  for (const [input, ticks] of FIGHTS_ROUTE)
    for (let i = 0; i < ticks; i++) {
      const result = sim.step(commandsFor(sim, input))
      rejected += result.rejected.length
      for (const event of result.events)
        events.push(event.type === 'hit.landed' ? (event.payload as { kind: string }).kind : event.type)
      const rows = foes(sim).map((entity) => ({ ...entity.get(Enemy), ...entity.get(Fighter) }))
      maxTokens = Math.max(maxTokens, rows.filter((row) => row.token).length)
      attacksWithoutToken += rows.filter((row) => row.state === CombatState.act && !row.token).length
    }
  const result = {
    hash: sim.hash(),
    rejected,
    maxTokens,
    attacksWithoutToken,
    events,
    embers: sim.resource(Progress).embers,
    health: fighter(sim, wickSid(sim))?.health,
    foesLeft: foes(sim).length,
    ticks: sim.tick - startTick,
  }
  sim.dispose()
  return { ...result, seed: spec.seed }
}

describe('the fights golden (B-a, G3-b’s two fights, G3-l)', () => {
  it('blocks and beats the Sootling, parries and beats the Ash Knight, takes both drops, and ends on the recorded hash', async ({
    task,
  }) => {
    const result = await runFights()
    expect(result.rejected).toBe(0)
    expect(result.events).toEqual([
      'block', // the Sootling's bite
      'hit',
      'hit',
      'foe.defeated',
      'parry', // the knight's first chop
      'hit',
      'hit',
      'hit',
      'parry', // its second
      'hit',
      'foe.defeated',
      'drop.taken', // five embers
      'drop.taken', // one
    ])
    // At most 2 tokens on every tick, and no enemy attacked without one (G3-l).
    expect(result.maxTokens).toBeLessThanOrEqual(MAX_TOKENS)
    expect(result.attacksWithoutToken).toBe(0)
    expect(result).toMatchObject({ embers: 6, health: 8, foesLeft: 0, ticks: 763 })
    expect(result.hash).toBe(FIGHTS_HASH)
    const { seed, ticks, hash } = result
    recordGoldenEvidence(task, { scenario: 'base-3d/golden-fights', seed, ticks, hash })
  })

  it('replays to the same hash twice in one engine', async () => {
    expect((await runFights()).hash).toBe((await runFights()).hash)
  })
})

describe('the Ash Knight Captain (DESIGN.md §8.3)', () => {
  const captain = async (vents: AreaSource['vents'] = []) => {
    const area = compileArea({
      id: 'd4',
      spawn: { x: 0, z: 0 },
      views: [{ id: 'open', yawDeg: 0 }],
      rooms: [{ view: 'open', min: [-20, -20], max: [20, 20] }],
      walls: [],
      targets: [],
      ember: { x: 19, z: 19 },
      foes: [{ kind: 'ash-captain', x: 0, z: 1.4, facing: 180 }],
      vents,
    })
    const sim = await startSim(area, MOVES)
    return { sim, sid: foes(sim)[0]?.sid as number }
  }
  const moveId = (sim: Sim, sid: number) => MOVES[(fighter(sim, sid)?.move ?? 0) - 1]?.id

  it('is a 2.1 m Ash Knight with 14 health and its shield', async () => {
    const { sim, sid } = await captain()
    expect(fighter(sim, sid)).toMatchObject({ health: 14, height: metres(2.1) })
    expect(slashes(sim)).toEqual(['block'])
    sim.dispose()
  })

  it('opens with the two-chop combo: the second chop follows the first at once, on its 21st frame', async () => {
    const { sim, sid } = await captain()
    stepUntil(sim, () => enemy(sim, sid)?.brain === BrainState.attack)
    expect(moveId(sim, sid)).toBe('captain-chop-1')
    stepUntil(sim, () => moveId(sim, sid) === 'captain-chop-2', 200, { act: { guard: true } })
    expect(enemy(sim, sid)?.token).toBe(true)
    // Its contact lands 20 frames after its start: Wick's shield blocks it.
    const kinds = hitKinds(sim, { act: { guard: true } }, 20)
    expect(kinds).toEqual(['block'])
    sim.dispose()
  })

  it('gets angry at half health: its windups 4 ticks shorter, and it calls a Sootling at a time from the vents, 2 at most', async () => {
    const { sim, sid } = await captain([
      { x: -5, z: 5 },
      { x: 5, z: 5 },
    ])
    sim.entity(sid)?.set(Fighter, { health: 7 })
    stepUntil(sim, () => enemy(sim, sid)?.brain === BrainState.attack)
    const started = sim.tick
    stepUntil(sim, () => fighter(sim, wickSid(sim))?.health !== 8)
    // The chop's contact on frame 31, reached 4 frames sooner: 26 ticks after it started, plus a tick of reporting.
    expect(sim.tick - started).toBe(26)
    const sootlings = () => foes(sim).filter((entity) => enemyKind(entity.get(Enemy).kind) === 'sootling')
    expect(sootlings()).toHaveLength(1)
    // At the first vent (it has begun pacing from there).
    expect(sootlings()[0]?.get(Enemy)).toMatchObject({ homeX: metres(-5), homeZ: metres(5) })
    let most = 0
    for (let i = 0; i < 900; i++) {
      run(sim, {})
      most = Math.max(most, sootlings().length)
    }
    expect(most).toBe(2)
    sim.dispose()
  })

  it('never calls before it is angry, and its death says so once, with no roll on the drop table', async () => {
    const { sim, sid } = await captain([{ x: -5, z: 5 }])
    run(sim, {}, 300)
    expect(foes(sim)).toHaveLength(1)
    sim.entity(sid)?.set(Fighter, { health: 1, state: CombatState.stun, stun: 30 })
    sim.entity(sid)?.set(Target, { facing: 0 })
    const events = run(sim, { act: { slash: true } }, 12)
    expect(events.filter((event) => event.startsWith('captain.defeated'))).toHaveLength(1)
    expect(sim.query(Drop)).toHaveLength(0)
    sim.dispose()
  })
})
