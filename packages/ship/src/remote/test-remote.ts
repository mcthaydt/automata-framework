import { type ProcessError, ProcessRunner } from '@mcthaydt/automata-node'
import { Effect } from 'effect'
import { TestRemoteFailed } from '../errors.ts'

// `test-remote` (FloorFifty `tools/test-remote`, ship spec §3.6): runs CI for the current branch on the
// remote runners and waits, so a developer's machine runs no heavy suite itself.
//
//   test-remote                         the hosted checks for this commit
//   test-remote <playwright args>       one focused browser run, e.g. tests/e2e/boot.spec.ts --project=desktop
//   test-remote --nightly               the nightly set now (every viewport, the GPU lanes)
//
// The runner tests what is pushed, so uncommitted changes are refused instead of silently left out. Hosted
// Actions jobs are not getting runners on this account (2026-10-11): such a run fails at once with jobs that
// never ran a step, and that is reported as "no runner" with the local command to run instead, not as red CI.

export interface TestRemoteInput {
  /** The words after `test-remote`. Split on whitespace, so a quoted multi-word value does not survive. */
  readonly args: readonly string[]
  /** Only a run created at or after this time (ISO 8601, UTC) is ours. */
  readonly since: string
  readonly pollAttempts?: number
  readonly pollIntervalMs?: number
}

interface Job {
  readonly name: string
  readonly conclusion: string | null
  readonly steps: readonly unknown[]
}

const LOCAL_GATE =
  'run CI locally instead: pnpm install --frozen-lockfile && pnpm check && pnpm --filter @mcthaydt/automata-sim exec vitest run --project browsers'

const fail = (reason: TestRemoteFailed['reason'], message: string) =>
  new TestRemoteFailed({ reason, message })

export function testRemote(
  input: TestRemoteInput,
): Effect.Effect<
  { runUrl: string; jobs: readonly string[] },
  TestRemoteFailed | ProcessError,
  ProcessRunner
> {
  return Effect.gen(function* () {
    const runner = yield* ProcessRunner
    const output = (command: string, args: readonly string[]) =>
      Effect.map(runner.run(command, args), (result) => ({ ...result, text: result.stdout.trim() }))

    const nightly = input.args[0] === '--nightly'
    if (nightly && input.args.length > 1) return yield* fail('usage', '--nightly takes no other arguments')

    const branch = (yield* output('git', ['rev-parse', '--abbrev-ref', 'HEAD'])).text
    if (branch === 'HEAD') return yield* fail('detached', 'detached HEAD: check out a branch first')
    if ((yield* output('git', ['status', '--porcelain'])).text !== '') {
      return yield* fail(
        'uncommitted',
        'uncommitted changes: commit them first; the runner tests what is pushed',
      )
    }
    const push = yield* runner.run('git', ['push', '-q', '-u', 'origin', branch])
    if (push.exitCode !== 0) return yield* fail('push', `git push failed:\n${push.stderr.trim()}`)
    const sha = (yield* output('git', ['rev-parse', 'HEAD'])).text

    const spec = nightly ? '' : input.args.join(' ')
    const dispatch = yield* runner.run('gh', [
      'workflow',
      'run',
      'ci.yml',
      '--ref',
      branch,
      '-f',
      `spec=${spec}`,
      '-f',
      `nightly=${nightly}`,
    ])
    if (dispatch.exitCode !== 0)
      return yield* fail('dispatch', `gh workflow run failed:\n${dispatch.stderr.trim()}`)

    // The dispatched run takes a moment to appear; take the first one created since we started.
    let run: { databaseId: number; url: string } | undefined
    for (let attempt = 0; attempt < (input.pollAttempts ?? 45) && run === undefined; attempt++) {
      if (attempt > 0) yield* Effect.sleep(input.pollIntervalMs ?? 2000)
      const listed = yield* output('gh', [
        'run',
        'list',
        '--workflow',
        'ci.yml',
        '--event',
        'workflow_dispatch',
        '--commit',
        sha,
        '--limit',
        '5',
        '--json',
        'databaseId,createdAt,url',
      ])
      const runs = JSON.parse(listed.text || '[]') as { databaseId: number; createdAt: string; url: string }[]
      run = runs.find((candidate) => candidate.createdAt >= input.since)
    }
    if (run === undefined) return yield* fail('no-run', `no workflow_dispatch run appeared for ${sha}`)

    const id = String(run.databaseId)
    const watch = yield* runner.run('gh', ['run', 'watch', id, '--exit-status', '--interval', '20'])
    const view = yield* output('gh', ['run', 'view', id, '--json', 'jobs'])
    const jobs = (JSON.parse(view.text || '{"jobs":[]}') as { jobs: Job[] }).jobs
    const summary = jobs.map((job) => `${job.conclusion ?? 'pending'}\t${job.name}`)
    if (watch.exitCode === 0) return { runUrl: run.url, jobs: summary }

    const failed = jobs.filter((job) => job.conclusion !== 'success' && job.conclusion !== 'skipped')
    if (failed.length > 0 && failed.every((job) => job.steps.length === 0)) {
      return yield* fail(
        'no-runner',
        `${run.url}: no runner picked the jobs up (${summary.join(', ')}); ${LOCAL_GATE}`,
      )
    }
    yield* runner.run('rm', ['-rf', 'playwright-report-remote'])
    const report = yield* runner.run('gh', [
      'run',
      'download',
      id,
      '-n',
      'e2e-report',
      '-D',
      'playwright-report-remote',
    ])
    const where = report.exitCode === 0 ? '\nreport: playwright-report-remote/' : ''
    return yield* fail('red', `${run.url} is red:\n${summary.join('\n')}${where}`)
  })
}
