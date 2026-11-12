import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readLevel } from '@automata/3d/level'
import { hotspotsOf } from '@automata/interact/sim'
import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { hotspotNamesAgainstCatalog } from '#src/testing/content-checks.ts'

// The English is the Owner's: every line says exactly what October's fixture says, and nothing was added or lost on
// the way. (A line changes only on the Owner's word; a translation never changes the English.)

const ROOT = join(import.meta.dirname, '../../..')
const FIXTURE = join(ROOT, '../../extensions/narrative/src/testing/fixtures')
const read = (path: string) => readFileSync(path, 'utf8')

const locale = parse(read(join(FIXTURE, 'prologue.locale.toml'))) as Record<string, string>
const fixtureLines = (
  parse(read(join(FIXTURE, 'prologue.lines.toml'))) as { lines: { id: string; text: string }[] }
).lines
const lines = (
  parse(read(join(ROOT, 'content/lines/prologue.toml'))) as {
    lines: { id: string; text: string; words: string }[]
  }
).lines

describe('the story’s words', () => {
  it('has the same 74 lines as the fixture, in the same order', () => {
    expect(fixtureLines).toHaveLength(74)
    expect(lines.map((line) => line.id)).toEqual(fixtureLines.map((line) => line.id))
  })

  it('says exactly what the fixture says, line by line', () => {
    for (const line of lines) expect(line.words, line.id).toBe(locale[line.text])
  })

  it('keeps the terms a translator never touches', () => {
    const all = lines.map((line) => line.words).join('\n')
    for (const term of ['Bed 04', 'A. Voss', '2000']) expect(all).toContain(term)
  })

  it('names each hotspot by a key the interface catalog has in English', () => {
    const level = readLevel(JSON.parse(read(join(ROOT, 'content/levels/prologue.af-sector.json')))).level
    const catalog = JSON.parse(read(join(ROOT, 'messages/ui/en.json'))) as Record<string, string>
    expect(hotspotNamesAgainstCatalog(hotspotsOf(level).hotspots, catalog)).toEqual([])
  })
})
