// The tile of a textured swatch, made from its photo at the scale the swatch declares it is seen at (`reads.at`): the
// ladder its labels are read against, and the swatch fields the maker reads.

import { DUEL_RAMP_NAMES, type DuelRampName } from '@automata/content/palette'
import type { PhotoSourceLoader } from './photo-library.ts'
import { READS, type Reads } from './structure.ts'
import { TEXTURE_DEFAULTS, type TextureSpec } from './texture-spec.ts'
import { type Ladder, type Tile, tileFromLab } from './tile.ts'

/** The fields of a swatch the tile maker reads. */
export interface TexturedSwatch {
  readonly ramp: DuelRampName
  readonly step: number
  readonly texture?: Readonly<Record<string, unknown>> | undefined
  readonly accent?: string | undefined
  readonly reads?: Partial<Reads> | undefined
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

/** A swatch's tile, made at its declared scale (`reads.at`, 32 texels a metre unless it says), with its worn variant when
 * `unworn` is true (wear 0, as a scene with no grime draws it). */
export async function swatchTile(
  swatch: TexturedSwatch,
  load: PhotoSourceLoader,
  options: { readonly unworn?: boolean } = {},
): Promise<Tile> {
  const spec = textureOf(swatch)
  if (spec === undefined) throw new Error('This swatch has no texture, so it has no tile.')
  const source = await load(
    spec.photo,
    spec.facet ?? TEXTURE_DEFAULTS.facet,
    spec.flatten ?? TEXTURE_DEFAULTS.flatten,
  )
  const at = swatch.reads?.at ?? READS.at
  return tileFromLab(source, options.unworn ? { ...spec, wear: 0 } : spec, { texels: [at, at] })
}
