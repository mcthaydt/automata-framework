import { clamp, decimalsOf, roundTo } from './widget-math'

// The Stepper's rules without its DOM: what typed text means, and where a drag or a key press lands.

export interface NumberRules {
  readonly min?: number | undefined
  readonly max?: number | undefined
  /** Only whole numbers are valid. */
  readonly integer?: boolean | undefined
}

export type ParsedNumber =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly message: string }

/** Plain decimal notation with an optional exponent; no hex, no separators, no `Infinity`. */
const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i

/** Typed text is refused with a message, never silently clamped: the field keeps the number it had. */
export function parseNumberText(text: string, rules: NumberRules): ParsedNumber {
  const trimmed = text.trim()
  if (!DECIMAL.test(trimmed)) return { ok: false, message: 'Enter a number' }
  const value = Number(trimmed)
  if (!Number.isFinite(value)) return { ok: false, message: 'Enter a number' }
  if (rules.integer && !Number.isInteger(value)) return { ok: false, message: 'Whole numbers only' }
  if (rules.min !== undefined && value < rules.min)
    return { ok: false, message: `Must be at least ${rules.min}` }
  if (rules.max !== undefined && value > rules.max)
    return { ok: false, message: `Must be at most ${rules.max}` }
  return { ok: true, value }
}

export interface StepRules {
  readonly step: number
  readonly min?: number | undefined
  readonly max?: number | undefined
}

/** `steps` whole steps from `value`, rounded to the decimals of the step and the value, and clamped to the bounds. */
export function steppedValue(value: number, steps: number, rules: StepRules): number {
  const decimals = Math.max(decimalsOf(rules.step), decimalsOf(value))
  return clamp(roundTo(value + steps * rules.step, decimals), rules.min, rules.max)
}

export interface ScrubRules extends StepRules {
  readonly pixelsPerStep: number
}

/** Where a drag of `dx` pixels from the press lands: one step for every `pixelsPerStep`, counted toward zero. */
export function scrubbedValue(start: number, dx: number, rules: ScrubRules): number {
  return steppedValue(start, Math.trunc(dx / rules.pixelsPerStep), rules)
}
