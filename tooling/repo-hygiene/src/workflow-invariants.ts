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
// 6. A job that runs `pnpm install` first runs the private-submodule step. The self-hosted runners keep their work
//    folders between jobs, so a submodule left at another commit by an earlier job breaks the install's `prepare`
//    until something resets it to the pinned commit.
// 7. A reusable workflow that uses the token declares it under `workflow_call.secrets`, and a job that calls one that
//    does passes it (`secrets`); otherwise the step runs with an empty token.

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
  readonly run?: string
  readonly env?: Readonly<Record<string, unknown>>
  readonly with?: Readonly<Record<string, unknown>>
}

/**
 * Secrets every job may hold: the workflow's own token (scoped by `permissions`), the read-only package token, and the
 * read-only token that checks out the private submodules (`.gitmodules`).
 */
const READ_ONLY_SECRETS: ReadonlySet<string> = new Set(['GITHUB_TOKEN', 'AF_READ_TOKEN', 'SUBMODULES_TOKEN'])

/** The light gate every pull request runs, drafts included (lint, typecheck, unit). */
const LIGHT_GATES: ReadonlySet<string> = new Set(['checks'])

/** The script every job runs to put the private submodules at their pinned commits. */
const SUBMODULE_SCRIPT = 'checkout-submodules.sh'

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
  if (
    on.includes('workflow_call') &&
    secretsIn(workflow.jobs).includes('SUBMODULES_TOKEN') &&
    !declaresToken(workflow)
  )
    problems.push(`${file}: uses SUBMODULES_TOKEN without declaring it under workflow_call secrets`)
  for (const name of secretsIn(workflow.env))
    problems.push(`${file}: hands ${name} to every job (workflow env)`)
  const workflowReachable = on.includes('pull_request') || on.includes('workflow_call')
  for (const [id, job] of Object.entries(workflow.jobs ?? {})) {
    for (const name of secretsIn(job.env))
      problems.push(`${file} ${id}: hands ${name} to every step (job env)`)
    for (const step of job.steps ?? [])
      for (const name of secretsIn([step.run, step.with]))
        problems.push(`${file} ${id}: names ${name} outside a step's env`)
    const steps = job.steps ?? []
    const install = steps.findIndex((step) => /\bpnpm install\b/.test(step.run ?? ''))
    const reset = steps.findIndex((step) => (step.run ?? '').includes(SUBMODULE_SCRIPT))
    if (install !== -1 && (reset === -1 || reset > install))
      problems.push(`${file} ${id}: runs pnpm install without checking out the private submodules first`)
    const reachable = reachableByPullRequest(job, workflowReachable)
    const publishing = [...new Set(secretsIn(job))].filter((name) => !READ_ONLY_SECRETS.has(name))
    for (const name of reachable ? publishing : [])
      problems.push(`${file} ${id}: a pull request can start the job that holds ${name}`)
    if (reachable && on.includes('pull_request') && !LIGHT_GATES.has(id) && !(job.if ?? '').includes('draft'))
      problems.push(`${file} ${id}: runs on draft pull requests`)
  }
  return problems
}

/**
 * What breaks rule 7 across workflows: a job that calls `./.github/workflows/<file>` whose `workflow_call` declares
 * SUBMODULES_TOKEN must pass it (or `secrets: inherit`), or the callee's step runs with no token.
 */
export function callerProblems(workflows: Readonly<Record<string, Workflow>>): readonly string[] {
  const needing = new Set(
    Object.entries(workflows)
      .filter(([, workflow]) => declaresToken(workflow))
      .map(([file]) => file),
  )
  return Object.entries(workflows).flatMap(([file, workflow]) =>
    Object.entries(workflow.jobs ?? {}).flatMap(([id, job]) => {
      const callee = job.uses?.replace(/^\.\/\.github\/workflows\//, '')
      if (callee === undefined || !needing.has(callee)) return []
      const passed = job.secrets === 'inherit' || secretsIn(job.secrets).includes('SUBMODULES_TOKEN')
      return passed ? [] : [`${file} ${id}: calls ${callee} without passing SUBMODULES_TOKEN`]
    }),
  )
}

function declaresToken(workflow: Workflow): boolean {
  const call = (workflow.on as Record<string, { secrets?: Record<string, unknown> } | null> | undefined)
    ?.workflow_call
  return call?.secrets !== undefined && 'SUBMODULES_TOKEN' in call.secrets
}
