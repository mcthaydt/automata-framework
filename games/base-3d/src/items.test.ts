import type { Sim } from '@mcthaydt/automata-sim'
import { describe, expect, it } from 'vitest'
import { Bomb, Chain, Drop, Enemy, Fighter, Pellet, Target } from './components.ts'
import { BrainState, DropKind, dropOf } from './constants/enemies.ts'
import { CombatState, metres } from './constants/index.ts'
import { BOMBS, HOOKCHAIN, ItemCode, SLING } from './constants/items.ts'
import { Inventory, Progress } from './resources.ts'
import { base3dSaves } from './screens/saves.ts'
import { newGame } from './state/save.ts'
import { type AreaSource, compileArea } from './systems/index.ts'
import { fighter, foes, wickSid } from './testing/foes.ts'
import { hero, run, startSim, type TickInput } from './testing/sim.ts'

// base-3d's items (GAME-3D.1e, DESIGN.md §9): the sling's draw, its pellets' flight and what they hit, the ammo and the
// inventory through the save. The browsers project runs this file in Chromium, WebKit and Firefox too.

/** Wick at the origin facing +z, with `foes` and `walls`, the sling owned and equipped with `pellets`. */
async function slingArea(foesIn: AreaSource['foes'] = [], walls: AreaSource['walls'] = [], pellets = 10) {
  const sim = await startSim(
    compileArea({
      id: 'range',
      spawn: { x: 0, z: 0 },
      views: [{ id: 'open', yawDeg: 0 }],
      rooms: [{ view: 'open', min: [-30, -30], max: [30, 30] }],
      walls,
      targets: [],
      ember: { x: 29, z: 29 },
      foes: foesIn,
    }),
  )
  Object.assign(sim.resource(Inventory), { sling: true, equipped: ItemCode.sling, pellets })
  return sim
}

const ITEM: TickInput = { act: { item: true } }
/** Holds Item `ticks` ticks, then lets go: the events of the whole draw and release, as types. */
function shoot(sim: Sim, ticks: number = SLING.draw): string[] {
  const events = run(sim, ITEM, ticks)
  events.push(...run(sim, {}))
  return events.map((event) => event.split('@')[0] as string)
}
const pellets = (sim: Sim) => sim.query(Pellet)

describe('the Spark Sling (DESIGN.md §9.1)', () => {
  it('fires when Item is let go after a draw of 8 ticks, spending a pellet, and not after 7', async () => {
    const sim = await slingArea()
    expect(shoot(sim, SLING.draw - 1)).not.toContain('shot.fired')
    expect(pellets(sim)).toHaveLength(0)
    expect(shoot(sim)).toContain('shot.fired')
    expect(pellets(sim)).toHaveLength(1)
    expect(sim.resource(Inventory).pellets).toBe(9)
    sim.dispose()
  })

  it('fires nothing with no pellets, or with the sling unowned or not equipped', async () => {
    for (const inventory of [{ pellets: 0 }, { sling: false }, { equipped: 0 }]) {
      const sim = await slingArea()
      Object.assign(sim.resource(Inventory), inventory)
      expect(shoot(sim)).not.toContain('shot.fired')
      expect(pellets(sim)).toHaveLength(0)
      sim.dispose()
    }
  })

  it('flies 20 m/s along the aim at chest height, and is gone after 15 m', async () => {
    const sim = await slingArea()
    shoot(sim)
    const [pellet] = pellets(sim)
    const first = pellet?.get(Pellet)
    expect(first).toMatchObject({ x: 0, z: 0, y: metres(1.2), facing: 0 })
    run(sim, {})
    expect(sim.entity(pellet?.sid as number)?.get(Pellet)?.z).toBe(SLING.step)
    // Its segments reach at most one tick's flight past 15 m, and then it is gone.
    let farthest = 0
    for (let i = 0; i < 60 && pellets(sim).length > 0; i++) {
      farthest = Math.max(farthest, pellets(sim)[0]?.get(Pellet)?.z ?? 0)
      run(sim, {})
    }
    expect(pellets(sim)).toHaveLength(0)
    expect(farthest).toBeGreaterThanOrEqual(SLING.range - SLING.step)
    expect(farthest).toBeLessThanOrEqual(SLING.range)
    sim.dispose()
  })

  it('stops at a wall', async () => {
    const sim = await slingArea([], [{ min: [-2, 3], max: [2, 3.2] }])
    shoot(sim)
    run(sim, {}, 12)
    expect(pellets(sim)).toHaveLength(0)
    sim.dispose()
  })

  it('stuns a Sootling 60 ticks', async () => {
    const sim = await slingArea([{ kind: 'sootling', x: 0, z: 4, facing: 180 }])
    const [sootling] = foes(sim).map((entity) => entity.sid) as [number]
    const events = shoot(sim)
    for (let i = 0; i < 20 && !events.includes('hit.landed'); i++)
      events.push(...run(sim, {}).map((e) => e.split('@')[0] as string))
    expect(events).toContain('hit.landed')
    expect(fighter(sim, sootling)).toMatchObject({ health: 1, state: CombatState.stun, stun: 60 })
    expect(pellets(sim)).toHaveLength(0)
    sim.dispose()
  })

  it('rises to a hovering Wisp ahead and drops it to the floor (§9.2, §8.2)', async () => {
    const sim = await slingArea([{ kind: 'wisp', x: 0.4, z: 6, facing: 180 }])
    const [wisp] = foes(sim).map((entity) => entity.sid) as [number]
    shoot(sim)
    expect(pellets(sim)[0]?.get(Pellet)?.y).toBe(metres(2.2) + metres(0.4))
    run(sim, {}, 25)
    expect(fighter(sim, wisp)).toMatchObject({ lift: 0 })
    sim.dispose()
  })

  it('turns Wick to the aim when he fires: toward his locked target', async () => {
    const sim = await slingArea([{ kind: 'ash-knight', x: 4, z: 4, facing: 225 }])
    run(sim, { lock: true, act: { item: true } }, SLING.draw)
    run(sim, { lock: true })
    expect(pellets(sim)[0]?.get(Pellet)?.facing).toBe(8_192)
    sim.dispose()
  })
})

describe('the inventory through the save (DESIGN.md §12.1)', () => {
  it('applies the items, ammo and equipped item before tick 0, and captures them back', async () => {
    const sim = await slingArea([], [], 0)
    const saves = base3dSaves()
    const data = {
      ...newGame(),
      items: { sling: true, bombs: true, hookchain: false },
      ammo: { pellets: 12, bombs: 3 },
      equipped: 'sling' as const,
    }
    saves.apply(sim, data)
    expect(sim.resource(Inventory)).toMatchObject({
      sling: true,
      bombs: true,
      hookchain: false,
      equipped: ItemCode.sling,
      pellets: 12,
      bombAmmo: 3,
    })
    shoot(sim)
    expect(saves.capture(sim)).toMatchObject({
      ammo: { pellets: 11, bombs: 3 },
      equipped: 'sling',
      items: data.items,
    })
    sim.dispose()
  })
})

describe('Ember Bombs (DESIGN.md §9.1)', () => {
  /** Wick at the origin with `foesIn`, bombs owned and equipped with `bombs` in stock. */
  async function bombArea(foesIn: AreaSource['foes'] = [], bombs = 5) {
    const sim = await slingArea(foesIn)
    Object.assign(sim.resource(Inventory), { bombs: true, equipped: ItemCode.bombs, bombAmmo: bombs })
    return sim
  }
  const bombs = (sim: Sim) => sim.query(Bomb)

  it('places one at Wick’s feet on each press, spending one', async () => {
    const sim = await bombArea()
    run(sim, ITEM, 5)
    // Placed on the first of the 5 ticks, and its fuse counted on each of them.
    expect(bombs(sim).map((bomb) => bomb.get(Bomb))).toEqual([{ x: 0, z: 0, fuse: BOMBS.fuse - 5 }])
    expect(sim.resource(Inventory).bombAmmo).toBe(4)
    sim.dispose()
  })

  it('places none with no bombs, or with bombs unowned or not equipped', async () => {
    for (const inventory of [{ bombAmmo: 0 }, { bombs: false }, { equipped: ItemCode.sling }]) {
      const sim = await bombArea()
      Object.assign(sim.resource(Inventory), inventory)
      run(sim, ITEM)
      expect(bombs(sim)).toHaveLength(0)
      sim.dispose()
    }
  })

  it('blasts 120 ticks after it is placed: a Sootling within 1.6 m is beaten (2 damage), one at 2.5 m untouched', async () => {
    const sim = await bombArea([
      { kind: 'sootling', x: 1.2, z: 0.5, facing: 270 },
      { kind: 'sootling', x: -2.5, z: 0, facing: 90 },
    ])
    const [near, far] = foes(sim).map((entity) => entity.sid) as [number, number]
    run(sim, ITEM)
    // Wick steps out of the blast; the Sootlings are pinned where they stand, so the blast finds them there.
    run(sim, { stick: { x: 0, y: 127 } }, 30)
    for (const sid of [near, far]) sim.entity(sid)?.set(Fighter, { state: CombatState.stun, stun: 200 })
    const events: string[] = []
    for (let i = 0; i < BOMBS.fuse - 31; i++)
      events.push(...run(sim, {}).map((event) => event.split('@')[0] as string))
    expect(events).not.toContain('bomb.blast')
    events.push(...run(sim, {}).map((event) => event.split('@')[0] as string))
    expect(events).toContain('bomb.blast')
    expect(sim.entity(near)).toBeUndefined()
    expect(fighter(sim, far)).toMatchObject({ health: 2, state: CombatState.stun })
    expect(fighter(sim, wickSid(sim))?.health).toBe(8)
    expect(bombs(sim)).toHaveLength(0)
    sim.dispose()
  })

  it('knocks an Ash Knight down through its shield, and hurts Wick 1 and knocks him down when he stands in it', async () => {
    const sim = await bombArea([{ kind: 'ash-knight', x: 0, z: 1.2, facing: 180 }])
    const [knight] = foes(sim).map((entity) => entity.sid) as [number]
    run(sim, ITEM)
    // The fuse counts live ticks (a hit's hitstop holds it), so step until the blast's own tick comes.
    for (let i = 0; i < 400 && bombs(sim)[0]?.get(Bomb)?.fuse !== 0; i++) run(sim, {})
    // On the blast's tick the knight stands idle facing Wick, its shield up, and Wick is up and open: the blast is
    // unblockable.
    sim.entity(knight)?.set(Fighter, { state: CombatState.idle, move: 0, moveTick: 0, health: 6 })
    sim.entity(knight)?.set(Enemy, { brain: BrainState.recover, timer: 500, token: false })
    sim.entity(knight)?.set(Target, { x: 0, z: metres(1.2), facing: 32_768 })
    sim.entity(wickSid(sim))?.set(Fighter, { state: CombatState.idle, health: 8, iframes: 0, stun: 0 })
    expect(run(sim, {}).map((event) => event.split('@')[0])).toContain('bomb.blast')
    expect(fighter(sim, knight)).toMatchObject({ state: CombatState.down, health: 4 })
    expect(fighter(sim, wickSid(sim))).toMatchObject({ health: 7, state: CombatState.down })
    sim.dispose()
  })
})

describe('the drop table’s ammo row (DESIGN.md §8.1 rule 6)', () => {
  const full = { sling: true, pellets: 30, bombs: true, bombAmmo: 10 }
  it('swaps one ember for 5 pellets, and five embers for 2 bombs, only when owned and under half', () => {
    const low = { ...full, pellets: 14, bombAmmo: 4 }
    expect(dropOf(3, low)).toEqual({ kind: DropKind.pellets, amount: 5 })
    expect(dropOf(7, low)).toEqual({ kind: DropKind.bombs, amount: 2 })
    expect(dropOf(3, full)).toEqual({ kind: DropKind.ember, amount: 1 })
    expect(dropOf(7, { ...low, bombs: false })).toEqual({ kind: DropKind.ember, amount: 5 })
    expect(dropOf(3, { ...low, sling: false })).toEqual({ kind: DropKind.ember, amount: 1 })
    expect(dropOf(9, low)).toEqual({ kind: DropKind.heart, amount: 1 })
  })

  it('adds a pellet or bomb drop Wick walks over to his ammo, up to the cap', async () => {
    const sim = await slingArea([], [], 28)
    Object.assign(sim.resource(Inventory), { bombs: true, bombAmmo: 9 })
    sim.spawn([[Drop, { x: 0, z: metres(1), kind: DropKind.pellets, amount: 5 }]])
    sim.spawn([[Drop, { x: 0, z: metres(2), kind: DropKind.bombs, amount: 2 }]])
    run(sim, { stick: { x: 0, y: -127 } }, 40)
    expect(sim.resource(Inventory)).toMatchObject({ pellets: SLING.maxPellets, bombAmmo: BOMBS.max })
    sim.dispose()
  })
})

describe('the Hookchain (DESIGN.md §9.1)', () => {
  /** Wick at the origin facing +z, with hook `posts`, `foesIn` and `walls`, the hookchain owned and equipped. */
  async function hookArea(
    posts: AreaSource['posts'],
    foesIn: AreaSource['foes'] = [],
    walls: AreaSource['walls'] = [],
  ) {
    const sim = await startSim(
      compileArea({
        id: 'hooks',
        spawn: { x: 0, z: 0 },
        views: [{ id: 'open', yawDeg: 0 }],
        rooms: [{ view: 'open', min: [-30, -30], max: [30, 30] }],
        walls,
        targets: [],
        ember: { x: 29, z: 29 },
        foes: foesIn,
        posts,
      }),
    )
    Object.assign(sim.resource(Inventory), { hookchain: true, equipped: ItemCode.hookchain })
    return sim
  }
  const chains = (sim: Sim) => sim.query(Chain)
  const throwChain = (sim: Sim) =>
    [...run(sim, ITEM), ...run(sim, {})].map((event) => event.split('@')[0] as string)

  it('pulls Wick in a straight line to 0.6 m from a post 5 m ahead, at 10 m/s, invulnerable, the stick ignored', async () => {
    const sim = await hookArea([{ x: 0, z: 5 }])
    const events = throwChain(sim)
    for (let i = 0; i < 40 && !events.includes('chain.hooked'); i++)
      events.push(...run(sim, {}).map((e) => e.split('@')[0] as string))
    expect(events).toContain('chain.hooked')
    const zs: number[] = []
    for (let i = 0; i < 60 && chains(sim).length > 0; i++) {
      run(sim, { stick: { x: 127, y: 0 } })
      zs.push(hero(sim).z)
      expect(hero(sim).x).toBe(0)
      if (chains(sim).length > 0) expect(fighter(sim, wickSid(sim))?.iframes).toBeGreaterThan(0)
    }
    expect(chains(sim)).toHaveLength(0)
    expect((zs[1] ?? 0) - (zs[0] ?? 0)).toBe(HOOKCHAIN.pull)
    expect(hero(sim).z).toBe(metres(5) - HOOKCHAIN.stop)
    sim.dispose()
  })

  it('pulls nothing to a post behind a wall or past 8 m: the chain is gone', async () => {
    for (const [posts, walls] of [
      [[{ x: 0, z: 5 }], [{ min: [-1, 2], max: [1, 2.2] }]],
      [[{ x: 0, z: 8.6 }], []],
    ] as const) {
      const sim = await hookArea([...posts], [], [...walls] as AreaSource['walls'])
      throwChain(sim)
      run(sim, {}, 50)
      expect(chains(sim)).toHaveLength(0)
      expect(hero(sim)).toMatchObject({ x: 0, z: 0 })
      sim.dispose()
    }
  })

  it('stuns a Sootling or a Wisp it meets 90 ticks; an Ash Knight only stops it', async () => {
    for (const [kind, stunned] of [
      ['sootling', true],
      ['wisp', true],
      ['ash-knight', false],
    ] as const) {
      const sim = await hookArea([], [{ kind, x: 0, z: 4, facing: 180 }])
      const [sid] = foes(sim).map((entity) => entity.sid) as [number]
      throwChain(sim)
      for (let i = 0; i < 30 && chains(sim).length > 0; i++) run(sim, {})
      expect(chains(sim)).toHaveLength(0)
      if (stunned) {
        expect(fighter(sim, sid)?.state).toBe(CombatState.stun)
        expect(fighter(sim, sid)?.stun).toBeGreaterThanOrEqual(HOOKCHAIN.stun - 1)
      } else expect(fighter(sim, sid)?.state).not.toBe(CombatState.stun)
      if (kind === 'wisp') expect(fighter(sim, sid)?.lift).toBe(0)
      sim.dispose()
    }
  })

  it('throws nothing with the hookchain unowned or not equipped, and one chain at a time', async () => {
    for (const inventory of [{ hookchain: false }, { equipped: ItemCode.sling }]) {
      const sim = await hookArea([{ x: 0, z: 5 }])
      Object.assign(sim.resource(Inventory), inventory)
      throwChain(sim)
      expect(chains(sim)).toHaveLength(0)
      sim.dispose()
    }
    const sim = await hookArea([])
    throwChain(sim)
    throwChain(sim)
    expect(chains(sim)).toHaveLength(1)
    sim.dispose()
  })
})

describe('hearts from the save (DESIGN.md §7.8, §12.1)', () => {
  it('gives Wick the save’s hearts as his maximum and his health, heals a heart up to it, and captures it back', async () => {
    const sim = await slingArea()
    const saves = base3dSaves()
    saves.apply(sim, { ...newGame(), hearts: { max: 5, pieces: ['a', 'b', 'c', 'd'] } })
    expect(sim.resource(Progress).maxHealth).toBe(10)
    expect(fighter(sim, wickSid(sim))?.health).toBe(10)
    sim.entity(wickSid(sim))?.set(Fighter, { health: 7 })
    sim.spawn([[Drop, { x: 0, z: metres(1), kind: DropKind.heart, amount: 1 }]])
    sim.spawn([[Drop, { x: 0, z: metres(2), kind: DropKind.heart, amount: 1 }]])
    run(sim, { stick: { x: 0, y: -127 } }, 40)
    expect(fighter(sim, wickSid(sim))?.health).toBe(10)
    expect(saves.capture(sim).hearts).toEqual({ max: 5, pieces: ['a', 'b', 'c', 'd'] })
    sim.dispose()
  })
})

describe('equip (DESIGN.md §14.1)', () => {
  const equip = (sim: Sim, item: 'sling' | 'bombs' | 'hookchain') =>
    sim.step([{ tick: sim.tick, source: 0, seq: 0, type: 'equip', payload: { item } }])

  it('equips an owned item and drops a draw under way; an item not owned changes nothing', async () => {
    const sim = await slingArea()
    Object.assign(sim.resource(Inventory), { equipped: 0, draw: 5 })
    equip(sim, 'sling')
    expect(sim.resource(Inventory)).toMatchObject({ equipped: ItemCode.sling, draw: 0 })
    equip(sim, 'bombs')
    expect(sim.resource(Inventory).equipped).toBe(ItemCode.sling)
    Object.assign(sim.resource(Inventory), { hookchain: true })
    equip(sim, 'hookchain')
    expect(sim.resource(Inventory).equipped).toBe(ItemCode.hookchain)
    sim.dispose()
  })
})
