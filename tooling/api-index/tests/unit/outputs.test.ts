import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { runApiIndex } from '#src/run.ts'

// One index, two committed pages: `docs/cheatsheet.md` and the agent package's `reference/api.md` (with the plugin's
// version, which Claude Code reads to refresh an installed plugin). `pnpm api-index --write` writes them all from one
// run; without `--write` a missing or different one is a finding.

const repo = fileURLToPath(new URL('../../fixtures/repo', import.meta.url))
const documented = ['@fixture/alpha#area', '@fixture/alpha#undocumented']
const scratch: string[] = []
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function committedFiles() {
  const dir = mkdtempSync(join(tmpdir(), 'api-index-outputs-'))
  scratch.push(dir)
  const baseline = join(dir, 'baseline.json')
  writeFileSync(baseline, JSON.stringify(documented))
  const pluginManifest = join(dir, 'plugin.json')
  writeFileSync(pluginManifest, `${JSON.stringify({ name: 'automata', version: '0.0.1' }, null, 2)}\n`)
  return {
    dir,
    baseline,
    committed: {
      cheatsheet: join(dir, 'cheatsheet.md'),
      agentReference: join(dir, 'api.md'),
      pluginManifest,
    },
  }
}

function run(files: ReturnType<typeof committedFiles>, write: boolean) {
  const out = join(files.dir, 'out')
  const result = runApiIndex({
    root: repo,
    out,
    corpus: ['docs/guide.md'],
    baseline: files.baseline,
    committed: { ...files.committed, write },
  })
  return { result, out, report: result.report.join('\n') }
}

describe('the committed outputs', () => {
  it('are each a finding, naming the one command, while missing or out of date', () => {
    const files = committedFiles()
    const { result, report } = run(files, false)
    expect(result.exitCode).toBe(1)
    for (const file of Object.values(files.committed)) expect(report).toContain(`${file} is stale`)
    expect(report).toContain('pnpm api-index --write')
    expect(existsSync(files.committed.cheatsheet)).toBe(false)
  })

  it('are all written by one run with --write, from the same index, and then pass', () => {
    const files = committedFiles()
    expect(run(files, true).result.exitCode).toBe(0)
    const { result, out } = run(files, false)
    expect(result.exitCode).toBe(0)
    expect(readFileSync(files.committed.cheatsheet, 'utf8')).toBe(
      readFileSync(join(out, 'cheatsheet.md'), 'utf8'),
    )
    expect(readFileSync(files.committed.agentReference, 'utf8')).toBe(
      readFileSync(join(out, 'api.md'), 'utf8'),
    )
    expect(JSON.parse(readFileSync(files.committed.pluginManifest, 'utf8'))).toEqual({
      name: 'automata',
      version: '1.2.3',
    })
  })

  it('catch one page edited by hand', () => {
    const files = committedFiles()
    run(files, true)
    writeFileSync(files.committed.agentReference, 'edited\n')
    const { result, report } = run(files, false)
    expect(result.exitCode).toBe(1)
    expect(report).toContain(`${files.committed.agentReference} is stale`)
    expect(report).not.toContain(`${files.committed.cheatsheet} is stale`)
  })
})
