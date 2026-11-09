// A tile's structure: five numbers that say whether a finish (a wall, a road, a fabric) reads as one at the scale it is
// seen at, or dissolves into camouflage, into flat colour or into specks. They are measured on a tile's labels, so they
// judge what is drawn, texel for texel, before a scene is rendered. A swatch declares the limits it must keep (`reads`, over
// the defaults in `READS`).
//
//   - `blotch`: the largest run of any label but the ground, as a share of the tile. Many labels crowded into one patch is
//     camouflage: a stain, not a texture. Runs are 4-connected and wrap round the tile's edges, as the tile repeats.
//   - `dominant`: the ground's share of the tile (the ground is the commonest label). Too much is flat: a surface that
//     reads as a single colour, with no structure to it.
//   - `span`: how many steps of shade the tone labels cover (highest less lowest). A painted finish should shade by at
//     most one step. Photo-mode labels (a ramp colour each) carry no tone, so they have no span.
//   - `spots`: the share of the tile in small runs (`SPOT_MIN` to `SPOT_MAX` texels) of any label but the ground. Many
//     small stains, none big enough to be a blotch, are worm-like specks under lamplight. The labels are mixed: a 7 beside a
//     9 is one run, because the eye sees one speck of "not the ground".
//   - `patches`: the same runs, counted when they are `PATCH_MIN` to `PATCH_MAX` texels. Many mid-size stains, each too big
//     to be a spot and too small to be the blotch, are the bare wall's camouflage.
//
// Spots and patches are judged on the unworn tile (wear 0) only: wear's own dark patches are the same size, so judged worn
// they would fail a clean tile at an unlucky seed. `blotch`, `dominant` and `span` are judged as written.
//
// The ground is left out of `blotch` and `spots` on purpose: it is connected across the tile, so counted it would be
// `dominant` itself and the limits could never pass.

import { type Tile, unpack } from './tile.ts'

export interface TileStructure {
  readonly blotch: number
  readonly dominant: number
  readonly span: number
  readonly spots: number
  readonly patches: number
}

/** The size of a run, in texels and both inclusive, that is a spot: smaller is a lone texel, larger is a blotch. */
export const SPOT_MIN = 2
export const SPOT_MAX = 12
/** The size of a run, in texels and both inclusive, that is a patch: smaller is a spot, larger is a mottle. */
export const PATCH_MIN = 13
export const PATCH_MAX = 120

/** What a swatch's check states: the scale it is seen at (texels a metre: 32 for a map surface, 64 for a prop), whether it
 * shades by one step at most, and the limits. */
export interface Reads {
  readonly at: number
  readonly oneStep: boolean
  readonly maxBlotch: number
  readonly maxDominant: number
  readonly maxSpots: number
  readonly maxPatches: number
}

/** The defaults of every field, in one place: a swatch declares only what differs (`reads = {}` for none). `maxSpots` and
 * `maxPatches` sit between the clean tiles in use and the stained walls: `maxSpots` 0.017 between the clean tiles (at most
 * 0.0121) and the stained wall (0.0239), `maxPatches` 0.12 between the clean tiles (at most 0.1006) and the bare and
 * stained walls (at least 0.1428). Both are judged at wear 0. A tile that is mid-size runs by nature (a plank's grain, a
 * speckled concrete) declares its own. */
export const READS: Reads = {
  at: 32,
  oneStep: false,
  maxBlotch: 0.06,
  maxDominant: 0.85,
  maxSpots: 0.017,
  maxPatches: 0.12,
}

/** A swatch's declared reads over the defaults. */
export const readsOf = (declared: Partial<Reads> = {}): Reads => ({ ...READS, ...declared })

/** The size of the 4-connected run of texels `member` holds from `start` (marked in `seen`), wrapping round the tile as it
 * repeats. */
function runFrom(
  start: number,
  width: number,
  height: number,
  seen: Uint8Array,
  member: (k: number) => boolean,
): number {
  const stack = [start]
  let size = 0
  seen[start] = 1
  while (stack.length > 0) {
    const k = stack.pop() as number
    const x = k % width
    const y = (k - x) / width
    size++
    for (const q of [
      y * width + ((x + 1) % width),
      y * width + ((x + width - 1) % width),
      ((y + 1) % height) * width + x,
      ((y + height - 1) % height) * width + x,
    ])
      if (!seen[q] && member(q)) {
        seen[q] = 1
        stack.push(q)
      }
  }
  return size
}

export function tileStructure(tile: Tile): TileStructure {
  const { width, height, labels } = tile
  const n = width * height
  // The ground: the commonest label, the first found on a tie.
  const count = new Map<number, number>()
  for (let k = 0; k < n; k++) count.set(labels[k] ?? 0, (count.get(labels[k] ?? 0) ?? 0) + 1)
  let ground = labels[0] ?? 0
  let most = 0
  for (const [label, c] of count)
    if (c > most) {
      ground = label
      most = c
    }
  // The largest run of one label other than the ground.
  let seen = new Uint8Array(n)
  let blotch = 0
  for (let k0 = 0; k0 < n; k0++) {
    if (seen[k0] || labels[k0] === ground) continue
    blotch = Math.max(
      blotch,
      runFrom(k0, width, height, seen, (q) => labels[q] === labels[k0]),
    )
  }
  // The texels in runs of any labels but the ground: those of SPOT_MIN to SPOT_MAX are spots, of PATCH_MIN to PATCH_MAX
  // patches.
  seen = new Uint8Array(n)
  let spots = 0
  let patches = 0
  for (let k0 = 0; k0 < n; k0++) {
    if (seen[k0] || labels[k0] === ground) continue
    const size = runFrom(k0, width, height, seen, (q) => labels[q] !== ground)
    if (size >= SPOT_MIN && size <= SPOT_MAX) spots += size
    if (size >= PATCH_MIN && size <= PATCH_MAX) patches += size
  }
  // The tone labels (slots 0 and 1: the swatch's ladder and its accent's) span their offsets.
  let lo = Number.POSITIVE_INFINITY
  let hi = Number.NEGATIVE_INFINITY
  for (const label of count.keys()) {
    const { value, slot } = unpack(label)
    if (slot < 2) {
      lo = Math.min(lo, value)
      hi = Math.max(hi, value)
    }
  }
  return {
    blotch: blotch / n,
    dominant: most / n,
    span: hi >= lo ? hi - lo : 0,
    spots: spots / n,
    patches: patches / n,
  }
}

/** What fails, named with its number and the limit it was held to (`blotch 0.080 > 0.06`); empty when the tile passes.
 * `oneStep` adds the span check. `worn` leaves out spots and patches, which wear's own patches would fail. */
export function structureIssues(s: TileStructure, declared: Partial<Reads> = {}, worn = false): string[] {
  const limit = readsOf(declared)
  const issues: string[] = []
  if (s.blotch > limit.maxBlotch) issues.push(`blotch ${s.blotch.toFixed(3)} > ${limit.maxBlotch}`)
  if (s.dominant > limit.maxDominant) issues.push(`flat ${s.dominant.toFixed(3)} > ${limit.maxDominant}`)
  if (limit.oneStep && s.span > 1) issues.push(`span ${s.span} > 1`)
  if (!worn && s.spots > limit.maxSpots) issues.push(`spots ${s.spots.toFixed(4)} > ${limit.maxSpots}`)
  if (!worn && s.patches > limit.maxPatches)
    issues.push(`patches ${s.patches.toFixed(4)} > ${limit.maxPatches}`)
  return issues
}
