// A few rules every GitHub workflow here keeps, checked on the parsed YAML. They replace tests that pinned each
// workflow line by line: only what guards something real is checked, so a CI change edits a workflow, not a test.
//
// 1. Every workflow sets its token's `permissions` at the top, so no job gets the default write access by accident.
// 2. Nothing runs on `pull_request_target`, which runs with the repository's secrets on a fork's code.
// 3. A secret is handed only to the step that uses it (a step's `env`), never to a whole workflow or job.
// 4. A publishing secret (anything but the read-only package token) reaches only jobs a pull request cannot start: a
//    workflow a pull request can trigger, directly or as a reusable workflow, guards such jobs in their `if`.
// 5. The heavy jobs skip draft pull requests: a job a pull request can start says `draft` in its `if`, unless it is
//    one of the light gates every pull request runs.
// 6. No step fetches a submodule: the repository has none, so `actions/checkout` is never given `submodules:` (other
//    than false) and no command runs `git submodule`.
// 7. Artifact storage is a small shared quota ("stop using the artifact storage unless something fails", the Owner,
//    2026-11-12). Every upload is evidence (traces, reports, screenshots, results) and runs only when the job failed
//    (`failure()`, alone or as one `&&` term), kept for 7 days at most, unless its name is in `CONSUMED_ARTIFACTS`.

/** The parts of a workflow the rules read. */
export interface Workflow {
  readonly on?: Readonly<Record<string, unknown>> | string | readonly string[]
  readonly permissions?: unknown
  readonly env?: Readonly<Record<string, unknown>>
  readonly jobs?: Readonly<Record<string, Job>>
}
interface Job {
  readonly if?: string
  readonly uses?: string
  readonly secrets?: unknown
  readonly env?: Readonly<Record<string, unknown>>
  readonly steps?: readonly Step[]
}
interface Step {
  readonly name?: string
  readonly uses?: string
  readonly if?: string
  readonly run?: string
  readonly env?: Readonly<Record<string, unknown>>
  readonly with?: Readonly<Record<string, unknown>>
}

/** Secrets every job may hold: the workflow's own token (scoped by `permissions`) and the read-only package token. */
const READ_ONLY_SECRETS: ReadonlySet<string> = new Set(['GITHUB_TOKEN', 'AF_READ_TOKEN'])

/** The light gate every pull request runs, drafts included (lint, typecheck, unit). */
const LIGHT_GATES: ReadonlySet<string> = new Set(['checks'])

/**
 * The artifacts that are not evidence, so they may upload on a green run: something later reads them.
 * - `evidence`: the golden-hash file of a push to main (ci.yml). Its comment says the website reads it; nothing in the
 *   repository downloads it, so a person or the website's host does, long after the run, which is why it is kept 90 days.
 */
const CONSUMED_ARTIFACTS: ReadonlySet<string> = new Set(['evidence'])

/** The longest an evidence artifact is kept, in days. */
const EVIDENCE_RETENTION_DAYS = 7

/** An upload to artifact storage: the artifact action, or the pages one that deploys a site. */
const UPLOAD = /^actions\/upload(-pages)?-artifact@/

/** Whether a condition holds only when the job failed: `failure()` alone or one term of an `&&`, never of an `||`. */
function failureOnly(condition: string | undefined): boolean {
  const bare = (condition ?? '').replace(/^\s*\$\{\{|\}\}\s*$/g, '').trim()
  return !bare.includes('||') && bare.split('&&').some((term) => term.trim() === 'failure()')
}

/** `git submodule …` in a command, however it is spaced or wrapped. */
const GIT_SUBMODULE = /\bgit\s+submodule\b/

const SECRET = /secrets\.([A-Z0-9_]+)/g

function triggers(workflow: Workflow): readonly string[] {
  const on = workflow.on
  if (typeof on === 'string') return [on]
  if (Array.isArray(on)) return on as readonly string[]
  return on === undefined ? [] : Object.keys(on as Record<string, unknown>)
}

/** The secrets a value names, however deep. */
function secretsIn(value: unknown): readonly string[] {
  return [...JSON.stringify(value ?? null).matchAll(SECRET)].map((match) => match[1] as string)
}

/**
 * Whether a pull request can start this job. A workflow-level PR trigger or a reusable workflow (a caller may be a
 * pull request) can, unless the job's `if` keeps pull requests out: it names only other events
 * (`github.event_name == 'schedule'`), or excludes both pull request events.
 */
function reachableByPullRequest(job: Job, workflowReachable: boolean): boolean {
  if (!workflowReachable) return false
  const condition = job.if ?? ''
  const excludesBoth =
    condition.includes("github.event_name != 'pull_request'") &&
    condition.includes("github.event_name != 'pull_request_target'")
  const onlyOtherEvents =
    /github\.event_name == '(?!pull_request)/.test(condition) && !condition.includes('pull_request')
  return !excludesBoth && !onlyOtherEvents
}

/** Whether a step fetches a submodule: `actions/checkout` with `submodules` set, or a `git submodule` command. */
function fetchesSubmodule(step: Step): boolean {
  const asked = step.with?.submodules
  return (asked !== undefined && asked !== false && asked !== 'false') || GIT_SUBMODULE.test(step.run ?? '')
}

/** What breaks the rules in one workflow, as sentences naming the file and the job; empty when it keeps them all. */
export function workflowProblems(file: string, workflow: Workflow): readonly string[] {
  const problems: string[] = []
  const on = triggers(workflow)
  if (workflow.permissions === undefined) problems.push(`${file}: sets no top-level permissions`)
  if (on.includes('pull_request_target')) problems.push(`${file}: runs on pull_request_target`)
  for (const name of secretsIn(workflow.env))
    problems.push(`${file}: hands ${name} to every job (workflow env)`)
  const workflowReachable = on.includes('pull_request') || on.includes('workflow_call')
  for (const [id, job] of Object.entries(workflow.jobs ?? {})) {
    for (const name of secretsIn(job.env))
      problems.push(`${file} ${id}: hands ${name} to every step (job env)`)
    for (const step of job.steps ?? []) {
      const artifact = String(step.with?.name ?? step.name ?? 'unnamed')
      if (UPLOAD.test(step.uses ?? '') && !CONSUMED_ARTIFACTS.has(artifact)) {
        if (!failureOnly(step.if))
          problems.push(
            `${file} ${id}: uploads the evidence "${artifact}" on a green run (${step.if === undefined ? 'no if' : `if: ${step.if}`})`,
          )
        const days = Number(step.with?.['retention-days'])
        if (!(days > 0 && days <= EVIDENCE_RETENTION_DAYS))
          problems.push(
            `${file} ${id}: the evidence "${artifact}" is kept longer than ${EVIDENCE_RETENTION_DAYS} days (retention-days is not set to ${EVIDENCE_RETENTION_DAYS} or less)`,
          )
      }
      for (const name of secretsIn([step.run, step.with]))
        problems.push(`${file} ${id}: names ${name} outside a step's env`)
      if (fetchesSubmodule(step))
        problems.push(`${file} ${id}: a step checks out a submodule (the repository has none)`)
    }
    const reachable = reachableByPullRequest(job, workflowReachable)
    const publishing = [...new Set(secretsIn(job))].filter((name) => !READ_ONLY_SECRETS.has(name))
    for (const name of reachable ? publishing : [])
      problems.push(`${file} ${id}: a pull request can start the job that holds ${name}`)
    if (reachable && on.includes('pull_request') && !LIGHT_GATES.has(id) && !(job.if ?? '').includes('draft'))
      problems.push(`${file} ${id}: runs on draft pull requests`)
  }
  return problems
}
