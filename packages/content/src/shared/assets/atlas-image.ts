// Atlas pages as pixels and files. PNGs are read and written with `pngjs`,
// always as 8-bit RGBA with fixed encoder options, so the same pixels always give the same bytes (G-c).
import { PNG } from 'pngjs'
import { ATLAS_EXTRUDE, type Placement } from './atlas-pack'

/** An image as 8-bit RGBA rows, top to bottom. */
export interface Rgba {
  readonly width: number
  readonly height: number
  readonly data: Uint8Array
}

/** Reads a PNG of any colour type as RGBA. Throws on bytes that are not a PNG. */
export function decodePng(bytes: Uint8Array): Rgba {
  const png = PNG.sync.read(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength))
  return { width: png.width, height: png.height, data: new Uint8Array(png.data) }
}

/** Writes RGBA as a PNG. The options are fixed: they are part of the output's identity. */
export function encodePng(image: Rgba): Uint8Array {
  const png = new PNG({ width: image.width, height: image.height })
  png.data = Buffer.from(image.data)
  return new Uint8Array(
    PNG.sync.write(png, { colorType: 6, inputColorType: 6, bitDepth: 8, deflateLevel: 9, filterType: -1 }),
  )
}

/**
 * Draws each frame of `placements` (one page's or all; other pages' are skipped by the caller) at its place, and
 * repeats its edge pixels into the extrusion, so a filtered sample at a frame's edge never reads a neighbour.
 */
export function composePage(
  size: number,
  placements: readonly Placement[],
  frames: ReadonlyMap<string, Rgba>,
): Rgba {
  const data = new Uint8Array(size * size * 4)
  for (const placement of placements) {
    const frame = frames.get(placement.name)
    if (frame === undefined) throw new Error(`composePage: no pixels for frame '${placement.name}'`)
    // Every page pixel of the cell, including the extrusion, copies the nearest frame pixel.
    for (let y = -ATLAS_EXTRUDE; y < frame.height + ATLAS_EXTRUDE; y++) {
      const sourceY = Math.min(Math.max(y, 0), frame.height - 1)
      for (let x = -ATLAS_EXTRUDE; x < frame.width + ATLAS_EXTRUDE; x++) {
        const sourceX = Math.min(Math.max(x, 0), frame.width - 1)
        const from = (sourceY * frame.width + sourceX) * 4
        const to = ((placement.y + y) * size + placement.x + x) * 4
        data.set(frame.data.subarray(from, from + 4), to)
      }
    }
  }
  return { width: size, height: size, data }
}

/** Pixi's `Spritesheet` data for page `page`: its frames, by name, in placement order. */
export function spritesheetJson(
  page: number,
  size: number,
  image: string,
  placements: readonly Placement[],
): string {
  const frames: Record<string, unknown> = {}
  for (const placement of placements) {
    if (placement.page !== page) continue
    const { x, y, width: w, height: h } = placement
    frames[placement.name] = {
      frame: { x, y, w, h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w, h },
      sourceSize: { w, h },
    }
  }
  const meta = { app: 'automata-content', image, format: 'RGBA8888', size: { w: size, h: size }, scale: 1 }
  return `${JSON.stringify({ frames, meta }, null, 2)}\n`
}
