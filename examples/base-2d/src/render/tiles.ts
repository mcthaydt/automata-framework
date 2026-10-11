import type { Room } from '../content/room.ts'
import { isSolid } from '../content/room.ts'

// A small autotiler: which stone goes where, which edges and moss caps lie over it, and where the grass,
// glowing mushrooms and vines grow. Pure and deterministic (a hash of the tile's position, no randomness),
// so every run and every screenshot shows the same room. Presentation only: the sim never reads it.

export type Overlay = 'mossTop' | 'edgeLeft' | 'edgeRight' | 'edgeBottom'

export interface TileAt {
  readonly tx: number
  readonly ty: number
}

export interface TilePlan {
  /** Every solid tile, with which of the three stone variants it shows. */
  readonly stone: ReadonlyArray<TileAt & { readonly variant: 0 | 1 | 2 }>
  readonly overlays: ReadonlyArray<TileAt & { readonly piece: Overlay }>
  /** Open tiles standing on a mossy top. */
  readonly grass: readonly TileAt[]
  readonly mushrooms: readonly TileAt[]
  /** Open tiles a vine hangs through; `end` marks its last piece. */
  readonly vines: ReadonlyArray<TileAt & { readonly end: boolean }>
}

/** A small integer hash of a tile position, spread enough that neighbours differ. */
function hash(tx: number, ty: number): number {
  return (Math.imul(tx, 73856093) ^ Math.imul(ty, 19349663)) >>> 0
}

export function planTiles(room: Room): TilePlan {
  const stone: Array<TileAt & { variant: 0 | 1 | 2 }> = []
  const overlays: Array<TileAt & { piece: Overlay }> = []
  const grass: TileAt[] = []
  const mushrooms: TileAt[] = []
  const vines: Array<TileAt & { end: boolean }> = []
  const reserved = (tx: number, ty: number) =>
    (tx === room.start.tx && ty === room.start.ty) || (tx === room.goal.tx && ty === room.goal.ty)

  for (let ty = 0; ty < room.height; ty++)
    for (let tx = 0; tx < room.width; tx++) {
      if (!isSolid(room, tx, ty)) continue
      const h = hash(tx, ty)
      stone.push({ tx, ty, variant: (h % 3) as 0 | 1 | 2 })
      if (!isSolid(room, tx, ty - 1)) {
        overlays.push({ tx, ty, piece: 'mossTop' })
        // Something grows on about half the mossy tops: mostly grass, now and then a mushroom.
        if (!reserved(tx, ty - 1)) {
          if (h % 11 === 0) mushrooms.push({ tx, ty: ty - 1 })
          else if (h % 2 === 0) grass.push({ tx, ty: ty - 1 })
        }
      }
      if (!isSolid(room, tx - 1, ty)) overlays.push({ tx, ty, piece: 'edgeLeft' })
      if (!isSolid(room, tx + 1, ty)) overlays.push({ tx, ty, piece: 'edgeRight' })
      if (!isSolid(room, tx, ty + 1)) {
        overlays.push({ tx, ty, piece: 'edgeBottom' })
        // About one underside in five has a vine, one or two tiles long, stopping above anything solid.
        if (h % 5 === 0) {
          const length = 1 + ((h >> 3) % 2)
          for (let i = 1; i <= length; i++) {
            const below = ty + i
            if (isSolid(room, tx, below) || reserved(tx, below)) break
            const last = i === length || isSolid(room, tx, below + 1)
            vines.push({ tx, ty: below, end: last })
            if (last) break
          }
        }
      }
    }
  return { stone, overlays, grass, mushrooms, vines }
}
