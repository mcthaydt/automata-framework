// Which tiles a level's pieces need at a camera: each piece's swatch (a name, which may carry a seed) laid on its faces at the
// scale a view sees them, the floor pair for what lies flat and the wall pair for what stands. A level asks for the pairs of
// every view it can take at once, so a switch between its views never waits on a tile.

import type { TexturedSwatch } from '../features/photo/swatch-tile.ts'
import { textureOf } from '../features/photo/swatch-tile.ts'
import type { TileScales } from '../features/photo/tile-scales.ts'
import type { TileRequest, TileStore } from '../features/photo/tile-store.ts'
import type { WorldPiece } from '../features/world/build.ts'
import { tileName } from '../features/world/surface.ts'
import type { WorldLibrary } from '../features/world/swatches.ts'
import type { AfSector2 } from '../shared/level/af-sector-2.schema.ts'
import type { PieceTiles } from './world-view.ts'

/** A swatch as the tile store reads it, and whether it glows: the library's entry, its seed (`name#seed`) set in its texture. */
export function levelSwatch(
  library: WorldLibrary,
  name: string,
): (TexturedSwatch & { readonly emit?: boolean | undefined }) | undefined {
  const [base, seed] = name.split('#')
  const entry = Object.hasOwn(library.swatches, name)
    ? library.swatches[name]
    : library.swatches[base as string]
  if (typeof entry !== 'object' || entry === null) return undefined
  const swatch = entry as TexturedSwatch & { readonly emit?: boolean | undefined }
  if (seed === undefined || swatch.texture === undefined || Object.hasOwn(library.swatches, name))
    return swatch
  return { ...swatch, texture: { ...swatch.texture, seed: Number(seed) } }
}

/** How worn a piece's room is: the room's grime, else the level's, else lived-in. */
export function grimeOf(level: AfSector2, piece: WorldPiece): number {
  return level.sectors.find((sector) => sector.id === piece.sector)?.grime ?? level.grime ?? 1
}

/** Whether a piece shows floor-like faces, wall-like faces, or either: a floor and a ceiling lie flat, a wall stands. */
const faces = (piece: WorldPiece): { floor: boolean; wall: boolean } => ({
  floor: piece.part !== 'wall',
  wall: piece.part !== 'floor' && piece.part !== 'ceiling',
})

/** Every tile the pieces need at each of `scales`, once each. */
export function tileRequests(
  pieces: readonly WorldPiece[],
  level: AfSector2,
  library: WorldLibrary,
  scales: readonly TileScales[],
): TileRequest[] {
  const found = new Map<string, TileRequest>()
  for (const piece of pieces) {
    const name = tileName(piece.surface)
    const swatch = levelSwatch(library, name)
    if (swatch === undefined || textureOf(swatch) === undefined) continue
    const grime = grimeOf(level, piece)
    const turn = piece.tex?.turn === true
    const { floor, wall } = faces(piece)
    for (const scale of scales)
      for (const pair of [...(floor ? [scale.floor] : []), ...(wall ? [scale.wall] : [])]) {
        const request: TileRequest = { name, swatch, pair, grime, ...(turn ? { turn } : {}) }
        found.set(`${name}|${pair.join(',')}|${grime}|${turn}`, request)
      }
  }
  return [...found.values()]
}

/**
 * A piece's tiles at `scales` from what the store has made: a tile not made yet is left out, so the piece draws the old
 * one (or its colour) until it is. `emit` swatches glow.
 */
export function pieceTiles(
  piece: WorldPiece,
  level: AfSector2,
  library: WorldLibrary,
  scales: TileScales,
  store: Pick<TileStore, 'peek'>,
): PieceTiles | undefined {
  const name = tileName(piece.surface)
  const swatch = levelSwatch(library, name)
  if (swatch === undefined) return undefined
  const grime = grimeOf(level, piece)
  const turn = piece.tex?.turn === true ? true : undefined
  const { floor, wall } = faces(piece)
  return {
    floor: floor ? store.peek(name, scales.floor, grime, turn) : undefined,
    wall: wall ? store.peek(name, scales.wall, grime, turn) : undefined,
    glowing: swatch.emit === true,
  }
}
