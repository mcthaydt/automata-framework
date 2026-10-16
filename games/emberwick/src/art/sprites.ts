// The base's art, as palette-indexed pixel maps: each character in a row is a key into the sprite's palette
// (Endesga 64 colors only, checked by art.test.ts), and `.` is transparent. Pixel maps in source keep the art
// diffable and exactly on palette; the renderer turns them into textures. Provenance: PROVENANCE.md.
//
// The look (2026-10-11, after the Owner asked for something less like a clone): Wick, a small hooded wanderer
// with glowing eyes and a lantern, climbs mossy ruins at night to an ember. The renderer adds the light.

export interface PixelSprite {
  readonly width: number
  readonly height: number
  /** Key → `#rrggbb`, every value an Endesga 64 color. */
  readonly palette: Readonly<Record<string, string>>
  readonly rows: readonly string[]
}

function sprite(palette: Readonly<Record<string, string>>, rows: readonly string[]): PixelSprite {
  return { width: rows[0]?.length ?? 0, height: rows.length, palette, rows }
}

// Wick, 16 × 16, facing right, feet on the bottom row. The renderer mirrors it to face left. Colored outlines
// (deep navy, not black) and a cyan rim light on the hood, as modern pixel art does.
const WICK_COLORS = {
  O: '#03193f', // outline (Endesga 52)
  L: '#00cdf9', // rim light (43)
  C: '#0098dc', // cloak, lit (42)
  c: '#0069aa', // cloak (41)
  s: '#00396d', // cloak, shade (40)
  f: '#0e071b', // the dark under the hood (15)
  e: '#ffeb57', // eyes (32)
  g: '#edab50', // cloak trim (24)
  b: '#391f21', // boots (17)
  h: '#8a4836', // lantern handle (19)
  y: '#ffc825', // lantern glass (31)
  w: '#ffffff', // lantern flame (8)
}

// The head is the same in every frame but the jump and fall, which tilt the hood tip.
const HOOD = [
  '.OO.............',
  '.OLO............',
  '..OLOOOO........',
  '..OLLLLCOO......',
  '.OLCCCCCCCO.....',
  '.OCCCOOOOOCO....',
  '.OCCOffffffO....',
]
const EYES_OPEN = ['.OcCOfefeffO....', '.OccOffffffO....']

export const WICK_IDLE_A: PixelSprite = sprite(WICK_COLORS, [
  '................',
  ...HOOD,
  ...EYES_OPEN,
  '.OsccOOOOOOcO...',
  'OsscccCCCCccOOh.',
  'OssccCCCCcccOyyO',
  'OggggggggggOOwyO',
  '.ObbO..ObbO..OO.',
  '.OOO...OOO......',
])

// Breathing: the hood settles a pixel and the eyes narrow.
export const WICK_IDLE_B: PixelSprite = sprite(WICK_COLORS, [
  '................',
  '................',
  ...HOOD.slice(1),
  '.OCCOffffffO....',
  '.OcCOeffeffO....',
  '.OsccOOOOOOcO...',
  'OsscccCCCCccOOh.',
  'OssccCCCCcccOyyO',
  'OggggggggggOOwyO',
  '.ObbO..ObbO..OO.',
  '.OOO...OOO......',
])

export const WICK_RUN_A: PixelSprite = sprite(WICK_COLORS, [
  '................',
  ...HOOD,
  ...EYES_OPEN,
  's.OccOOOOOOcOOh.',
  'OsscccCCCCccOyyO',
  'sOsccCCCCcccOwyO',
  '.OgggggggggO.OO.',
  '.ObbO...ObbbO...',
  '.OOO.....OOOO...',
])

export const WICK_RUN_B: PixelSprite = sprite(WICK_COLORS, [
  '................',
  ...HOOD,
  ...EYES_OPEN,
  '.OsccOOOOOOcO...',
  'sOsccCCCCcccOOh.',
  'OssccCCCCcccOyyO',
  '.OgggggggggOOwyO',
  '...ObbOObbO..OO.',
  '...OOOOOOO......',
])

// Rising: the hood tip blows back, the cloak flares under the feet and the lantern swings up.
export const WICK_JUMP: PixelSprite = sprite(WICK_COLORS, [
  'OO..............',
  'OLOO............',
  '.OLLOOOO.....OO.',
  '..OLLLLCOO..OhO.',
  '.OLCCCCCCCO.OyyO',
  '.OCCCOOOOOCOOwyO',
  '.OCCOffffffO.OO.',
  '.OcCOfefeffO....',
  '.OccOffffffO....',
  '.OsccOOOOOOcO...',
  '.OsccCCCCcccO...',
  'OssccCCCCcccO...',
  'OsgggggggggsO...',
  'Os.ObbOObbO.sO..',
  'O..OOO.OOO...O..',
  '................',
])

// Falling: the hood tip lifts and the cloak billows up around the body.
export const WICK_FALL: PixelSprite = sprite(WICK_COLORS, [
  '................',
  '..OO............',
  '..OLO...........',
  '...OLOOOO.......',
  '..OLLLLCOO......',
  '.OLCCCCCCCO.....',
  'sOCCCOOOOOCO....',
  'OsCCOffffffO....',
  'OscCOfefeffO....',
  '.OccOffffffOOh..',
  '.OsccOOOOOOcOyyO',
  '.OsccCCCCcccOwyO',
  '.OsccCCCCccO.OO.',
  '..OgggggggO.....',
  '..ObbO.ObbO.....',
  '..OOO..OOO......',
])

// Stone, 8 × 8, in slate blues. The renderer picks a variant per tile from its position, then lays the moss
// cap and the edge shading over it where a side is open (a small autotiler).
const STONE_COLORS = {
  l: '#657392', // lit (11)
  b: '#424c6e', // stone (12)
  s: '#2a2f4e', // shade (13)
  d: '#1a1932', // seam (14)
}

export const STONE_A: PixelSprite = sprite(STONE_COLORS, [
  'lbbbbbsd',
  'bbbbbbsd',
  'bbbbbssd',
  'dddddddd',
  'bbsdlbbb',
  'bbsdbbbb',
  'ssddbbbs',
  'dddddddd',
])

export const STONE_B: PixelSprite = sprite(STONE_COLORS, [
  'lbbbsdlb',
  'bbbbsdbb',
  'bbbssdbb',
  'ddddddbs',
  'lbbbbdbs',
  'bbbsbdss',
  'bbssbddd',
  'dddddddd',
])

export const STONE_C: PixelSprite = sprite(STONE_COLORS, [
  'lbbsdlbb',
  'bbbsdbbb',
  'bssddbbs',
  'dddldsss',
  'lbbbbbsd',
  'bbbbbbsd',
  'bbbbssdd',
  'dddddddd',
])

// Moss over the top of a tile whose top is open, with a lit fringe and drips.
export const MOSS_TOP: PixelSprite = sprite(
  {
    t: '#99e65f', // tips (34)
    g: '#5ac54f', // moss (35)
    m: '#33984b', // shade (36)
    d: '#1e6f50', // drips (37)
  },
  ['tgttgtgt', 'gggmgggg', 'mgmmmgmm', 'dm.dmd.m', '.d..d..d', '........', '........', '........'],
)

// Dark edges where a tile's side or underside is open, so platforms read as solid shapes.
const EDGE_COLORS = { d: '#1a1932', s: '#2a2f4e' }
export const EDGE_LEFT: PixelSprite = sprite(EDGE_COLORS, [
  'd.......',
  'd.......',
  'd.......',
  'd.......',
  'd.......',
  'd.......',
  'd.......',
  'd.......',
])
export const EDGE_RIGHT: PixelSprite = sprite(EDGE_COLORS, [
  '.......d',
  '.......d',
  '.......d',
  '.......d',
  '.......d',
  '.......d',
  '.......d',
  '.......d',
])
export const EDGE_BOTTOM: PixelSprite = sprite(EDGE_COLORS, [
  '........',
  '........',
  '........',
  '........',
  '........',
  '........',
  'ssssssss',
  'dddddddd',
])

// Grass tufts standing on top of a mossy tile (drawn 8 × 4 above it).
export const GRASS: PixelSprite = sprite({ t: '#99e65f', g: '#5ac54f', m: '#33984b' }, [
  '.t....t.',
  '.g.t.tg.',
  'tgmg.gmt',
  'gmmgtmmg',
])

// A glowing mushroom on top of a mossy tile (8 × 6); the renderer gives it a small cyan light.
export const MUSHROOM: PixelSprite = sprite({ o: '#03193f', c: '#00cdf9', C: '#94fdff', s: '#c7cfdd' }, [
  '..oooo..',
  '.oCccco.',
  'ocCcCcco',
  '.oooooo.',
  '...os...',
  '...os...',
])

// A vine hanging under a tile whose underside is open: a middle piece and an end piece, 8 × 8 each.
const VINE_COLORS = { g: '#33984b', d: '#1e6f50', t: '#5ac54f' }
export const VINE: PixelSprite = sprite(VINE_COLORS, [
  '...gd...',
  '...dg...',
  '..tg....',
  '..gd....',
  '...dg...',
  '...gdt..',
  '...dg...',
  '..gd....',
])
export const VINE_END: PixelSprite = sprite(VINE_COLORS, [
  '..gd....',
  '...dg...',
  '...gt...',
  '..tdg...',
  '...g....',
  '...t....',
  '........',
  '........',
])

// The goal: an ember crystal, 16 × 16, floating over the goal tile. The renderer adds its glow and sparks.
export const EMBER: PixelSprite = sprite(
  {
    w: '#ffffff', // core (8)
    Y: '#ffeb57', // lit face (32)
    y: '#ffc825', // face (31)
    o: '#ffa214', // shade (30)
    r: '#ed7614', // deep shade (29)
    R: '#8e251d', // outline (27)
  },
  [
    '................',
    '.......Rr.......',
    '......RYwr......',
    '.....RYwYor.....',
    '.....RYwYyoR....',
    '....RYwYYyorR...',
    '....RYYYyyorR...',
    '...RYYYyyyoorR..',
    '....RyYyyyorR...',
    '....RyyYyoorR...',
    '.....RyyyorR....',
    '.....RyyoorR....',
    '......RyorR.....',
    '.......RrR......',
    '........R.......',
    '................',
  ],
)

export const ALL_SPRITES: Readonly<Record<string, PixelSprite>> = {
  WICK_IDLE_A,
  WICK_IDLE_B,
  WICK_RUN_A,
  WICK_RUN_B,
  WICK_JUMP,
  WICK_FALL,
  STONE_A,
  STONE_B,
  STONE_C,
  MOSS_TOP,
  EDGE_LEFT,
  EDGE_RIGHT,
  EDGE_BOTTOM,
  GRASS,
  MUSHROOM,
  VINE,
  VINE_END,
  EMBER,
}
