// What the plan paints (ED3D.4 step 2): fills and walls as plain data, read from the geometry layers alone, each with
// the selection id the app selects it by.

import type { AfSector2File } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { planScene } from '#src/features/levels-3d/plan/plan-scene.ts'
import { levelBounds } from '#src/features/levels-3d/plan/plan-viewport.ts'
import { selectionOf } from '#src/shared/edit/selection-of.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import type { GeometryLayer } from '#src/shared/level-session/level-profile.ts'
import { loadAuthored } from '#src/testing/fixtures.ts'
import { toyAfSector, toyDock, toyHall } from '#src/testing/toy-af-sector.ts'

const depot = (): AfSector2File => {
  const parsed = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!parsed.ok) throw new Error('the depot does not parse')
  return parsed.value
}

/** The scene of an af-sector level, with the selection ids its profile gives. */
const sceneOf = (level: AfSector2File, hidden: readonly string[] = []) =>
  planScene(afSectorProfile.geometry(level).layers, selectionOf(afSectorProfile, level), { hidden })

/** A hall that is `corners` and a dock joined to it by a portal on x = 8, as in the toy level. */
const hallWith = (corners: AfSector2File['sectors'][number]['corners'], more: object = {}): AfSector2File =>
  toyAfSector({ sectors: [{ ...toyHall, corners, ...more }, toyDock] })

const SQUARE = [
  [0, 0],
  [8, 0, { next: 'dock' }],
  [8, 6],
  [0, 6],
] as const

describe('planScene pits', () => {
  it('marks the fill of a room that is a pit, and no other', () => {
    const level = toyAfSector({ sectors: [toyHall, { ...toyDock, pit: true }] })
    const { fills } = planScene(afSectorProfile.geometry(level).layers, selectionOf(afSectorProfile, level), {
      pits: new Set(['dock']),
    })
    expect(fills.map((fill) => [fill.sector, fill.pit === true])).toEqual([
      ['hall', false],
      ['dock', true],
    ])
  })
})

describe('planScene fills', () => {
  it('has one fill for each sector, with its outline, no holes, its heights and light', () => {
    const level = depot()
    const layers = afSectorProfile.geometry(level).layers
    const { fills } = sceneOf(level)
    expect(fills.map((fill) => fill.sector)).toEqual(['hall', 'dock'])
    const [hall, dock] = fills
    expect(hall).toEqual({
      sector: 'hall',
      selection: 'sector:hall',
      outline: layers[0]?.map.sectors[0]?.points[0],
      holes: [],
      group: 'tile',
      floor: 0,
      ceiling: 4,
      light: 1,
    })
    expect(dock).toMatchObject({
      sector: 'dock',
      selection: 'sector:dock',
      group: 'plank',
      floor: -0.5,
      light: 0.7,
    })
    expect(hall?.outline).toHaveLength(4)
  })

  it("groups by the sector's floor texture, then nothing", () => {
    expect(sceneOf(depot()).fills.map((fill) => fill.group)).toEqual(['tile', 'plank'])
    expect(sceneOf(toyAfSector()).fills.map((fill) => fill.group)).toEqual(['', ''])
  })

  it('gives a sector with a hole the hole as a loop of its own', () => {
    const hole = [
      [2, 2],
      [4, 2],
      [4, 4],
      [2, 4],
    ]
    const level = hallWith(SQUARE, { holes: [hole] })
    const { fills, walls } = sceneOf(level)
    const hall = fills.find((fill) => fill.sector === 'hall')
    expect(hall?.holes).toHaveLength(1)
    expect(hall?.holes[0]?.map((p) => [p.x, p.z]).sort()).toEqual([...hole].sort())
    // The hole's walls are walls of the sector: they belong to no corner, so the sector is their selection.
    const inside = walls.filter((wall) => wall.sector === 'hall' && wall.selection === 'sector:hall')
    expect(inside).toHaveLength(4)
    expect(inside.every((wall) => wall.kind === 'solid')).toBe(true)
  })
})

describe('planScene walls', () => {
  it('has one wall for each physical line: the portal pair on x = 8 is drawn once, from the sector that comes first', () => {
    const { walls } = sceneOf(depot())
    expect(walls).toHaveLength(7)
    const across = walls.filter((wall) => wall.a.x === 8 && wall.b.x === 8)
    expect(across).toHaveLength(1)
    expect(across[0]).toMatchObject({ sector: 'hall', selection: 'wall:hall/1', kind: 'portal' })
  })

  it('classifies a wall as solid, portal, door or window, with the span of a door or a window', () => {
    const { walls } = sceneOf(depot())
    const byName = Object.fromEntries(walls.map((wall) => [wall.selection, wall]))
    // hall corner 0 has a 1.6 m window at 4 m, corner 3 a 1.2 m door at 3 m, corner 1 the portal into the dock.
    expect(byName['wall:hall/0']).toMatchObject({ kind: 'window', a: { x: 0, z: 0 }, b: { x: 8, z: 0 } })
    expect(byName['wall:hall/0']?.span?.[0]).toBeCloseTo(3.2, 9)
    expect(byName['wall:hall/0']?.span?.[1]).toBeCloseTo(4.8, 9)
    expect(byName['wall:hall/2']).toMatchObject({ kind: 'solid' })
    expect(byName['wall:hall/2']).not.toHaveProperty('span')
    expect(byName['wall:hall/3']).toMatchObject({ kind: 'door' })
    expect(byName['wall:hall/3']?.span?.[0]).toBeCloseTo(2.4, 9)
    expect(byName['wall:hall/3']?.span?.[1]).toBeCloseTo(3.6, 9)
    expect(byName['wall:hall/1']).toMatchObject({ kind: 'portal' })
    expect(byName['wall:hall/1']).not.toHaveProperty('span')
    expect(Object.keys(byName).filter((name) => name.startsWith('wall:dock/'))).toEqual([
      'wall:dock/0',
      'wall:dock/1',
      'wall:dock/2',
    ])
  })

  it('keeps the span inside the wall for a door or a window that overhangs its end', () => {
    const level = hallWith([
      [0, 0, { door: { at: 0.3, width: 1.2, height: 2 } }],
      [8, 0, { next: 'dock' }],
      [8, 6, { window: { at: 7.9, width: 1, y0: 1, y1: 2 } }],
      [0, 6],
    ])
    const { walls } = sceneOf(level)
    const door = walls.find((wall) => wall.selection === 'wall:hall/0')
    const window = walls.find((wall) => wall.selection === 'wall:hall/2')
    expect(door?.span?.[0]).toBe(0)
    expect(door?.span?.[1]).toBeCloseTo(0.9, 9)
    // The wall from (8, 6) to (0, 6) is 8 m long.
    expect(window?.span?.[0]).toBeCloseTo(7.4, 9)
    expect(window?.span?.[1]).toBe(8)
  })

  it('draws a portal that carries a door as a portal: its door is a frame', () => {
    const level = hallWith([
      [0, 0],
      [8, 0, { next: 'dock', door: { at: 3, width: 1.2, height: 2.2 } }],
      [8, 6],
      [0, 6],
    ])
    const wall = sceneOf(level).walls.find((w) => w.selection === 'wall:hall/1')
    expect(wall?.kind).toBe('portal')
    expect(wall).not.toHaveProperty('span')
  })

  it('draws a wall that has both a door and a window as its door', () => {
    const level = hallWith([
      [0, 0, { door: { at: 2, width: 1, height: 2 }, window: { at: 6, width: 1, y0: 1, y1: 2 } }],
      [8, 0, { next: 'dock' }],
      [8, 6],
      [0, 6],
    ])
    const wall = sceneOf(level).walls.find((w) => w.selection === 'wall:hall/0')
    expect(wall?.kind).toBe('door')
    expect(wall?.span).toEqual([1.5, 2.5])
  })

  it('draws a portal that does not meet its reverse, a millimetre off in x or in z, as a wall of its own', () => {
    for (const [dx, dz] of [
      [0.001, 0],
      [0, 0.001],
    ] as const) {
      const level = toyAfSector({
        sectors: [
          toyHall,
          {
            ...toyDock,
            corners: [
              [8 + dx, dz],
              [14, 0],
              [14, 6],
              [8 + dx, 6, { next: 'hall' }],
            ],
          },
        ],
      })
      expect(sceneOf(level).walls).toHaveLength(8)
    }
  })

  it('keeps the door and the window of the depot inside their walls', () => {
    const { walls } = sceneOf(depot())
    const cut = walls.filter((wall) => wall.kind === 'door' || wall.kind === 'window')
    expect(cut.filter((wall) => wall.kind === 'door')).toHaveLength(1)
    expect(cut.filter((wall) => wall.kind === 'window')).toHaveLength(1)
    for (const wall of cut) {
      const length = Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z)
      const [from, to] = wall.span ?? [Number.NaN, Number.NaN]
      expect(from).toBeGreaterThanOrEqual(0)
      expect(to).toBeLessThanOrEqual(length + 1e-9)
      expect(to).toBeGreaterThan(from)
    }
    // The hall's door: 1.2 m wide, 3 m along the 6 m west wall.
    const door = walls.find((wall) => wall.selection === 'wall:hall/3')
    expect(door?.kind).toBe('door')
    expect(door?.span?.[0]).toBeCloseTo(2.4, 9)
    expect(door?.span?.[1]).toBeCloseTo(3.6, 9)
  })
})

describe('planScene layers', () => {
  it('leaves out the walls of a hidden walls layer and the fills of a hidden sectors layer', () => {
    const level = depot()
    expect(sceneOf(level, ['walls']).walls).toEqual([])
    expect(sceneOf(level, ['walls']).fills).toHaveLength(2)
    expect(sceneOf(level, ['sectors']).fills).toEqual([])
    expect(sceneOf(level, ['sectors']).walls).toHaveLength(7)
    const none = sceneOf(level, ['sectors', 'walls'])
    expect([none.fills, none.walls]).toEqual([[], []])
    // A hidden layer does not move the frame the level fits in, and another layer's name does nothing.
    expect(none.bounds).toEqual(sceneOf(level).bounds)
    expect(sceneOf(level, ['things:crate']).walls).toHaveLength(7)
  })

  it('has the bounds of the level', () => {
    const level = depot()
    expect(sceneOf(level).bounds).toEqual(levelBounds(afSectorProfile.geometry(level).layers))
  })

  it('draws every layer there is', () => {
    const level = depot()
    const layers = afSectorProfile.geometry(level).layers
    const twice: readonly GeometryLayer[] = [...layers, ...layers]
    const scene = planScene(twice, selectionOf(afSectorProfile, level))
    expect(scene.fills).toHaveLength(4)
  })

  it('is plain data that depends on the geometry alone', () => {
    const level = depot()
    const layers = afSectorProfile.geometry(level).layers
    const select = selectionOf(afSectorProfile, level)
    const scene = planScene(layers, select)
    expect(planScene(layers, select)).toStrictEqual(scene)
    expect(planScene(afSectorProfile.geometry(level).layers, select)).toStrictEqual(scene)
    expect(structuredClone(scene)).toStrictEqual(scene)
  })
})
