import { Effect } from 'effect'
import type { ProcessError } from '../../node/errors.ts'
import { ProcessRunner } from '../../node/process-runner.ts'
import { TestRemoteFailed } from '../errors.ts'

// `test-remote` (FloorFifty `tools/test-remote`, ship spec §3.6): runs CI for the current branch on the
// remote runners and waits, so a developer's machine runs no heavy suite itself.
//
//   test-remote                         the hosted checks for this commit
//   test-remote <folder> <args>         one focused browser run: a game or example set that has its own Playwright
//                                       config, then Playwright's arguments, e.g. games/emberwick --project=emberwick-ipad-webkit
//   test-remote --nightly               the nightly set now (every viewport, the GPU lanes)
//
// The runner tests what is pushed, so uncommitted changes are refused instead of silently left out.
//
// AF's jobs run on a self-hosted runner (ci.yml header). With none online a job does not fail, it waits in the
// queue, and GitHub only gives up after a day. So test-remote polls the run itself: a run with no job started
// after the queue timeout (10 minutes) is cancelled and reported as "no runner" with the local command to run
// instead (ship spec §6), and a run still going after the run timeout (60 minutes, past every job's
// timeout-minutes) is cancelled as "timeout". A hosted job that failed without running a step (no hosted
// minutes) is also "no runner", not red CI.
//
// "No runner" is decided only from looks that worked: a `gh run view` that fails (an HTTP 502) or prints
// something that is not JSON says nothing about the run, so it is retried and never counted. After
// `viewRetries` failed looks in a row test-remote stops as "gh-unavailable" and leaves the run alone, since it
// cannot tell whether the run is healthy.

/**
 * What `testRemote` runs and how long it waits. The timing fields are for tests: the defaults suit a real
 * run. `args` are the words after `test-remote`: nothing for the hosted checks, a folder and Playwright arguments for one
 * focused run, or `--nightly`.
 */
export interface TestRemoteInput {
  /** The words after `test-remote`. Split on whitespace, so a quoted multi-word value does not survive. */
  readonly args: readonly string[]
  /** Only a run created at or after this time (ISO 8601, UTC) is ours. */
  readonly since: string
  /** How often, and how many times, to look for the dispatched run (default 45 × 2 s). */
  readonly pollAttempts?: number
  readonly pollIntervalMs?: number
  /** How often to look at the run while it is queued or running (default 20 s). */
  readonly watchIntervalMs?: number
  /** Looks at a run with no job started before it counts as having no runner (default 30, 10 minutes). */
  readonly queuePolls?: number
  /** Looks at a run in all before giving up on it (default 180, 60 minutes). */
  readonly runPolls?: number
  /** Failed looks in a row (gh error or not JSON) before giving up on gh (default 5). */
  readonly viewRetries?: number
}

interface Job {
  readonly name: string
  readonly status: string
  readonly conclusion: string | null
  readonly steps: readonly unknown[]
}

interface RunView {
  readonly status: string
  readonly conclusion: string | null
  readonly jobs: readonly Job[]
}

const LOCAL_GATE = 'run CI locally instead: pnpm ci:local'

/** Parses gh's JSON output; undefined when it is not JSON, so the caller can look again. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function isRunView(value: unknown): value is RunView {
  const view = value as RunView | undefined
  return typeof view?.status === 'string' && Array.isArray(view.jobs)
}

// Job states that mean "no runner has taken it yet". `waiting` is not one: GitHub uses it for a job held for an
// environment's approval, which a person gives, not a runner.
const WAITING_FOR_RUNNER = new Set(['queued', 'pending', 'requested'])

/**
 * True when the run is held up only by jobs no runner has taken: nothing is in progress or waiting for an
 * approval, and some job (or the run itself, queued before its jobs exist) is still queued. Covers a run whose
 * first job finished on one runner and whose next job never got one.
 */
function waitingForRunner(viewed: RunView): boolean {
  if (viewed.status === 'completed') return false
  if (viewed.jobs.length === 0) return viewed.status === 'queued'
  const busy = viewed.jobs.some((job) => job.status === 'in_progress' || job.status === 'waiting')
  return !busy && viewed.jobs.some((job) => WAITING_FOR_RUNNER.has(job.status))
}

const fail = (reason: TestRemoteFailed['reason'], message: string) =>
  new TestRemoteFailed({ reason, message })

/**
 * Pushes the current branch, dispatches CI for it, waits and returns the run's URL and one `<result>\t<job>`
 * line per job when it is green. Otherwise fails with a `TestRemoteFailed` whose `reason` says why (see
 * `TestRemoteReason`).
 */
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
      // A failed or garbled answer just means another try.
      const runs = listed.exitCode === 0 ? parseJson(listed.text || '[]') : undefined
      if (!Array.isArray(runs)) continue
      run = (runs as { databaseId: number; createdAt: string; url: string }[]).find(
        (candidate) => candidate.createdAt >= input.since,
      )
    }
    if (run === undefined) return yield* fail('no-run', `no workflow_dispatch run appeared for ${sha}`)

    const id = String(run.databaseId)
    const runUrl = run.url
    // One look at the run: its view, or undefined when gh failed or printed something that is not a run.
    const look = Effect.map(
      output('gh', ['run', 'view', id, '--json', 'status,conclusion,jobs']),
      (viewed) => {
        if (viewed.exitCode !== 0) return undefined
        const parsed = parseJson(viewed.text)
        return isRunView(parsed) ? parsed : undefined
      },
    )
    const cancel = runner.run('gh', ['run', 'cancel', id])
    const summaryOf = (viewed: RunView) =>
      viewed.jobs.map((job) => `${job.conclusion ?? job.status}\t${job.name}`)

    let polls = 0
    let failedLooks = 0
    // Looks in a row, among those that worked, that found the run waiting for a runner.
    let waitingLooks = 0
    let completed: RunView | undefined
    while (completed === undefined) {
      if (polls > 0) yield* Effect.sleep(input.watchIntervalMs ?? 20_000)
      const viewed = yield* look
      polls += 1
      if (viewed === undefined) {
        failedLooks += 1
        if (failedLooks >= (input.viewRetries ?? 5)) {
          return yield* fail(
            'gh-unavailable',
            `gh could not read ${runUrl} ${failedLooks} times in a row; the run was left alone, check it there`,
          )
        }
      } else {
        failedLooks = 0
        if (viewed.status === 'completed') {
          completed = viewed
          continue
        }
        waitingLooks = waitingForRunner(viewed) ? waitingLooks + 1 : 0
        if (waitingLooks >= (input.queuePolls ?? 30)) {
          yield* cancel
          return yield* fail(
            'no-runner',
            `${runUrl}: no runner picked the jobs up; it was cancelled. ${LOCAL_GATE}`,
          )
        }
      }
      if (polls >= (input.runPolls ?? 180)) {
        yield* cancel
        return yield* fail('timeout', `${runUrl} was still running after the run timeout; it was cancelled`)
      }
    }

    const summary = summaryOf(completed)
    if (completed.conclusion === 'success') return { runUrl, jobs: summary }

    const failed = completed.jobs.filter(
      (job) => job.conclusion !== 'success' && job.conclusion !== 'skipped',
    )
    if (failed.length > 0 && failed.every((job) => job.steps.length === 0)) {
      return yield* fail(
        'no-runner',
        `${runUrl}: no runner picked the jobs up (${summary.join(', ')}); ${LOCAL_GATE}`,
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
    return yield* fail('red', `${runUrl} is red:\n${summary.join('\n')}${where}`)
  })
}
