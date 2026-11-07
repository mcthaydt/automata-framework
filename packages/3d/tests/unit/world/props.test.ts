// Props: how a preset becomes a generator's pieces, where they stand, which way they face, the lights they carry and
// what is reported when the library lacks something. Core draws a box and a cylinder; any other kind is registered.
import { describe, expect, it } from 'vitest'
import { buildWorld } from '#src/features/world/build.ts'
import { worldPropSchema } from '#src/features/world/content/world-prop.schema.ts'
import { LAMP_KINDS } from '#src/features/world/lamp-kit.ts'
import { box } from '#src/features/world/mesh.ts'
import { part } from '#src/features/world/props/piece.ts'
import {
  propGenerator,
  registeredPropGenerators,
  registerPropGenerator,
} from '#src/features/world/props/prop-generator-registry.ts'
import { isFault, resolveProp } from '#src/features/world/props/resolve.ts'
import type { WorldLibrary } from '#src/features/world/swatches.ts'
import type { AfSector2, PropPlace } from '#src/shared/level/af-sector-2.schema.ts'
import type { MeshData } from '#src/shared/math/geometry.ts'
import { RegistryClash } from '#src/shared/registry/registry-clash.ts'

// Kinds a game's extension would register: a wide bench, a swaying tree, a wall lamp with a light.
registerPropGenerator('test.bench', () => ({
  pieces: [part(box([0, 0, 0], [1.6, 0.4, 0.4]), 'wood', 'seat')],
}))
registerPropGenerator('test.tree', () => ({
  pieces: [part(box([0, 0, 0], [0.4, 2, 0.4]), 'wood', 'crown', { sway: 0.05, phase: 1 })],
}))
registerPropGenerator('test.lamp', () => ({
  pieces: [part(box([0, 1, 0], [0.2, 0.2, 0.2]), 'wood', 'shade', { noCast: true })],
  lights: [{ at: [0, 1.2, 0.2], kind: 'bulb' }],
}))

const LIBRARY: WorldLibrary = {
  swatches: {
    wood: { ramp: 'mud', step: 3 },
    crateWood: { ramp: 'mud', step: 4 },
    oakFloor: {},
    plasterWarm: {},
    floor: {},
    wall: {},
    ceiling: {},
  },
  props: {
    crate: { kind: 'box', swatch: 'wood', size: [0.6, 0.5, 0.6] },
    drum: { kind: 'cylinder', swatch: 'wood', radius: 0.3, height: 0.8 },
    bench: { kind: 'test.bench' },
    oak: { kind: 'test.tree' },
    'lamp.wall': { kind: 'test.lamp' },
  },
}

/** A 6 × 6 room with a floor that rises along x, and the props given. */
const levelWith = (list: PropPlace[], extra: Partial<AfSector2> = {}): AfSector2 => ({
  format: 'af-sector/2',
  name: 't',
  sectors: [
    {
      id: 'hall',
      floor: { z: 0, slope: [0.1, 0] },
      ceiling: { z: 4 },
      light: 1,
      corners: [
        [0, 0],
        [6, 0],
        [6, 6],
        [0, 6],
      ],
    },
  ],
  props: list,
  ...extra,
})

const bounds = (mesh: MeshData): { lo: number[]; hi: number[] } => {
  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < mesh.positions.length; i++) {
    const axis = i % 3
    lo[axis] = Math.min(lo[axis] as number, mesh.positions[i] as number)
    hi[axis] = Math.max(hi[axis] as number, mesh.positions[i] as number)
  }
  return { lo, hi }
}

describe('the generators', () => {
  it('core draws a box and a cylinder from a swatch and a size', () => {
    const resolved = resolveProp({ use: 'crate' }, LIBRARY)
    if (isFault(resolved)) throw new Error('fault')
    const built = resolved.generator(resolved.params)
    expect(built.pieces).toHaveLength(1)
    const { lo, hi } = bounds(built.pieces[0]?.mesh as MeshData)
    // Its origin is the base centre: 0.6 wide, 0.5 tall, on the floor.
    expect(lo[1]).toBeCloseTo(0, 5)
    expect(hi[1]).toBeCloseTo(0.5, 5)
    expect((hi[0] as number) - (lo[0] as number)).toBeCloseTo(0.6, 5)
    expect(built.top).toEqual({ y: 0.5, size: [0.6, 0.6] })
  })

  it('core registers only box and cylinder, before any extension', () => {
    expect(registeredPropGenerators().slice(0, 2)).toEqual(['box', 'cylinder'])
  })

  it('refuses a name core or an extension took', () => {
    expect(() => registerPropGenerator('box', () => ({ pieces: [] }))).toThrow(RegistryClash)
    expect(() => registerPropGenerator('test.bench', () => ({ pieces: [] }))).toThrow(RegistryClash)
    expect(propGenerator('spaceship')).toBeUndefined()
  })

  it('takes any kind in a preset, leaving the generator to the builder', () => {
    expect(worldPropSchema.safeParse({ kind: 'test.bench' }).success).toBe(true)
    expect(worldPropSchema.safeParse({ size: [1, 1, 1] }).success).toBe(false)
  })
})

describe('resolving a prop', () => {
  it('lays the place over the preset', () => {
    const resolved = resolveProp({ use: 'crate', with: { swatch: 'crateWood' } }, LIBRARY)
    if (isFault(resolved)) throw new Error('fault')
    expect(resolved.kind).toBe('box')
    expect(resolved.params).toMatchObject({ size: [0.6, 0.5, 0.6], swatch: 'crateWood' })
  })

  it('replaces a surface by its tile and keeps the placement', () => {
    const resolved = resolveProp(
      { kind: 'box', with: { swatch: { tile: 'crateWood', repeat: [2, 2] } } },
      LIBRARY,
    )
    if (isFault(resolved)) throw new Error('fault')
    expect(resolved.params.swatch).toBe('crateWood')
    expect(resolved.placements.crateWood).toEqual({ tile: 'crateWood', repeat: [2, 2] })
  })

  it('says what is missing', () => {
    expect(resolveProp({ use: 'throne' }, LIBRARY)).toEqual({ code: 'unknown-prop', name: 'throne' })
    expect(resolveProp({ kind: 'spaceship' }, LIBRARY)).toEqual({
      code: 'unknown-generator',
      name: 'spaceship',
    })
  })
})

describe('a prop in the world', () => {
  const crate = (extra: Partial<PropPlace> = {}): PropPlace => ({
    id: 'box',
    use: 'crate',
    at: [3, 3],
    ...extra,
  })

  it('stands on the floor under it, in the room it is in', () => {
    const { pieces, problems } = buildWorld(levelWith([crate()]), LIBRARY)
    expect(problems).toEqual([])
    const mine = pieces.filter((piece) => piece.part === 'prop')
    expect(mine.map((piece) => piece.id)).toEqual(['hall:prop:box.0.body'])
    // The floor rises 0.1 per metre along x: 0.3 at x = 3.
    expect(bounds(mine[0]?.mesh as MeshData).lo[1]).toBeCloseTo(0.3, 2)
    expect(mine[0]?.sector).toBe('hall')
  })

  it('stands at the height it is given', () => {
    const { pieces } = buildWorld(levelWith([crate({ at: [3, 3, 1.5] })]), LIBRARY)
    expect(bounds(pieces.find((piece) => piece.part === 'prop')?.mesh as MeshData).lo[1]).toBeCloseTo(1.5, 2)
  })

  it('faces the way its angle says: 90 is its front toward +z, 0 toward +x', () => {
    const wide = { id: 'bench', use: 'bench', at: [3, 3] } as PropPlace
    const along = (angle: number): number[] => {
      const { pieces } = buildWorld(levelWith([{ ...wide, angle }]), LIBRARY)
      const all = pieces.filter((piece) => piece.part === 'prop')
      const lo = [Infinity, 0, Infinity]
      const hi = [-Infinity, 0, -Infinity]
      for (const piece of all) {
        const b = bounds(piece.mesh)
        for (const axis of [0, 2]) {
          lo[axis] = Math.min(lo[axis] as number, b.lo[axis] as number)
          hi[axis] = Math.max(hi[axis] as number, b.hi[axis] as number)
        }
      }
      return [(hi[0] as number) - (lo[0] as number), (hi[2] as number) - (lo[2] as number)]
    }
    const [facingZ, facingX] = [along(90), along(0)]
    // A bench is 1.6 m wide along its own x: along world x when it faces +z, along world z when it faces +x.
    expect(facingZ[0]).toBeGreaterThan(facingZ[1] as number)
    expect(facingX[1]).toBeGreaterThan(facingX[0] as number)
  })

  it('places a placement tile in the prop frame', () => {
    const place = crate({ with: { swatch: { tile: 'crateWood', repeat: [3, 3] } } })
    const { pieces } = buildWorld(levelWith([place]), LIBRARY)
    const box = pieces.find((piece) => piece.id === 'hall:prop:box.0.body')
    expect(box?.surface).toEqual({ tile: 'crateWood', repeat: [3, 3] })
    expect(box?.tex?.repeat).toEqual([3, 3])
    expect(box?.tex?.frame?.o[0]).toBe(3)
    expect(box?.tex?.frame?.o[1]).toBeCloseTo(0.3, 5)
    expect(box?.tex?.frame?.o[2]).toBe(3)
  })

  it('keeps the sway of leaves and the shadow of glow', () => {
    const { pieces } = buildWorld(
      levelWith([
        { id: 'oak', use: 'oak', at: [3, 3] },
        { id: 'sign', use: 'lamp.wall', at: [1, 1] },
      ]),
      LIBRARY,
    )
    expect(pieces.some((piece) => piece.id.startsWith('hall:prop:oak.') && (piece.sway ?? 0) > 0)).toBe(true)
    expect(pieces.find((piece) => piece.id === 'hall:prop:sign.0.shade')?.noCast).toBe(true)
  })

  it('reports a preset the library lacks and still draws the room', () => {
    const { pieces, problems } = buildWorld(levelWith([{ id: 'x', use: 'throne', at: [3, 3] }]), LIBRARY)
    expect(problems).toContainEqual(
      expect.objectContaining({ code: 'unknown-prop', name: 'throne', where: 'x', path: ['props', 0] }),
    )
    expect(pieces.some((piece) => piece.part === 'floor')).toBe(true)
  })

  it('reports a swatch a prop names that the library lacks', () => {
    const { problems } = buildWorld(levelWith([crate({ with: { swatch: 'plaid' } })]), LIBRARY)
    expect(problems).toContainEqual(expect.objectContaining({ code: 'unknown-swatch', name: 'plaid' }))
  })

  it('takes the nearest room for a prop outside every room', () => {
    const { pieces } = buildWorld(levelWith([crate({ at: [-1, 3] })]), LIBRARY)
    expect(pieces.find((piece) => piece.part === 'prop')?.sector).toBe('hall')
  })
})

describe('lamps', () => {
  const lamp = (extra: Record<string, unknown>): Partial<AfSector2> => ({
    lamps: [{ id: 'l', kind: 'bulb', at: [2, 4, 2.5], ...extra }],
  })

  it('resolves a level lamp against its kind, placed in the world as x, up, z', () => {
    const { lamps, problems } = buildWorld(levelWith([], lamp({ range: 99, level: 9 })), LIBRARY)
    expect(problems).toEqual([])
    expect(lamps).toHaveLength(1)
    expect(lamps[0]).toMatchObject({ id: 'l', kind: 'bulb', at: [2, 2.5, 4], color: 0xffce7f, peak: 1.5 })
    // The range holds to the kind's band, the level to its peak.
    expect(lamps[0]?.range).toBe(LAMP_KINDS.bulb?.range[1])
    expect(lamps[0]?.level).toBe(1.5)
  })

  it('takes the middle of the band when it names no range', () => {
    const { lamps } = buildWorld(levelWith([], lamp({})), LIBRARY)
    expect(lamps[0]?.range).toBe(4.75)
  })

  it('reports a kind it lacks and a colour off its tone', () => {
    expect(buildWorld(levelWith([], lamp({ kind: 'plasma' })), LIBRARY).problems).toContainEqual(
      expect.objectContaining({ code: 'unknown-lamp-kind', name: 'plasma', where: 'l' }),
    )
    expect(buildWorld(levelWith([], lamp({ color: '#0000ff' })), LIBRARY).problems).toContainEqual(
      expect.objectContaining({ code: 'lamp-off-tone', where: 'l' }),
    )
    // A neon may be any colour.
    expect(buildWorld(levelWith([], lamp({ kind: 'neon', color: '#0000ff' })), LIBRARY).problems).toEqual([])
  })

  it('carries a prop lamp with the prop, turned with it', () => {
    const place: PropPlace = { id: 'lamp1', use: 'lamp.wall', at: [3, 3, 2], angle: 90 }
    const faced = buildWorld(levelWith([place]), LIBRARY).lamps[0]
    const turned = buildWorld(levelWith([{ ...place, angle: 0 }]), LIBRARY).lamps[0]
    expect(faced).toMatchObject({ id: 'lamp1.light0', prop: 'lamp1', kind: 'bulb' })
    // The wall lamp's light stands 0.2 m out from its wall (+z of the prop): at angle 90 that is +z, at 0 it is +x.
    expect(faced?.at[2]).toBeCloseTo(3.2, 5)
    expect(turned?.at[0]).toBeCloseTo(3.2, 5)
  })
})

describe('a room that asks to be dressed', () => {
  const asks = (dress: AfSector2['dress'], room?: AfSector2['dress']): AfSector2 => {
    const level = levelWith([])
    const [hall] = level.sectors
    return {
      ...level,
      ...(dress === undefined ? {} : { dress }),
      sectors: [{ ...(hall as NonNullable<typeof hall>), ...(room === undefined ? {} : { dress: room }) }],
    }
  }

  it('draws bare and says the world kit is missing, in words a person can act on', () => {
    for (const level of [asks({ as: 'office' }), asks(undefined, { as: 'office' })]) {
      const { pieces, problems } = buildWorld(level, LIBRARY)
      expect(problems).toContainEqual({
        path: expect.any(Array),
        code: 'needs-extension',
        message:
          'This room asks to be furnished by the world kit, which this game doesn\'t have. Add @automata/world-kit, or remove "dress" from the room.',
        where: 'hall',
        name: 'world-kit',
      })
      expect(pieces.every((piece) => piece.part !== 'prop')).toBe(true)
      expect(pieces.some((piece) => piece.part === 'floor')).toBe(true)
    }
  })

  it('says nothing when dressing is switched off', () => {
    expect(buildWorld(asks({ as: 'office', keep: false }), LIBRARY).problems).toEqual([])
  })
})
