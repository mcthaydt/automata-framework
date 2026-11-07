import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FilesLive, ProcessRunnerLive } from '@mcthaydt/automata-node'
import { Effect, Layer } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import { AUDIT_LOG, type AuditEntry, appendAudit, auditEntrySchema, auditRootOf, gitHead } from './audit.ts'

// The audit log (The Last Light's docs/pipeline-audit.jsonl and AuditEntry at 92e6704): one JSON line per call.

const temps: string[] = []
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})
const temp = () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'pipe-audit-')))
  temps.push(dir)
  return dir
}
const run = <A, E>(effect: Effect.Effect<A, E, never>) => Effect.runPromise(effect)
const live = Layer.merge(FilesLive, ProcessRunnerLive)

const entry: AuditEntry = {
  at: '2026-10-30T00:00:00.000Z',
  tool: 'pipeline_status',
  args: { pipeline: 'toy', target: 'toy', token: 'openai-secret-value' },
  ok: true,
  summary: 'toy: openai-secret-value',
  ms: 3,
  head: 'unknown',
}

describe('appendAudit', () => {
  it('appends one parseable line per call, creating the folder, with key values redacted', async () => {
    const path = join(temp(), AUDIT_LOG)
    await run(appendAudit(path, entry, { OPENAI_API_KEY: 'openai-secret-value' }))
    await run(appendAudit(path, { ...entry, ok: false, cost: { images: 1 } }, {}))
    const lines = readFileSync(path, 'utf8').split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[2]).toBe('')
    const first = auditEntrySchema.parse(JSON.parse(lines[0] as string))
    expect(first).toEqual({
      ...entry,
      args: { pipeline: 'toy', target: 'toy', token: '[redacted]' },
      summary: 'toy: [redacted]',
    })
    expect(auditEntrySchema.parse(JSON.parse(lines[1] as string))).toMatchObject({
      ok: false,
      cost: { images: 1 },
    })
  })
})

describe('gitHead', () => {
  it("is the repository's HEAD inside Git and unknown outside it", async () => {
    const repo = temp()
    const git = (...args: string[]) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' })
    git('init', '-q')
    writeFileSync(join(repo, 'a.txt'), 'a\n')
    git('add', '.')
    git('-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-q', '-m', 'a')
    const expected = git('rev-parse', 'HEAD').stdout.trim()
    expect(expected).toMatch(/^[0-9a-f]{40}$/)
    expect(await run(Effect.provide(gitHead(repo), live))).toBe(expected)
    expect(await run(Effect.provide(gitHead(temp()), live))).toBe('unknown')
  })
})

describe('auditRootOf', () => {
  it('is the folder of the nearest pipeline.toml, or the working folder', async () => {
    const root = temp()
    writeFileSync(join(root, 'pipeline.toml'), '')
    mkdirSync(join(root, 'art/wren'), { recursive: true })
    writeFileSync(join(root, 'art/wren/character.toml'), '')
    const of = (from: string) => run(Effect.provide(auditRootOf(from, process.cwd()), live))
    expect(await of(join(root, 'art/wren'))).toBe(root)
    expect(await of(join(root, 'art/wren/character.toml'))).toBe(root)
    const bare = temp()
    expect(await of(join(bare, 'x'))).toBe(process.cwd())
  })
})
