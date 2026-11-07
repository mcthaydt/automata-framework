import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { measure } from '#src/features/figures/body/genes.ts'
import { skeletonFromGenes } from '#src/features/figures/body/rig.ts'
import { hairStyleSchema } from '#src/features/figures/content/hair.schema.ts'
import { hairParts } from '#src/features/figures/hair/hair-parts.ts'
import { toneOf } from '#src/features/figures/hair/tones.ts'
import { fabricOf, labelAt, registerFabric } from '#src/features/figures/registry/fabric-registry.ts'
import { finishMatte, registerFinish } from '#src/features/figures/registry/hair-finish-registry.ts'
import { registerHairPiece } from '#src/features/figures/registry/hair-piece-registry.ts'
import { RegistryClash } from '#src/features/figures/registry/registry-clash.ts'

// FigureBuilder's H3 (hair pieces), H4 (finishes) and H5 (fabrics), as registries a game's extension fills: a name
// taken, by the base set or an earlier registration, is a RegistryClash that names it.

const m = measure({})
const s = skeletonFromGenes(m.genes)
const input = { m, s, hair: 'hair-dark', skin: 'fair', made: {} }

describe('hair pieces (H3)', () => {
  it('refuses a name the base generators or an earlier piece has taken', () => {
    expect(() => registerHairPiece('tail', { build: () => {} })).toThrow(
      'A hair piece called "tail" is already registered',
    )
    registerHairPiece('ribbon', { build: () => {} })
    expect(() => registerHairPiece('ribbon', { build: () => {} })).toThrow(RegistryClash)
  })
  it('builds a registered piece, hands it its own data, and takes the crown tag when it asks', () => {
    const seen: unknown[] = []
    registerHairPiece<{ n: number }>('crowned', {
      crown: true,
      build: (b, piece) => {
        seen.push(piece)
        b.rigid(
          {
            positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
            normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
            indices: [0, 1, 2],
          },
          'hair',
        )
      },
    })
    registerHairPiece('plain', { build: () => {} })
    const look = hairParts(input, { pieces: [{ crowned: { n: 2 } }, { plain: {} }] } as never)
    expect(seen).toEqual([{ n: 2 }])
    expect(look.parts.map((p) => p.tag)).toEqual(['crown'])
  })
  it('names a piece nobody registered', () => {
    expect(() => hairParts(input, { pieces: [{ nope: {} }] } as never)).toThrow(
      'There is no hair piece called "nope"',
    )
  })
  it("a style's schema accepts a registered piece, checked by its schema, and still refuses an unknown one", () => {
    registerHairPiece('checked', { schema: z.strictObject({ n: z.number() }), build: () => {} })
    expect(hairStyleSchema.safeParse({ pieces: [{ checked: { n: 1 } }] }).success).toBe(true)
    expect(hairStyleSchema.safeParse({ pieces: [{ checked: { n: 'x' } }] }).success).toBe(false)
    const unknown = hairStyleSchema.safeParse({ pieces: [{ missing: {} }] })
    expect(unknown.success).toBe(false)
  })
})

describe('hair finishes (H4)', () => {
  it('the base finishes are there, and a taken name is refused', () => {
    expect(finishMatte('coil')).toBe(true)
    expect(finishMatte('straight')).toBe(false)
    expect(finishMatte('smooth')).toBe(false)
    expect(finishMatte('curl')).toBe(true)
    expect(() => registerFinish('coil', { matte: false })).toThrow(
      'A hair finish called "coil" is already registered',
    )
  })
  it('a registered finish takes effect: a style names it, and its tones are matte when it is', () => {
    registerFinish('wax', { matte: true })
    expect(() => registerFinish('wax', { matte: true })).toThrow(RegistryClash)
    expect(finishMatte('wax')).toBe(true)
    expect(
      hairStyleSchema.safeParse({ finish: 'wax', pieces: [{ scalp: { from: [[0, 0]], lift: 0.1 } }] })
        .success,
    ).toBe(true)
    const made = {}
    expect(toneOf(made, 'hair-dark', 'fair', 'wax', 'hair')).not.toBe('hair-dark')
    expect(toneOf({}, 'hair-dark', 'fair', 'straight', 'hair')).toBe('hair-dark')
  })
  it('a finish nobody registered is refused by the schema, naming the ones there are', () => {
    const r = hairStyleSchema.safeParse({
      finish: 'glitter',
      pieces: [{ scalp: { from: [[0, 0]], lift: 0.1 } }],
    })
    expect(r.success).toBe(false)
    expect(JSON.stringify(r.error?.issues)).toContain('coil')
  })
})

describe('fabrics (H5)', () => {
  it('registers a tile, refuses a taken name and a bad tile', () => {
    registerFabric('twill', { w: 2, h: 2, labels: [0, -1, -1, 0] })
    expect(fabricOf('twill')?.labels).toEqual([0, -1, -1, 0])
    expect(() => registerFabric('twill', { w: 1, h: 1, labels: [0] })).toThrow(
      'A fabric called "twill" is already registered',
    )
    expect(() => registerFabric('bad', { w: 2, h: 2, labels: [0] })).toThrow(
      'fabric bad: 1 labels for a 2×2 tile',
    )
    expect(() => registerFabric('bad', { w: 2, h: 2, labels: [0, 1, 0, 0] })).toThrow(
      'a motif (4×4 or smaller) is one step deep',
    )
    expect(() => registerFabric('bad', { w: 5, h: 1, labels: [0, 0, 0, 0, 3] })).toThrow(
      "a pattern's labels run -2 to +1",
    )
  })
  it('labelAt wraps the tile, at texels a metre or at the tile’s own metres', () => {
    registerFabric('check', { w: 2, h: 1, labels: [0, -1] })
    const f = fabricOf('check')
    if (!f) throw new Error('no check')
    expect([0, 1, 2, 3].map((i) => labelAt(f, (i + 0.5) / 10, 0, 10))).toEqual([0, -1, 0, -1])
    registerFabric('wide', { w: 2, h: 1, labels: [0, -1], metres: 0.5 })
    const w = fabricOf('wide')
    if (!w) throw new Error('no wide')
    expect([labelAt(w, 0.25, 0, 99), labelAt(w, 0.75, 0, 99)]).toEqual([0, -1])
  })
})
