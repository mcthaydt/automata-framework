import type { TileFile } from '@automata/world-kit'
import floor from './world-tiles/ward-floor.tile.json' with { type: 'json' }
import plaster from './world-tiles/ward-plaster.tile.json' with { type: 'json' }
import wainscot from './world-tiles/ward-wainscot.tile.json' with { type: 'json' }

// The tile files of the game's own swatches. The kit commits tiles for its own swatches only; a game's are made by
// `tools/tiles/make.ts` from the swatches in `content/world-swatches` and the kit's photographs, and kept in `world-tiles/` beside this file (made data, not content: nothing compiles it).
// Without one a swatch is drawn as a single flat colour, however much texture it names.

/** The swatches that have a tile file of the game's own. */
export const OWN_TILE_NAMES = ['ward-floor', 'ward-plaster', 'ward-wainscot'] as const

/** Their tile files, by swatch name. */
export const OWN_TILES: Readonly<Record<string, TileFile>> = {
  'ward-floor': floor as unknown as TileFile,
  'ward-plaster': plaster as unknown as TileFile,
  'ward-wainscot': wainscot as unknown as TileFile,
}
