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

/** The parts of a workflow the rules read. */
export interface Workflow {
  readonly on?: Readonly<Record<string, unknown>> | string | readonly string[]
  readonly permissions?: unknown
  readonly env?: Readonly<Record<string, unknown>>
  readonly jobs?: Readonly<Record<string, Job>>
}
interface Job {
  readonly if?: string
  readonly env?: Readonly<Record<string, unknown>>
  readonly steps?: readonly Step[]
}
interface Step {
  readonly run?: string
  readonly with?: Readonly<Record<string, unknown>>
}

/** Secrets every job may hold: the workflow's own token (scoped by `permissions`) and the read-only package token. */
const READ_ONLY_SECRETS: ReadonlySet<string> = new Set(['GITHUB_TOKEN', 'AF_READ_TOKEN'])
/** The light gate every pull request runs, drafts included (lint, typecheck, unit). */
const LIGHT_GATES: ReadonlySet<string> = new Set(['checks'])

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
    for (const step of job.steps ?? [])
      for (const name of secretsIn([step.run, step.with]))
        problems.push(`${file} ${id}: names ${name} outside a step's env`)
    const reachable = reachableByPullRequest(job, workflowReachable)
    const publishing = [...new Set(secretsIn(job))].filter((name) => !READ_ONLY_SECRETS.has(name))
    for (const name of reachable ? publishing : [])
      problems.push(`${file} ${id}: a pull request can start the job that holds ${name}`)
    if (reachable && on.includes('pull_request') && !LIGHT_GATES.has(id) && !(job.if ?? '').includes('draft'))
      problems.push(`${file} ${id}: runs on draft pull requests`)
  }
  return problems
}
