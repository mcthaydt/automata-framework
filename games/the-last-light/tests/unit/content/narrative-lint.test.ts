import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { lintNarrative } from '@automata/narrative/tools'
import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'

// The prologue's lines, beats and canon against the narrative lint every game's story passes: no line says a fact the
// canon has wrong, every beat is a line that exists, and no proper noun is invented.

const ROOT = join(import.meta.dirname, '../../..')
const file = (path: string) => parse(readFileSync(join(ROOT, path), 'utf8')) as Record<string, any>
const lines = file('content/lines/prologue.toml').lines as { id: string; text: string; words: string }[]
const text = Object.fromEntries(lines.map((line) => [line.text, line.words]))

describe('the prologue’s story', () => {
  const findings = lintNarrative({
    canon: file('content/canon/canon.toml') as never,
    records: lines as never,
    text,
    beats: file('content/beats/prologue.toml').beats as never,
  })

  it('has no lint error', () => {
    expect(
      findings
        .filter((finding) => finding.level === 'error')
        .map((finding) => `${finding.rule} ${finding.id}: ${finding.detail}`),
    ).toEqual([])
  })

  it('does lint: a beat delivered by a line that does not exist is an error', () => {
    const bad = lintNarrative({
      canon: file('content/canon/canon.toml') as never,
      records: lines as never,
      text,
      beats: [{ id: 'prologue.bogus', required: true, learn: 'x', deliveredBy: ['prologue.nope'] }] as never,
    })
    expect(bad.some((finding) => finding.level === 'error')).toBe(true)
  })
})
