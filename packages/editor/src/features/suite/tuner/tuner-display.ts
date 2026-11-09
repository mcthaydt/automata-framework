import type { Tunable } from './tuner-content'

// How the Tuner shows a number in a unit a player can feel. A tunable may carry a `scale` (from `tuning.toml`): the
// Tuner shows its value times that scale in its `unit` (Emberwick's speeds are subpixels a tick, times 60/256, so
// "90 px/s"), and turns what a person types or drags back into the sim's own number, snapped to the tunable's step.
// The file and the sim keep the sim's units; this is display only. Without a scale every function is the identity.

/**
 * The step a person sees on a scaled setting. One raw step is rarely a number anyone can feel (0.23 px/s), so the shown
 * step is rounded up to one that is: a power of ten from a tenth up (1 px/s, 100 px/s²), and 1, 2 or 5 below that
 * (0.02 s). The raw value still moves in whole raw steps (`rawValue` snaps to the nearest), so nothing the file
 * cannot hold is ever written.
 */
function displayStep(tunable: Tunable): number {
  const raw = Math.abs((tunable.step ?? 1) * (tunable.scale ?? 1))
  const decade = 10 ** Math.floor(Math.log10(raw))
  if (raw >= 0.1) return cleaned(10 ** Math.ceil(Math.log10(raw)))
  const mantissa = raw / decade
  const nice = [1, 2, 5, 10].find((candidate) => candidate >= mantissa - 1e-9) ?? 10
  return cleaned(nice * decade)
}

/** Drops the floating-point dust of a power of ten (0.020000000000000004 is 0.02). */
const cleaned = (value: number): number => Number(value.toPrecision(12))

/** How many decimals a shown value keeps: enough to show what one shown step changes, no more. */
function decimalsOf(tunable: Tunable): number {
  return Math.max(0, Math.ceil(-Math.log10(displayStep(tunable))))
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
  const shownStep = displayStep(tunable)
  if (ends.length < 2) return { step: shownStep }
  return { min: Math.min(...ends), max: Math.max(...ends), step: shownStep }
}
