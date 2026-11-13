// The railway's things: track, platform edge, canopy and signal. Each is registered, draws the same twice, keeps to the
// size it documents, and does what its parameters say. A level of them builds and its surfaces pass the kit's reads check.
import {
  type Built,
  buildWorld,
  isFault,
  type MeshData,
  type PropPiece,
  resolveProp,
} from '@automata/3d/props-kit'
import { describe, expect, it } from 'vitest'
import { worldKitLibrary } from '#src/app/world-kit-library.ts'
import '#src/features/props/register-props.ts'
import { checkReads } from '#src/features/textures/check-reads.ts'
import { levelWith } from '../../fixtures/level.ts'

type Size = readonly [width: number, height: number, depth: number]

/** What each kind documents as its bounds with no parameters, in metres: width (x), height (y), depth (z, the front). */
const SIZES: Readonly<Record<string, Size>> = {
  rails: [6, 0.3, 2.6],
  platformEdge: [6, 0.9, 0.6],
  canopy: [6, 3.6, 3],
  signal: [1.2, 5, 0.5],
}
const KINDS = Object.keys(SIZES)

function built(kind: string, params: Record<string, unknown> = {}): Built {
  const resolved = resolveProp({ kind, with: params }, worldKitLibrary)
  if (isFault(resolved)) throw new Error(`${kind} is not registered: ${resolved.code}`)
  return resolved.generator(resolved.params)
}

const meshes = (b: Built): MeshData[] => b.pieces.map((p) => p.mesh)
const piece = (b: Built, label: string): PropPiece => {
  const found = b.pieces.find((p) => p.label === label)
  if (found === undefined)
    throw new Error(`no piece "${label}" among ${b.pieces.map((p) => p.label).join(', ')}`)
  return found
}

/** The box round every vertex of the pieces (all of them unless `only` names the labels): [low, high]. */
function bounds(b: Built, only?: readonly string[]): [number[], number[]] {
  const low = [Infinity, Infinity, Infinity]
  const high = [-Infinity, -Infinity, -Infinity]
  for (const { mesh } of b.pieces.filter((p) => only === undefined || only.includes(p.label)))
    for (let i = 0; i < mesh.positions.length; i++) {
      const k = i % 3
      const v = mesh.positions[i] as number
      if (v < (low[k] as number)) low[k] = v
      if (v > (high[k] as number)) high[k] = v
    }
  return [low, high]
}
const sizeOf = (b: Built, only?: readonly string[]): number[] => {
  const [low, high] = bounds(b, only)
  return high.map((h, k) => h - (low[k] as number))
}

describe.each(KINDS)('%s', (kind) => {
  it('is registered by the kit', () => {
    expect(isFault(resolveProp({ kind }, worldKitLibrary))).toBe(false)
  })

  it('draws the same twice: the same vertices, the same bounds', () => {
    const a = built(kind)
    const b = built(kind)
    expect(bounds(a)).toEqual(bounds(b))
    expect(meshes(a)).toEqual(meshes(b))
  })

  it('keeps within 5% of the size it documents', () => {
    const got = sizeOf(built(kind))
    const want = SIZES[kind] as Size
    for (let k = 0; k < 3; k++)
      expect(
        Math.abs((got[k] as number) / (want[k] as number) - 1),
        `axis ${k}: ${got[k]} against ${want[k]}`,
      ).toBeLessThan(0.05)
  })

  it('stands on the floor, centred on its base', () => {
    const [low, high] = bounds(built(kind))
    expect(Math.abs(low[1] as number)).toBeLessThan(0.01)
    // The signal's arm reaches out to one side of its post; every other kind is centred on x.
    if (kind !== 'signal') expect(Math.abs(((low[0] as number) + (high[0] as number)) / 2)).toBeLessThan(0.06)
    expect(Math.abs(((low[2] as number) + (high[2] as number)) / 2)).toBeLessThan(0.1)
  })

  it('has meshes that are finite and index only their own vertices', () => {
    for (const { mesh, label } of built(kind).pieces) {
      expect(mesh.positions.every(Number.isFinite), label).toBe(true)
      expect(mesh.normals.length, label).toBe(mesh.positions.length)
      expect(Math.max(...mesh.indices), label).toBeLessThan(mesh.positions.length / 3)
    }
  })

  it('has a preset of the same name in the library, so a level can say `use`', () => {
    const resolved = resolveProp({ use: kind }, worldKitLibrary)
    if (isFault(resolved)) throw new Error(`no preset ${kind}: ${resolved.code}`)
    expect(resolved.kind).toBe(kind)
  })

  it('uses only swatches the library has', () => {
    for (const { swatch, label } of built(kind).pieces)
      expect(worldKitLibrary.swatches[swatch], `${kind}/${label} -> ${swatch}`).toBeDefined()
  })
})

describe('the parameters', () => {
  it('the rails are as long as asked: twice the length, twice the width', () => {
    expect(sizeOf(built('rails', { length: 12 }))[0]).toBeCloseTo(
      2 * (sizeOf(built('rails'))[0] as number),
      1,
    )
  })

  it('the rails run the gauge apart', () => {
    const [low, high] = bounds(built('rails', { gauge: 1.435 }), ['rails'])
    // Each rail is a few centimetres wide, so the outer faces sit a gauge plus a rail's width apart.
    expect((high[2] as number) - (low[2] as number)).toBeGreaterThan(1.435)
    expect((high[2] as number) - (low[2] as number)).toBeLessThan(1.435 + 0.2)
    const wide = bounds(built('rails', { gauge: 1.6 }), ['rails'])
    expect((wide[1][2] as number) - (wide[0][2] as number)).toBeGreaterThan(
      (high[2] as number) - (low[2] as number),
    )
  })

  it('the rails lie on sleepers, which lie in a bed of ballast, and are painted with the swatches asked', () => {
    const b = built('rails', { rail: 'rust', sleeper: 'oak', bed: 'aggregate' })
    expect(b.pieces.map((p) => [p.label, p.swatch])).toEqual(
      expect.arrayContaining([
        ['rails', 'rust'],
        ['sleepers', 'oak'],
        ['bed', 'aggregate'],
      ]),
    )
  })

  it('the platform edge shows a white line only when asked', () => {
    expect(built('platformEdge', { line: false }).pieces.length).toBeLessThan(
      built('platformEdge', { line: true }).pieces.length,
    )
    expect(built('platformEdge').pieces.map((p) => p.label)).toContain('line')
    expect(built('platformEdge', { line: false }).pieces.map((p) => p.label)).not.toContain('line')
  })

  it('the platform edge is as high as asked', () => {
    expect(sizeOf(built('platformEdge', { height: 1.1 }))[1]).toBeCloseTo(1.1, 1)
  })

  it('the canopy has the posts asked for, each as high as it says', () => {
    const vertices = (n: number): number =>
      piece(built('canopy', { posts: n }), 'posts').mesh.positions.length
    expect(vertices(4)).toBe(2 * vertices(2))
    expect(sizeOf(built('canopy', { height: 3.6 }), ['posts'])[1]).toBeCloseTo(3.6, 1)
  })

  it('the canopy is as long and as deep as asked', () => {
    const [w, , d] = sizeOf(built('canopy', { length: 9, depth: 4 }))
    expect(w).toBeCloseTo(9, 1)
    expect(d).toBeCloseTo(4, 1)
  })

  it('the signal’s arm points higher when the line is clear', () => {
    const armTop = (clear: boolean): number => bounds(built('signal', { clear }), ['arm'])[1][1] as number
    expect(armTop(true)).toBeGreaterThan(armTop(false) + 0.2)
    // The post and the lamp stay where they are.
    expect(piece(built('signal', { clear: true }), 'post').mesh).toEqual(
      piece(built('signal', { clear: false }), 'post').mesh,
    )
  })

  it('the signal’s lamp is lit only when asked, and then carries a light', () => {
    const on = built('signal', { lit: true })
    const off = built('signal', { lit: false })
    expect(on.lights?.length ?? 0).toBeGreaterThan(0)
    expect(off.lights ?? []).toEqual([])
    expect(piece(off, 'lamp').swatch).not.toBe(piece(on, 'lamp').swatch)
  })

  it('the signal is as tall as asked', () => {
    expect(sizeOf(built('signal', { height: 6 }))[1]).toBeCloseTo(6, 1)
  })
})

describe('in a level', () => {
  const level = levelWith(
    KINDS.map((kind, i) => ({ id: kind, use: kind, at: [1 + (i % 2) * 3, 1 + Math.floor(i / 2) * 3] })),
  )

  it('builds with no problem and every prop in its room', () => {
    const { pieces, problems } = buildWorld(level, worldKitLibrary)
    expect(problems).toEqual([])
    for (const kind of KINDS)
      expect(
        pieces.some((p) => p.id.includes(`:prop:${kind}.`)),
        kind,
      ).toBe(true)
  })

  it('has no swatch-reads problem', () => {
    expect(checkReads(level, worldKitLibrary).filter((p) => p.code === 'swatch-reads')).toEqual([])
  })
})
