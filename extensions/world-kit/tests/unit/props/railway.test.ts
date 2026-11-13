// The railway's things: track, platform edge, canopy, signal, ticket window, lever frame and trunk, and the platform lamp
// preset. Each kind is registered, draws the same twice, keeps to the
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
  ticketWindow: [1.6, 2.1, 0.5],
  leverFrame: [1.2, 1.3, 0.6],
  trunk: [0.9, 0.5, 0.5],
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

describe('the indoor things’ parameters', () => {
  /** A piece's mesh, or undefined where the build has none of that label. */
  const meshOf = (b: Built, label: string): MeshData | undefined =>
    b.pieces.find((p) => p.label === label)?.mesh

  it('the ticket window is as wide as asked', () => {
    expect(sizeOf(built('ticketWindow', { width: 2 }))[0]).toBeCloseTo(2, 1)
  })

  it('the ticket window with its hatch shut is no deeper than its counter', () => {
    const shut = built('ticketWindow', { open: false })
    expect(sizeOf(shut)[2] as number).toBeLessThanOrEqual((sizeOf(shut, ['counter'])[2] as number) + 1e-6)
  })

  it('the ticket window’s hatch is up when open and down when shut; the rest does not move', () => {
    const top = (open: boolean): number => bounds(built('ticketWindow', { open }), ['sash'])[0][1] as number
    expect(top(true)).toBeGreaterThan(top(false) + 0.3)
    for (const label of ['counter', 'partition'])
      expect(meshOf(built('ticketWindow', { open: true }), label)).toEqual(
        meshOf(built('ticketWindow', { open: false }), label),
      )
  })

  it('the lever frame has the levers asked for, one piece each, and is as wide as they need', () => {
    const levers = (n: number): string[] =>
      built('leverFrame', { levers: n })
        .pieces.map((p) => p.label)
        .filter((l) => l.startsWith('lever') && l !== 'leverFrame')
    expect(levers(4)).toHaveLength(4)
    expect(levers(6)).toHaveLength(6)
    expect(sizeOf(built('leverFrame', { levers: 6 }))[0]).toBeGreaterThan(
      sizeOf(built('leverFrame'))[0] as number,
    )
  })

  it('a pulled lever leans toward −z and the rest of the frame is the same', () => {
    const shut = built('leverFrame', { pulled: [] })
    const one = built('leverFrame', { pulled: [1] })
    expect(one.pieces.map((p) => p.label)).toEqual(shut.pieces.map((p) => p.label))
    for (const { label, mesh } of one.pieces) {
      const same = JSON.stringify(mesh) === JSON.stringify(meshOf(shut, label))
      expect(same, label).toBe(label !== 'lever1')
    }
    // Lever 1's far end is behind where it was: its lowest z is more negative.
    expect(bounds(one, ['lever1'])[0][2] as number).toBeLessThan(bounds(shut, ['lever1'])[0][2] as number)
  })

  // A strap is a band round the trunk: where the lid curves down to its front and back edges, the strap follows it and
  // never stands up past it as a tab.
  it("the trunk's straps follow the lid's curve and do not stand past its edges", () => {
    const trunk = built('trunk')
    const top = (label: string, nearEdge: (z: number) => boolean): number => {
      const positions = piece(trunk, label).mesh.positions
      let highest = -Infinity
      for (let i = 0; i < positions.length; i += 3)
        if (nearEdge(positions[i + 2] as number)) highest = Math.max(highest, positions[i + 1] as number)
      return highest
    }
    for (const nearEdge of [(z: number) => z <= -0.22, (z: number) => z >= 0.22])
      expect(top('straps', nearEdge)).toBeLessThanOrEqual(top('lid', nearEdge) + 0.01)
  })

  it('the trunk is as wide as asked and has the straps asked for', () => {
    expect(sizeOf(built('trunk', { width: 1.2 }))[0]).toBeCloseTo(1.2, 1)
    const strapVertices = (n: number): number =>
      meshOf(built('trunk', { straps: n }), 'straps')?.positions.length ?? 0
    expect(strapVertices(2)).toBeGreaterThan(0)
    expect(strapVertices(4)).toBe(2 * strapVertices(2))
    expect(strapVertices(0)).toBe(0)
  })
})

describe('the preset lamp.platform', () => {
  it('resolves, to core’s street lamp at 3.4 m with the lamp head and a warm bulb', () => {
    const resolved = resolveProp({ use: 'lamp.platform' }, worldKitLibrary)
    if (isFault(resolved)) throw new Error(`no preset lamp.platform: ${resolved.code}`)
    expect(resolved.kind).toBe('streetLamp')
    expect(resolved.params).toMatchObject({ height: 3.4, head: 'lampHead', glass: 'bulbWarm' })
  })

  it('draws a lamp 3.4 m tall that carries a light, and builds in a level with no problem', () => {
    const resolved = resolveProp({ use: 'lamp.platform' }, worldKitLibrary)
    if (isFault(resolved)) throw new Error(resolved.code)
    const lamp = resolved.generator(resolved.params)
    expect(lamp.lights?.length ?? 0).toBeGreaterThan(0)
    expect(sizeOf(lamp)[1]).toBeGreaterThan(3.4)
    expect(sizeOf(lamp)[1]).toBeLessThan(3.7)
    expect(
      buildWorld(levelWith([{ id: 'l', use: 'lamp.platform', at: [3, 3] }]), worldKitLibrary).problems,
    ).toEqual([])
  })
})

describe('in a level', () => {
  const level = levelWith(
    KINDS.map((kind, i) => ({ id: kind, use: kind, at: [1.5 + (i % 3) * 2, 1.5 + Math.floor(i / 3) * 2] })),
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
