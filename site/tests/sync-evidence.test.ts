// @vitest-environment node
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { assertFromRun, candidateRuns, installEvidence, type RunSummary } from '../scripts/sync-evidence'

const fixtures = resolve(import.meta.dirname, 'fixtures')
const dirs: string[] = []
const temp = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'sync-evidence-'))
  dirs.push(dir)
  return dir
}
afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }) })

/** A folder shaped like the downloaded `evidence` artifact. */
function artifact(change?: (doc: any) => void): string {
  const dir = temp()
  const doc = JSON.parse(readFileSync(join(fixtures, 'evidence.sample.json'), 'utf8'))
  change?.(doc)
  writeFileSync(join(dir, 'evidence.json'), `${JSON.stringify(doc, null, 2)}\n`)
  cpSync(join(fixtures, 'evidence.schema.sample.json'), join(dir, 'evidence.schema.json'))
  return dir
}

const run = (databaseId: number, conclusion: string, createdAt: string, headSha = '0'.repeat(39) + '1'): RunSummary =>
  ({ databaseId, conclusion, createdAt, headSha, url: `https://github.com/example/framework/actions/runs/${databaseId}` })

describe('candidateRuns', () => {
  it('keeps successful runs only, newest first', () => {
    const runs = [run(1, 'success', '2026-10-01T00:00:00Z'), run(2, 'failure', '2026-10-03T00:00:00Z'), run(3, 'success', '2026-10-02T00:00:00Z'), run(4, 'cancelled', '2026-10-04T00:00:00Z')]
    expect(candidateRuns(runs).map(r => r.databaseId)).toEqual([3, 1])
  })
})

describe('installEvidence', () => {
  it('copies a valid artifact byte for byte', () => {
    const from = artifact()
    const to = temp()
    installEvidence(from, to)
    for (const name of ['evidence.json', 'evidence.schema.json']) expect(readFileSync(join(to, name))).toEqual(readFileSync(join(from, name)))
  })

  it('writes nothing when the artifact does not validate', () => {
    const to = temp()
    expect(() => installEvidence(artifact(doc => { doc.goldens[0].hashes[0].hash = 'nope' }), to)).toThrow(/rejected/)
    expect(existsSync(join(to, 'evidence.json'))).toBe(false)
    expect(existsSync(join(to, 'evidence.schema.json'))).toBe(false)
  })

  it('says what is missing from a folder that is not the artifact', () => {
    expect(() => installEvidence(temp(), temp())).toThrow(/evidence\.json/)
  })
})

describe('assertFromRun', () => {
  it('accepts an artifact made at the revision its run built', () => {
    const evidence = JSON.parse(readFileSync(join(artifact(), 'evidence.json'), 'utf8'))
    expect(() => assertFromRun(evidence, run(9, 'success', '2026-10-05T00:00:00Z'))).not.toThrow()
  })

  it('refuses an artifact from another revision', () => {
    const evidence = JSON.parse(readFileSync(join(artifact(), 'evidence.json'), 'utf8'))
    expect(() => assertFromRun(evidence, run(9, 'success', '2026-10-05T00:00:00Z', 'f'.repeat(40)))).toThrow(/revision/)
  })
})
