import type { RunResult } from '@mcthaydt/automata-node'
import { Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { fakeProcessRunner, type RecordedRun } from '../testing/fake-process-runner.ts'
import { testRemote } from './test-remote.ts'

const ok = (stdout = ''): RunResult => ({ exitCode: 0, stdout, stderr: '' })
const SINCE = '2026-10-11T08:00:00Z'

interface Script {
  readonly status?: string
  readonly runs?: object[]
  readonly watchExit?: number
  readonly jobs?: object[]
}

/** A fake git and gh that answer like a branch with one dispatched run. */
function fakeGitAndGh(script: Script = {}) {
  return fakeProcessRunner((run: RecordedRun) => {
    const line = [run.command, ...run.args].join(' ')
    if (line === 'git rev-parse --abbrev-ref HEAD') return ok('claude/af-m1-ship\n')
    if (line === 'git status --porcelain') return ok(script.status ?? '')
    if (line === 'git rev-parse HEAD') return ok('abc123\n')
    if (line.startsWith('gh run list')) {
      return ok(
        JSON.stringify(
          script.runs ?? [{ databaseId: 7, createdAt: '2026-10-11T08:00:05Z', url: 'https://gh/run/7' }],
        ),
      )
    }
    if (line.startsWith('gh run watch')) return { exitCode: script.watchExit ?? 0, stdout: '', stderr: '' }
    if (line.startsWith('gh run view')) {
      return ok(
        JSON.stringify({ jobs: script.jobs ?? [{ name: 'checks', conclusion: 'success', steps: [{}] }] }),
      )
    }
    return ok()
  })
}

const run = (args: readonly string[], fake: ReturnType<typeof fakeGitAndGh>) =>
  Effect.runPromise(
    Effect.either(
      Effect.provide(testRemote({ args, since: SINCE, pollAttempts: 3, pollIntervalMs: 0 }), fake.layer),
    ),
  )

/** The failure's reason; a ProcessError (a program that could not start) fails the test. */
function reasonOf(result: Awaited<ReturnType<typeof run>>): { reason: string; message: string } {
  if (Either.isRight(result)) throw new Error('expected a failure')
  if (result.left._tag !== 'TestRemoteFailed') throw new Error(`unexpected ${result.left._tag}`)
  return result.left
}

const commands = (fake: ReturnType<typeof fakeGitAndGh>): string[] =>
  fake.runs.map((recorded) => [recorded.command, ...recorded.args].join(' '))

describe('testRemote', () => {
  it('pushes the branch and dispatches a focused run with the spec and project', async () => {
    const fake = fakeGitAndGh()
    const result = await run(['tests/e2e/boot.spec.ts', '--project=mobile-portrait'], fake)
    expect(result).toEqual(Either.right({ runUrl: 'https://gh/run/7', jobs: ['success\tchecks'] }))
    expect(commands(fake)).toContain('git push -q -u origin claude/af-m1-ship')
    expect(commands(fake)).toContain(
      'gh workflow run ci.yml --ref claude/af-m1-ship -f spec=tests/e2e/boot.spec.ts --project=mobile-portrait -f nightly=false',
    )
  })

  it('dispatches the nightly set with --nightly', async () => {
    const fake = fakeGitAndGh()
    await run(['--nightly'], fake)
    expect(commands(fake)).toContain(
      'gh workflow run ci.yml --ref claude/af-m1-ship -f spec= -f nightly=true',
    )
  })

  it('refuses uncommitted changes, because the runner tests what is pushed', async () => {
    const fake = fakeGitAndGh({ status: ' M package.json\n' })
    const result = await run([], fake)
    expect(reasonOf(result).reason).toBe('uncommitted')
    expect(commands(fake).some((line) => line.startsWith('git push'))).toBe(false)
  })

  it('refuses --nightly with other arguments', async () => {
    const result = await run(['--nightly', 'x.spec.ts'], fakeGitAndGh())
    expect(reasonOf(result).reason).toBe('usage')
  })

  it('ignores runs from before it started and says so when none appears', async () => {
    const fake = fakeGitAndGh({ runs: [{ databaseId: 1, createdAt: '2026-10-11T07:59:59Z', url: 'old' }] })
    const result = await run([], fake)
    expect(reasonOf(result).reason).toBe('no-run')
  })

  it('reports a run whose jobs never got a runner, with the local command to use instead', async () => {
    const fake = fakeGitAndGh({ watchExit: 1, jobs: [{ name: 'checks', conclusion: 'failure', steps: [] }] })
    const result = await run([], fake)
    expect(reasonOf(result).reason).toBe('no-runner')
    expect(reasonOf(result).message).toContain('pnpm check')
  })

  it('downloads the Playwright report when a run is red', async () => {
    const fake = fakeGitAndGh({
      watchExit: 1,
      jobs: [{ name: 'e2e', conclusion: 'failure', steps: [{}, {}] }],
    })
    const result = await run(['tests/e2e/boot.spec.ts'], fake)
    expect(reasonOf(result).reason).toBe('red')
    expect(commands(fake)).toContain('gh run download 7 -n e2e-report -D playwright-report-remote')
  })
})
