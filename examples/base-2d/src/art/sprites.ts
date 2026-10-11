// The base's art, as palette-indexed pixel maps: each character in a row is a key into the sprite's palette
// (Endesga 64 colors only, checked by art.test.ts), and `.` is transparent. Pixel maps in source keep the art
// diffable and exactly on palette; the renderer turns them into textures. Provenance: PROVENANCE.md.

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

// The character: a round green bubble-blower with a red scarf, 16 × 16, facing right. Bubble Bobble's chunky
// outlined shapes, Celeste's scarf. The renderer mirrors it to face left.
const CHARACTER_COLORS = {
  o: '#0e071b', // outline (Endesga 15)
  l: '#99e65f', // highlight (34)
  g: '#5ac54f', // body (35)
  d: '#33984b', // shade (36)
  f: '#1e6f50', // feet (37)
  w: '#ffffff', // eye (8)
  k: '#0e071b', // pupil (15)
  p: '#f68187', // cheek (58)
  r: '#ea323c', // scarf (60)
  R: '#891e2b', // scarf shade (62)
}

export const CHARACTER_IDLE: PixelSprite = sprite(CHARACTER_COLORS, [
  '................',
  '................',
  '................',
  '....oooooooo....',
  '...olllllllgo...',
  '..ollllggwwwgo..',
  '..olllgggwwkgo..',
  '..ollggggwwkgo..',
  '..olgggggwwwgo..',
  '..oggggggggppo..',
  '..odgggggggggo..',
  'orrrrrrrrrrrro..',
  'oRRrrrrrrrrrRo..',
  '.oRodddddddddo..',
  '..o.offo.offo...',
  '.....oo...oo....',
])

export const CHARACTER_RUN_A: PixelSprite = sprite(CHARACTER_COLORS, [
  '................',
  '................',
  '....oooooooo....',
  '...olllllllgo...',
  '..ollllggwwwgo..',
  '..olllgggwwkgo..',
  '..ollggggwwkgo..',
  '..olgggggwwwgo..',
  '..oggggggggppo..',
  '..odgggggggggo..',
  'oorrrrrrrrrrro..',
  'RRrrrrrrrrrrRo..',
  'oo.odddddddddo..',
  '...offo..oddo...',
  '...ooo..offo....',
  '.........oo.....',
])

export const CHARACTER_RUN_B: PixelSprite = sprite(CHARACTER_COLORS, [
  '................',
  '................',
  '....oooooooo....',
  '...olllllllgo...',
  '..ollllggwwwgo..',
  '..olllgggwwkgo..',
  '..ollggggwwkgo..',
  '..olgggggwwwgo..',
  '..oggggggggppo..',
  '..odgggggggggo..',
  '.orrrrrrrrrrro..',
  'orRrrrrrrrrrRo..',
  'oRoodddddddddo..',
  '..oddo..offo....',
  '..offo...ooo....',
  '...oo...........',
])

export const CHARACTER_JUMP: PixelSprite = sprite(CHARACTER_COLORS, [
  '................',
  '....oooooooo....',
  '...olllllllgo...',
  '..ollllggwwwgo..',
  '..olllgggwwkgo..',
  '..ollggggwwkgo..',
  '..olgggggwwwgo..',
  '..oggggggggppo..',
  '..odgggggggggo..',
  '..orrrrrrrrrro..',
  '.oRrrrrrrrrrRo..',
  'oRo.oddddddddo..',
  'oRo..oddddddo...',
  '.o...offo.ffo...',
  '.....ooo..ooo...',
  '................',
])

export const CHARACTER_FALL: PixelSprite = sprite(CHARACTER_COLORS, [
  '................',
  '................',
  '....oooooooo....',
  '...olllllllgo...',
  '..ollllggwwwgo..',
  '..olllgggwwwgo..',
  '..ollggggwwkgo..',
  '..olgggggwwkgo..',
  '..oggggggggppo..',
  'o.odgggggggggo..',
  'Rorrrrrrrrrrro..',
  'oRRrrrrrrrrrRo..',
  '.ooodddddddddo..',
  '...offodddoffo..',
  '...ooo.ooo.oo...',
  '................',
])

// Bricks, 8 × 8, in Bubble Bobble's saturated purple-pink. The top variant has a lit edge and is used where
// the tile above is open.
const BRICK_COLORS = {
  o: '#3b1443', // mortar (53)
  s: '#622461', // shade (54)
  b: '#93388f', // brick (55)
  h: '#ca52c9', // light (56)
  t: '#f389f5', // lit top edge (47)
}

export const TILE_TOP: PixelSprite = sprite(BRICK_COLORS, [
  'tttttttt',
  'hhhhhhho',
  'hbbbbbso',
  'hbbbbbso',
  'oooooooo',
  'bbbobbbb',
  'bbsobbbs',
  'oooooooo',
])

export const TILE: PixelSprite = sprite(BRICK_COLORS, [
  'bbbobbbb',
  'bbsobbbs',
  'oooooooo',
  'bobbbbbo',
  'sobbbsbo',
  'oooooooo',
  'bbbobbbb',
  'oooooooo',
])

// The goal: a bubble with a star inside, 16 × 16, centred on the goal tile.
export const GOAL_BUBBLE: PixelSprite = sprite(
  {
    c: '#94fdff', // rim, lit (45)
    C: '#0cf1ff', // rim (44)
    B: '#0098dc', // rim, shaded (42)
    w: '#ffffff', // shine (8)
    y: '#ffc825', // star (31)
    Y: '#ffeb57', // star, lit (32)
  },
  [
    '................',
    '.....cccccc.....',
    '...cc......cc...',
    '..c..ww......c..',
    '..c.ww.......c..',
    '.c.w....y.....c.',
    '.c.....yYy....c.',
    '.c...yyYYYyy..C.',
    '.c....yYYYy...C.',
    '.c....yy.yy...C.',
    '.c....y...y...C.',
    '..c..........C..',
    '..C.........BC..',
    '...CC.....BBC...',
    '.....CCCCCC.....',
    '................',
  ],
)

export const ALL_SPRITES: Readonly<Record<string, PixelSprite>> = {
  CHARACTER_IDLE,
  CHARACTER_RUN_A,
  CHARACTER_RUN_B,
  CHARACTER_JUMP,
  CHARACTER_FALL,
  TILE_TOP,
  TILE,
  GOAL_BUBBLE,
}
