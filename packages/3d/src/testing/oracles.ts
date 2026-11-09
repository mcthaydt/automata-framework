// The oracles the looks's ports are held to (tests/fixtures/oracles): what FigureBuilder's painter and EnvironmentBuilder's
// look produced at the commits named in `source`, recorded once by scripts/oracles. Node only; a test reads them, the
// shipped code never does.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'

type V3 = readonly [number, number, number]

const ORACLES = join(import.meta.dirname, '../../tests/fixtures/oracles')

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T
const readGz = (path: string): Uint8Array => {
  const bytes = gunzipSync(readFileSync(path))
  // A copy that owns its buffer, so a typed view over it starts at 0 and is aligned.
  return new Uint8Array(bytes)
}

/** A figure's triangle soup as FigureBuilder rasterised it: 9 floats a vertex, 6 ints a triangle. */
export interface OracleSoup {
  readonly count: number
  readonly triCount: number
  readonly verts: Float32Array
  readonly tris: Int32Array
}

/** The motion state FigureBuilder's `motion()` built for a frame, so AF's figure can be posed from the same state. */
export interface OracleMotion {
  readonly t: number
  readonly phase: number
  readonly moving: boolean
  readonly yaw: number
  readonly headYaw: number
  readonly lookUp: number
  readonly pitch: number
  readonly hair: { readonly pitch: number; readonly roll: number }
  readonly [more: string]: unknown
}

/** One posed frame of the base pair: what FigureBuilder painted, and everything the painter was given. */
export interface OracleFrame {
  readonly id: string
  readonly member: 'base-m' | 'base-f'
  readonly density: number
  readonly kind: 'stand' | 'walk' | 'hero'
  readonly yaw: number
  readonly pitch: number
  readonly cell: readonly [number, number]
  readonly feet: readonly [number, number]
  readonly metres: number
  readonly facing: number
  readonly hand: string
  readonly supersample: number
  readonly soup: OracleSoup
  readonly decals: readonly unknown[]
  readonly face: { readonly view: number; readonly [more: string]: unknown } | null
  readonly hands: readonly Record<string, unknown>[]
  readonly materials: readonly unknown[]
  readonly materialIndex: readonly (readonly [string, number])[]
  readonly bends: Record<string, unknown>
  readonly neck: readonly number[]
  readonly skin: number
  readonly motion: OracleMotion
  /** The frame loses an eye in FigureBuilder at this commit (a defect the port fixes; the audit's F13). */
  readonly f13: boolean
  /** The md5 of the painted cell's RGBA bytes. */
  readonly md5: string
}

interface FrameRecord extends Omit<OracleFrame, 'soup'> {
  readonly soupVerts: number
  readonly soupTris: number
  readonly vertOffset: number
  readonly triOffset: number
}

/** Reads the painter's frames (FigureBuilder 025ffb4). */
export function figureBuilderFrames(): { readonly source: string; readonly frames: readonly OracleFrame[] } {
  const dir = join(ORACLES, 'figurebuilder-025ffb4')
  const file = readJson<{ source: string; vert: number; tri: number; frames: FrameRecord[] }>(
    join(dir, 'frames.json'),
  )
  const blob = readGz(join(dir, 'soups.bin.gz'))
  const view = new DataView(blob.buffer)
  const frames = file.frames.map((r): OracleFrame => {
    const verts = new Float32Array(r.soupVerts * file.vert)
    const tris = new Int32Array(r.soupTris * file.tri)
    for (let i = 0; i < verts.length; i++) verts[i] = view.getFloat32(r.vertOffset + i * 4, true)
    for (let i = 0; i < tris.length; i++) tris[i] = view.getInt32(r.triOffset + i * 4, true)
    const { soupVerts, soupTris, vertOffset, triOffset, ...frame } = r
    void vertOffset
    void triOffset
    return { ...frame, soup: { count: soupVerts, triCount: soupTris, verts, tris } }
  })
  return { source: file.source, frames }
}

/** The vertex light at one vertex of a built base scene, after the light's steps and clamp. */
export interface OracleLightPoint {
  readonly scene: string
  readonly time: string
  readonly at: V3
  readonly normal: V3
  readonly light: V3
}

/** One texel through the colour pipeline: albedo × light, hazed, then the one snap with its dither. */
export interface OracleShade {
  readonly albedo: number
  readonly light: V3
  readonly share: number
  readonly x: number
  readonly y: number
  readonly out: number
}

/** A figure cell lit as a sprite: its inputs, the lights it was given and the cell that came out. */
export interface OracleSpriteCell {
  readonly cell: string
  readonly w: number
  readonly h: number
  readonly ambient: V3
  readonly lamps: readonly { readonly dir: V3; readonly rgb: V3 }[]
  readonly step: number
  readonly max: number
  readonly shade: number
  readonly style: {
    readonly threshold: number
    readonly ink: number
    readonly floor: number
    readonly rim: number
    readonly floorCap: number
  }
  readonly painted: Uint8ClampedArray
  readonly normals: Uint8ClampedArray
  readonly lit: Uint8ClampedArray
  readonly md5: string
}

/** A photo tile's label array, by its md5, at a pair of texel scales. */
export interface OracleTile {
  readonly swatch: string
  readonly texture: Record<string, unknown>
  readonly texels: readonly [number, number]
  readonly w: number
  readonly h: number
  readonly md5: string
}

export interface EbOracle {
  readonly source: string
  readonly vertexLight: readonly OracleLightPoint[]
  readonly shade: readonly OracleShade[]
  readonly shadeLook: {
    readonly gain: number
    readonly dither: number
    readonly haze: Record<string, unknown>
  }
  readonly spriteLight: readonly OracleSpriteCell[]
  readonly tiles: readonly OracleTile[]
}

/** Reads the look's oracle (EnvironmentBuilder 6d82a52). */
export function environmentBuilderLook(): EbOracle {
  const dir = join(ORACLES, 'environmentbuilder-6d82a52')
  const vertex = readJson<{ source: string; points: OracleLightPoint[] }>(join(dir, 'vertex-light.json'))
  const shade = readJson<{
    gain: number
    dither: number
    haze: Record<string, unknown>
    samples: OracleShade[]
  }>(join(dir, 'shade.json'))
  const sprite = readJson<{
    cells: (Omit<OracleSpriteCell, 'painted' | 'normals' | 'lit'> & { offset: number })[]
  }>(join(dir, 'sprite-light.json'))
  const tiles = readJson<{ tiles: OracleTile[] }>(join(dir, 'tiles.json'))
  const bytes = readGz(join(dir, 'cells.bin.gz'))
  const spriteLight = sprite.cells.map((c): OracleSpriteCell => {
    const n = c.w * c.h * 4
    const at = (k: number): Uint8ClampedArray =>
      new Uint8ClampedArray(bytes.slice(c.offset + k * n, c.offset + (k + 1) * n))
    const { offset, ...rest } = c
    void offset
    return { ...rest, painted: at(0), normals: at(1), lit: at(2) }
  })
  return {
    source: vertex.source,
    vertexLight: vertex.points,
    shade: shade.samples,
    shadeLook: { gain: shade.gain, dither: shade.dither, haze: shade.haze },
    spriteLight,
    tiles: tiles.tiles,
  }
}
