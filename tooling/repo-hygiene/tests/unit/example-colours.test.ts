import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { DUEL_RAMPS, nearestDuel } from '@automata/content/palette'
import { expect, it } from 'vitest'

// The 2D examples are what the site shows and what a new author copies, so their colours are the palette the framework
// ships with (DUEL, docs/art/palettes/duel.txt). A colour that is not in it is named with the DUEL colour nearest to it.

const ROOT = join(import.meta.dirname, '../../../../examples/2d')
const SKIPPED = new Set(['node_modules', 'tests', '__goldens__', 'dist', 'public'])
const DUEL = new Set(DUEL_RAMPS.flat())

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return SKIPPED.has(name) ? [] : sources(path)
    return name.endsWith('.ts') && !name.endsWith('.d.ts') ? [path] : []
  })
}

it('every hex colour in examples/2d is a DUEL colour', () => {
  const strangers: string[] = []
  for (const file of sources(ROOT)) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, index) => {
        for (const match of line.matchAll(/0x([0-9a-f]{6})\b/gi)) {
          const hex = `#${match[1]!.toLowerCase()}`
          if (DUEL.has(hex)) continue
          const pick = DUEL_RAMPS.flat()[nearestDuel(hex)]
          strangers.push(`${relative(ROOT, file)}:${index + 1} 0x${match[1]} is not DUEL; use ${pick}`)
        }
      })
  }
  expect(strangers).toEqual([])
})
