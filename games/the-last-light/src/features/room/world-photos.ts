import type { TexturedSwatch, TextureSpec } from '@automata/world-kit/textures'

// The kit's swatches the ward uses that the kit draws as one flat colour, given a photograph of their material: the world kit's look is
// that every surface is photo-made. A prop names its swatch by the kit's own name (`chrome`, `linen`), and a game's swatch file cannot take
// a kit name (a file is kebab-case, a kit name camelCase), so the ward gives the kit's swatch its texture here; the swatch's ramp and step
// stay the kit's, so only the surface changes. `tools/tiles/make.ts` makes a tile from each, and `tiles.ts` loads them.
//
// What stays flat is light or glass (`bulbWarm`, `glassDay`, `bottleClear`, `exit-green`): a photograph of those is their reflections.
// The kit holds no leaf, cork or paper photograph, so `fabric` stands in for the leaves and the books' cloth, `bark` for the cork board
// (`ward-cork`) and `plasterFinish` for paper.

/** The photograph each kit swatch is read through, by swatch name. */
export const WARD_PHOTOS: Readonly<Record<string, string>> = {
  trimWhite: 'woodPanels',
  chrome: 'metal',
  steelGrey: 'metalSheet',
  metalBox: 'metalSheet',
  brass: 'metal',
  ironDark: 'metal',
  linen: 'fabric',
  pillowWhite: 'fabric',
  posterPaper: 'plasterFinish',
  bookCream: 'plasterFinish',
  vinylTeal: 'lino',
  tyre: 'asphalt',
  leafGreen: 'fabric',
  bookGreen: 'fabric',
  carRed: 'metalSheet',
  fenceWood: 'planks',
  terracotta: 'stucco',
  cordBlack: 'fabric',
  enamel: 'metalSheet',
  walnut: 'woodGrain',
}

/** The texture knobs they share: a prop is seen at 64 texels a metre, and a photograph is read lightly (one step of tone per 0.05). */
export const WARD_PHOTO_KNOBS: Omit<TextureSpec, 'photo' | 'seed'> = {
  contrast: 0.05,
  facet: 0,
  flatten: 0.9,
  cluster: 2,
  wear: 0.15,
}

/** A kit swatch with its ward photograph: the kit's swatch, read through `WARD_PHOTOS[name]`, with its own seed so two materials of one photograph differ. */
export function photoSwatch(base: object, name: string): TexturedSwatch {
  const index = Object.keys(WARD_PHOTOS).indexOf(name)
  const photo = WARD_PHOTOS[name] as string
  return {
    ...base,
    reads: { at: 64 },
    texture: { photo, ...WARD_PHOTO_KNOBS, seed: 100 + index },
  } as TexturedSwatch
}
