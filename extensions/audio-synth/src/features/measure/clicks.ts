// Clicks and decay: the checks that need no loudness meter.

/**
 * How strict the click check is: the smallest second difference that counts (`floor`) and how far
 * it must stand out from its neighbours (`ratio`).
 */
export interface ClickOptions {
  readonly floor?: number
  readonly ratio?: number
}

/**
 * Clicks: a second difference that stands out of everything around it. A sample is a click when
 * |x[n] - 2x[n-1] + x[n-2]| exceeds `floor` and `ratio` times the largest second difference in the 30 ms on either side (the 1 ms
 * around the sample left out). A waveform's own edges (a saw's reset, a square's step, from 34 Hz up) repeat inside that window and
 * pass, and so does noise. A sound starting out of silence (the 30 ms before it under -80 dBFS) is an attack, not a click:
 * percussive cues start hard on purpose. An isolated step, dropout or cut inside a sound does not pass.
 */
export function clicks(
  x: Float32Array,
  rate: number,
  { floor = 0.02, ratio = 3 }: ClickOptions = {},
): number[] {
  const d = new Float64Array(x.length)
  for (let i = 2; i < x.length; i++)
    d[i] = Math.abs((x[i] as number) - 2 * (x[i - 1] as number) + (x[i - 2] as number))
  const near = Math.round(rate * 0.001)
  const far = Math.round(rate * 0.03)
  const found: number[] = []
  const peak = (lo: number, hi: number): number => {
    let m = 0
    for (let j = Math.max(0, lo); j < Math.min(x.length, hi); j++) m = Math.max(m, d[j] as number)
    return m
  }
  const silentBefore = (i: number): boolean => {
    for (let j = Math.max(0, i - far); j < i - 2; j++) if (Math.abs(x[j] as number) >= 1e-4) return false
    return true
  }
  for (let i = 2; i < x.length; i++) {
    if ((d[i] as number) < floor || silentBefore(i)) continue
    if ((d[i] as number) > ratio * Math.max(peak(i - far, i - near), peak(i + near + 1, i + far + 1))) {
      found.push(i)
      i += near
    }
  }
  return found
}

/** The root mean square of `x[from..to)`. */
export function rms(x: ArrayLike<number>, from: number, to: number): number {
  let s = 0
  for (let i = from; i < to; i++) s += (x[i] as number) ** 2
  return Math.sqrt(s / Math.max(1, to - from))
}

/**
 * RT60 measured from a decaying tail starting at `from`: the level in 10 ms windows, a straight line fitted to it from 5 dB below
 * its start to 25 dB below (a T20), extended to 60 dB. `null` when the tail is too short or too quiet to measure.
 */
export function decay(x: ArrayLike<number>, from: number, rate: number): number | null {
  const w = Math.round(0.01 * rate)
  const db: number[] = []
  for (let i = from; i + w <= x.length; i += w) db.push(20 * Math.log10(Math.max(1e-12, rms(x, i, i + w))))
  if (db.length < 4) return null
  const top = db[0] as number
  const pts = db.map((v, i) => [(i * w) / rate, v] as const).filter(([, v]) => v <= top - 5 && v >= top - 25)
  if (pts.length < 3) return null
  const n = pts.length
  const mt = pts.reduce((a, [t]) => a + t, 0) / n
  const mv = pts.reduce((a, [, v]) => a + v, 0) / n
  const slope =
    pts.reduce((a, [t, v]) => a + (t - mt) * (v - mv), 0) / pts.reduce((a, [t]) => a + (t - mt) ** 2, 0)
  return slope < 0 ? -60 / slope : null
}
