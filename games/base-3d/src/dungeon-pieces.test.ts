// base-3d's dungeon pieces in the sim, part 4 (GAME-3D.1f, DESIGN.md §10): chests and what they hold, heart pieces,
// pots, cracked walls, one-way gates, ledge drops, and the npc and shop that answer a press. The browsers project
// runs this file in Chromium, WebKit and Firefox too.
import type { Sim, SimEvent } from '@mcthaydt/automata-sim'
import { describe, expect, it } from 'vitest'
import { Breakable, Chest, Drop, Enemy, Fighter, Gate, Hero } from './components.ts'
import { HERO_HALF, HERO_HEALTH, metres } from './constants/index.ts'
import { BOMBS, ItemCode, SLING } from './constants/items.ts'
import { Dungeon, Inventory, Progress } from './resources.ts'
import { base3dSaves } from './screens/saves.ts'
import { newGame } from './state/save.ts'
import { type AreaSource, compileArea } from './systems/index.ts'
import { commandsFor, DOWN, hero, startSim, type TickInput, UP } from './testing/sim.ts'

/**
 * Two open rooms, `south` (z −10 to 0) and `north` (z 0 to 10), with nothing between them but the area's
 * `entities`; Wick starts at `spawn` (2 m south of the line, facing north, by default).
 */
async function rooms(
  entities: AreaSource['entities'],
  spawn = { x: 0, z: -2 },
  foesIn: AreaSource['foes'] = [],
): Promise<Sim> {
  return startSim(
    compileArea({
      id: 'pieces',
      spawn,
      views: [
        { id: 'south', yawDeg: 0 },
        { id: 'north', yawDeg: 0 },
      ],
      rooms: [
        { view: 'south', min: [-10, -10], max: [10, 0] },
        { view: 'north', min: [-10, 0], max: [10, 10] },
      ],
      walls: [],
      targets: [],
      ember: { x: 9, z: 9 },
      foes: foesIn,
      entities,
    }),
  )
}

/** Steps `ticks` ticks with `input` held, and returns every event. */
function stepWith(sim: Sim, input: TickInput, ticks = 1): SimEvent[] {
  const events: SimEvent[] = []
  for (let i = 0; i < ticks; i++) events.push(...sim.step(commandsFor(sim, input)).events)
  return events
}
/** A pick-up press, then two ticks: its events. */
const press = (sim: Sim): SimEvent[] => [...stepWith(sim, { act: { pickup: true } }), ...stepWith(sim, {}, 2)]
const ofType = (events: readonly SimEvent[], type: string) =>
  events.filter((event) => event.type === type).map((event) => event.payload)

/** A chest 1 m wide just north of the line, holding `contents`. */
const chestOf = (contents: string, more: Record<string, unknown> = {}) => ({
  def: 'chest',
  id: 'chest-1',
  x: 0,
  z: 1,
  width: 1,
  depth: 0.6,
  contents,
  ...more,
})
/** Walks Wick up to the chest and presses beside it: the events of the press. */
function openChest(sim: Sim): SimEvent[] {
  stepWith(sim, { stick: UP }, 40)
  return press(sim)
}

describe('chests (GAME-3D.1f part 4, DESIGN.md §10)', () => {
  it('stands as a wall and opens once with a press beside it, giving a small key and saving the chest', async () => {
    const sim = await rooms([chestOf('small-key')])
    const events = openChest(sim)
    expect(hero(sim).z).toBeLessThanOrEqual(metres(0.7) - HERO_HALF)
    expect(ofType(events, 'chest.opened')).toEqual([{ piece: 1, contents: 'small-key' }])
    expect(sim.query(Chest)[0]?.get(Chest)).toMatchObject({ open: true, shown: true })
    expect(sim.resource(Dungeon)).toMatchObject({ smallKeys: 1, flags: ['pieces/chest-1'] })
    // An open chest gives nothing more.
    expect(ofType(press(sim), 'chest.opened')).toEqual([])
    expect(sim.resource(Dungeon).smallKeys).toBe(1)
    sim.dispose()
  })

  it('gives each kind of contents: the boss key, the map, the compass and embers', async () => {
    const cases = [
      ['boss-key', (sim: Sim) => sim.resource(Dungeon).bossKey],
      ['map', (sim: Sim) => sim.resource(Dungeon).map],
      ['compass', (sim: Sim) => sim.resource(Dungeon).compass],
      ['embers:25', (sim: Sim) => sim.resource(Progress).embers === 25],
    ] as const
    for (const [contents, given] of cases) {
      const sim = await rooms([chestOf(contents)])
      expect(given(sim)).toBe(false)
      openChest(sim)
      expect(given(sim)).toBe(true)
      sim.dispose()
    }
  })

  it('gives an item with a full bag, on the Item button when nothing was', async () => {
    const sim = await rooms([chestOf('bombs')])
    openChest(sim)
    expect(sim.resource(Inventory)).toMatchObject({
      bombs: true,
      bombAmmo: BOMBS.max,
      equipped: ItemCode.bombs,
    })
    sim.dispose()

    const slung = await rooms([chestOf('sling')])
    Object.assign(slung.resource(Inventory), { hookchain: true, equipped: ItemCode.hookchain })
    openChest(slung)
    expect(slung.resource(Inventory)).toMatchObject({
      sling: true,
      pellets: SLING.maxPellets,
      equipped: ItemCode.hookchain,
    })
    slung.dispose()
  })

  it('stays hidden, neither a wall nor openable, until the entity it names is on', async () => {
    const lever = { def: 'switch', id: 'lever-1', x: 1, z: -2, kind: 'lever' }
    const hidden = await rooms([chestOf('compass', { hidden: 'lever-1' }), lever])
    // Wick walks on through where it stands, and presses there.
    stepWith(hidden, { stick: UP }, 50)
    expect(hero(hidden).z).toBeGreaterThan(metres(1.3) - HERO_HALF)
    expect(ofType(press(hidden), 'chest.opened')).toEqual([])
    expect(hidden.query(Chest)[0]?.get(Chest).shown).toBe(false)
    hidden.dispose()

    const sim = await rooms([chestOf('compass', { hidden: 'lever-1' }), lever])
    press(sim)
    expect(sim.query(Chest)[0]?.get(Chest).shown).toBe(true)
    expect(ofType(openChest(sim), 'chest.opened')).toEqual([{ piece: 1, contents: 'compass' }])
    sim.dispose()
  })

  it('shows the Ember Bombs chest when the arena’s clear door opens (the Captain beaten)', async () => {
    const arenaDoor = { def: 'door', id: 'arena-door', x: 8, z: -9, width: 2, depth: 0.3, lock: 'clear' }
    const sim = await rooms([chestOf('bombs', { hidden: 'arena-door' }), arenaDoor], undefined, [
      { kind: 'sootling', x: -6, z: -8, facing: 0 },
    ])
    stepWith(sim, {}, 2)
    expect(sim.query(Chest)[0]?.get(Chest).shown).toBe(false)
    for (const foe of sim.query(Enemy)) foe.set(Fighter, { health: 0 })
    stepWith(sim, {}, 2)
    expect(sim.query(Chest)[0]?.get(Chest).shown).toBe(true)
    openChest(sim)
    expect(sim.resource(Inventory).bombs).toBe(true)
    sim.dispose()
  })

  it('is open from the start when the save has it, and gives nothing', async () => {
    const sim = await rooms([chestOf('small-key')])
    sim.resource(Dungeon).flags = ['pieces/chest-1']
    expect(ofType(openChest(sim), 'chest.opened')).toEqual([])
    expect(sim.query(Chest)[0]?.get(Chest).open).toBe(true)
    expect(sim.resource(Dungeon).smallKeys).toBe(0)
    sim.dispose()
  })
})

describe('heart pieces (GAME-3D.1f part 4, DESIGN.md §10, §12.1)', () => {
  it('raises Wick’s hearts by one, full, on every fourth piece, and records each piece', async () => {
    const third = await rooms([chestOf('heart-piece')])
    third.resource(Dungeon).heartPieces = ['kiln/hp-1', 'kiln/hp-2']
    openChest(third)
    expect(third.resource(Dungeon).heartPieces).toEqual(['kiln/hp-1', 'kiln/hp-2', 'pieces/chest-1'])
    expect(third.resource(Progress).maxHealth).toBe(HERO_HEALTH)
    third.dispose()

    const fourth = await rooms([chestOf('heart-piece')])
    fourth.resource(Dungeon).heartPieces = ['kiln/hp-1', 'kiln/hp-2', 'kiln/hp-3']
    const [wick] = fourth.query(Hero, Fighter)
    wick?.set(Fighter, { health: 3 })
    openChest(fourth)
    expect(fourth.resource(Progress).maxHealth).toBe(HERO_HEALTH + 2)
    expect(fourth.entity(wick?.sid ?? 0)?.get(Fighter).health).toBe(HERO_HEALTH + 2)
    fourth.dispose()
  })

  it('round-trips the pieces through the save', async () => {
    const saves = base3dSaves()
    const sim = await rooms([chestOf('heart-piece')])
    saves.apply(sim, { ...newGame(), hearts: { max: 4, pieces: ['kiln/hp-1'] } })
    expect(sim.resource(Dungeon).heartPieces).toEqual(['kiln/hp-1'])
    openChest(sim)
    expect(saves.capture(sim).hearts).toEqual({ max: 4, pieces: ['kiln/hp-1', 'pieces/chest-1'] })
    sim.dispose()
  })
})

/** A pot 0.8 m round, 1 m north of Wick's start at z −3. */
const potAt = (z = -2) => ({ def: 'pot', id: 'pot-1', x: 0, z, width: 0.8, depth: 0.8, drop: 'pot' })

describe('pots (GAME-3D.1f part 4, DESIGN.md §10)', () => {
  it('stands as a wall, breaks on a slash, may leave a drop from the table, and is neither locked nor saved', async () => {
    const sim = await rooms([potAt()], { x: 0, z: -3.5 })
    stepWith(sim, { stick: UP }, 30)
    expect(hero(sim).z).toBeLessThanOrEqual(metres(-2.4) - HERO_HALF)
    stepWith(sim, { lock: true }, 2)
    expect(hero(sim).lockTarget).toBe(0)
    const events = [...stepWith(sim, { act: { slash: true } }), ...stepWith(sim, {}, 20)]
    expect(ofType(events, 'piece.broke')).toEqual([{ piece: 1 }])
    expect(sim.query(Breakable)).toHaveLength(0)
    expect(sim.query(Drop).length).toBeLessThanOrEqual(1)
    expect(sim.resource(Dungeon).flags).toEqual([])
    stepWith(sim, { stick: UP }, 30)
    expect(hero(sim).z).toBeGreaterThan(metres(-1.6))
    sim.dispose()
  })

  it('breaks on a bomb’s blast', async () => {
    const sim = await rooms([potAt(1)], { x: 0, z: 0 })
    Object.assign(sim.resource(Inventory), { bombs: true, equipped: ItemCode.bombs, bombAmmo: 1 })
    const events = [
      ...stepWith(sim, { act: { item: true } }),
      ...stepWith(sim, { stick: DOWN }, 30),
      ...stepWith(sim, {}, BOMBS.fuse),
    ]
    expect(ofType(events, 'bomb.blast')).toHaveLength(1)
    expect(ofType(events, 'piece.broke')).toEqual([{ piece: 1 }])
    sim.dispose()
  })

  it('stands again when Wick comes back into its room', async () => {
    const sim = await rooms([potAt()], { x: 0, z: -3.5 })
    stepWith(sim, { stick: UP }, 30)
    stepWith(sim, { act: { slash: true } })
    stepWith(sim, {}, 20)
    expect(sim.query(Breakable)).toHaveLength(0)
    stepWith(sim, { stick: { x: 127, y: 0 } }, 30)
    while (sim.resource(Dungeon).room !== 'north') stepWith(sim, { stick: UP })
    while (sim.resource(Dungeon).room !== 'south') stepWith(sim, { stick: DOWN })
    expect(sim.query(Breakable)).toHaveLength(1)
    sim.dispose()
  })
})

/** A cracked wall 2 m wide across Wick's way, 1 m north of the origin. */
const cracked = { def: 'cracked', id: 'cracked-1', x: 0, z: 1, width: 2, depth: 0.4 }

describe('cracked walls (GAME-3D.1f part 4, DESIGN.md §10)', () => {
  it('takes a slash unharmed, and goes for good in a bomb’s blast, saved', async () => {
    const sim = await rooms([cracked], { x: 0, z: 0 })
    const slashed = [...stepWith(sim, { act: { slash: true } }), ...stepWith(sim, {}, 30)]
    expect(ofType(slashed, 'piece.broke')).toEqual([])
    expect(sim.query(Breakable)).toHaveLength(1)
    Object.assign(sim.resource(Inventory), { bombs: true, equipped: ItemCode.bombs, bombAmmo: 1 })
    const events = [
      ...stepWith(sim, { act: { item: true } }),
      ...stepWith(sim, { stick: DOWN }, 30),
      ...stepWith(sim, {}, BOMBS.fuse),
    ]
    expect(ofType(events, 'piece.broke')).toEqual([{ piece: 1 }])
    expect(sim.query(Breakable)).toHaveLength(0)
    expect(sim.resource(Dungeon).flags).toEqual(['pieces/cracked-1'])
    stepWith(sim, { stick: UP }, 90)
    expect(hero(sim).z).toBeGreaterThan(metres(1.5))
    sim.dispose()
  })

  it('is gone from the start when the save has it broken', async () => {
    const sim = await rooms([cracked], { x: 0, z: 0 })
    sim.resource(Dungeon).flags = ['pieces/cracked-1']
    stepWith(sim, {}, 1)
    expect(sim.query(Breakable)).toHaveLength(0)
    stepWith(sim, { stick: UP }, 40)
    expect(hero(sim).z).toBeGreaterThan(metres(1.5))
    sim.dispose()
  })
})

/** A gate across the whole line between the rooms. */
const gateOf = (def: 'one-way' | 'ledge-drop', field: Record<string, string>) => ({
  def,
  id: 'gate-1',
  x: 0,
  z: 0,
  width: 20,
  depth: 0.3,
  ...field,
})

describe('one-way gates and ledge drops (GAME-3D.1f part 4, DESIGN.md §10)', () => {
  it('lets Wick through a one-way gate from its `from` room only', async () => {
    const sim = await rooms([gateOf('one-way', { from: 'south' })])
    stepWith(sim, { stick: UP }, 60)
    expect(hero(sim).z).toBeGreaterThan(metres(0.15) + HERO_HALF)
    expect(sim.query(Gate)[0]?.get(Gate).open).toBe(false)
    stepWith(sim, { stick: DOWN }, 90)
    expect(hero(sim).z).toBeGreaterThanOrEqual(metres(0.15) + HERO_HALF)
    sim.dispose()

    const shut = await rooms([gateOf('one-way', { from: 'north' })])
    stepWith(shut, { stick: UP }, 60)
    expect(hero(shut).z).toBeLessThanOrEqual(metres(-0.15) - HERO_HALF)
    shut.dispose()
  })

  it('drops Wick over a ledge into its `to` room, one way, and says so', async () => {
    const sim = await rooms([gateOf('ledge-drop', { to: 'north' })])
    const events = stepWith(sim, { stick: UP }, 60)
    expect(ofType(events, 'ledge.dropped')).toEqual([{ piece: 1 }])
    expect(hero(sim).z).toBeGreaterThan(metres(0.15) + HERO_HALF)
    stepWith(sim, { stick: DOWN }, 90)
    expect(hero(sim).z).toBeGreaterThanOrEqual(metres(0.15) + HERO_HALF)
    sim.dispose()

    const below = await rooms([gateOf('ledge-drop', { to: 'south' })])
    stepWith(below, { stick: UP }, 60)
    expect(hero(below).z).toBeLessThanOrEqual(metres(-0.15) - HERO_HALF)
    below.dispose()
  })
})

describe('the npc and the shop (GAME-3D.1f part 4, DESIGN.md §10)', () => {
  const npc = { def: 'npc', id: 'smith', x: 0.8, z: -2, figure: 'wick', lines: 'npc.smith' }
  const shop = { def: 'shop', id: 'stall', x: -1, z: -2, width: 1, depth: 1, stock: 'kiln-stall' }

  it('answer a press beside them with an event, and one out of reach does not', async () => {
    const sim = await rooms([npc, shop])
    const events = press(sim)
    expect(ofType(events, 'npc.talk')).toEqual([{ piece: 1 }])
    expect(ofType(events, 'shop.open')).toEqual([{ piece: 2 }])
    sim.dispose()

    const far = await rooms([
      { ...npc, x: 5 },
      { ...shop, x: -5 },
    ])
    const none = press(far)
    expect(ofType(none, 'npc.talk')).toEqual([])
    expect(ofType(none, 'shop.open')).toEqual([])
    far.dispose()
  })
})
