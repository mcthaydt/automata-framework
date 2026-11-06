// @vitest-environment node
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DOCUMENT_FIXTURES, loadDocumentFixture, loadGolden } from './fixtures'

interface Recorded {
  readonly source: string
  readonly bytes: number
  readonly sha256: string
}
interface Origin {
  readonly repository: string
  readonly commit: string
  readonly files: Record<string, Recorded>
  readonly goldens?: Record<string, { bytes: number; sha256: string; recordedBy: string }>
}

const SOURCE = JSON.parse(readFileSync(new URL('./fixtures/SOURCE.json', import.meta.url), 'utf8')) as Record<
  string,
  Origin
>

const sha256 = (text: string): string => createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex')

describe('the documents fixtures', () => {
  it('record the repository and commit of each game they were copied from', () => {
    expect(SOURCE.lastLight).toMatchObject({
      repository: 'mcthaydt/PixiJS3D_Experiment_001',
      commit: '92e6704',
    })
    expect(SOURCE.arcade).toMatchObject({
      repository: 'the arcade source (docs/provenance/sources.md)',
      commit: '677d456',
    })
    expect(SOURCE.automata).toMatchObject({ repository: 'mcthaydt/automata-framework', commit: '30e9606c' })
  })

  it('list every fixture file once', () => {
    const recorded = Object.values(SOURCE).flatMap((origin) => Object.keys(origin.files))
    expect(recorded.sort()).toEqual([...DOCUMENT_FIXTURES].sort())
  })

  for (const name of DOCUMENT_FIXTURES) {
    it(`${name}: has the recorded byte length and sha256`, () => {
      const recorded = Object.values(SOURCE).find((origin) => origin.files[name])?.files[name]
      const text = loadDocumentFixture(name)
      expect(Buffer.byteLength(text, 'utf8')).toBe(recorded?.bytes)
      expect(sha256(text)).toBe(recorded?.sha256)
    })
  }

  it('the literals golden has the recorded byte length and sha256, and says how it was recorded', () => {
    const recorded = SOURCE.lastLight?.goldens?.['literals.golden.json']
    const text = loadGolden('literals')
    expect(Buffer.byteLength(text, 'utf8')).toBe(recorded?.bytes)
    expect(sha256(text)).toBe(recorded?.sha256)
    expect(recorded?.recordedBy).toMatch(/record-literals\.mjs/)
  })
})
