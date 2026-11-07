// Lettering for signs: block capitals (library/glyphs.json), set into lines and built as geometry, so a letter's
// texels land on the grid from every camera: raised panel letters (a quad per run of a glyph's texels) or neon tube
// letters (a glowing rod along each run, a bead at each lone texel). Words are made up from a seed (shop kinds,
// invented names, street names), never brands.
//
// Ported from EnvironmentBuilder (mcthaydt/EnvironmentBuilder) src/features/world/lettering.ts at 6d82a52.
// Changed: the font is read through a typed shape, a glyph the font lacks is a blank, and names come from a seeded
// stream (`stream`, AF's seeded generator).
import { type MeshData, merge } from '../../shared/math/geometry.ts'
import { at, type V3 } from '../../shared/math/math.ts'
import glyphs from './library/glyphs.json' with { type: 'json' }
import { blob, quad, rod } from './mesh.ts'
import { stream } from './stream.ts'

interface Font {
  readonly gap: number
  readonly leading: number
  readonly glyphs: Readonly<Record<string, readonly string[]>>
}

const FONT: Font = glyphs.font

/** Lines of text as rows of `#` (ink) and `.` (none): each line centred, a texel between letters. */
export function setText(lines: readonly string[]): string[] {
  const out: string[] = []
  lines.forEach((line, i) => {
    if (i > 0) for (let l = 0; l < FONT.leading; l++) out.push('')
    const blank = FONT.glyphs[' '] as readonly string[]
    const chars = [...line.toUpperCase()].map((c) => FONT.glyphs[c] ?? blank)
    const rows = (chars[0] ?? blank).length
    for (let r = 0; r < rows; r++) out.push(chars.map((g) => g[r] ?? '').join('.'.repeat(FONT.gap)))
  })
  const width = Math.max(0, ...out.map((r) => r.length))
  return out.map((row) => {
    const pad = width - row.length
    return '.'.repeat(pad >> 1) + row + '.'.repeat(pad - (pad >> 1))
  })
}

/** A bitmap's size in texels: width, height. */
export const sizeOf = (rows: readonly string[]): readonly [number, number] => [
  Math.max(0, ...rows.map((r) => r.length)),
  rows.length,
]

/**
 * Raised letters: a quad per horizontal run of ink, `px` metres a texel, centred on x 0 with its bottom at y 0, `z`
 * out.
 */
export function letterMesh(rows: readonly string[], px: number, z: number): MeshData {
  const [width, height] = sizeOf(rows)
  const runs: MeshData[] = []
  rows.forEach((row, j) => {
    let i = 0
    while (i < row.length) {
      if (row[i] !== '#') {
        i++
        continue
      }
      let end = i
      while (end < row.length && row[end] === '#') end++
      runs.push(quad([(i - width / 2) * px, (height - 1 - j) * px, z], [(end - i) * px, 0, 0], [0, px, 0]))
      i = end
    }
  })
  return merge(...runs)
}

/**
 * Neon tube letters: a rod along each horizontal and vertical run of ink (through texel centres), a bead at every
 * inked texel to round the joins, the tube `thick` metres across.
 */
export function tubeMesh(rows: readonly string[], px: number, z: number, thick: number): MeshData {
  const [width, height] = sizeOf(rows)
  const ink = (i: number, j: number): boolean => rows[j]?.[i] === '#'
  const centre = (i: number, j: number): V3 => [(i + 0.5 - width / 2) * px, (height - 1 - j + 0.5) * px, z]
  const parts: MeshData[] = []
  for (let j = 0; j < height; j++)
    for (let i = 0; i < width; i++) {
      if (!ink(i, j)) continue
      if (ink(i + 1, j) && !ink(i - 1, j)) {
        let end = i
        while (ink(end + 1, j)) end++
        parts.push(rod(centre(i, j), centre(end, j), thick, 6))
      }
      if (ink(i, j + 1) && !ink(i, j - 1)) {
        let end = j
        while (ink(i, end + 1)) end++
        parts.push(rod(centre(i, j), centre(i, end), thick, 6))
      }
      parts.push(blob(centre(i, j), [thick * 1.05, thick * 1.05, thick * 1.05], { seg: 6 }))
    }
  return merge(...parts)
}

const KINDS = [
  'CAFE',
  'BAR',
  'DELI',
  'BOOKS',
  'NOODLES',
  'RADIO',
  'TAILOR',
  'LAUNDRY',
  'BAKERY',
  'RECORDS',
  'HOTEL',
  'PAWN',
  'DINER',
  'MARKET',
  'GARAGE',
  'ARCADE',
] as const
const SYLLABLES = [
  'KA',
  'MO',
  'RI',
  'ZEN',
  'LO',
  'VA',
  'TE',
  'NO',
  'SU',
  'BE',
  'DA',
  'YU',
  'OR',
  'IN',
  'EL',
  'MA',
] as const

/** A made-up name: two or three syllables. */
export function nameOf(seed: number): string {
  const next = stream(seed * 31 + 7)
  let name = ''
  for (let i = 0; i < 2 + Math.floor(next() * 2); i++)
    name += at(SYLLABLES, Math.floor(next() * SYLLABLES.length))
  return name
}

/** A shop's sign: a kind, sometimes after a made-up name. */
export function shopName(seed: number): string[] {
  const next = stream(seed * 17 + 3)
  const kind = at(KINDS, Math.floor(next() * KINDS.length))
  return next() < 0.5 ? [kind] : [nameOf(seed), kind]
}

/** A street's name plate. */
export const streetName = (seed: number): string[] => [`${nameOf(seed)} ST`]
