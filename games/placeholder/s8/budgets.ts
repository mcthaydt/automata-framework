// The S8 budgets (docs/spikes/s8-effect.md) as a check. `node s8/measure.ts --check` measures and fails on any
// breach; `--sizes-only` skips the browser (E1, E3), which is what every CI run does. E5, no CSP violation,
// fails the boot measurement itself.

export interface Measurement {
  /** Gzip bytes of the placeholder's page with Effect (as shipped) and of the same page without it. */
  readonly gzip: { readonly effect: number; readonly noEffect: number }
  /** Median cold boot to `ready` in ms at 4× CPU, per phone profile; empty when boot was not measured. */
  readonly bootMedians: readonly {
    readonly profile: string
    readonly effect: number
    readonly noEffect: number
  }[]
}

export const BUDGETS = {
  effectShareBytes: 35_000,
  effectBootMs: 100,
  pageBytes: 60_000,
  bootMs: 300,
} as const

const kB = (bytes: number): string => (bytes / 1000).toFixed(2)

/** Every budget the measurement breaks, as a line naming it; empty when all are met. */
export function overBudget(measured: Measurement): string[] {
  const breaches: string[] = []
  // A missing number (NaN) compares false with every budget, so it would pass silently; it is a breach.
  if (!Number.isFinite(measured.gzip.effect) || !Number.isFinite(measured.gzip.noEffect)) {
    breaches.push('E1/E3: the page size was not measured')
  }
  const effectShare = measured.gzip.effect - measured.gzip.noEffect
  if (effectShare > BUDGETS.effectShareBytes) {
    breaches.push(`E1: Effect adds ${kB(effectShare)} kB gzip (budget ${BUDGETS.effectShareBytes / 1000} kB)`)
  }
  if (measured.gzip.effect > BUDGETS.pageBytes) {
    breaches.push(
      `E3: the page is ${kB(measured.gzip.effect)} kB gzip (budget ${BUDGETS.pageBytes / 1000} kB)`,
    )
  }
  for (const { profile, effect, noEffect } of measured.bootMedians) {
    if (!Number.isFinite(effect) || !Number.isFinite(noEffect)) {
      breaches.push(`E2/E4: boot on ${profile} was not measured`)
      continue
    }
    if (effect - noEffect > BUDGETS.effectBootMs) {
      breaches.push(
        `E2: Effect adds ${Math.round(effect - noEffect)} ms of boot on ${profile} (budget ${BUDGETS.effectBootMs} ms)`,
      )
    }
    if (effect > BUDGETS.bootMs) {
      breaches.push(`E4: boot takes ${Math.round(effect)} ms on ${profile} (budget ${BUDGETS.bootMs} ms)`)
    }
  }
  return breaches
}
