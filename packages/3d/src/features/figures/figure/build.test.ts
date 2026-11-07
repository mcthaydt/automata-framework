import { beforeAll, describe, expect, it } from 'vitest'
import { type FixtureFigures, fixtureFigures } from '../../../testing/fixture-library.ts'
import {
  expectMatchesGolden,
  expectPlatformStable,
  expectSound,
  figureOf,
} from '../../../testing/golden-checks.ts'
import { GOLDEN_OUTFITS } from '../../../testing/golden-outfits.ts'
import { GROUP } from '../body/mesh.ts'
import { J, type Skeleton } from '../body/rig.ts'
import { build, type FigureLibrary } from './build.ts'
import type { FigureDef } from './figure.schema.ts'
import { skeleton } from './figure-skeleton.ts'

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
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
      expectMatchesGolden(outfit, library)
    })
  }
  it("builds the pony's cuffs on every other braid (the source's density gate is a sprite's)", () => {
    const outfit = GOLDEN_OUTFITS.find((o) => o.name === 'model-moto')
    if (!outfit) throw new Error('no model-moto')
    const def = figureOf(outfit.sliders, outfit.skin, outfit.garments)
    const cuffs = build(def, skeleton(def), 'golden', null, library).parts.filter((p) => p.tag === 'cuff')
    // Seven ropes, the four on top cuffed.
    expect(cuffs).toHaveLength(4)
    for (const cuff of cuffs) {
      expect(cuff.material).toBe('chrome-dark')
      expect(cuff.skin?.length).toBe(cuff.mesh.positions.length / 3)
    }
  })
})

describe('build() is platform-stable: a last-bit change moves no part past the goldens’ tolerance', () => {
  // CI's macOS arm64 runner differs from Linux x64 in the last bit of some `Math` functions, and the source's
  // sweep let that bit decide a rope tip's ring and its normals' side (decision 16). A height one bit higher
  // stands in for that difference on every golden outfit.
  for (const outfit of GOLDEN_OUTFITS) {
    it(outfit.name, () => {
      expectPlatformStable(outfit, library)
      // Two builds of a streetwear outfit take a few seconds while the whole repository's checks share the CPU.
    }, 90_000)
  }
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
