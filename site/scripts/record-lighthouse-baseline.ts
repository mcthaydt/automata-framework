// Writes lighthouse-baseline.json from the reports `pnpm lighthouse` left in .lighthouseci/reports: for each page, the
// median of its runs. The file is the record the budget in lighthouserc.json is held against
// (tests/lighthouse-budget.test.ts), so it is generated, never typed.
//   pnpm lighthouse; node --import tsx scripts/record-lighthouse-baseline.ts [machine description]
import { readFileSync, writeFileSync } from 'node:fs'
import { cpus, loadavg } from 'node:os'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface PageMetrics {
  performance: number
  lcpMs: number
  cls: number
  tbtMs: number
  fcpMs: number
  speedIndexMs: number
  transferBytes: number
}

/** The slice of a Lighthouse result this record reads. */
export interface LighthouseResult {
  lighthouseVersion: string
  categories: { performance: { score: number | null } }
  audits: Record<string, { numericValue?: number }>
  environment: { hostUserAgent: string }
}

const AUDITS = {
  lcpMs: 'largest-contentful-paint',
  cls: 'cumulative-layout-shift',
  tbtMs: 'total-blocking-time',
  fcpMs: 'first-contentful-paint',
  speedIndexMs: 'speed-index',
  transferBytes: 'total-byte-weight',
} as const

const median = (values: number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!

/** One page's metrics: each one's median over its runs, so an outlier run moves nothing. */
export function medianMetrics(results: LighthouseResult[]): PageMetrics {
  if (results.length === 0) throw new Error('no Lighthouse results to summarise')
  const metric = (audit: string): number => median(results.map(result => {
    const value = result.audits[audit]?.numericValue
    if (value === undefined) throw new Error(`a Lighthouse result has no ${audit} value`)
    return value
  }))
  const performance = median(results.map(result => {
    const score = result.categories.performance.score
    if (score === null) throw new Error('a Lighthouse run could not score performance')
    return score
  }))
  const round = (value: number): number => Math.round(value * 1000) / 1000
  return {
    performance: round(performance),
    ...(Object.fromEntries(Object.entries(AUDITS).map(([key, audit]) => [key, round(metric(audit))])) as Omit<PageMetrics, 'performance'>),
  }
}

/**
 * One page's LCP in every run, in the order they ran, with the best and the median. The budget judges the best run
 * (lighthouserc.json): a runner that was busy with something else shows here as a spread, or as every run being slow.
 */
export function describeRuns(path: string, results: LighthouseResult[]): string {
  if (results.length === 0) throw new Error('no Lighthouse results to summarise')
  const lcp = results.map(result => {
    const value = result.audits[AUDITS.lcpMs]?.numericValue
    if (value === undefined) throw new Error(`a Lighthouse result has no ${AUDITS.lcpMs} value`)
    return value
  })
  const whole = (value: number): number => Math.round(value)
  return `${path} LCP per run (ms): ${lcp.map(whole).join(', ')}; best ${whole(Math.min(...lcp))}, median ${whole(median(lcp))}`
}

/** What else the runner was doing: it is shared with the framework's CI, and a busy host makes every run slower. */
export function describeHostLoad(cores: number, [one, five, fifteen]: readonly number[]): string {
  return `Host: ${cores} cores, load average ${one!.toFixed(2)}, ${five!.toFixed(2)}, ${fifteen!.toFixed(2)} (${(one! / cores).toFixed(2)} per core over the last minute)`
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const reports = join(process.cwd(), '.lighthouseci/reports')
  const manifest = JSON.parse(readFileSync(join(reports, 'manifest.json'), 'utf8')) as { url: string; jsonPath: string }[]
  const byPath = new Map<string, LighthouseResult[]>()
  for (const run of manifest) {
    const result = JSON.parse(readFileSync(join(reports, basename(run.jsonPath)), 'utf8')) as LighthouseResult
    const path = new URL(run.url).pathname
    byPath.set(path, [...(byPath.get(path) ?? []), result])
  }
  const first = [...byPath.values()][0]![0]!
  const record = {
    recordedAt: new Date().toISOString().slice(0, 10),
    machine: process.argv[2] ?? 'not described',
    browser: /HeadlessChrome\/[\d.]+|Chrome\/[\d.]+/.exec(first.environment.hostUserAgent)?.[0] ?? first.environment.hostUserAgent,
    lighthouse: first.lighthouseVersion,
    runsPerPage: Math.min(...[...byPath.values()].map(results => results.length)),
    pages: Object.fromEntries([...byPath].map(([path, results]) => [path, medianMetrics(results)])),
  }
  writeFileSync('lighthouse-baseline.json', `${JSON.stringify(record, null, 2)}\n`)
  console.log(`Wrote lighthouse-baseline.json for ${byPath.size} pages.`)
  for (const [path, results] of byPath) console.log(describeRuns(path, results))
  console.log(describeHostLoad(cpus().length, loadavg()))
}
