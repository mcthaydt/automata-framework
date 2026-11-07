// The prop generators and their placement: what a preset draws, where it stands, which way it faces, the lights it
// carries, and what is reported when the library lacks one.
import { describe, expect, it } from 'vitest'
import { buildWorld } from '#src/features/world/build.ts'
import { LAMP_KINDS, lampFault } from '#src/features/world/lamp-kit.ts'
import { letterMesh, setText, shopName, sizeOf, tubeMesh } from '#src/features/world/lettering.ts'
import { CORE_LIBRARY } from '#src/features/world/library.ts'
import { GENERATORS } from '#src/features/world/props/generators.ts'
import { isFault, resolveProp } from '#src/features/world/props/resolve.ts'
import type { AfSector2, PropPlace } from '#src/shared/level/af-sector-2.schema.ts'
import type { MeshData } from '#src/shared/math/geometry.ts'

const WITH: Record<string, Record<string, unknown>> = { runner: { size: [3, 0.8] } }
const props = CORE_LIBRARY.props as Record<string, unknown>

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

describe('every preset', () => {
  const names = Object.keys(props)

  it('builds finite meshes whose triangles wind to their normals', () => {
    for (const name of names) {
      const resolved = resolveProp({ use: name, with: WITH[name] }, CORE_LIBRARY)
      if (isFault(resolved)) throw new Error(`${name} did not resolve`)
      for (const { mesh, label } of resolved.generator(resolved.params).pieces) {
        const where = `${name}/${label}`
        expect(mesh.positions.every(Number.isFinite), where).toBe(true)
        expect(mesh.normals.length, where).toBe(mesh.positions.length)
        expect(Math.max(...mesh.indices), where).toBeLessThan(mesh.positions.length / 3)
        // Every triangle faces the way the mean of its normals does (the renderer culls back faces).
        for (let t = 0; t < mesh.indices.length; t += 3) {
          const [a, b, c] = [mesh.indices[t], mesh.indices[t + 1], mesh.indices[t + 2]] as [
            number,
            number,
            number,
          ]
          const p = (i: number): number[] => [0, 1, 2].map((k) => mesh.positions[i * 3 + k] as number)
          const [pa, pb, pc] = [p(a), p(b), p(c)] as [number[], number[], number[]]
          const u = pb.map((v, k) => v - (pa[k] as number))
          const v = pc.map((w, k) => w - (pa[k] as number))
          const cross = [
            (u[1] as number) * (v[2] as number) - (u[2] as number) * (v[1] as number),
            (u[2] as number) * (v[0] as number) - (u[0] as number) * (v[2] as number),
            (u[0] as number) * (v[1] as number) - (u[1] as number) * (v[0] as number),
          ]
          const facing = [0, 1, 2].map(
            (k) =>
              (mesh.normals[a * 3 + k] as number) +
              (mesh.normals[b * 3 + k] as number) +
              (mesh.normals[c * 3 + k] as number),
          )
          const dot = cross.reduce((sum, x, k) => sum + x * (facing[k] as number), 0)
          if (dot < -1e-9) throw new Error(`${where}: triangle ${t / 3} faces away from its normals`)
        }
      }
    }
  })

  it('carries lights the lamp kit accepts', () => {
    for (const name of names) {
      const resolved = resolveProp({ use: name, with: WITH[name] }, CORE_LIBRARY)
      if (isFault(resolved)) continue
      for (const light of resolved.generator(resolved.params).lights ?? [])
        expect(lampFault(light), `${name}: ${JSON.stringify(light)}`).toBeUndefined()
    }
  })

  it('draws the same twice, and a seed changes the variety', () => {
    const draw = (seed: number): MeshData[] =>
      GENERATORS.bookStack?.({ seed, count: 4 }).pieces.map((piece) => piece.mesh) ?? []
    expect(draw(3)).toEqual(draw(3))
    expect(draw(3)).not.toEqual(draw(4))
  })
})

describe('resolving a prop', () => {
  it('lays the place over the preset', () => {
    const resolved = resolveProp({ use: 'crate', with: { mat: 'oak' } }, CORE_LIBRARY)
    if (isFault(resolved)) throw new Error('fault')
    expect(resolved.kind).toBe('crate')
    expect(resolved.params).toMatchObject({ size: [0.6, 0.5, 0.6], mat: 'oak', slat: 'oak' })
  })

  it('replaces a surface by its tile and keeps the placement', () => {
    const resolved = resolveProp(
      { kind: 'crate', with: { mat: { tile: 'crateWood', repeat: [2, 2] } } },
      CORE_LIBRARY,
    )
    if (isFault(resolved)) throw new Error('fault')
    expect(resolved.params.mat).toBe('crateWood')
    expect(resolved.placements.crateWood).toEqual({ tile: 'crateWood', repeat: [2, 2] })
  })

  it('says what is missing', () => {
    expect(resolveProp({ use: 'throne' }, CORE_LIBRARY)).toEqual({ code: 'unknown-prop', name: 'throne' })
    expect(resolveProp({ kind: 'spaceship' }, CORE_LIBRARY)).toEqual({
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
    const { pieces, problems } = buildWorld(levelWith([crate()]), CORE_LIBRARY)
    expect(problems).toEqual([])
    const mine = pieces.filter((piece) => piece.part === 'prop')
    expect(mine.map((piece) => piece.id)).toEqual(['hall:prop:box.0.box', 'hall:prop:box.1.slats'])
    // The floor rises 0.1 per metre along x: 0.3 at x = 3.
    expect(bounds(mine[0]?.mesh as MeshData).lo[1]).toBeCloseTo(0.3, 2)
    expect(mine[0]?.sector).toBe('hall')
  })

  it('stands at the height it is given', () => {
    const { pieces } = buildWorld(levelWith([crate({ at: [3, 3, 1.5] })]), CORE_LIBRARY)
    expect(bounds(pieces.find((piece) => piece.part === 'prop')?.mesh as MeshData).lo[1]).toBeCloseTo(1.5, 2)
  })

  it('faces the way its angle says: 90 is its front toward +z, 0 toward +x', () => {
    const wide = { id: 'bench', use: 'bench', at: [3, 3] } as PropPlace
    const along = (angle: number): number[] => {
      const { pieces } = buildWorld(levelWith([{ ...wide, angle }]), CORE_LIBRARY)
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
    const place = crate({ with: { mat: { tile: 'crateWood', repeat: [3, 3] } } })
    const { pieces } = buildWorld(levelWith([place]), CORE_LIBRARY)
    const box = pieces.find((piece) => piece.id === 'hall:prop:box.0.box')
    expect(box?.surface).toEqual({ tile: 'crateWood', repeat: [3, 3] })
    expect(box?.tex?.repeat).toEqual([3, 3])
    expect(box?.tex?.frame?.o[0]).toBe(3)
    expect(box?.tex?.frame?.o[1]).toBeCloseTo(0.3, 5)
    expect(box?.tex?.frame?.o[2]).toBe(3)
  })

  it('keeps the sway of leaves and the shadow of glow', () => {
    const { pieces } = buildWorld(
      levelWith([
        { id: 'oak', use: 'tree.round', at: [3, 3] },
        { id: 'sign', use: 'neon.glass', at: [1, 1] },
      ]),
      CORE_LIBRARY,
    )
    expect(pieces.some((piece) => piece.id.startsWith('hall:prop:oak.') && (piece.sway ?? 0) > 0)).toBe(true)
    expect(pieces.find((piece) => piece.id === 'hall:prop:sign.0.tube')?.noCast).toBe(true)
  })

  it('reports a preset the library lacks and still draws the room', () => {
    const { pieces, problems } = buildWorld(levelWith([{ id: 'x', use: 'throne', at: [3, 3] }]), CORE_LIBRARY)
    expect(problems).toContainEqual(
      expect.objectContaining({ code: 'unknown-prop', name: 'throne', where: 'x', path: ['props', 0] }),
    )
    expect(pieces.some((piece) => piece.part === 'floor')).toBe(true)
  })

  it('reports a swatch a prop names that the library lacks', () => {
    const { problems } = buildWorld(levelWith([crate({ with: { mat: 'plaid' } })]), CORE_LIBRARY)
    expect(problems).toContainEqual(expect.objectContaining({ code: 'unknown-swatch', name: 'plaid' }))
  })

  it('takes the nearest room for a prop outside every room', () => {
    const { pieces } = buildWorld(levelWith([crate({ at: [-1, 3] })]), CORE_LIBRARY)
    expect(pieces.find((piece) => piece.part === 'prop')?.sector).toBe('hall')
  })
})

describe('lamps', () => {
  const lamp = (extra: Record<string, unknown>): Partial<AfSector2> => ({
    lamps: [{ id: 'l', kind: 'bulb', at: [2, 4, 2.5], ...extra }],
  })

  it('resolves a level lamp against its kind, placed in the world as x, up, z', () => {
    const { lamps, problems } = buildWorld(levelWith([], lamp({ range: 99, level: 9 })), CORE_LIBRARY)
    expect(problems).toEqual([])
    expect(lamps).toHaveLength(1)
    expect(lamps[0]).toMatchObject({ id: 'l', kind: 'bulb', at: [2, 2.5, 4], color: 0xffce7f, peak: 1.5 })
    // The range holds to the kind's band, the level to its peak.
    expect(lamps[0]?.range).toBe(LAMP_KINDS.bulb?.range[1])
    expect(lamps[0]?.level).toBe(1.5)
  })

  it('takes the middle of the band when it names no range', () => {
    const { lamps } = buildWorld(levelWith([], lamp({})), CORE_LIBRARY)
    expect(lamps[0]?.range).toBe(4.75)
  })

  it('reports a kind it lacks and a colour off its tone', () => {
    expect(buildWorld(levelWith([], lamp({ kind: 'plasma' })), CORE_LIBRARY).problems).toContainEqual(
      expect.objectContaining({ code: 'unknown-lamp-kind', name: 'plasma', where: 'l' }),
    )
    expect(buildWorld(levelWith([], lamp({ color: '#0000ff' })), CORE_LIBRARY).problems).toContainEqual(
      expect.objectContaining({ code: 'lamp-off-tone', where: 'l' }),
    )
    // A neon may be any colour.
    expect(
      buildWorld(levelWith([], lamp({ kind: 'neon', color: '#0000ff' })), CORE_LIBRARY).problems,
    ).toEqual([])
  })

  it('carries a prop lamp with the prop, turned with it', () => {
    const place: PropPlace = { id: 'lamp1', use: 'lamp.wall', at: [3, 3, 2], angle: 90 }
    const faced = buildWorld(levelWith([place]), CORE_LIBRARY).lamps[0]
    const turned = buildWorld(levelWith([{ ...place, angle: 0 }]), CORE_LIBRARY).lamps[0]
    expect(faced).toMatchObject({ id: 'lamp1.light0', prop: 'lamp1', kind: 'bulb' })
    // The wall lamp's light stands 0.2 m out from its wall (+z of the prop): at angle 90 that is +z, at 0 it is +x.
    expect(faced?.at[2]).toBeCloseTo(3.2, 5)
    expect(turned?.at[0]).toBeCloseTo(3.2, 5)
  })
})

describe('lettering', () => {
  it('sets lines as rows of ink, each line centred', () => {
    const rows = setText(['AB', 'A'])
    const [width, height] = sizeOf(rows)
    expect(height).toBe(5 + 1 + 5)
    expect(rows.every((row) => row.length === width)).toBe(true)
    expect(rows[0]).toBe('###.##.')
  })

  it('makes a quad per run of ink, and tubes along the strokes', () => {
    const rows = setText(['I'])
    expect(letterMesh(rows, 0.05, 0).indices.length / 6).toBeGreaterThanOrEqual(rows.length)
    const tubes = tubeMesh(rows, 0.05, 0, 0.01)
    expect(tubes.positions.length).toBeGreaterThan(0)
    expect(tubes.positions.every(Number.isFinite)).toBe(true)
  })

  it('names a shop from its seed, the same each time', () => {
    expect(shopName(4)).toEqual(shopName(4))
    expect(shopName(4).at(-1)).toMatch(/^[A-Z]+$/)
  })
})
