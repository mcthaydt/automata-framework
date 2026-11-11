// The nine ward props: a sink, a trolley, a wheelchair, a gurney, a monitor cart, a wall clock, a key cabinet, a locker and
// a drip stand. Each is registered, draws the same twice, keeps to the size it documents, and does what its parameters say.
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
import { wardRoom } from '../../fixtures/ward-room.ts'

type Size = readonly [width: number, height: number, depth: number]

/** What each kind documents as its bounds with no parameters, in metres: width (x), height (y), depth (z, the front). */
const SIZES: Readonly<Record<string, Size>> = {
  sink: [0.6, 1.1, 0.45],
  trolley: [0.75, 0.95, 0.45],
  wheelchair: [0.65, 0.95, 1.05],
  gurney: [1.9, 1, 0.7],
  monitorCart: [0.5, 1.45, 0.5],
  wallClock: [0.32, 0.32, 0.06],
  keyCabinet: [0.4, 0.5, 0.12],
  locker: [0.6, 1.8, 0.5],
  dripStand: [0.6, 1.9, 0.6],
}
const KINDS = Object.keys(SIZES)
/** Kinds that hang on a wall, so stand above the floor at a height of their own; the rest stand on it. */
const ON_WALL = new Set(['wallClock', 'keyCabinet'])

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

/** The box round every vertex of every piece: [low, high]. */
function bounds(b: Built): [number[], number[]] {
  const low = [Infinity, Infinity, Infinity]
  const high = [-Infinity, -Infinity, -Infinity]
  for (const mesh of meshes(b))
    for (let i = 0; i < mesh.positions.length; i++) {
      const k = i % 3
      const v = mesh.positions[i] as number
      if (v < (low[k] as number)) low[k] = v
      if (v > (high[k] as number)) high[k] = v
    }
  return [low, high]
}
const sizeOf = (b: Built): number[] => {
  const [low, high] = bounds(b)
  return high.map((h, k) => h - (low[k] as number))
}
const vertexCount = (b: Built): number => meshes(b).reduce((sum, m) => sum + m.positions.length / 3, 0)

describe.each(KINDS)('%s', (kind) => {
  it('is registered by the kit', () => {
    expect(isFault(resolveProp({ kind }, worldKitLibrary))).toBe(false)
  })

  it('draws the same twice: the same vertices, the same bounds', () => {
    const a = built(kind)
    const b = built(kind)
    expect(vertexCount(a)).toBe(vertexCount(b))
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

  it(
    ON_WALL.has(kind)
      ? 'hangs above the floor, its back on the wall'
      : 'stands on the floor, centred on its base',
    () => {
      const [low, high] = bounds(built(kind))
      if (ON_WALL.has(kind)) {
        expect(low[1] as number).toBeGreaterThan(0.5)
        expect(Math.abs(low[2] as number)).toBeLessThan(0.02)
        expect(high[2] as number).toBeGreaterThan(0.03)
        return
      }
      expect(Math.abs(low[1] as number)).toBeLessThan(0.01)
      // Centred on x and z to the width of a wheel or a leg.
      expect(Math.abs(((low[0] as number) + (high[0] as number)) / 2)).toBeLessThan(0.06)
      expect(Math.abs(((low[2] as number) + (high[2] as number)) / 2)).toBeLessThan(0.1)
    },
  )

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
})

describe('the parameters', () => {
  it('the sink is as wide as asked', () => {
    expect(sizeOf(built('sink', { width: 0.9 }))[0]).toBeCloseTo(0.9, 1)
  })

  it('the trolley has the shelves asked for, one board each', () => {
    const boards = (shelves: number): number =>
      vertexCount(built('trolley', { shelves })) - vertexCount(built('trolley', { shelves: 1 }))
    expect(boards(3)).toBeGreaterThan(boards(2))
    expect(boards(2)).toBeGreaterThan(0)
  })

  it('the gurney is as long as asked', () => {
    expect(sizeOf(built('gurney', { length: 2.1 }))[0]).toBeCloseTo(2.1, 1)
  })

  it('the locker is as wide as its doors', () => {
    expect(sizeOf(built('locker', { doors: 3 }))[0]).toBeCloseTo(0.9, 1)
    expect(sizeOf(built('locker', { doors: 1 }))[0]).toBeCloseTo(0.3, 1)
  })

  it('the monitor cart shows a lit screen only when it is on', () => {
    const on = built('monitorCart', { on: true })
    const off = built('monitorCart', { on: false })
    const swatches = (b: Built): string[] => b.pieces.map((p) => p.swatch)
    expect(swatches(on)).toContain('screenGlow')
    expect(swatches(off)).not.toContain('screenGlow')
    expect(piece(off, 'screen').swatch).not.toBe(piece(on, 'screen').swatch)
  })

  it('the clock’s hands are in other places at 8:00 and at 4:17', () => {
    const eight = built('wallClock', { hour: 8, minute: 0 })
    const fourSeventeen = built('wallClock', { hour: 4, minute: 17 })
    expect(piece(eight, 'hands').mesh.positions).not.toEqual(piece(fourSeventeen, 'hands').mesh.positions)
    // The face, the rim and the ticks do not move with the time.
    expect(piece(eight, 'face').mesh).toEqual(piece(fourSeventeen, 'face').mesh)
    // A twelve-hour clock: 16:17 reads as 4:17.
    expect(piece(built('wallClock', { hour: 16, minute: 17 }), 'hands').mesh).toEqual(
      piece(fourSeventeen, 'hands').mesh,
    )
  })

  it('the clock’s minute hand points where the minute says', () => {
    // At :15 the minute hand lies to the right of the centre (+x), level with it; at :30 it points down.
    const tip = (minute: number): { x: number; y: number } => {
      const hands = piece(built('wallClock', { hour: 12, minute }), 'hands').mesh
      let far = { x: 0, y: 0 }
      const cx = 0
      const cy = 2.2
      for (let i = 0; i < hands.positions.length; i += 3) {
        const x = (hands.positions[i] as number) - cx
        const y = (hands.positions[i + 1] as number) - cy
        if (Math.hypot(x, y) > Math.hypot(far.x, far.y)) far = { x, y }
      }
      return far
    }
    expect(tip(15).x).toBeGreaterThan(0.08)
    expect(Math.abs(tip(15).y)).toBeLessThan(0.03)
    expect(tip(30).y).toBeLessThan(-0.08)
  })

  for (const kind of ['keyCabinet', 'locker'])
    it(`the ${kind} looks different open: its door has swung`, () => {
      const shut = built(kind, { open: false })
      const open = built(kind, { open: true })
      expect(meshes(open)).not.toEqual(meshes(shut))
      expect(piece(open, 'door').mesh.positions).not.toEqual(piece(shut, 'door').mesh.positions)
      // The body is the same shape either way; only the door moved.
      expect(piece(open, 'body').mesh).toEqual(piece(shut, 'body').mesh)
    })

  it('the key cabinet has a keypad on its face', () => {
    const keypad = piece(built('keyCabinet'), 'keypad')
    // Twelve keys: three across, four down.
    expect(keypad.mesh.positions.length / 3).toBeGreaterThan(12 * 8)
  })
})

describe('in the base interior', () => {
  const level = wardRoom()

  it('builds with no problem and every prop in its room', () => {
    const { pieces, problems } = buildWorld(level, worldKitLibrary)
    expect(problems).toEqual([])
    for (const kind of KINDS)
      expect(
        pieces.some((p) => p.id.startsWith(`room:prop:${kind}.`)),
        kind,
      ).toBe(true)
  })

  it('passes the kit’s reads check', () => {
    expect(checkReads(level, worldKitLibrary)).toEqual([])
  })

  it('lights a lamp only where a prop carries one', () => {
    for (const kind of KINDS) expect(built(kind).lights ?? [], kind).toEqual([])
  })
})

it('uses only swatches the library has', () => {
  for (const kind of KINDS)
    for (const { swatch, label } of built(kind).pieces)
      expect(worldKitLibrary.swatches[swatch], `${kind}/${label} -> ${swatch}`).toBeDefined()
})

it('is found by a level that names it, as the level of the kit’s other props is', () => {
  const { problems } = buildWorld(
    levelWith(
      KINDS.map((kind, i) => ({ id: kind, use: kind, at: [1 + (i % 3) * 2, 1 + Math.floor(i / 3) * 2] })),
    ),
    worldKitLibrary,
  )
  expect(problems).toEqual([])
})
