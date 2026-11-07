// Where the asset build's outputs go. `automata-content assets` writes the atlases to
// `<outDir>/atlases/` and the font subsets to `<outDir>/fonts/`, and a game's build serves them in the same
// folders, `atlases/` and `fonts/` (the preload list looks for them there; the build hook puts them
// there). The writers and the readers take every name from here, so the layout has one owner.

/** The atlas pages' folder, below `outDir` and in the build. */
export const ATLASES_FOLDER = 'atlases'

/** The font subsets' folder, below `outDir` and in the build. */
export const FONTS_FOLDER = 'fonts'

/** The font build's map from each font and language to its subset file, in `FONTS_FOLDER` (`FontFiles`). */
export const FONT_FILES = 'fonts.json'

/** The two files of one atlas page: Pixi's Spritesheet JSON, and the image it names. Pages count from 0. */
export const atlasPageFiles = (
  atlas: string,
  page: number,
): { readonly json: string; readonly image: string } => ({
  json: `${atlas}-${page}.json`,
  image: `${atlas}-${page}.png`,
})
