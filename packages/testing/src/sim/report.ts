// What a golden check found (M2.3 spec §3.6), and how it prints: one screen that says why a golden broke.
import type { Difference } from './diff'

/**
 * What a golden check found: `pass`, `written`, `missing`, `schema-changed`, `content-changed`,
 * `setup-changed` or `diverged` (with the first differing tick and the fields that differ).
 */
export type GoldenReport = { readonly name: string } & (
  | { readonly kind: 'pass'; readonly checks: number }
  | { readonly kind: 'written'; readonly file: string; readonly bytes: number }
  | { readonly kind: 'missing'; readonly file: string }
  | {
      readonly kind: 'schema-changed' | 'content-changed'
      readonly expected: string
      readonly actual: string
    }
  | {
      readonly kind: 'setup-changed'
      readonly field: 'seed' | 'tickHz' | 'ticks' | 'every'
      readonly expected: number
      readonly actual: number
    }
  | {
      readonly kind: 'diverged'
      /** The first tick whose hash differs (the tick after the step), or the failed check when not exact. */
      readonly firstTick: number
      readonly lastGoodTick: number
      readonly exact: boolean
      /** The tick the differences were taken at, when that is not firstTick. */
      readonly diffTick?: number
      readonly differences: readonly Difference[]
    }
)

const MAX_LINES = 20
const RECORD_HOW = 'record it in Node with AUTOMATA_UPDATE_GOLDENS=1'

/** One report as text: a line for most outcomes, and for a divergence the tick and up to 20 differences. */
export function formatGoldenReport(report: GoldenReport): string {
  const { name } = report
  switch (report.kind) {
    case 'pass':
      return `${name} matches (${report.checks} checks)`
    case 'written':
      return `${name} written: ${report.file} (${report.bytes} bytes)`
    case 'missing':
      return `${name} is missing (${report.file}); ${RECORD_HOW}`
    case 'schema-changed':
    case 'content-changed': {
      const what = report.kind === 'schema-changed' ? 'schema' : 'content'
      return `${name}: the ${what} hash changed (golden ${report.expected}, now ${report.actual}); if that is intended, ${RECORD_HOW}`
    }
    case 'setup-changed':
      return `${name}: ${report.field} changed (golden ${report.expected}, test ${report.actual}); a changed setup is a new golden, never a silent re-pin`
    case 'diverged': {
      if (!report.exact)
        return `${name} diverged between tick ${report.lastGoodTick} and tick ${report.firstTick} (no reference data to find the exact tick)`
      const where =
        report.diffTick !== undefined && report.diffTick !== report.firstTick
          ? `; differences at tick ${report.diffTick}`
          : ''
      const head = `${name} diverged at tick ${report.firstTick} (last matching check: tick ${report.lastGoodTick})${where}`
      const shown = report.differences
        .slice(0, MAX_LINES)
        .map((d) => `  ${d.at}: ${d.expected} ≠ ${d.actual}`)
      const more = report.differences.length - shown.length
      return [head, ...shown, ...(more > 0 ? [`  … and ${more} more`] : [])].join('\n')
    }
  }
}

/** Throws with the formatted report unless the golden matched or was just written. */
export function expectGolden(report: GoldenReport): void {
  if (report.kind === 'pass' || report.kind === 'written') return
  throw new Error(formatGoldenReport(report))
}
