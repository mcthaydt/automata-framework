// What a golden test calls after its run, in every engine it runs in (DX.9): it puts the hash this engine computed,
// with the run's seed and ticks, in the test's Vitest meta, and Vitest's JSON reporter carries it out of the
// browser to cli.ts. Nothing is imported, so the module loads unchanged in Node and in a browser page.
//
// The shape is GoldenEvidenceSchema's (evidence.schema.ts), which cli.ts checks when it reads the report.

export interface GoldenRun {
  /** A stable name for the scenario, `<package>/<run>`. */
  readonly scenario: string
  /** The sim's seed (`sim.seed`). */
  readonly seed: number
  /** Ticks stepped: the sim's tick at the end minus its tick at the start. */
  readonly ticks: number
  /** `sim.hash()` at the end of the run, in this engine. */
  readonly hash: string
}

type Runtime = { kind: 'node'; version: string } | { kind: 'browser'; userAgent: string }

/** What this reads from the global scope; typed here, since the sim's packages compile without DOM or Node types. */
const scope = globalThis as {
  readonly window?: unknown
  readonly navigator?: { readonly userAgent?: string }
  readonly process?: { readonly version?: string }
}

/** The engine's own description of itself: Node's version, or the browser's user agent. */
function runtime(): Runtime {
  if (scope.window === undefined) return { kind: 'node', version: scope.process?.version ?? 'unknown' }
  return { kind: 'browser', userAgent: scope.navigator?.userAgent ?? 'unknown' }
}

/** Records `run` in `task.meta.goldenEvidence`. Call it with the test context's `task`, after the run's assertions. */
export function recordGoldenEvidence(task: { readonly meta: object }, run: GoldenRun): void {
  const { scenario, seed, ticks, hash } = run
  Object.assign(task.meta, { goldenEvidence: { scenario, seed, ticks, hash, runtime: runtime() } })
}
