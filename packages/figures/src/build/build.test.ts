import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { FigureDef } from '../figure/figure.schema'
import { skeleton } from '../figure/figure-skeleton'
import type { Garment } from '../figure/garment.schema'
import { GROUP, type Part } from '../parts/mesh'
import { J, JOINTS, type Skeleton } from '../rig/rig'
import { type FixtureFigures, fixtureFigures } from '../testing/fixture-library'
import { GOLDEN_OUTFITS } from '../testing/golden-outfits'
import { type Built, build, type FigureLibrary } from './build'

interface GoldenPart {
  readonly bone: number
  readonly group: number
  readonly v: number
  readonly i: number
  readonly isum: number
  readonly sum: number[]
  readonly nsum: number[]
  readonly w: number
  readonly cut?: string
}
interface Golden {
  readonly clearance: number[]
  readonly anchors: {
    readonly kind: string
    readonly side: string | null
    readonly bone: number
    readonly at: number[]
    readonly open: number[]
  }[]
  readonly parts: GoldenPart[]
}
const GOLDENS = JSON.parse(
  readFileSync(join(import.meta.dirname, '../testing/__goldens__/figurebuilder-dress.json'), 'utf8'),
) as Record<string, Golden>

/** A part as the goldens fingerprint it (FigureBuilder's dress() run through the same sums, M3.5b step 2). */
function fingerprint(p: Part): Omit<GoldenPart, 'cut'> {
  const P = p.mesh.positions
  const N = p.mesh.normals
  const sum = [0, 0, 0]
  const nsum = [0, 0, 0]
  for (let i = 0; i < P.length; i++) {
    sum[i % 3] = (sum[i % 3] ?? 0) + (P[i] ?? 0)
    nsum[i % 3] = (nsum[i % 3] ?? 0) + (N[i] ?? 0)
  }
  let w = 0
  for (const v of p.skin ?? []) for (const [bone, x] of v) w += (bone + 1) * x
  let isum = 0
  for (const i of p.mesh.indices) isum += i
  return { bone: p.bone ?? -1, group: p.group, v: P.length / 3, i: p.mesh.indices.length, isum, sum, nsum, w }
}

const close = (actual: number, expected: number, what: string): void => {
  expect(Math.abs(actual - expected), `${what}: ${actual} vs ${expected}`).toBeLessThanOrEqual(
    1e-9 * Math.max(1, Math.abs(expected)),
  )
}

const figureOf = (sliders: FigureDef['sliders'], skin: string, garments: readonly Garment[]): FigureDef => ({
  sliders,
  skin,
  gait: 'bounce',
  hand: 'R',
  outfits: { golden: garments },
  default: 'golden',
})

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

/** Every part is bound to real joints, and every number in it is finite. */
function expectSound(built: Built): void {
  expect(built.parts.length).toBeGreaterThan(0)
  for (const [n, p] of built.parts.entries()) {
    const what = `part ${n} (${p.material})`
    const vertices = p.mesh.positions.length / 3
    expect(p.mesh.normals, what).toHaveLength(p.mesh.positions.length)
    expect([...p.mesh.positions, ...p.mesh.normals].every(Number.isFinite), what).toBe(true)
    expect(
      p.mesh.indices.every((i) => Number.isInteger(i) && i >= 0 && i < vertices),
      what,
    ).toBe(true)
    expect((p.bone === undefined) !== (p.skin === undefined), `${what} is rigid or skinned`).toBe(true)
    if (p.bone !== undefined) expect(p.bone >= 0 && p.bone < JOINTS.length, what).toBe(true)
    if (p.skin) {
      expect(p.skin, what).toHaveLength(vertices)
      for (const pairs of p.skin) {
        const total = pairs.reduce((sum, [joint, weight]) => {
          expect(joint >= 0 && joint < JOINTS.length && Number.isFinite(weight), what).toBe(true)
          return sum + weight
        }, 0)
        expect(Math.abs(total - 1), what).toBeLessThan(1e-9)
      }
    }
  }
  for (const d of built.decals) {
    expect([...d.at, ...d.normal].every(Number.isFinite), d.material).toBe(true)
    expect(d.bone >= 0 && d.bone < JOINTS.length).toBe(true)
  }
  // Every material a part or decal names is a palette colour (Endesga 64: 64 colours).
  for (const name of [...built.parts.map((p) => p.material), ...built.decals.map((d) => d.material)]) {
    const material = built.materials[name]
    expect(material, `material ${name}`).toBeDefined()
    expect(Number.isInteger(material?.colour) && (material?.colour ?? -1) >= 0, name).toBe(true)
    expect(material?.colour ?? 64, name).toBeLessThan(64)
  }
  expect(built.clearance.every((c) => c >= 0 && c <= 0.6)).toBe(true)
}

let fixture: FixtureFigures
let library: FigureLibrary
beforeAll(async () => {
  fixture = await fixtureFigures()
  library = fixture.library
})

describe('build() matches FigureBuilder dress() part for part (goldens, a1f7246)', () => {
  for (const outfit of GOLDEN_OUTFITS) {
    it(`${outfit.name}: the same parts, bones, skins, anchors and clearance`, () => {
      const def = figureOf(outfit.sliders, outfit.skin, outfit.garments)
      const built = build(def, skeleton(def), 'golden', null, library)
      const golden = GOLDENS[outfit.name]
      if (!golden) throw new Error(`no golden for ${outfit.name}`)
      // Cut here (decisions 4 and 9): the chain's nameplate. Added here: the pony's cuffs, which the source
      // builds only past 1.5 × its ppm.
      const want = golden.parts.filter((p) => p.cut === undefined)
      const cuff = (p: Part) => p.group === GROUP.hair && p.material === 'chrome-dark' && p.skin !== undefined
      const got = built.parts.filter((p) => !cuff(p))
      expect(got.map((p) => p.material)).toHaveLength(want.length)
      for (const [n, expected] of want.entries()) {
        const part = got[n]
        if (!part) throw new Error(`no part ${n}`)
        const actual = fingerprint(part)
        const what = `${outfit.name} part ${n} (${part.material})`
        expect([actual.bone, actual.group, actual.v, actual.i, actual.isum], what).toEqual([
          expected.bone,
          expected.group,
          expected.v,
          expected.i,
          expected.isum,
        ])
        for (const c of [0, 1, 2]) {
          close(actual.sum[c] ?? Number.NaN, expected.sum[c] ?? Number.NaN, `${what} sum ${c}`)
          close(actual.nsum[c] ?? Number.NaN, expected.nsum[c] ?? Number.NaN, `${what} normals ${c}`)
        }
        close(actual.w, expected.w, `${what} skin`)
      }
      // Cut with the nameplate (decision 9): the chain's `pendant` anchor.
      const anchors = golden.anchors.filter((a) => a.kind !== 'pendant')
      expect(built.anchors.map((a) => [a.kind, a.side ?? null, a.bone])).toEqual(
        anchors.map((a) => [a.kind, a.side, a.bone]),
      )
      for (const [n, a] of built.anchors.entries()) {
        const expected = anchors[n]
        for (const c of [0, 1, 2] as const) {
          close(a.at[c], expected?.at[c] ?? Number.NaN, `${outfit.name} anchor ${n} at`)
          close(a.open[c], expected?.open[c] ?? Number.NaN, `${outfit.name} anchor ${n} open`)
        }
      }
      for (const c of [0, 1]) close(built.clearance[c] ?? Number.NaN, golden.clearance[c] ?? 0, 'clearance')
      expectSound(built)
    })
  }
  it("builds the pony's cuffs on every other braid (the source's density gate is a sprite's)", () => {
    const outfit = GOLDEN_OUTFITS.find((o) => o.name === 'model-moto')
    if (!outfit) throw new Error('no model-moto')
    const def = figureOf(outfit.sliders, outfit.skin, outfit.garments)
    const cuffs = build(def, skeleton(def), 'golden', null, library).parts.filter(
      (p) => p.group === GROUP.hair && p.material === 'chrome-dark' && p.skin !== undefined,
    )
    // Seven ropes, the four on top cuffed.
    expect(cuffs).toHaveLength(4)
    for (const cuff of cuffs) expect(cuff.skin?.length).toBe(cuff.mesh.positions.length / 3)
  })
})

describe('the fixture figures build', () => {
  it('every outfit of Wick and the keeper, sound and on palette colours', () => {
    for (const [id, def] of Object.entries(fixture.figures)) {
      const s = skeleton(def)
      for (const outfit of Object.keys(def.outfits)) {
        const built = build(def, s, outfit, null, library)
        expect(built.parts.length, `${id} ${outfit}`).toBeGreaterThan(20)
        expectSound(built)
      }
    }
  })
  it("an item's parts ride the holding hand's socket, and an unknown one is named", () => {
    const keeper = fixture.figures.keeper
    if (!keeper) throw new Error('no keeper')
    const s = skeleton(keeper)
    const bare = build(keeper, s, 'lamplighter', null, library)
    const lit = build(keeper, s, 'lamplighter', 'torch', library)
    const held = lit.parts.filter((p) => p.group === GROUP.item)
    expect(bare.parts.filter((p) => p.group === GROUP.item)).toHaveLength(0)
    expect(held).toHaveLength(lit.parts.length - bare.parts.length)
    expect(held.length).toBeGreaterThan(0)
    // The keeper holds with the left hand.
    for (const p of held) expect(p.bone).toBe(J['socket.L'])
    expectSound(lit)
    expect(() => build(keeper, s, 'lamplighter', 'lantern', library)).toThrow(/no item lantern/)
    expect(() => build(keeper, s, 'ballgown', null, library)).toThrow(/no outfit ballgown/)
  })
  it("the face's marks are anchor points on the head: eyes, lids, brows and mouth (no drawn face)", () => {
    const wick = fixture.figures.wick
    if (!wick) throw new Error('no wick')
    const built = build(wick, skeleton(wick), 'wanderer', null, library)
    const face = built.decals.filter((d) => d.tag === 'face')
    expect(face.length).toBe(14)
    for (const d of face) expect(d.bone).toBe(J.head)
    expect(face.filter((d) => d.blink === true).map((d) => d.material)).toEqual(['lid', 'lid'])
  })
})

describe('hairPieces (decision 6): a hair garment with no style wears the figure’s own pieces', () => {
  // The hair's parts: on the head's group (which the head shares), in the hair's colour.
  const pieces = (def: FigureDef, s: Skeleton) =>
    build(def, s, 'golden', null, library).parts.filter(
      (p) => p.group === GROUP.hair && p.material.startsWith('auburn'),
    )
  it('in order, in the garment’s colour; a style on the garment wins; no hair garment, no hair', () => {
    const base = figureOf({}, 'fair', [{ tee: 'navy' }, { hair: 'auburn' }, { eyes: 'eye-dark' }])
    const def: FigureDef = { ...base, hairPieces: ['cropped', 'sleek-bun'] }
    const s = skeleton(def)
    const cropped = pieces(figureOf({}, 'fair', [{ hair: 'auburn', style: 'cropped' }]), s)
    const bun = pieces(figureOf({}, 'fair', [{ hair: 'auburn', style: 'sleek-bun' }]), s)
    const both = pieces(def, s)
    expect(cropped.length).toBeGreaterThan(0)
    expect(bun.length).toBeGreaterThan(0)
    expect(both).toEqual([...cropped, ...bun])
    const styled = { ...def, outfits: { golden: [{ hair: 'auburn', style: 'bob' }] } }
    expect(pieces(styled, s)).toEqual(pieces(figureOf({}, 'fair', [{ hair: 'auburn', style: 'bob' }]), s))
    expect(pieces({ ...def, outfits: { golden: [{ tee: 'navy' }] } }, s)).toEqual([])
    expect(() => build(base, s, 'golden', null, library)).toThrow(/hairPieces/)
  })
})

describe('F-d: build is pure, so swapping an outfit rebuilds the parts and changes no joint', () => {
  it('outfit A, then B, then A again: A is the same, and the skeleton is untouched', () => {
    const keeper = fixture.figures.keeper
    if (!keeper) throw new Error('no keeper')
    const s = skeleton(keeper)
    const before = structuredClone(s)
    deepFreeze(s)
    deepFreeze(keeper)
    deepFreeze(library)
    const first = build(keeper, s, 'lamplighter', 'hand-lamp', library)
    const other = build(keeper, s, 'shirtsleeves', 'hand-lamp', library)
    const again = build(keeper, s, 'lamplighter', 'hand-lamp', library)
    expect(again).toEqual(first)
    expect(other.parts.length).not.toBe(first.parts.length)
    // Every joint's rest place and offset as they were, for either outfit: the skeleton is the figure's, not
    // the outfit's (skeleton(def) reads no outfit, and build never writes it).
    expect(s).toEqual(before)
    expect(skeleton(keeper)).toEqual(before)
  })
})
