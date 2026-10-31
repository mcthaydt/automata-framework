// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { allGoldensAgree, parseEvidence } from '../src/lib/evidence'
import sample from './fixtures/evidence.sample.json'
import schema from './fixtures/evidence.schema.sample.json'

// DX.9w. The framework's CI writes evidence.json on every push to main (DX spec §3.10); the site renders proof from it
// and never types a hash by hand. The fixtures here are SAMPLES: tests/fixtures/evidence.schema.sample.json is
// z.toJSONSchema of the framework's EvidenceSchema (tooling/evidence), and evidence.sample.json is a made-up document
// that fits it (all-letter hashes, a zero revision). Nothing in tests/fixtures is ever rendered on the site.

const mutated = (change: (doc: any) => void): unknown => {
  const doc = structuredClone(sample)
  change(doc)
  return doc
}

describe('parseEvidence', () => {
  it('accepts a document that fits the schema', () => {
    const evidence = parseEvidence(sample, schema)
    expect(evidence.goldens.map(golden => golden.scenario)).toEqual(['sample/agreeing', 'sample/disagreeing'])
    expect(evidence.run.kind).toBe('ci')
  })

  it.each([
    ['a hash that is not 16 hex digits', (doc: any) => { doc.goldens[0].hashes[0].hash = 'xyz' }],
    ['an engine outside node, chromium, firefox and webkit', (doc: any) => { doc.goldens[0].hashes[0].engine = 'edge' }],
    ['a revision that is not a full commit', (doc: any) => { doc.revision.sha = 'abc1234' }],
    ['a golden with fewer than four engines', (doc: any) => { doc.goldens[0].hashes.pop() }],
    ['a property the schema does not know', (doc: any) => { doc.goldens[0].speedup = 3 }],
    ['an automata check that claims to have passed', (doc: any) => { doc.automataCheck = { status: 'passed' } }],
    ['no goldens', (doc: any) => { doc.goldens = [] }],
    ['a CI run without its URL', (doc: any) => { delete doc.run.url }],
    ['a generation time that is not a date', (doc: any) => { doc.generatedAt = 'yesterday' }],
  ])('rejects %s', (_name, change) => {
    expect(() => parseEvidence(mutated(change), schema)).toThrow(/evidence/i)
  })

  it('refuses a local run: only CI on main is proof', () => {
    expect(() => parseEvidence(mutated(doc => { doc.run = { kind: 'local' } }), schema)).toThrow(/CI run/)
  })

  it('refuses a dirty working tree', () => {
    expect(() => parseEvidence(mutated(doc => { doc.revision.dirty = true }), schema)).toThrow(/uncommitted/)
  })

  it('does not trust enginesAgree: it must say what the hashes say', () => {
    expect(() => parseEvidence(mutated(doc => { doc.goldens[1].enginesAgree = true }), schema)).toThrow(/sample\/disagreeing.*differ/)
    expect(() => parseEvidence(mutated(doc => { doc.goldens[0].enginesAgree = false }), schema)).toThrow(/sample\/agreeing.*agree/)
  })

  it('refuses a golden that lists one engine twice', () => {
    expect(() => parseEvidence(mutated(doc => { doc.goldens[0].hashes[1].engine = 'node' }), schema)).toThrow(/sample\/agreeing.*each engine once/)
  })
})

describe('allGoldensAgree (DX.10a: the homepage claims determinism only when it holds)', () => {
  it('is true only when there are goldens and every one has the engines agreeing', () => {
    const evidence = parseEvidence(sample, schema)
    expect(allGoldensAgree(evidence)).toBe(false)
    expect(allGoldensAgree({ ...evidence, goldens: evidence.goldens.filter(golden => golden.enginesAgree) })).toBe(true)
    expect(allGoldensAgree({ ...evidence, goldens: [] })).toBe(false)
    expect(allGoldensAgree(undefined)).toBe(false)
  })
})

describe('the synced evidence file (src/data/evidence.json)', () => {
  const data = (name: string) => resolve(import.meta.dirname, '../src/data', name)

  // Red until `pnpm sync:evidence` has run with a GitHub token that can read the framework's Actions artifacts.
  it('exists, and is the one the schema next to it accepts', () => {
    expect(existsSync(data('evidence.json')), 'run `pnpm sync:evidence` (needs `gh auth login`)').toBe(true)
    expect(existsSync(data('evidence.schema.json')), 'run `pnpm sync:evidence`').toBe(true)
    const evidence = parseEvidence(JSON.parse(readFileSync(data('evidence.json'), 'utf8')), JSON.parse(readFileSync(data('evidence.schema.json'), 'utf8')))
    expect(evidence.goldens.length).toBeGreaterThan(0)
  })
})
