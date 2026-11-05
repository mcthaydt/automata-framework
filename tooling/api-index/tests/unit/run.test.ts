import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { runApiIndex } from '#src/run.ts'

const repo = fileURLToPath(new URL('../../fixtures/repo', import.meta.url))
const unbuilt = fileURLToPath(new URL('../../fixtures/unbuilt', import.meta.url))
const corpus = ['docs/guide.md']
const scratch: string[] = []

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'api-index-'))
  scratch.push(dir)
  return dir
}

function baselineFile(ids: readonly string[]): string {
  const file = join(tempDir(), 'baseline.json')
  writeFileSync(file, `${JSON.stringify(ids)}\n`)
  return file
}

afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('runApiIndex', () => {
  it('writes the four files and fails naming each undocumented export missing from the baseline', () => {
    const out = tempDir()
    const result = runApiIndex({ root: repo, out, corpus, baseline: baselineFile([]) })
    expect(result.exitCode).toBe(1)
    expect(result.report.join('\n')).toContain('@fixture/alpha#undocumented')
    expect(result.report.join('\n')).toContain('@fixture/alpha#area')
    for (const name of ['api.json', 'api.md', 'llms-api.txt', 'llms-full.txt']) {
      expect(readFileSync(join(out, name), 'utf8').length, name).toBeGreaterThan(0)
    }
    expect(readFileSync(join(out, 'api.md'), 'utf8')).toBe(readFileSync(join(out, 'llms-api.txt'), 'utf8'))
  })

  it('passes when the baseline lists exactly the undocumented exports, and reports the counts', () => {
    const result = runApiIndex({
      root: repo,
      out: tempDir(),
      corpus,
      baseline: baselineFile(['@fixture/alpha#area', '@fixture/alpha#undocumented']),
    })
    expect(result.exitCode).toBe(0)
    expect(result.report.join('\n')).toContain(
      '10 exports from 2 entry points at 1.2.3; 2 undocumented (baseline)',
    )
  })

  it('fails on a stale baseline entry, so the baseline only shrinks', () => {
    const result = runApiIndex({
      root: repo,
      out: tempDir(),
      corpus,
      baseline: baselineFile(['@fixture/alpha#add', '@fixture/alpha#area', '@fixture/alpha#undocumented']),
    })
    expect(result.exitCode).toBe(1)
    expect(result.report.join('\n')).toContain('@fixture/alpha#add')
  })

  it('exits 2 with what to do when the packages are not built', () => {
    const result = runApiIndex({ root: unbuilt, out: tempDir(), corpus: [], baseline: baselineFile([]) })
    expect(result.exitCode).toBe(2)
    expect(result.report.join('\n')).toMatch(/pnpm build/)
  })

  describe('the committed cheatsheet', () => {
    const documented = ['@fixture/alpha#area', '@fixture/alpha#undocumented']

    function run(file: string, write: boolean) {
      const out = tempDir()
      const result = runApiIndex({
        root: repo,
        out,
        corpus,
        baseline: baselineFile(documented),
        cheatsheet: { file, write },
      })
      return { result, out }
    }

    it('fails naming the page and the fix when it is missing', () => {
      const file = join(tempDir(), 'cheatsheet.md')
      const { result } = run(file, false)
      expect(result.exitCode).toBe(1)
      expect(result.report.join('\n')).toContain(`${file} is stale`)
      expect(result.report.join('\n')).toContain('pnpm cheatsheet')
      expect(existsSync(file)).toBe(false)
    })

    it('fails when it differs from the page the index renders', () => {
      const file = join(tempDir(), 'cheatsheet.md')
      run(file, true)
      writeFileSync(file, readFileSync(file, 'utf8').replace('Adds two numbers.', 'Adds numbers.'))
      const { result } = run(file, false)
      expect(result.exitCode).toBe(1)
      expect(result.report.join('\n')).toContain(`${file} is stale`)
    })

    it('writes the page on request, then passes, and always writes cheatsheet.md beside the index', () => {
      const file = join(tempDir(), 'cheatsheet.md')
      const written = run(file, true)
      expect(written.result.exitCode).toBe(0)
      expect(written.result.report.join('\n')).toContain(`wrote ${file}`)
      const checked = run(file, false)
      expect(checked.result.exitCode).toBe(0)
      expect(readFileSync(join(checked.out, 'cheatsheet.md'), 'utf8')).toBe(readFileSync(file, 'utf8'))
    })
  })
})
