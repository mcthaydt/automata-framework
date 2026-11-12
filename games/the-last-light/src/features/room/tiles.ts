import type { TileFile } from '@automata/world-kit'
import bookCream from './world-tiles/bookCream.tile.json' with { type: 'json' }
import bookGreen from './world-tiles/bookGreen.tile.json' with { type: 'json' }
import brass from './world-tiles/brass.tile.json' with { type: 'json' }
import carRed from './world-tiles/carRed.tile.json' with { type: 'json' }
import chrome from './world-tiles/chrome.tile.json' with { type: 'json' }
import cordBlack from './world-tiles/cordBlack.tile.json' with { type: 'json' }
import enamel from './world-tiles/enamel.tile.json' with { type: 'json' }
import exitPlate from './world-tiles/exit-plate.tile.json' with { type: 'json' }
import fenceWood from './world-tiles/fenceWood.tile.json' with { type: 'json' }
import ironDark from './world-tiles/ironDark.tile.json' with { type: 'json' }
import leafGreen from './world-tiles/leafGreen.tile.json' with { type: 'json' }
import linen from './world-tiles/linen.tile.json' with { type: 'json' }
import metalBox from './world-tiles/metalBox.tile.json' with { type: 'json' }
import pillowWhite from './world-tiles/pillowWhite.tile.json' with { type: 'json' }
import posterPaper from './world-tiles/posterPaper.tile.json' with { type: 'json' }
import steelGrey from './world-tiles/steelGrey.tile.json' with { type: 'json' }
import terracotta from './world-tiles/terracotta.tile.json' with { type: 'json' }
import trimWhite from './world-tiles/trimWhite.tile.json' with { type: 'json' }
import tyre from './world-tiles/tyre.tile.json' with { type: 'json' }
import vinylTeal from './world-tiles/vinylTeal.tile.json' with { type: 'json' }
import walnut from './world-tiles/walnut.tile.json' with { type: 'json' }
import wardCork from './world-tiles/ward-cork.tile.json' with { type: 'json' }
import wardFloor from './world-tiles/ward-floor.tile.json' with { type: 'json' }
import wardPlaster from './world-tiles/ward-plaster.tile.json' with { type: 'json' }
import wardWainscot from './world-tiles/ward-wainscot.tile.json' with { type: 'json' }

// The tile files of the game's own surfaces. The kit commits tiles for its own swatches only; a game's are made by
// `tools/tiles/make.ts` from the swatches in `content/world-swatches` and the kit's swatches the ward gives a photograph
// (`world-photos.ts`) and kept in `world-tiles/` beside this file (made data, not content: nothing compiles it).
// Without one a swatch is drawn as a single flat colour, however much texture it names.

/** The swatches that have a tile file of the game's own. */
export const OWN_TILE_NAMES = [
  'bookCream',
  'bookGreen',
  'brass',
  'carRed',
  'chrome',
  'cordBlack',
  'enamel',
  'exit-plate',
  'fenceWood',
  'ironDark',
  'leafGreen',
  'linen',
  'metalBox',
  'pillowWhite',
  'posterPaper',
  'steelGrey',
  'terracotta',
  'trimWhite',
  'tyre',
  'vinylTeal',
  'walnut',
  'ward-cork',
  'ward-floor',
  'ward-plaster',
  'ward-wainscot',
] as const

/** Their tile files, by swatch name. */
export const OWN_TILES: Readonly<Record<string, TileFile>> = {
  bookCream: bookCream as unknown as TileFile,
  bookGreen: bookGreen as unknown as TileFile,
  brass: brass as unknown as TileFile,
  carRed: carRed as unknown as TileFile,
  chrome: chrome as unknown as TileFile,
  cordBlack: cordBlack as unknown as TileFile,
  enamel: enamel as unknown as TileFile,
  'exit-plate': exitPlate as unknown as TileFile,
  fenceWood: fenceWood as unknown as TileFile,
  ironDark: ironDark as unknown as TileFile,
  leafGreen: leafGreen as unknown as TileFile,
  linen: linen as unknown as TileFile,
  metalBox: metalBox as unknown as TileFile,
  pillowWhite: pillowWhite as unknown as TileFile,
  posterPaper: posterPaper as unknown as TileFile,
  steelGrey: steelGrey as unknown as TileFile,
  terracotta: terracotta as unknown as TileFile,
  trimWhite: trimWhite as unknown as TileFile,
  tyre: tyre as unknown as TileFile,
  vinylTeal: vinylTeal as unknown as TileFile,
  walnut: walnut as unknown as TileFile,
  'ward-cork': wardCork as unknown as TileFile,
  'ward-floor': wardFloor as unknown as TileFile,
  'ward-plaster': wardPlaster as unknown as TileFile,
  'ward-wainscot': wardWainscot as unknown as TileFile,
}
