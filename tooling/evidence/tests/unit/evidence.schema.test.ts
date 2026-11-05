import { describe, expect, it } from 'vitest'
import { EvidenceSchema, GoldenEvidenceSchema } from '#src/evidence.schema.ts'

const hash = '539176c83c864b31'
const engines = ['node', 'chromium', 'firefox', 'webkit'] as const

const evidence = {
  schemaVersion: 1,
  generatedAt: '2026-10-16T12:00:00.000Z',
  revision: { sha: '71c3410aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', dirty: false },
  run: {
    kind: 'ci',
    url: 'https://github.com/mcthaydt/automata-framework/actions/runs/123/attempts/1',
    id: '123',
    attempt: 1,
    workflow: 'ci',
    job: 'parity',
    event: 'push',
    ref: 'refs/heads/main',
  },
  playwright: '1.63.0',
  goldens: [
    {
      scenario: 'testing/bounce',
      seed: 42,
      ticks: 300,
      enginesAgree: true,
      sources: ['packages/testing/src/sim/bounce.golden.test.ts'],
      hashes: engines.map((engine) => ({ engine, version: '1.0', hash })),
    },
  ],
  packages: [{ name: '@mcthaydt/automata-sim', version: '0.0.2', released: true }],
  automataCheck: {
    status: 'pending',
    waitingOn: ['DX.5', 'DX.6'],
    note: 'create-game and automata check are not merged yet',
  },
}

describe('EvidenceSchema', () => {
  it('accepts a complete evidence file', () => {
    expect(EvidenceSchema.parse(evidence)).toEqual(evidence)
  })

  it('accepts a local run, which has no URL', () => {
    expect(EvidenceSchema.safeParse({ ...evidence, run: { kind: 'local' } }).success).toBe(true)
  })

  it('rejects a CI run without its URL', () => {
    const { url: _url, ...run } = evidence.run
    expect(EvidenceSchema.safeParse({ ...evidence, run }).success).toBe(false)
  })

  it('rejects a hash that is not 16 hex digits', () => {
    const golden = { ...evidence.goldens[0], hashes: [{ engine: 'node', version: 'v24', hash: 'abc' }] }
    expect(EvidenceSchema.safeParse({ ...evidence, goldens: [golden] }).success).toBe(false)
  })

  it('rejects an engine outside Node, Chromium, Firefox and WebKit', () => {
    const golden = { ...evidence.goldens[0], hashes: [{ engine: 'safari', version: '26', hash }] }
    expect(EvidenceSchema.safeParse({ ...evidence, goldens: [golden] }).success).toBe(false)
  })

  it('rejects a file with no goldens: an empty file is not evidence', () => {
    expect(EvidenceSchema.safeParse({ ...evidence, goldens: [] }).success).toBe(false)
  })

  it('says the automata check results are pending until DX.5 and DX.6 land, and accepts nothing else', () => {
    const checked = { status: 'passed', results: [] }
    expect(EvidenceSchema.safeParse({ ...evidence, automataCheck: checked }).success).toBe(false)
  })
})

describe('GoldenEvidenceSchema (one engine’s run, from a test’s meta)', () => {
  it('accepts a Node run and a browser run', () => {
    const run = { scenario: 'testing/bounce', seed: 42, ticks: 300, hash }
    expect(
      GoldenEvidenceSchema.parse({ ...run, runtime: { kind: 'node', version: 'v24.21.0' } }),
    ).toBeTruthy()
    expect(
      GoldenEvidenceSchema.parse({ ...run, runtime: { kind: 'browser', userAgent: 'Firefox/155.0' } }),
    ).toBeTruthy()
  })
})
