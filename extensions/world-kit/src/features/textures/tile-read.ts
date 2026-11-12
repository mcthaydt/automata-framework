// What a committed tile file is and how it is read, free of the photo pipeline and Node's Buffer, so a browser bundle can
// hold it.
import { DUEL_RAMP_NAMES, type DuelRampName } from '@automataframework/content/palette'
import type { Reads } from './structure.ts'
import type { TextureSpec } from './texture-spec.ts'
import type { Ladder, Tile } from './tile-colours.ts'

/** The fields of a swatch the tile maker reads. */
export interface TexturedSwatch {
  readonly ramp: DuelRampName
  readonly step: number
  readonly texture?: Readonly<Record<string, unknown>> | undefined
  readonly accent?: string | undefined
  readonly reads?: Partial<Reads> | undefined
}

export const TILE_FORMAT = 'world-kit-tile/1'

/** A tile as the file holds it. */
export interface TileFile {
  readonly format: typeof TILE_FORMAT
  /** The swatch it is for. */
  readonly swatch: string
  readonly photo: string
  /** The sha-256, in hex, of the photo's bytes when the tile was made. */
  readonly sha256: string
  /** The texture's own knobs, as the swatch wrote them. */
  readonly texture: Readonly<Record<string, unknown>>
  /** Texels a metre the tile was made for, along u and along v. */
  readonly texels: readonly [number, number]
  readonly width: number
  readonly height: number
  /** The labels, two bytes each, little endian, as base64. */
  readonly labels: string
}

/** The texture a swatch declares, or `undefined` for a flat one. */
export function textureOf(swatch: TexturedSwatch): TextureSpec | undefined {
  const t = swatch.texture
  return typeof t?.photo === 'string' ? (t as unknown as TextureSpec) : undefined
}

/** The ladder a swatch's labels are read against: its own ramp and step, and its accent's. */
export function ladderOf(swatch: TexturedSwatch, swatches: Readonly<Record<string, TexturedSwatch>>): Ladder {
  const row = (s: TexturedSwatch): { ramp: number; step: number } => ({
    ramp: DUEL_RAMP_NAMES.indexOf(s.ramp),
    step: s.step,
  })
  const accent = swatch.accent === undefined ? undefined : swatches[swatch.accent]
  return { base: row(swatch), accent: accent === undefined ? undefined : row(accent) }
}

/** The labels a tile file holds. */
export function decodeTileFile(file: TileFile): Tile {
  const bin = atob(file.labels)
  const labels = new Uint16Array(bin.length / 2)
  for (let i = 0; i < labels.length; i++) labels[i] = bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8)
  return { width: file.width, height: file.height, labels }
}
