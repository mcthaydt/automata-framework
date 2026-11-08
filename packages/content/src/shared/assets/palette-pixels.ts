// The palette check on art.
// A pixel with alpha 0 carries no colour a player can see, so its channels are
// whatever the exporter left and are not checked; every other pixel must be a palette colour. AF names the first
// stray pixel's position and colour, with the count, so an artist can find it.
import type { Palette } from '../palette/palette'
import type { Rgba } from './atlas-image'

export interface OffPalette {
  readonly count: number
  /** The first stray pixel in reading order. */
  readonly first: { readonly x: number; readonly y: number; readonly color: string }
}

const hex = (r: number, g: number, b: number) =>
  `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`

/** The drawn pixels of `image` that are not `palette` colours, or undefined when there are none. */
export function offPalettePixels(image: Rgba, palette: Palette): OffPalette | undefined {
  const allowed = new Set(palette.colors.map((color) => color.toLowerCase()))
  let count = 0
  let first: OffPalette['first'] | undefined
  for (let index = 0; index < image.data.length; index += 4) {
    if (image.data[index + 3] === 0) continue
    const color = hex(image.data[index] ?? 0, image.data[index + 1] ?? 0, image.data[index + 2] ?? 0)
    if (allowed.has(color)) continue
    count++
    if (first === undefined) {
      const pixel = index / 4
      first = { x: pixel % image.width, y: Math.floor(pixel / image.width), color }
    }
  }
  return first === undefined ? undefined : { count, first }
}
