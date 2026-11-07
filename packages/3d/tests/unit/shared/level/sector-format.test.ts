// The sector format's one owner (M6 spec M6-D15, M6-D17): the Build-style sector vocabulary as Zod schemas, the
// constants every reader of a map shares, and the `occlude` member. It is a sim entry, so it imports nothing but zod.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as format from '#src/entries/level.ts'

/** Every bare import reachable from `file` through relative imports. */
function bareImports(file: string, seen = new Set<string>()): Set<string> {
  const found = new Set<string>()
  if (seen.has(file)) return found
  seen.add(file)
  const source = readFileSync(file, 'utf8')
  for (const [, spec] of source.matchAll(/(?:from|import)\s*\(?\s*'([^']+)'/g)) {
    if (spec === undefined) continue
    if (spec.startsWith('.')) {
      for (const inner of bareImports(resolve(dirname(file), spec), seen)) found.add(inner)
    } else found.add(spec)
  }
  return found
}

const wall = { next: 'hall', door: { at: 1, width: 0.9, height: 2.1 } }

describe('the sector format entry', () => {
  it('is declared as a sim entry and imports nothing but zod', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../../../package.json'), 'utf8'),
    )
    expect(manifest.automata.simEntries).toEqual(['./sim', './level', './timeline'])
    expect([...bareImports(resolve(import.meta.dirname, '../../../../src/entries/level.ts'))].sort()).toEqual(
      ['zod'],
    )
  })

  it('owns the constants a map is read with', () => {
    expect(format.WALL_THICK).toBe(0.125)
    expect(format.STEP).toBe(0.25)
    expect(format.DEFAULT_TRIM).toEqual({ skirting: 0.14, wainscot: 1.14, rail: 0.08, cap: true })
  })
})

describe('occlude', () => {
  it('is cut, fade or never, and nothing else', () => {
    expect(format.OCCLUDES).toEqual(['cut', 'fade', 'never'])
    for (const value of format.OCCLUDES) expect(format.occludeSchema.parse(value)).toBe(value)
    expect(format.occludeSchema.safeParse('hide').success).toBe(false)
  })
})

describe('cornerSchema', () => {
  it('takes x and z, with the wall that runs to the next corner', () => {
    expect(format.cornerSchema.parse([1, 2])).toEqual([1, 2])
    expect(format.cornerSchema.parse([1, 2, wall])).toEqual([1, 2, wall])
  })

  it('refuses a corner without both coordinates or with a bad wall', () => {
    expect(format.cornerSchema.safeParse([1]).success).toBe(false)
    expect(format.cornerSchema.safeParse([1, 2, { thick: 'deep' }]).success).toBe(false)
  })
})

describe('sectorDefSchema', () => {
  const room = {
    id: 'ward',
    zone: 'ward',
    floor: 0,
    ceiling: 3,
    light: 1,
    corners: [
      [0, 0],
      [4, 0, wall],
      [4, 3],
      [0, 3],
    ],
  }

  it('parses a sector without adding a default', () => {
    expect(format.sectorDefSchema.parse(room)).toEqual(room)
  })

  it('keeps holes, trims and members it does not know', () => {
    const more = {
      ...room,
      holes: [
        [
          [1, 1],
          [1, 2],
          [2, 2],
        ],
      ],
      trim: { rail: 0 },
      newer: true,
    }
    expect(format.sectorDefSchema.parse(more)).toEqual(more)
  })

  it.each(['id', 'zone', 'floor', 'ceiling', 'light', 'corners'])('refuses a sector without %s', (member) => {
    const { [member as keyof typeof room]: _left, ...rest } = room
    expect(format.sectorDefSchema.safeParse(rest).success).toBe(false)
  })
})
