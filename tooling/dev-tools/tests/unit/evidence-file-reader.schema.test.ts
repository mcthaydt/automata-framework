import { EvidenceSchema } from '@automata/evidence'
import { describe, expect, it } from 'vitest'
import { EvidenceFileReaderSchema, evidenceFileRefusal } from '#src/evidence-file-reader.schema.ts'

// DT-d: the reader takes what promotion needs from core's evidence file (the framework's tooling/evidence, packed as
// the private @automata/evidence, imported here in a test only, as F1 allows). The contract case parses a file with
// core's own schema first, so the reader follows core rather than a copy of it.

const node = { engine: 'node', version: 'v24.21.0', hash: '0123456789abcdef' }
const golden = (enginesAgree: boolean) => ({
  scenario: 'sim/walk',
  seed: 7,
  ticks: 600,
  enginesAgree,
  sources: ['packages/sim/src/walk.golden.test.ts'],
  hashes: [
    node,
    { engine: 'chromium', version: '140.0', hash: '0123456789abcdef' },
    { engine: 'firefox', version: '141.0', hash: '0123456789abcdef' },
    { engine: 'webkit', version: '26.0', hash: enginesAgree ? '0123456789abcdef' : 'fedcba9876543210' },
  ],
})
const coreFile = (overrides: { dirty?: boolean; enginesAgree?: boolean } = {}) =>
  EvidenceSchema.parse({
    schemaVersion: 1,
    generatedAt: '2026-10-30T12:00:00.000Z',
    revision: { sha: 'a'.repeat(40), dirty: overrides.dirty ?? false },
    run: { kind: 'local' },
    playwright: '1.60.0',
    goldens: [golden(overrides.enginesAgree ?? true)],
    packages: [{ name: '@automata/sim', version: '0.0.3', released: false }],
    automataCheck: { status: 'pending', waitingOn: ['DX.5'], note: 'not merged yet' },
  })

describe('EvidenceFileReaderSchema', () => {
  it('reads a file core writes, keeping only what promotion needs', () => {
    expect(EvidenceFileReaderSchema.parse(coreFile())).toEqual({
      schemaVersion: 1,
      revision: { sha: 'a'.repeat(40), dirty: false },
      goldens: [{ scenario: 'sim/walk', enginesAgree: true }],
    })
  })

  it('refuses another schema version and a file with no goldens', () => {
    expect(EvidenceFileReaderSchema.safeParse({ ...coreFile(), schemaVersion: 2 }).success).toBe(false)
    expect(EvidenceFileReaderSchema.safeParse({ ...coreFile(), goldens: [] }).success).toBe(false)
  })
})

describe('evidenceFileRefusal', () => {
  it('passes a clean file whose engines all agree', () => {
    expect(evidenceFileRefusal(JSON.stringify(coreFile()))).toBeNull()
  })

  it('refuses a file made from a dirty tree', () => {
    expect(evidenceFileRefusal(JSON.stringify(coreFile({ dirty: true })))).toBe(
      `made from a dirty tree at ${'a'.repeat(7)}`,
    )
  })

  it('refuses a file whose engines disagree, naming the golden', () => {
    expect(evidenceFileRefusal(JSON.stringify(coreFile({ enginesAgree: false })))).toBe(
      'the engines disagree on sim/walk',
    )
  })

  it('refuses text that is not JSON, and JSON that is not an evidence file', () => {
    expect(evidenceFileRefusal('{')).toMatch(/^not JSON: /)
    expect(evidenceFileRefusal('{"schemaVersion":1}')).toMatch(/^not an evidence file: /)
  })
})
