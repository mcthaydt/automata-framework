import { Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { testRemote } from '#src/shared/ship/remote/test-remote.ts'
import { fakeProcessRunner, type RecordedRun } from '#src/shared/ship/testing/fake-process-runner.ts'
import type { RunResult } from '../../../../../src/shared/node/process-runner.ts'

const ok = (stdout = ''): RunResult => ({ exitCode: 0, stdout, stderr: '' })
const SINCE = '2026-10-11T08:00:00Z'

interface Script {
  readonly status?: string
  /** What `gh run list` answers; a string is printed as is (not JSON). */
  readonly runs?: object[] | string
  /**
   * What each `gh run view` answers, in order; the last answer repeats. A string is printed as is (not JSON);
   * `{ fail }` makes gh exit 1 with that message, as on an HTTP 502.
   */
  readonly views?: (object | string)[]
}

const job = (status: string, conclusion: string | null, steps = 1) => ({
  name: 'checks',
  status,
  conclusion,
  steps: Array.from({ length: steps }, () => ({})),
})
const view = (status: string, conclusion: string | null, jobs: object[]) => ({ status, conclusion, jobs })
const GREEN = view('completed', 'success', [job('completed', 'success')])

/** A fake git and gh that answer like a branch with one dispatched run. */
function fakeGitAndGh(script: Script = {}) {
  let viewCalls = 0
  return fakeProcessRunner((run: RecordedRun) => {
    const line = [run.command, ...run.args].join(' ')
    if (line === 'git rev-parse --abbrev-ref HEAD') return ok('claude/af-m1-ship\n')
    if (line === 'git status --porcelain') return ok(script.status ?? '')
    if (line === 'git rev-parse HEAD') return ok('abc123\n')
    if (line.startsWith('gh run list')) {
      if (typeof script.runs === 'string') return ok(script.runs)
      return ok(
        JSON.stringify(
          script.runs ?? [{ databaseId: 7, createdAt: '2026-10-11T08:00:05Z', url: 'https://gh/run/7' }],
        ),
      )
    }
    if (line.startsWith('gh run view')) {
      const views = script.views ?? [GREEN]
      const answer = views[Math.min(viewCalls, views.length - 1)]
      viewCalls += 1
      if (typeof answer === 'string') return ok(answer)
      if (answer !== undefined && 'fail' in answer)
        return { exitCode: 1, stdout: '', stderr: String(answer.fail) }
      return ok(JSON.stringify(answer))
    }
    return ok()
  })
}

const run = (args: readonly string[], fake: ReturnType<typeof fakeGitAndGh>) =>
  Effect.runPromise(
    Effect.either(
      Effect.provide(
        testRemote({
          args,
          since: SINCE,
          pollAttempts: 3,
          pollIntervalMs: 0,
          watchIntervalMs: 0,
          queuePolls: 3,
          runPolls: 10,
        }),
        fake.layer,
      ),
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

  it('treats a garbled run list as no run yet, not as a crash', async () => {
    const result = await run([], fakeGitAndGh({ runs: '<html>502 Bad Gateway</html>' }))
    expect(reasonOf(result).reason).toBe('no-run')
  })

  it('waits while the run is queued and running, then reports it green', async () => {
    const fake = fakeGitAndGh({
      views: [
        view('queued', null, [job('queued', null, 0)]),
        view('in_progress', null, [job('in_progress', null)]),
        GREEN,
      ],
    })
    const result = await run([], fake)
    expect(result).toEqual(Either.right({ runUrl: 'https://gh/run/7', jobs: ['success\tchecks'] }))
  })

  it('cancels a run that no runner picks up within the queue timeout and says to run CI locally', async () => {
    const fake = fakeGitAndGh({ views: [view('queued', null, [job('queued', null, 0)])] })
    const result = await run([], fake)
    expect(reasonOf(result).reason).toBe('no-runner')
    expect(reasonOf(result).message).toContain('pnpm ci:local')
    expect(commands(fake)).toContain('gh run cancel 7')
    expect(commands(fake).filter((line) => line.startsWith('gh run view'))).toHaveLength(3)
  })

  it('does not take a failed look at the run (an HTTP 502) for a queued run', async () => {
    const queued = view('queued', null, [job('queued', null, 0)])
    const fake = fakeGitAndGh({
      views: [
        queued,
        queued,
        { fail: 'HTTP 502: Bad Gateway' },
        view('in_progress', null, [job('in_progress', null)]),
        GREEN,
      ],
    })
    const result = await run([], fake)
    expect(result).toEqual(Either.right({ runUrl: 'https://gh/run/7', jobs: ['success\tchecks'] }))
    expect(commands(fake)).not.toContain('gh run cancel 7')
  })

  it('looks again when gh prints something that is not JSON', async () => {
    const fake = fakeGitAndGh({ views: ['<html>502 Bad Gateway</html>', GREEN] })
    const result = await run([], fake)
    expect(result).toEqual(Either.right({ runUrl: 'https://gh/run/7', jobs: ['success\tchecks'] }))
  })

  it('stops with gh-unavailable after repeated failed looks, and leaves the run alone', async () => {
    const fake = fakeGitAndGh({ views: [{ fail: 'HTTP 502: Bad Gateway' }] })
    const result = await run([], fake)
    expect(reasonOf(result).reason).toBe('gh-unavailable')
    expect(reasonOf(result).message).toContain('https://gh/run/7')
    expect(commands(fake)).not.toContain('gh run cancel 7')
  })

  it('reports no runner when one job finished and another stays queued with nothing running', async () => {
    const fake = fakeGitAndGh({
      views: [
        view('in_progress', null, [job('completed', 'success'), { ...job('queued', null, 0), name: 'e2e' }]),
      ],
    })
    const result = await run([], fake)
    expect(reasonOf(result).reason).toBe('no-runner')
    expect(commands(fake)).toContain('gh run cancel 7')
  })

  it('does not take a job waiting for an environment approval for one with no runner', async () => {
    const fake = fakeGitAndGh({
      views: [
        view('waiting', null, [job('completed', 'success'), { ...job('waiting', null, 0), name: 'deploy' }]),
      ],
    })
    const result = await run([], fake)
    expect(reasonOf(result).reason).toBe('timeout')
    expect(commands(fake).filter((line) => line.startsWith('gh run view'))).toHaveLength(10)
  })

  it('reports jobs that failed without running a step as no runner, not as red CI', async () => {
    const fake = fakeGitAndGh({ views: [view('completed', 'failure', [job('completed', 'failure', 0)])] })
    const result = await run([], fake)
    expect(reasonOf(result).reason).toBe('no-runner')
  })

  it('gives up on a run still going after the run timeout, and cancels it', async () => {
    const fake = fakeGitAndGh({ views: [view('in_progress', null, [job('in_progress', null)])] })
    const result = await run([], fake)
    expect(reasonOf(result).reason).toBe('timeout')
    expect(commands(fake)).toContain('gh run cancel 7')
  })

  it('downloads the Playwright report when a run is red', async () => {
    const fake = fakeGitAndGh({
      views: [view('completed', 'failure', [{ ...job('completed', 'failure', 2), name: 'e2e' }])],
    })
    const result = await run(['tests/e2e/boot.spec.ts'], fake)
    expect(reasonOf(result).reason).toBe('red')
    expect(commands(fake)).toContain('gh run download 7 -n e2e-report -D playwright-report-remote')
  })
})
