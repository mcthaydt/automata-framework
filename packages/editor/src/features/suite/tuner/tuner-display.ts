import type { Tunable } from './tuner-content'

// How the Tuner shows a number in a unit a player can feel. A tunable may carry a `scale` (from `tuning.toml`): the
// Tuner shows its value times that scale in its `unit` (Emberwick's speeds are subpixels a tick, times 60/256, so
// "90 px/s"), and turns what a person types or drags back into the sim's own number, snapped to the tunable's step.
// The file and the sim keep the sim's units; this is display only. Without a scale every function is the identity.

/** How many decimals a shown value keeps: enough to show what one step changes, no more (0.23 px/s shows as 0.2). */
function decimalsOf(tunable: Tunable): number {
  const step = Math.abs((tunable.step ?? 1) * (tunable.scale ?? 1))
  return Math.max(0, Math.ceil(-Math.log10(step)))
}

const rounded = (value: number, decimals: number): number => Number(value.toFixed(decimals))

/** The value as the Tuner shows it. */
export function shownValue(tunable: Tunable, raw: number): number {
  if (tunable.scale === undefined) return raw
  return rounded(raw * tunable.scale, decimalsOf(tunable))
}

/** What a shown value is in the sim's units: the nearest whole step. */
export function rawValue(tunable: Tunable, shown: number): number {
  if (tunable.scale === undefined) return shown
  const step = tunable.step ?? 1
  // A negative scale (an upward speed shown as how hard a jump is) flips the sign; the step snap keeps it exact.
  return Math.round(shown / tunable.scale / step) * step
}

/** The bounds and the step as shown, the smaller bound first even when a negative scale turns them round. */
export function shownBounds(tunable: Tunable): { min?: number; max?: number; step: number } {
  const step = tunable.step ?? 1
  if (tunable.scale === undefined)
    return {
      ...(tunable.min === undefined ? {} : { min: tunable.min }),
      ...(tunable.max === undefined ? {} : { max: tunable.max }),
      step,
    }
  const ends = [tunable.min, tunable.max]
    .filter((end): end is number => end !== undefined)
    .map((end) => shownValue(tunable, end))
  const shownStep = rounded(Math.abs(step * tunable.scale), decimalsOf(tunable))
  if (ends.length < 2) return { step: shownStep }
  return { min: Math.min(...ends), max: Math.max(...ends), step: shownStep }
}
