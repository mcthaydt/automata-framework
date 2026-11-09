import { blank, type Picture, plot } from './png.ts'
import { PALETTE } from './palette.ts'

// The starter terrain: 8 x 8 tiles of 16 px, in the order the starter level's ground rules name them. Tiles 0 to 46 are
// soil whose edges follow which neighbours are soil (read from the rules' own patterns, so the picture and the rules
// cannot disagree); 47 to 50 are a spike, water, a ladder and a one-way plank; 51 to 63 are decor to place over it.

const TILE = 16
const COLUMNS = 8

/** A cell of a rule's 3 x 3 pattern, as the level project writes it. */
export type PatternCell = 'any' | { readonly is: number } | { readonly not: number }

/** A rule of the ground group: the tile it picks and the neighbours it needs. */
export interface GroundRule {
  readonly tiles: readonly number[]
  /** Top row, middle row, bottom row: north-west, north, north-east, west, here, east, south-west, south, south-east. */
  readonly pattern: readonly PatternCell[]
}

/** Which neighbours of a soil cell are soil. A cell the rule does not care about counts as soil: no edge is drawn there. */
interface Around {
  readonly n: boolean
  readonly e: boolean
  readonly s: boolean
  readonly w: boolean
  readonly ne: boolean
  readonly se: boolean
  readonly sw: boolean
  readonly nw: boolean
}

const soil = (cell: PatternCell | undefined): boolean => cell === undefined || cell === 'any' || 'is' in cell

function aroundOf(pattern: readonly PatternCell[]): Around {
  return {
    nw: soil(pattern[0]),
    n: soil(pattern[1]),
    ne: soil(pattern[2]),
    w: soil(pattern[3]),
    e: soil(pattern[5]),
    sw: soil(pattern[6]),
    s: soil(pattern[7]),
    se: soil(pattern[8]),
  }
}

/** A number from 0 to 1 that depends only on its inputs: the same speckle in every run. */
function noise(x: number, y: number, seed: number): number {
  let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ Math.imul(seed + 1, 2147483647)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const colour = (key: string): string => PALETTE[key] ?? '#ff00ff'

function drawSoil(sheet: Picture, ox: number, oy: number, around: Around, seed: number): void {
  const set = (x: number, y: number, key: string): void => plot(sheet, ox + x, oy + y, colour(key))
  for (let y = 0; y < TILE; y += 1)
    for (let x = 0; x < TILE; x += 1) {
      const n = noise(x, y, seed)
      set(x, y, n < 0.08 ? 'D' : n > 0.93 ? 'e' : 'd')
    }
  // The shaded sides and foot of soil that faces open air.
  if (!around.w) for (let y = 0; y < TILE; y += 1) set(0, y, 'D')
  if (!around.e) for (let y = 0; y < TILE; y += 1) set(TILE - 1, y, 'D')
  if (!around.s) for (let x = 0; x < TILE; x += 1) for (const y of [TILE - 2, TILE - 1]) set(x, y, 'D')
  // Grass over soil that faces the sky, with a ragged lower edge.
  if (!around.n) {
    for (let x = 0; x < TILE; x += 1) {
      const drop = noise(x, 0, seed + 7) < 0.45 ? 4 : 3
      for (let y = 0; y < drop; y += 1) set(x, y, y === 0 ? 'q' : 'r')
      set(x, drop, 'R')
    }
  }
  // An inner corner: soil above and beside but open air diagonally, so a little grass turns the corner.
  if (around.n && around.w && !around.nw)
    for (const [x, y] of [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
      [0, 2],
    ] as const)
      set(x, y, y === 0 ? 'q' : 'r')
  if (around.n && around.e && !around.ne)
    for (const [x, y] of [
      [15, 0],
      [14, 0],
      [13, 0],
      [15, 1],
      [14, 1],
      [15, 2],
    ] as const)
      set(x, y, y === 0 ? 'q' : 'r')
  // Outer corners are rounded off.
  const clear = (x: number, y: number): void => {
    const at = ((oy + y) * sheet.width + ox + x) * 4
    sheet.rgba.fill(0, at, at + 4)
  }
  if (!around.n && !around.w)
    for (const [x, y] of [
      [0, 0],
      [1, 0],
      [0, 1],
    ] as const)
      clear(x, y)
  if (!around.n && !around.e)
    for (const [x, y] of [
      [15, 0],
      [14, 0],
      [15, 1],
    ] as const)
      clear(x, y)
  if (!around.s && !around.w)
    for (const [x, y] of [
      [0, 15],
      [1, 15],
      [0, 14],
    ] as const)
      clear(x, y)
  if (!around.s && !around.e)
    for (const [x, y] of [
      [15, 15],
      [14, 15],
      [15, 14],
    ] as const)
      clear(x, y)
}

function drawSpike(sheet: Picture, ox: number, oy: number): void {
  for (let spike = 0; spike < 4; spike += 1)
    for (let y = 6; y < TILE; y += 1) {
      const half = Math.floor((y - 6) / 3)
      const centre = spike * 4 + 1.5
      for (let x = Math.ceil(centre - half - 0.5); x <= Math.floor(centre + half + 0.5); x += 1)
        plot(sheet, ox + x, oy + y, colour(x < centre ? 'a' : 'A'))
    }
}

function drawWater(sheet: Picture, ox: number, oy: number): void {
  for (let y = 0; y < TILE; y += 1)
    for (let x = 0; x < TILE; x += 1) {
      const ripple = y === 1 && (x + 2) % 6 < 3
      plot(sheet, ox + x, oy + y, colour(ripple ? 'x' : 'W'))
    }
}

function drawLadder(sheet: Picture, ox: number, oy: number): void {
  for (let y = 0; y < TILE; y += 1) {
    plot(sheet, ox + 3, oy + y, colour('e'))
    plot(sheet, ox + 12, oy + y, colour('D'))
    if (y % 5 === 2) for (let x = 4; x < 12; x += 1) plot(sheet, ox + x, oy + y, colour('d'))
  }
}

function drawPlank(sheet: Picture, ox: number, oy: number): void {
  for (let x = 0; x < TILE; x += 1) {
    plot(sheet, ox + x, oy, colour('e'))
    plot(sheet, ox + x, oy + 1, colour('d'))
    plot(sheet, ox + x, oy + 2, colour('D'))
  }
}

/** Decor 0 to 12: grass tufts, flowers, a stone and a mushroom stand on the foot of a transparent tile. */
function drawDecor(sheet: Picture, ox: number, oy: number, index: number): void {
  const foot = TILE - 1
  const at = (x: number, y: number, key: string): void => plot(sheet, ox + x, oy + y, colour(key))
  const kind = index % 4
  const left = 3 + (index % 3) * 3
  if (kind === 0)
    for (const dx of [0, 2, 4]) {
      at(left + dx, foot, 'R')
      at(left + dx, foot - 1, 'r')
      at(left + dx + (dx === 2 ? 0 : dx === 0 ? -1 : 1), foot - 2, 'q')
    }
  else if (kind === 1) {
    for (let y = foot; y > foot - 4; y -= 1) at(left + 1, y, 'R')
    for (const [dx, dy] of [
      [0, 0],
      [2, 0],
      [1, -1],
      [1, 1],
    ] as const)
      at(left + dx, foot - 5 + dy, 'F')
    at(left + 1, foot - 5, 'y')
  } else if (kind === 2)
    for (const [dx, dy, key] of [
      [1, 0, 'a'],
      [2, 0, 'a'],
      [0, 1, 'a'],
      [1, 1, 'a'],
      [2, 1, 'A'],
      [3, 1, 'A'],
      [0, 2, 'A'],
      [1, 2, 'A'],
      [2, 2, 'A'],
      [3, 2, 'A'],
    ] as const)
      at(left + dx, foot - 2 + dy, key)
  else {
    for (let y = foot; y > foot - 3; y -= 1) at(left + 1, y, 'f')
    for (const [dx, dy] of [
      [-1, 0],
      [0, -1],
      [1, -1],
      [2, -1],
      [3, 0],
    ] as const)
      at(left + dx, foot - 3 + dy, 'F')
    at(left + 1, foot - 4, 'F')
  }
}

/** The terrain sheet, 128 x 128, from the ground group's rules. */
export function terrainSheet(rules: readonly GroundRule[]): Picture {
  const sheet = blank(COLUMNS * TILE, COLUMNS * TILE)
  const placeAt = (index: number): readonly [number, number] => [
    (index % COLUMNS) * TILE,
    Math.floor(index / COLUMNS) * TILE,
  ]
  for (const rule of rules)
    for (const index of rule.tiles) {
      const [ox, oy] = placeAt(index)
      drawSoil(sheet, ox, oy, aroundOf(rule.pattern), index)
    }
  drawSpike(sheet, ...placeAt(47))
  drawWater(sheet, ...placeAt(48))
  drawLadder(sheet, ...placeAt(49))
  drawPlank(sheet, ...placeAt(50))
  for (let index = 51; index < 64; index += 1) drawDecor(sheet, ...placeAt(index), index - 51)
  return sheet
}
