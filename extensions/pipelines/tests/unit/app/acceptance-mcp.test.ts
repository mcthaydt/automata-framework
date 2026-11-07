import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { Effect, Layer } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import { FilesLive } from '#src/shared/node/files.ts'
import { ProcessRunnerLive } from '#src/shared/node/process.ts'
import { route } from '#src/shared/router.ts'
import { mcpProject, TOY } from '#src/testing/mcp-client.ts'
import { toyPipeline } from '#src/testing/toy.ts'

// Every tool call is audited and an agent's approve is refused, in a temp Git repository holding the toy pipeline's project.

const temps: string[] = []
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const git = (root: string, ...args: string[]) =>
  spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], {
    cwd: root,
    encoding: 'utf8',
  })
const commit = (root: string, message: string) => {
  git(root, 'add', '-A')
  git(root, 'commit', '-q', '--allow-empty', '-m', message)
  return git(root, 'rev-parse', 'HEAD').stdout.trim()
}
const initRepo = (root: string) => {
  git(root, 'init', '-q')
  commit(root, 'project')
}

describe('every MCP tool call adds one audit line with the current head', () => {
  it('logs each call, valid or not, with the head at that call', async () => {
    const { root, call, auditLines } = await mcpProject(temps, { prepare: initRepo })
    const first = git(root, 'rev-parse', 'HEAD').stdout.trim()
    expect(first).toMatch(/^[0-9a-f]{40}$/)
    await call('pipeline_list')
    await call('pipeline_status', TOY)
    await call('pipeline_estimate', TOY)
    await call('pipeline_run', TOY)
    const second = commit(root, 'after the first run')
    expect(second).not.toBe(first)
    await call('pipeline_request_review', { ...TOY, gate: 'T1' })
    await call('pipeline_review_status', { ...TOY, gate: 'T1' })
    await call('pipeline_status', { pipeline: 'toy' })
    await call('pipeline_nothing')
    expect(auditLines().map((line) => [line.tool, line.head])).toEqual([
      ['pipeline_list', first],
      ['pipeline_status', first],
      ['pipeline_estimate', first],
      ['pipeline_run', first],
      ['pipeline_request_review', second],
      ['pipeline_review_status', second],
      ['pipeline_status', second],
      ['pipeline_nothing', second],
    ])
  })
})

describe("an agent's approve is refused with exit 4 and logged", () => {
  it('through the router and through the server; only the person, by elicitation, approves', async () => {
    const { root, call, gates, auditLines } = await mcpProject(temps, {
      prepare: initRepo,
      answer: () => ({ action: 'accept', content: { decision: 'approve' } }),
    })
    const head = git(root, 'rev-parse', 'HEAD').stdout.trim()
    expect((await call('pipeline_run', TOY)).data.exit).toBe(3)

    const routed = await Effect.runPromise(
      route(['toy', 'approve', join(root, 'toy'), 'T1', '--json'], [toyPipeline()], undefined, {
        agent: true,
        env: {},
      }).pipe(Effect.provide(Layer.merge(FilesLive, ProcessRunnerLive))),
    )
    expect(routed.exit).toBe(4)
    expect(JSON.parse(routed.stdout)).toMatchObject({ ok: false, exit: 4 })
    expect(gates().T1?.decision).toBe('pending')

    const tool = await call('pipeline_approve', { ...TOY, gate: 'T1' })
    expect([tool.error, tool.data.exit]).toEqual([true, 4])
    expect(gates().T1?.decision).toBe('pending')

    expect((await call('pipeline_request_review', { ...TOY, gate: 'T1' })).data.decision).toBe('approved')
    expect(gates().T1).toMatchObject({ decision: 'approved', by: 'owner' })

    expect(auditLines().map((line) => [line.tool, line.ok, line.head])).toEqual([
      ['pipeline_run', true, head],
      ['automata-pipe approve', false, head],
      ['pipeline_approve', false, head],
      ['pipeline_request_review', true, head],
    ])
  })
})
