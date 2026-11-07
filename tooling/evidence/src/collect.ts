// Turns what the runs left behind into the evidence file. Pure functions over their inputs, so
// cli.ts only gathers inputs and writes the result. Each refusal names what is wrong: a file that cannot say what
// it proves is not written at all.
import { relative } from 'node:path'
import {
  ENGINES,
  type Engine,
  type Evidence,
  EvidenceSchema,
  type Golden,
  type GoldenEvidence,
  GoldenEvidenceSchema,
  type Run,
} from './evidence.schema.ts'

/** The parts of Vitest's JSON reporter output this reads. */
export interface VitestJsonReport {
  testResults: Array<{
    /** The test file's absolute path. */
    name: string
    assertionResults: Array<{ fullName: string; status: string; meta?: Record<string, unknown> }>
  }>
}

/**
 * The engine and its version, from what the runtime said about itself. Playwright's browsers report their own
 * user agents: Chromium as (Headless)Chrome, Firefox as Firefox, and WebKit with its Safari `Version/`.
 */
export function engineOf(runtime: GoldenEvidence['runtime']): { engine: Engine; version: string } {
  if (runtime.kind === 'node') return { engine: 'node', version: runtime.version }
  const ua = runtime.userAgent
  const firefox = /Firefox\/([\d.]+)/.exec(ua)
  if (firefox?.[1]) return { engine: 'firefox', version: firefox[1] }
  const chromium = /(?:HeadlessChrome|Chrome)\/([\d.]+)/.exec(ua)
  if (chromium?.[1]) return { engine: 'chromium', version: chromium[1] }
  const webkit = /AppleWebKit\/[\d.]+.*Version\/([\d.]+)/.exec(ua)
  if (webkit?.[1]) return { engine: 'webkit', version: webkit[1] }
  throw new Error(`cannot tell which engine this user agent is: ${ua}`)
}

interface EngineRun {
  readonly engine: Engine
  readonly version: string
  readonly evidence: GoldenEvidence
  readonly source: string
}

/** Every golden in the reports, one entry per scenario with one hash per engine, sorted by scenario. */
export function goldensFromReports(reports: readonly VitestJsonReport[], root: string): Golden[] {
  const byScenario = new Map<string, EngineRun[]>()
  for (const report of reports)
    for (const file of report.testResults)
      for (const assertion of file.assertionResults) {
        const recorded = assertion.meta?.goldenEvidence
        if (recorded === undefined) continue
        const source = relative(root, file.name).replace(/\\/g, '/')
        const parsed = GoldenEvidenceSchema.safeParse(recorded)
        if (!parsed.success)
          throw new Error(`${source} › ${assertion.fullName}: not golden evidence: ${parsed.error.message}`)
        const evidence = parsed.data
        if (assertion.status !== 'passed')
          throw new Error(`${evidence.scenario}: ${source} › ${assertion.fullName} ${assertion.status}`)
        const runs = byScenario.get(evidence.scenario) ?? []
        runs.push({ ...engineOf(evidence.runtime), evidence, source })
        byScenario.set(evidence.scenario, runs)
      }
  if (byScenario.size === 0) throw new Error('the reports hold no golden evidence; run `pnpm evidence`')
  return [...byScenario.keys()].sort().map((scenario) => golden(scenario, byScenario.get(scenario) ?? []))
}

/** One scenario's runs as a golden: exactly one run per engine, all with the same seed and ticks. */
function golden(scenario: string, runs: readonly EngineRun[]): Golden {
  const hashes = ENGINES.map((engine) => {
    const found = runs.filter((run) => run.engine === engine)
    if (found.length === 0) throw new Error(`${scenario}: no ${engine} run in the reports`)
    if (found.length > 1) throw new Error(`${scenario}: ${engine} reported it twice`)
    const [run] = found as [EngineRun]
    return { engine, version: run.version, hash: run.evidence.hash }
  })
  const [first] = runs as [EngineRun]
  for (const field of ['seed', 'ticks'] as const)
    for (const run of runs)
      if (run.evidence[field] !== first.evidence[field])
        throw new Error(
          `${scenario}: ${field} is ${first.evidence[field]} in ${first.engine} but ${run.evidence[field]} in ${run.engine}`,
        )
  return {
    scenario,
    seed: first.evidence.seed,
    ticks: first.evidence.ticks,
    enginesAgree: hashes.every((entry) => entry.hash === hashes[0]?.hash),
    sources: [...new Set(runs.map((run) => run.source))].sort(),
    hashes,
  }
}

/**
 * Each publishable package's manifest version, and whether Changesets' release tag `<name>@<version>` exists.
 * A checkout with no tags at all (a shallow clone without `fetch-tags`) would make every package look
 * unreleased, so it is refused instead.
 */
export function packagesFromManifests(
  manifests: ReadonlyArray<{ readonly name: string; readonly version: string }>,
  tags: readonly string[],
): Evidence['packages'] {
  if (tags.length === 0) throw new Error('this checkout has no git tags; fetch the release tags first')
  const tagSet = new Set(tags)
  return manifests
    .map(({ name, version }) => ({ name, version, released: tagSet.has(`${name}@${version}`) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

const ACTIONS_VARIABLES = [
  'GITHUB_SERVER_URL',
  'GITHUB_REPOSITORY',
  'GITHUB_RUN_ID',
  'GITHUB_RUN_ATTEMPT',
  'GITHUB_WORKFLOW',
  'GITHUB_JOB',
  'GITHUB_EVENT_NAME',
  'GITHUB_REF',
] as const

/** The GitHub Actions run this is part of (from the variables Actions sets), or a local run. */
export function runFromEnv(env: Readonly<Record<string, string | undefined>>): Run {
  if (env.GITHUB_ACTIONS !== 'true') return { kind: 'local' }
  const value = (name: (typeof ACTIONS_VARIABLES)[number]): string => {
    const found = env[name]
    if (!found) throw new Error(`a GitHub Actions run without ${name}`)
    return found
  }
  const id = value('GITHUB_RUN_ID')
  const attempt = value('GITHUB_RUN_ATTEMPT')
  return {
    kind: 'ci',
    url: `${value('GITHUB_SERVER_URL')}/${value('GITHUB_REPOSITORY')}/actions/runs/${id}/attempts/${attempt}`,
    id,
    attempt: Number(attempt),
    workflow: value('GITHUB_WORKFLOW'),
    job: value('GITHUB_JOB'),
    event: value('GITHUB_EVENT_NAME'),
    ref: value('GITHUB_REF'),
  }
}

/** `create-game` and `automata check` are not merged, so there are no results to report yet. */
export const AUTOMATA_CHECK_PENDING: Evidence['automataCheck'] = {
  status: 'pending',
  waitingOn: ['DX.5', 'DX.6'],
  note: '`automata check` results for the create-game output: create-game (DX.5) and automata check (DX.6) are not merged yet',
}

export interface EvidenceInputs {
  readonly generatedAt: Date
  readonly revision: Evidence['revision']
  readonly run: Run
  readonly playwright: string
  readonly goldens: readonly Golden[]
  readonly packages: Evidence['packages']
}

/** The evidence file, checked against the schema the website validates it with. */
export function buildEvidence(inputs: EvidenceInputs): Evidence {
  return EvidenceSchema.parse({
    schemaVersion: 1,
    generatedAt: inputs.generatedAt.toISOString(),
    revision: inputs.revision,
    run: inputs.run,
    playwright: inputs.playwright,
    goldens: inputs.goldens,
    packages: inputs.packages,
    automataCheck: AUTOMATA_CHECK_PENDING,
  })
}
