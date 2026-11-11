// What the world builder draws of a room's structure: trim in bands (skirting, wainscot, rail, capital) with their own
// depth and surface, a wall's top (cap), masses, handrails, pilasters, and a window's bars and moon glass. Each reads
// fields `af-sector/2` already holds.
import { describe, expect, it } from 'vitest'
import { buildWorld, type WorldPiece } from '#src/features/world/build.ts'
import type { WorldLibrary } from '#src/features/world/swatches.ts'
import type { AfCorner2, AfSector2, AfSectorEntry2, AfWall2 } from '#src/shared/level/af-sector-2.schema.ts'

const NAMES = [
  'plasterWarm',
  'oakFloor',
  'trimWhite',
  'glassDay',
  'glassNight',
  'kick',
  'counterFront',
  'counterTop',
  'cap',
  'chrome',
  'moonGlass',
  'plaster',
]
const LIB: WorldLibrary = { swatches: Object.fromEntries(NAMES.map((n) => [n, {}])) }

const room = (
  id: string,
  [x0, z0, x1, z1]: [number, number, number, number],
  extra: Partial<AfSectorEntry2> = {},
  walls: (AfWall2 | undefined)[] = [],
): AfSectorEntry2 => ({
  id,
  floor: { z: 0 },
  ceiling: { z: 3 },
  light: 1,
  corners: [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ].map(([x, z], i) => (walls[i] === undefined ? [x, z] : [x, z, walls[i]])) as AfCorner2[],
  ...extra,
})
const level = (sectors: AfSectorEntry2[], extra: Partial<AfSector2> = {}): AfSector2 => ({
  format: 'af-sector/2',
  name: 't',
  sectors,
  ...extra,
})
const axis = (p: WorldPiece, k: 0 | 1 | 2): number[] => p.mesh.positions.filter((_, i) => i % 3 === k)
const range = (p: WorldPiece, k: 0 | 1 | 2): [number, number] => [
  Math.min(...axis(p, k)),
  Math.max(...axis(p, k)),
]
const near = (a: number, b: number): void => expect(a).toBeCloseTo(b, 6)
const roles = (pieces: WorldPiece[]): string[] => pieces.map((p) => p.id.split(':')[1] as string)
const byRole = (pieces: WorldPiece[], name: string): WorldPiece[] =>
  pieces.filter((p) => p.id.split(':')[1] === name)

// The south wall (edge 0) runs along x at z = 0; the room is at z > 0, so its inward normal is +z.
const COUNTER: AfWall2 = {
  trim: { skirting: 0.1, wainscot: 1.02, rail: 0.08 },
  trimTexture: { skirting: 'kick', wainscot: 'counterFront', rail: 'counterTop' },
  trimDepth: { skirting: -0.06, wainscot: 0.016, rail: 0.05 },
}

describe('trim in bands (a wall that names a wainscot)', () => {
  const { pieces, problems } = buildWorld(level([room('a', [0, 0, 6, 4], {}, [COUNTER])]), LIB)
  it('draws skirting, wainscot and rail as pieces of their own, in the surfaces trimTexture names', () => {
    expect(problems).toEqual([])
    expect(byRole(pieces, 'skirting')[0]?.surface).toBe('kick')
    expect(byRole(pieces, 'wainscot')[0]?.surface).toBe('counterFront')
    expect(byRole(pieces, 'rail')[0]?.surface).toBe('counterTop')
  })
  it('stacks them: skirting from the floor, wainscot up to its height, the rail on top of it', () => {
    const [s, w, r] = ['skirting', 'wainscot', 'rail'].map((n) => byRole(pieces, n)[0] as WorldPiece)
    expect(range(s as WorldPiece, 1)).toEqual([0, 0.1])
    expect(range(w as WorldPiece, 1)).toEqual([0.1, 1.02])
    near(range(r as WorldPiece, 1)[0], 1.02)
    near(range(r as WorldPiece, 1)[1], 1.1)
  })
  it('stands each band trimDepth off the face: a kick plate set back, a rail proud', () => {
    const [s, w, r] = ['skirting', 'wainscot', 'rail'].map((n) => byRole(pieces, n)[0] as WorldPiece)
    near(range(s as WorldPiece, 2)[0], -0.06)
    near(range(w as WorldPiece, 2)[1], 0.016)
    near(range(r as WorldPiece, 2)[1], 0.05)
  })
  it('breaks a band at a door, as the skirting is', () => {
    const one = buildWorld(level([room('a', [0, 0, 6, 4], {}, [COUNTER])]), LIB).pieces
    const broken = buildWorld(
      level([room('a', [0, 0, 6, 4], {}, [{ ...COUNTER, door: { at: 3, width: 1, height: 2 } }])]),
      LIB,
    ).pieces
    const xs = (ps: WorldPiece[]): number[] => axis(byRole(ps, 'wainscot')[0] as WorldPiece, 0)
    expect(xs(one).some((x) => x > 2.5 && x < 3.5)).toBe(true)
    expect(xs(broken).some((x) => x > 2.5 && x < 3.5)).toBe(false)
    expect(xs(broken).some((x) => x < 2.5)).toBe(true)
    expect(xs(broken).some((x) => x > 3.5)).toBe(true)
  })
  it('lets a recessed band show: the wall face starts above a kick plate set back into it', () => {
    const wall = byRole(pieces, 'wall').find((p) => p.id.startsWith('a:wall:0.0')) as WorldPiece
    near(range(wall, 1)[0], 0.1)
  })
  it('keeps a wall without a wainscot as it was: skirting, and a rail at its height', () => {
    const old = buildWorld(level([room('a', [0, 0, 6, 4], {}, [{ skirting: 0.1, rail: 0.9 }])]), LIB).pieces
    const rail = byRole(old, 'rail')[0] as WorldPiece
    near(range(rail, 1)[0], 0.9)
    expect(byRole(old, 'wainscot')).toEqual([])
  })
  it('puts a capital band high up (a pilaster’s moulding), 0.22 m tall', () => {
    const { pieces: capped } = buildWorld(
      level([room('a', [0, 0, 6, 4], {}, [{ trim: { skirting: 0.3, capital: 2.35 } }])]),
      LIB,
    )
    const cap = byRole(capped, 'capital')[0] as WorldPiece
    near(range(cap, 1)[0], 2.35)
    near(range(cap, 1)[1], 2.57)
  })
  it('takes the room’s trim under the wall’s', () => {
    const { pieces: inherited } = buildWorld(
      level([room('a', [0, 0, 6, 4], { trim: { skirting: 0.1, wainscot: 1 } })]),
      LIB,
    )
    expect(byRole(inherited, 'wainscot').length).toBe(4)
  })
  it('trims the steps of a portal too (the reception counter’s front)', () => {
    const lv = level([
      room('hall', [0, 0, 6, 4], {}, [undefined, { next: 'counter', ...COUNTER }]),
      room('counter', [6, 0, 8, 4], { floor: { z: 1.1 } }),
    ])
    const { pieces: stepped, problems: faults } = buildWorld(lv, LIB)
    expect(faults).toEqual([])
    const rail = stepped.find((p) => p.sector === 'hall' && p.id.split(':')[1] === 'rail') as WorldPiece
    expect(rail).toBeDefined()
    near(range(rail, 1)[1], 1.1)
  })
})

describe('a wall’s top (cap)', () => {
  it('is drawn across the masonry behind the face when the trim says cap, at the ceiling', () => {
    const { pieces } = buildWorld(
      level([room('a', [0, 0, 6, 4], { trim: { skirting: 0, wainscot: 0, rail: 0, cap: true } })]),
      LIB,
    )
    const tops = byRole(pieces, 'top')
    expect(tops).toHaveLength(4)
    const south = tops.find((p) => p.id.includes(':top:0.0')) as WorldPiece
    expect(range(south, 1)).toEqual([3, 3])
    near(range(south, 2)[0], -0.125) // the default masonry thickness
    near(range(south, 2)[1], 0)
    expect(south.surface).toBe('cap')
    expect(south.line).toBeDefined() // it is cut away with its wall
  })
  it('is left out when thick is 0, or the trim does not say cap', () => {
    const none = buildWorld(level([room('a', [0, 0, 6, 4], {}, [{ thick: 0 }])]), LIB).pieces
    expect(byRole(none, 'top')).toEqual([])
    const thin = buildWorld(
      level([room('a', [0, 0, 6, 4], { trim: { cap: true } }, [{ thick: 0 }])]),
      LIB,
    ).pieces
    expect(byRole(thin, 'top')).toHaveLength(3)
  })
})

describe('masses', () => {
  const mass = {
    points: [
      { x: 1, z: 1 },
      { x: 3, z: 1 },
      { x: 3, z: 2 },
      { x: 1, z: 2 },
    ],
    top: 0.24,
  }
  it('draws a mass’s top at its height, facing up, in the cap surface', () => {
    const { pieces, problems } = buildWorld(level([room('a', [0, 0, 6, 4])], { masses: [mass] }), LIB)
    expect(problems).toEqual([])
    const top = pieces.find((p) => p.id.includes('mass0:top')) as WorldPiece
    expect(range(top, 1)).toEqual([0.24, 0.24])
    expect(range(top, 0)).toEqual([1, 3])
    expect(top.surface).toBe('cap')
    expect(new Set(top.mesh.normals.filter((_, i) => i % 3 === 1))).toEqual(new Set([1]))
  })
  it('stands the named edges up as faces facing outward, from `from` to the top', () => {
    const { pieces } = buildWorld(
      level([room('a', [0, 0, 6, 4])], {
        masses: [{ ...mass, top: 4.9, faces: { edges: [0], from: 3.2 } }],
      }),
      LIB,
    )
    const face = pieces.find((p) => p.id.includes('mass0:face0')) as WorldPiece
    near(range(face, 1)[0], 3.2)
    near(range(face, 1)[1], 4.9)
    // Edge 0 runs (1,1) → (3,1): the outside is the −z side.
    near(face.mesh.normals[2] as number, -1)
    expect(range(face, 2)).toEqual([1, 1])
  })
  it('carries its cut group, so room visibility can hide it with its walls', () => {
    const { pieces } = buildWorld(
      level([room('a', [0, 0, 6, 4])], { masses: [{ ...mass, cut: 'north-east' }] }),
      LIB,
    )
    expect(pieces.filter((p) => p.id.includes('mass0')).every((p) => p.cut === 'north-east')).toBe(true)
  })
  it('belongs to the room it stands in, and its light', () => {
    const { pieces } = buildWorld(level([room('a', [0, 0, 6, 4], { light: 0.7 })], { masses: [mass] }), LIB)
    const top = pieces.find((p) => p.id.includes('mass0:top')) as WorldPiece
    expect([top.sector, top.light]).toEqual(['a', 0.7])
  })
})

describe('a wall’s cut group', () => {
  it('is carried by every piece of the wall, for room visibility', () => {
    const { pieces } = buildWorld(
      level([room('a', [0, 0, 6, 4], {}, [{ cut: 'north', skirting: 0.1 }])]),
      LIB,
    )
    const mine = pieces.filter((p) => p.id.includes(':0.0.0'))
    expect(roles(mine)).toEqual(expect.arrayContaining(['wall', 'skirting']))
    expect(mine.every((p) => p.cut === 'north')).toBe(true)
    expect(pieces.filter((p) => p.id.includes(':1.0.0')).every((p) => p.cut === undefined)).toBe(true)
  })
})

describe('a handrail', () => {
  it('runs along the wall at its height on brackets, in the chrome surface', () => {
    const { pieces } = buildWorld(level([room('a', [0, 0, 6, 4], {}, [{ handrail: 0.92 }])]), LIB)
    const [rail] = byRole(pieces, 'handrail') as [WorldPiece]
    expect(rail.surface).toBe('chrome')
    near(range(rail, 1)[0], 0.87) // the brackets
    near(range(rail, 1)[1], 0.92 + 0.045)
    expect(range(rail, 0)[0]).toBeGreaterThan(0)
    expect(range(rail, 0)[1]).toBeLessThan(6)
  })
  it('breaks at a door and leaves out a run shorter than 0.6 m', () => {
    const { pieces } = buildWorld(
      level([room('a', [0, 0, 6, 4], {}, [{ handrail: 0.92, door: { at: 3, width: 1, height: 2 } }])]),
      LIB,
    )
    expect(byRole(pieces, 'handrail').length).toBeGreaterThan(0)
    const short = buildWorld(level([room('a', [0, 0, 0.5, 4], {}, [{ handrail: 0.92 }])]), LIB).pieces
    expect(byRole(short, 'handrail')).toEqual([])
  })
  it('falls back to the trim surface when the library has no chrome', () => {
    const lib: WorldLibrary = { swatches: { ...LIB.swatches, chrome: undefined as never } }
    delete (lib.swatches as Record<string, unknown>).chrome
    const { pieces, problems } = buildWorld(level([room('a', [0, 0, 6, 4], {}, [{ handrail: 0.92 }])]), lib)
    expect(problems).toEqual([])
    expect(byRole(pieces, 'handrail')[0]?.surface).toBe('trimWhite')
  })
})

describe('a pilaster', () => {
  it('builds a block out of the wall at its start: width along the wall, depth into the room, floor to ceiling', () => {
    const { pieces } = buildWorld(
      level([room('a', [0, 0, 6, 4], {}, [{ pilaster: { start: [0.4, 0.2] } }])]),
      LIB,
    )
    const [block] = byRole(pieces, 'pilaster') as [WorldPiece]
    near(range(block, 0)[0], 0)
    near(range(block, 0)[1], 0.4)
    near(range(block, 2)[0], 0)
    near(range(block, 2)[1], 0.2)
    expect(range(block, 1)).toEqual([0, 3])
  })
  it('stands at the end of the wall too', () => {
    const { pieces } = buildWorld(
      level([room('a', [0, 0, 6, 4], {}, [{ pilaster: { end: [0.4, 0.2] } }])]),
      LIB,
    )
    const [block] = byRole(pieces, 'pilaster') as [WorldPiece]
    near(range(block, 0)[0], 5.6)
    near(range(block, 0)[1], 6)
  })
})

describe('a window’s bars and moon glass', () => {
  const wall: AfWall2 = { window: { at: 3, width: 0.7, y0: 1.2, y1: 1.9, bars: 4, moon: true } }
  it('stands one bar for each of the window’s bars, spanning the opening', () => {
    const { pieces } = buildWorld(level([room('a', [0, 0, 6, 4], {}, [wall])]), LIB, { night: true })
    const bars = pieces.filter((p) => p.id.includes(':bar0.'))
    expect(bars).toHaveLength(4)
    for (const bar of bars) {
      near(range(bar, 1)[0], 1.2)
      near(range(bar, 1)[1], 1.9)
    }
  })
  it('glazes a moon window with the moon glass, which glows, by day and by night', () => {
    for (const night of [true, false]) {
      const { pieces } = buildWorld(level([room('a', [0, 0, 6, 4], {}, [wall])]), LIB, { night })
      const pane = pieces.find((p) => p.id.includes(':pane0')) as WorldPiece
      expect(pane.surface).toBe('moonGlass')
      expect(pane.noCast).toBe(true)
    }
  })
  it('keeps the plain glass of a window that is not a moon’s', () => {
    const { pieces } = buildWorld(
      level([room('a', [0, 0, 6, 4], {}, [{ window: { at: 3, width: 0.7, y0: 1.2, y1: 1.9 } }])]),
      LIB,
      { night: true },
    )
    expect((pieces.find((p) => p.id.includes(':pane0')) as WorldPiece).surface).toBe('glassNight')
  })
})
