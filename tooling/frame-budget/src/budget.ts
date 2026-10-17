// The frame-budget check (PRODUCT spec §2 F5): compares the probe's results with the budget recorded in
// tooling/frame-budget/budget.json. It fails closed: only a well-formed, hardware-rendered result for every
// budgeted project, measured on the budget's own GPU and within it, passes. Like S8's `overBudget`, a number
// that was not measured is a failure, never a pass.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

// JSON has no NaN: `summarize` reports an empty sample as NaN, which JSON.stringify writes as null.
const metric = z.number().nullable()
const frameStats = z.object({
  count: z.number().int().nonnegative(),
  mean: metric,
  p50: metric,
  p95: metric,
  p99: metric,
  max: metric,
})

export const FrameBudgetResult = z.object({
  schema: z.literal('af-frame-budget-result/1'),
  project: z.string().min(1),
  measuredAt: z.string(),
  scene: z.object({ entities: z.number().int().positive(), systems: z.number().int().positive() }),
  sample: z.object({ warmupMs: z.number().nonnegative(), sampleMs: z.number().positive() }),
  environment: z.object({
    /** The unmasked WebGL renderer string, or 'unknown'. Software renderers are never compared. */
    gpu: z.string(),
    gpuVendor: z.string(),
    renderer: z.enum(['webgl', 'webgpu']),
    browser: z.string(),
    browserVersion: z.string(),
    userAgent: z.string(),
    viewport: z.object({ width: z.number(), height: z.number() }),
    devicePixelRatio: z.number(),
    os: z.string(),
    cpus: z.number().int(),
    cpuModel: z.string(),
    node: z.string(),
    commit: z.string(),
    runner: z.string().nullable(),
    ci: z.boolean(),
  }),
  workMs: frameStats,
  intervalMs: frameStats,
})
export type FrameBudgetResult = z.infer<typeof FrameBudgetResult>

const projectBudget = z.object({ workMsP95: z.number().positive(), intervalMsP95: z.number().positive() })

export const BudgetFile = z.discriminatedUnion('status', [
  z.object({ status: z.literal('unset'), note: z.string() }),
  z.object({
    status: z.literal('set'),
    /** The GPU the budget was measured on; results from any other GPU are not compared. */
    gpu: z.string().min(1),
    evidence: z.object({
      result: z.string().min(1),
      commit: z.string().min(1),
      runner: z.string().min(1),
      date: z.string().min(1),
      headroom: z.number().min(1),
    }),
    projects: z.record(z.string(), projectBudget),
  }),
])
export type BudgetFile = z.infer<typeof BudgetFile>

export type Verdict = 'pass' | 'over' | 'unset' | 'not-comparable' | 'invalid'

export interface CheckOutcome {
  readonly verdict: Verdict
  readonly lines: readonly string[]
}

// Worst first: the outcome is the worst verdict any line produced.
const SEVERITY: readonly Verdict[] = ['invalid', 'not-comparable', 'unset', 'over', 'pass']

const SOFTWARE_GPU = /swiftshader|llvmpipe|softpipe|software|basic render/i

/** True when frames were drawn by a CPU rasterizer, or the GPU could not be read. */
export function isSoftwareGpu(gpu: string): boolean {
  return SOFTWARE_GPU.test(gpu) || gpu.trim() === '' || gpu === 'unknown'
}

const ms = (value: number): string => `${value.toFixed(2)} ms`
const shown = (value: number | null): string => (value === null ? 'not measured' : ms(value))

export function checkFrameBudget(budgetInput: unknown, resultInputs: readonly unknown[]): CheckOutcome {
  const found: { verdict: Verdict; line: string }[] = []
  const add = (verdict: Verdict, line: string): void => {
    found.push({ verdict, line })
  }

  const budget = BudgetFile.safeParse(budgetInput)
  if (!budget.success) add('invalid', `INVALID budget file: ${z.prettifyError(budget.error)}`)
  if (resultInputs.length === 0)
    add('invalid', 'INVALID no probe results: run `pnpm test:frame-budget` first')

  const results: FrameBudgetResult[] = []
  for (const [index, input] of resultInputs.entries()) {
    const parsed = FrameBudgetResult.safeParse(input)
    if (parsed.success) results.push(parsed.data)
    else add('invalid', `INVALID result ${index + 1}: ${z.prettifyError(parsed.error)}`)
  }

  for (const result of results) {
    if (isSoftwareGpu(result.environment.gpu)) {
      add(
        'not-comparable',
        `NOT COMPARABLE ${result.project}: drawn by a software renderer (${result.environment.gpu}); a local smoke, never a budget`,
      )
    }
  }

  if (budget.success && budget.data.status === 'unset') {
    add(
      'unset',
      'UNSET: no frame budget is recorded (tooling/frame-budget/budget.json); nothing was compared',
    )
    for (const result of results) {
      add(
        'unset',
        `  ${result.project}: work p95 ${shown(result.workMs.p95)}, interval p95 ${shown(result.intervalMs.p95)} (not compared)`,
      )
    }
  }

  if (budget.success && budget.data.status === 'set') {
    const set = budget.data
    if (isSoftwareGpu(set.gpu)) {
      add(
        'invalid',
        `INVALID the budget was recorded on a software renderer (${set.gpu}); record it on the GPU runner`,
      )
    }
    for (const result of results) {
      if (isSoftwareGpu(result.environment.gpu)) continue
      const limits = set.projects[result.project]
      if (limits === undefined) {
        add('invalid', `INVALID ${result.project}: no budget recorded for this project`)
        continue
      }
      if (result.environment.gpu !== set.gpu) {
        add(
          'not-comparable',
          `NOT COMPARABLE ${result.project}: measured on ${result.environment.gpu}, the budget on ${set.gpu}`,
        )
        continue
      }
      compareProject(result, limits, add)
    }
    const measured = new Set(results.map((result) => result.project))
    for (const project of Object.keys(set.projects).sort()) {
      if (!measured.has(project)) add('invalid', `INVALID ${project}: no result for this budgeted project`)
    }
  }

  const verdict = SEVERITY.find((level) => found.some((each) => each.verdict === level)) ?? 'invalid'
  return { verdict, lines: found.map((each) => each.line) }
}

function compareProject(
  result: FrameBudgetResult,
  limits: z.infer<typeof projectBudget>,
  add: (verdict: Verdict, line: string) => void,
): void {
  const checks = [
    { name: 'work', value: result.workMs.p95, limit: limits.workMsP95 },
    { name: 'interval', value: result.intervalMs.p95, limit: limits.intervalMsP95 },
  ]
  const unmeasured = checks.filter((check) => check.value === null || !Number.isFinite(check.value))
  for (const check of unmeasured)
    add('invalid', `INVALID ${result.project}: ${check.name} p95 was not measured`)
  if (unmeasured.length > 0) return
  const over = checks.filter((check) => (check.value as number) > check.limit)
  for (const check of over) {
    add(
      'over',
      `OVER ${result.project}: ${check.name} p95 ${ms(check.value as number)}/frame (budget ${ms(check.limit)})`,
    )
  }
  if (over.length === 0) {
    add(
      'pass',
      `ok ${result.project}: ${checks
        .map((check) => `${check.name} p95 ${ms(check.value as number)}/frame (budget ${ms(check.limit)})`)
        .join(', ')}`,
    )
  }
}

/** Reads the budget file and every `*.json` result in `resultsDir`; a missing folder has no results. */
export function checkFiles(budgetPath: string, resultsDir: string): CheckOutcome {
  const budget: unknown = JSON.parse(readFileSync(budgetPath, 'utf8'))
  const files = existsSync(resultsDir)
    ? readdirSync(resultsDir)
        .filter((name) => name.endsWith('.json'))
        .sort()
    : []
  const results = files.map((name): unknown => JSON.parse(readFileSync(join(resultsDir, name), 'utf8')))
  return checkFrameBudget(budget, results)
}
