// Where a photo tile lies on a piece: Build's placement. A tile is a few clean texels (palette colours) at a texel scale;
// a piece's vertices get the (u, v) that lay it by metres along the surface, as the painter's `uv` does (a floor or ceiling
// by x and z, a wall by the horizontal axis it faces and y), taken in the piece's own frame when its placement has one, then
// repeated, panned (whole texels), turned (the tile's own turn is made when the tile is) and started at its seed unless anchored.
import type { TexPlace } from '../surface.ts'
import { toLocal } from './frame.ts'

/** A tile as a texture: RGBA of DUEL colours, `texels` texels a metre along u and along v, and its seed. */
export interface AlbedoTile {
  readonly width: number
  readonly height: number
  readonly texels: readonly [number, number]
  readonly rgba: Uint8Array
  readonly seed: number
}

/** A surface's (u, v) in metres at a point with a normal; `down` says v runs up the surface (tile rows run down). */
function surfaceUv(p: readonly number[], n: readonly number[]): { u: number; v: number; down: boolean } {
  const [nx, ny, nz] = [n[0] as number, n[1] as number, n[2] as number]
  if (Math.abs(ny) >= 0.7) return { u: p[0] as number, v: p[2] as number, down: false }
  if (Math.abs(nz) >= Math.abs(nx)) return { u: p[0] as number, v: p[1] as number, down: true }
  return { u: p[2] as number, v: p[1] as number, down: true }
}

/** A hash of the seed to [0, 1): the same seed starts the tile at the same place. */
function seedUnit(seed: number, k: number): number {
  let n = Math.imul(seed | 0, 0x27d4eb2d) ^ Math.imul(k, 0x9e3779b1)
  n = Math.imul(n ^ (n >>> 15), 0x85ebca6b)
  n ^= n >>> 13
  return (n >>> 0) / 4294967296
}

/**
 * The texture coordinates of a piece's vertices (2 a vertex). `anchored` starts the tile at u = v = 0 (a wall's start, a
 * prop's origin) with no seed offset; a surface tiled in the world keeps the seed's, so two swatches of one photo differ.
 */
export function tileUvs(
  mesh: { readonly positions: ArrayLike<number>; readonly normals: ArrayLike<number> },
  tile: AlbedoTile,
  place: TexPlace | undefined,
  anchored: boolean,
): Float32Array {
  const count = mesh.positions.length / 3
  const out = new Float32Array(count * 2)
  const [r0, r1] = place?.repeat ?? [1, 1]
  const [p0, p1] = place?.pan ?? [0, 0]
  const [lu, lv] = tile.texels
  // Whole tile texels, as the painter pans.
  const du = Math.round((p0 / r0) * lu)
  const dv = Math.round((p1 / r1) * lv)
  const ox = anchored ? 0 : Math.floor(seedUnit(tile.seed, 1) * tile.width)
  const oy = anchored ? 0 : Math.floor(seedUnit(tile.seed, 2) * tile.height)
  for (let i = 0; i < count; i++) {
    let p: readonly number[] = [
      mesh.positions[i * 3] as number,
      mesh.positions[i * 3 + 1] as number,
      mesh.positions[i * 3 + 2] as number,
    ]
    let n: readonly number[] = [
      mesh.normals[i * 3] as number,
      mesh.normals[i * 3 + 1] as number,
      mesh.normals[i * 3 + 2] as number,
    ]
    if (place?.frame !== undefined) [p, n] = toLocal(place.frame, p, n)
    const { u, v, down } = surfaceUv(p, n)
    const x = (u / r0) * lu - du + ox
    const y = down ? -((v / r1) * lv) + dv + oy : (v / r1) * lv - dv + oy
    out[i * 2] = x / tile.width
    out[i * 2 + 1] = y / tile.height
  }
  return out
}
