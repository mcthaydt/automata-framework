// One tile, made from a prepared photo: indexed, worn and cleaned by the pipeline, then read against its swatch's ladder as
// the palette's RGBA. It is the whole of the work a tile costs, so it runs the same on the page's own thread and in a worker.

import { DEFAULT_PALETTE } from '@automata/content/palette'
import type { TextureSpec } from './texture-spec.ts'
import { texelScale } from './texture-spec.ts'
import { type Ladder, type PhotoSource, tileColours, tileFromLab } from './tile.ts'

/** What a tile is made from: its photo (named, and where to fetch it), the texture as worn and turned, the ladder its labels
 * are read against and the texels a metre along u and v. */
export interface TileJob {
  readonly photo: string
  readonly url: string
  readonly spec: TextureSpec
  readonly ladder: Ladder
  readonly pair: readonly [number, number]
}

/** A tile as made: its palette colours (four bytes a texel, opaque), the pipeline's labels of the same texels and the texels a
 * metre it was made at. */
export interface PaintedTile {
  readonly width: number
  readonly height: number
  readonly rgba: Uint8Array
  readonly labels: Uint16Array
  readonly texels: readonly [number, number]
}

let colours: Uint8Array | undefined
/** The palette as RGBA bytes, by index. */
function paletteBytes(): Uint8Array {
  if (colours === undefined) {
    const table = new Uint8Array(DEFAULT_PALETTE.colors.length * 4)
    DEFAULT_PALETTE.colors.forEach((hex, i) => {
      const n = Number.parseInt(hex.slice(1), 16)
      table.set([(n >> 16) & 255, (n >> 8) & 255, n & 255, 255], i * 4)
    })
    colours = table
  }
  return colours
}

export function renderTile(source: PhotoSource, job: TileJob): PaintedTile {
  const { photo: _photo, ...spec } = job.spec
  const tile = tileFromLab(source, spec, { texels: job.pair })
  const table = paletteBytes()
  const rgba = new Uint8Array(tile.labels.length * 4)
  tileColours(tile, job.ladder).forEach((index, i) => {
    rgba.set(table.subarray(index * 4, index * 4 + 4), i * 4)
  })
  return {
    width: tile.width,
    height: tile.height,
    rgba,
    labels: tile.labels,
    texels: [texelScale(job.pair[0]), texelScale(job.pair[1])],
  }
}
