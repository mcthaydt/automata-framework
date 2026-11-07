// The geometry golden checks (tests/fixtures/goldens/dress.json, recorded by scripts/record-goldens.ts), shared by build.test.ts, which runs
// them in Node, and build/golden.parity.test.ts, which runs the same checks in Chromium, WebKit and Firefox. The
// goldens are a JSON import, not a file read, so this module loads in a browser page too.

import { expect } from 'vitest'
import goldens from '../../tests/fixtures/goldens/dress.json' with { type: 'json' }
import { JOINTS } from '../features/figures/body/rig.ts'
import type { Built, FigureLibrary } from '../features/figures/figure/build.ts'
import { build } from '../features/figures/figure/build.ts'
import { skeleton } from '../features/figures/figure/figure-skeleton.ts'
import { type Fingerprint, fingerprint, type Moments } from './fingerprint.ts'
import { figureOf, type GoldenOutfit } from './golden-outfits.ts'

type GoldenPart = Fingerprint
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
const GOLDENS = goldens as unknown as Readonly<Record<string, Golden>>

/** `actual` within the goldens' tolerance of `expected`: 1e-9, relative past 1. */
function close(actual: number, expected: number, what: string): void {
  expect(Math.abs(actual - expected), `${what}: ${actual} vs ${expected}`).toBeLessThanOrEqual(
    1e-9 * Math.max(1, Math.abs(expected)),
  )
}

/** Every part is bound to real joints, and every number in it is finite. */
export function expectSound(built: Built): void {
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
        let total = 0
        for (const [joint, weight] of pairs) {
          expect(joint >= 0 && joint < JOINTS.length && Number.isFinite(weight), what).toBe(true)
          total += weight
        }
        expect(Math.abs(total - 1), what).toBeLessThan(1e-9)
      }
    }
  }
  for (const d of built.decals) {
    expect([...d.at, ...d.normal].every(Number.isFinite), d.material).toBe(true)
    expect(d.bone >= 0 && d.bone < JOINTS.length).toBe(true)
  }
  // Every material a part or decal names is a palette colour (DUEL: 256 colours).
  for (const name of [...built.parts.map((p) => p.material), ...built.decals.map((d) => d.material)]) {
    const material = built.materials[name]
    expect(material, `material ${name}`).toBeDefined()
    expect(Number.isInteger(material?.colour) && (material?.colour ?? -1) >= 0, name).toBe(true)
    expect(material?.colour ?? 256, name).toBeLessThan(256)
  }
  expect(built.clearance.every((c) => c >= 0 && c <= 0.6)).toBe(true)
}

/** The outfit built here matches its recorded golden part for part: parts, bones, skins, anchors, clearance. */
export function expectMatchesGolden(outfit: GoldenOutfit, library: FigureLibrary): void {
  const def = figureOf(outfit.sliders, outfit.skin, outfit.garments)
  const built = build(def, skeleton(def), 'golden', null, library)
  const golden = GOLDENS[outfit.name]
  if (!golden) throw new Error(`no golden for ${outfit.name}`)
  const want = golden.parts
  expect(built.parts).toHaveLength(want.length)
  for (const [n, expected] of want.entries()) {
    const part = built.parts[n]
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
    for (const key of ['positions', 'normals'] as const)
      for (const moment of ['sum', 'second', 'ordered'] as const) {
        const want = expected[key][moment]
        const have = (actual[key] as Moments)[moment]
        expect(have, `${what} ${key} ${moment}`).toHaveLength(want.length)
        for (const [c, value] of want.entries())
          close(have[c] ?? Number.NaN, value, `${what} ${key} ${moment} ${c}`)
      }
    close(actual.w, expected.w, `${what} skin`)
    close(actual.wOrdered, expected.wOrdered, `${what} skin order`)
  }
  const anchors = golden.anchors
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
}

/** The next double above `x`: a difference in the last bit, as between two platforms' `Math` functions. */
function nextUp(x: number): number {
  const bits = new BigInt64Array(new Float64Array([x]).buffer)
  bits[0] = (bits[0] ?? 0n) + (x >= 0 ? 1n : -1n)
  return new Float64Array(bits.buffer)[0] ?? Number.NaN
}

/**
 * The outfit on a body one bit taller moves no part past the goldens' tolerance. CI's macOS arm64 runner differs
 * from Linux x64 in the last bit of some `Math` functions, and the source's sweep let that bit decide a rope tip's
 * ring and its normals' side (decision 16); a height one bit higher stands in for that difference.
 */
export function expectPlatformStable(outfit: GoldenOutfit, library: FigureLibrary): void {
  const height = outfit.sliders.height ?? 170
  const def = figureOf(outfit.sliders, outfit.skin, outfit.garments)
  const nudged = figureOf({ ...outfit.sliders, height: nextUp(height) }, outfit.skin, outfit.garments)
  const parts = build(def, skeleton(def), 'golden', null, library).parts
  const moved = build(nudged, skeleton(nudged), 'golden', null, library).parts
  expect(moved).toHaveLength(parts.length)
  for (const [n, part] of parts.entries()) {
    const a = fingerprint(part)
    const b = fingerprint(moved[n] ?? part)
    const what = `${outfit.name} part ${n} (${part.material})`
    expect(b.v, what).toBe(a.v)
    for (const key of ['positions', 'normals'] as const)
      for (const moment of ['sum', 'second', 'ordered'] as const)
        for (const [c, value] of a[key][moment].entries())
          close(b[key][moment][c] ?? Number.NaN, value, `${what} ${key} ${moment} ${c}`)
  }
}
