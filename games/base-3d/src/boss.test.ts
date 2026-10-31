import type { Command, Sim } from '@mcthaydt/automata-sim'
import { recordGoldenEvidence } from '@mcthaydt/evidence/golden'
import { describe, expect, it } from 'vitest'
import { Enemy, Fighter, Target } from './components.ts'
import { BrainState, ENEMIES, ENEMY_MOVES } from './constants/enemies.ts'
import { CombatState, type MoveDef, metres } from './constants/index.ts'
import { type AreaSource, compileArea } from './systems/index.ts'
import { enemy, fighter, foes, hitKinds, MOVES, slashes, wickSid } from './testing/foes.ts'
import { commandsFor, hero, run, startSim, type TickInput } from './testing/sim.ts'

// The Ashen Warden (GAME-3D.1d part 3, DESIGN.md §8.4): its two phases, its openings and its defeat, in the sim. The
// browsers project runs this file in Chromium, WebKit and Firefox too (G3-c).

// Stand-ins for GAME-3D.1e's items: a sling pellet (it opens the Warden's mouth) and a bomb blast (power 3), both
// reaching 6 m ahead from the floor to 4 m up.
const reachAll = { near: 0, far: metres(6), bottom: 0, top: metres(4), stop: 2, stun: 10, kb: 0 }
const PELLET: MoveDef = {
  id: 'test-pellet',
  total: 10,
  active: [1, 1],
  hit: { ...reachAll, dmg: 1, power: 1, pellet: true },
}
const BOMB: MoveDef = { id: 'test-bomb', total: 10, active: [1, 1], hit: { ...reachAll, dmg: 2, power: 3 } }
// A blow big enough to end the Warden from 13 health in one hit while it kneels (7, doubled).
const BLAST: MoveDef = { id: 'test-blast', total: 10, active: [1, 1], hit: { ...reachAll, dmg: 7, power: 1 } }
const BOSS_MOVES = [...MOVES, PELLET, BOMB, BLAST]
const moveIndex = (id: string) => BOSS_MOVES.findIndex((move) => move.id === id) + 1
const WARDEN = ENEMIES.find((type) => type.id === 'warden')

/** The Warden `z` metres ahead of Wick, facing him, in an open arena with `walls`. */
async function arena(z = 1.6, walls: AreaSource['walls'] = []) {
  const area = compileArea({
    id: 'hearth',
    spawn: { x: 0, z: 0 },
    views: [{ id: 'open', yawDeg: 0 }],
    rooms: [{ view: 'open', min: [-20, -20], max: [20, 20] }],
    walls,
    targets: [],
    ember: { x: 19, z: 19 },
    foes: [{ kind: 'warden', x: 0, z, facing: 180 }],
  })
  const sim = await startSim(area, BOSS_MOVES)
  return { sim, sid: foes(sim)[0]?.sid as number }
}

/** Starts `move` on the Warden as its brain would: holding a token, attacking, frame 1 played on the next step. */
function attack(sim: Sim, sid: number, move: string) {
  sim.entity(sid)?.set(Enemy, { brain: BrainState.attack, token: true })
  sim
    .entity(sid)
    ?.set(Fighter, { move: moveIndex(move), moveTick: 0, moveStart: sim.tick, state: CombatState.act })
}

/** A stand-in item fired from beside Wick, straight ahead, on the next step. */
function fire(sim: Sim, item: 'test-pellet' | 'test-bomb' | 'test-blast') {
  const sid = sim.spawn([
    [Target, { x: metres(0.1), z: 0, facing: 0 }],
    [Fighter, { side: 0, health: 6, radius: metres(0.3), height: metres(1.6) }],
  ])
  sim
    .entity(sid)
    ?.set(Fighter, { move: moveIndex(item), moveTick: 0, moveStart: sim.tick, state: CombatState.act })
}

/** Steps `ticks` of `input` and returns the events that are not hits, as their types. */
function eventsOf(sim: Sim, input: TickInput, ticks = 1): string[] {
  const types: string[] = []
  for (let i = 0; i < ticks; i++)
    for (const event of run(sim, input))
      if (!event.startsWith('hit.landed')) types.push(event.split('@')[0] as string)
  return types
}

describe('the Warden’s tables (DESIGN.md §8.1 rule 1, §8.4)', () => {
  it('is 3.2 m tall with 24 health, and every attack it opens with winds up at least 36 ticks', () => {
    expect(WARDEN).toMatchObject({ health: 24, height: metres(3.2) })
    const attacks = [...(WARDEN?.attacks ?? []), ...(WARDEN?.phase2?.attacks ?? [])]
    expect(attacks).toEqual(['warden-slam', 'warden-swipe', 'warden-breath', 'warden-charge'])
    for (const id of attacks) {
      const move = ENEMY_MOVES.find((candidate) => candidate.id === id) as MoveDef
      expect(move.active[0] - 1, id).toBeGreaterThanOrEqual(36)
    }
  })
})

describe('phase 1 (DESIGN.md §8.4, G3-n)', () => {
  it('staggers 90 ticks, kneeling, when its slam is parried, and takes double from every slash while it kneels', async () => {
    const { sim, sid } = await arena()
    attack(sim, sid, 'warden-slam')
    hitKinds(sim, {}, 35)
    expect(hitKinds(sim, { act: { guard: true } }, 6)).toEqual(['parry'])
    expect(fighter(sim, sid)).toMatchObject({ state: CombatState.stagger, stun: 90 })
    hitKinds(sim, {}, 14) // the parry's hitstop
    expect([...slashes(sim), ...slashes(sim)]).toEqual(['hit', 'hit'])
    expect(fighter(sim, sid)).toMatchObject({ health: 20, state: CombatState.stagger })
    sim.dispose()
  })

  it('reaches Wick behind it with the slam’s ring', async () => {
    const { sim, sid } = await arena(-1.8)
    sim.entity(sid)?.set(Target, { facing: 32_768 }) // facing away from him
    attack(sim, sid, 'warden-slam')
    expect(hitKinds(sim, {}, 50)).toEqual(['hit'])
    expect(fighter(sim, wickSid(sim))?.health).toBe(6)
    sim.dispose()
  })

  it('opens nothing when its swipe is parried, and a blocked swipe costs Wick nothing', async () => {
    const parried = await arena()
    attack(parried.sim, parried.sid, 'warden-swipe')
    hitKinds(parried.sim, {}, 32)
    expect(hitKinds(parried.sim, { act: { guard: true } }, 8)).toEqual(['parry'])
    expect(fighter(parried.sim, parried.sid)?.state).toBe(CombatState.act)
    parried.sim.dispose()

    const blocked = await arena()
    run(blocked.sim, { act: { guard: true } }, 20)
    attack(blocked.sim, blocked.sid, 'warden-swipe')
    expect(hitKinds(blocked.sim, { act: { guard: true } }, 50)).toEqual(['block'])
    expect(fighter(blocked.sim, wickSid(blocked.sim))?.health).toBe(8)
    blocked.sim.dispose()
  })

  it('keeps fighting through a slash or a thrust: no stun, no knockdown, only the damage', async () => {
    const { sim, sid } = await arena()
    attack(sim, sid, 'warden-swipe')
    expect(slashes(sim)).toEqual(['hit'])
    expect(fighter(sim, sid)).toMatchObject({
      health: 23,
      state: CombatState.act,
      move: moveIndex('warden-swipe'),
    })
    sim.dispose()
  })
})

describe('phase 2 (DESIGN.md §8.4, G3-n)', () => {
  it('goes to phase 2 at 12 health, once, and opens with its breath', async () => {
    const { sim, sid } = await arena()
    sim.entity(sid)?.set(Fighter, { health: 13 })
    const events = [...eventsOf(sim, { act: { slash: true } }), ...eventsOf(sim, {}, 12)]
    expect(events).toEqual(['boss.phase'])
    expect(enemy(sim, sid)?.phase).toBe(2)
    for (let i = 0; i < 400 && enemy(sim, sid)?.brain !== BrainState.attack; i++) run(sim, {})
    expect(BOSS_MOVES[(fighter(sim, sid)?.move ?? 0) - 1]?.id).toBe('warden-breath')
    expect(eventsOf(sim, {}, 300)).not.toContain('boss.phase')
    sim.dispose()
  })

  it('staggers 120 ticks when a pellet goes into its mouth during the inhale', async () => {
    const { sim, sid } = await arena(3)
    sim.entity(sid)?.set(Enemy, { phase: 2 })
    attack(sim, sid, 'warden-breath')
    run(sim, {}, 20)
    fire(sim, 'test-pellet')
    expect(hitKinds(sim, {})).toEqual(['hit'])
    expect(fighter(sim, sid)).toMatchObject({ state: CombatState.stagger, stun: 120, move: 0 })
    sim.dispose()
  })

  it('breathes a cone no shield stops, and a pillar between them does', async () => {
    const open = await arena(3)
    attack(open.sim, open.sid, 'warden-breath')
    expect(hitKinds(open.sim, { act: { guard: true } }, 90)).toEqual(['hit'])
    open.sim.dispose()

    const hidden = await arena(3, [{ min: [-0.5, 1.2], max: [0.5, 1.6] }])
    attack(hidden.sim, hidden.sid, 'warden-breath')
    expect(hitKinds(hidden.sim, {}, 90)).toEqual([])
    hidden.sim.dispose()
  })

  it('is knocked down 90 ticks by a bomb in its charge’s path, and charges in a straight line', async () => {
    const charged = await arena(6)
    const before = charged.sim.entity(charged.sid)?.get(Target)?.z as number
    attack(charged.sim, charged.sid, 'warden-charge')
    run(charged.sim, {}, 45)
    expect(charged.sim.entity(charged.sid)?.get(Target)?.x).toBe(0)
    expect(charged.sim.entity(charged.sid)?.get(Target)?.z).toBeLessThan(before)
    charged.sim.dispose()

    const bombed = await arena(6)
    attack(bombed.sim, bombed.sid, 'warden-charge')
    run(bombed.sim, {}, 42)
    fire(bombed.sim, 'test-bomb')
    expect(hitKinds(bombed.sim, {})).toEqual(['hit'])
    expect(fighter(bombed.sim, bombed.sid)).toMatchObject({ state: CombatState.down, stun: 90, move: 0 })
    bombed.sim.dispose()

    // Outside the charge, a bomb only hurts it.
    const standing = await arena(6)
    fire(standing.sim, 'test-bomb')
    hitKinds(standing.sim, {})
    expect(fighter(standing.sim, standing.sid)).toMatchObject({ health: 22, state: CombatState.idle })
    standing.sim.dispose()
  })
})

describe('the Warden’s defeat (DESIGN.md §8.4, G3-F8)', () => {
  it('says so once, rolls no drop, and a lethal hit from phase 1 never enters phase 2', async () => {
    const { sim, sid } = await arena()
    // In phase 1 at 13 health, kneeling: one blow of 14 ends it from above the phase 2 line.
    sim.entity(sid)?.set(Fighter, { health: 13, state: CombatState.stagger, stun: 60 })
    sim.entity(sid)?.set(Enemy, { phase: 1 })
    fire(sim, 'test-blast')
    const events = eventsOf(sim, {}, 30)
    expect(events).toEqual(['foe.defeated', 'boss.defeated'])
    expect(foes(sim)).toHaveLength(0)
    sim.dispose()
  })
})

// G3-c: a recorded command log of the boss fight replays to the same `boss.defeated` tick and the same final hash in
// every engine. The log is made by a test player that reads only the sim (deterministic, no wall clock): locked on,
// it raises the shield just before each blockable contact (parrying the slam), strafes out of the breath, closes in
// when the Warden is out of reach, and slashes whenever it is in reach and not about to be hit.
function bossPlayer(sim: Sim, sid: number): TickInput {
  const warden = fighter(sim, sid)
  if (warden === undefined) return {}
  const move = warden.move === 0 ? undefined : BOSS_MOVES[warden.move - 1]
  const frame = warden.moveTick + 1
  const at = sim.entity(sid)?.get(Target) as { x: number; z: number }
  const wick = hero(sim)
  // Integers only (squares under 2^53), so the player decides alike in every engine.
  const reach = metres(2.1)
  const near = (at.x - wick.x) ** 2 + (at.z - wick.z) ** 2 <= reach * reach
  const threat = move?.hit !== undefined && frame >= move.active[0] - 12 && frame <= move.active[1]
  if (move?.hit?.unblockable === true && frame <= move.active[1])
    return { lock: true, stick: { x: 127, y: 0 } }
  if (threat) return { lock: true, act: { guard: frame >= move.active[0] - 4 } }
  if (!near) return { lock: true, stick: { x: 0, y: -127 } }
  return { lock: true, act: { slash: sim.tick % 10 === 0 } }
}

async function recordBossFight() {
  const { sim, sid } = await arena(4)
  const log: Command[][] = []
  const events: string[] = []
  let defeatedAt: number | undefined
  for (let i = 0; i < 6000 && defeatedAt === undefined; i++) {
    const commands = commandsFor(sim, bossPlayer(sim, sid))
    log.push(commands)
    const result = sim.step(commands)
    for (const event of result.events)
      events.push(event.type === 'hit.landed' ? (event.payload as { kind: string }).kind : event.type)
    if (result.events.some((event) => event.type === 'boss.defeated')) defeatedAt = result.tick
  }
  const health = fighter(sim, wickSid(sim))?.health
  const hash = sim.hash()
  sim.dispose()
  return { log, events, defeatedAt, health, hash }
}

async function replayBossFight(log: readonly Command[][]) {
  const { sim } = await arena(4)
  let defeatedAt: number | undefined
  for (const commands of log) {
    const result = sim.step(commands)
    if (result.events.some((event) => event.type === 'boss.defeated')) defeatedAt = result.tick
  }
  const hash = sim.hash()
  sim.dispose()
  return { defeatedAt, hash }
}

/** The boss fight's defeat tick and final hash, with seed 1 (recorded in Node); every engine must end on both. */
const BOSS_DEFEATED_AT = 458
const BOSS_HASH = '6001e1c06a58eabe'

describe('the boss fight’s recorded log (G3-c)', () => {
  it('beats the Warden through a parried slam’s kneel and phase 2, and its log replays to the same defeat tick and hash', async ({
    task,
  }) => {
    const recorded = await recordBossFight()
    // Three hits, the slam parried, the kneel's doubled slashes taking it past 12 into phase 2, and the end.
    expect(recorded.events).toEqual([
      ...['hit', 'hit', 'hit', 'parry', 'hit', 'hit', 'hit', 'boss.phase'],
      ...Array.from({ length: 9 }, () => 'hit'),
      'foe.defeated',
      'boss.defeated',
    ])
    expect(recorded).toMatchObject({ defeatedAt: BOSS_DEFEATED_AT, health: 8, hash: BOSS_HASH })
    expect(await replayBossFight(recorded.log)).toEqual({ defeatedAt: BOSS_DEFEATED_AT, hash: BOSS_HASH })
    recordGoldenEvidence(task, {
      scenario: 'base-3d/golden-boss',
      seed: 1,
      ticks: recorded.log.length,
      hash: BOSS_HASH,
    })
  })
})
