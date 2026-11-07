// Loudness and true peak, after ITU-R BS.1770-4 (the K-weighting and gating pyloudnorm uses) in plain TypeScript, so the
// container needs no audio stack. The tests check the meter against BS.1770's reference tones.

interface Biquad {
  readonly b: readonly [number, number, number]
  readonly a: readonly [number, number]
}

/** The K-weighting stages for any sample rate: a +4 dB shelf at 1.5 kHz, then a 38 Hz high-pass. */
function kWeighting(rate: number): Biquad[] {
  const A = 10 ** (4 / 40)
  const w0 = (2 * Math.PI * 1500) / rate
  const alpha = Math.sin(w0) / (2 / Math.SQRT2)
  const c = Math.cos(w0)
  const r = 2 * Math.sqrt(A) * alpha
  const a0 = A + 1 - (A - 1) * c + r
  const shelf: Biquad = {
    b: [
      (A * (A + 1 + (A - 1) * c + r)) / a0,
      (-2 * A * (A - 1 + (A + 1) * c)) / a0,
      (A * (A + 1 + (A - 1) * c - r)) / a0,
    ],
    a: [(2 * (A - 1 - (A + 1) * c)) / a0, (A + 1 - (A - 1) * c - r) / a0],
  }
  const hw0 = (2 * Math.PI * 38) / rate
  const halpha = Math.sin(hw0) / (2 * 0.5)
  const hc = Math.cos(hw0)
  const ha0 = 1 + halpha
  const highPass: Biquad = {
    b: [(1 + hc) / 2 / ha0, -(1 + hc) / ha0, (1 + hc) / 2 / ha0],
    a: [(-2 * hc) / ha0, (1 - halpha) / ha0],
  }
  return [shelf, highPass]
}

function filter(x: Float32Array, { b, a }: Biquad): Float64Array {
  const y = new Float64Array(x.length)
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  for (let i = 0; i < x.length; i++) {
    const xi = x[i] as number
    const v = b[0] * xi + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2
    x2 = x1
    x1 = xi
    y2 = y1
    y1 = v
    y[i] = v
  }
  return y
}

const lufs = (v: number): number => -0.691 + 10 * Math.log10(v)
const mean = (v: readonly number[]): number => v.reduce((a, b) => a + b, 0) / v.length

/** Integrated loudness in LUFS (gated), `null` when the signal is shorter than one 400 ms block, `-Infinity` when all is gated out. */
export function integratedLoudness(channels: readonly Float32Array[], rate: number): number | null {
  const n = channels[0]?.length ?? 0
  const T = 0.4
  const step = 0.25
  if (n / rate < T) return null
  const weighted = channels.map((ch) =>
    kWeighting(rate).reduce<Float32Array>((x, q) => Float32Array.from(filter(x, q)), ch),
  )
  const blocks = Math.round((n / rate - T) / (T * step)) + 1
  const z: number[] = []
  for (let j = 0; j < blocks; j++) {
    const lo = Math.floor(T * j * step * rate)
    const hi = Math.min(n, Math.floor(T * (j * step + 1) * rate))
    let sum = 0
    for (const ch of weighted) {
      let s = 0
      for (let i = lo; i < hi; i++) s += (ch[i] as number) ** 2
      sum += s / (T * rate)
    }
    z.push(sum)
  }
  const absolute = z.filter((v) => lufs(v) >= -70)
  if (absolute.length === 0) return Number.NEGATIVE_INFINITY
  const relative = lufs(mean(absolute)) - 10
  const gated = absolute.filter((v) => lufs(v) > relative)
  return gated.length > 0 ? lufs(mean(gated)) : Number.NEGATIVE_INFINITY
}

const OVER = 4
const HALF = 16
/** The windowed-sinc phases of a 4x upsampling. */
const TAPS: readonly (readonly number[])[] = Array.from({ length: OVER }, (_, p) =>
  Array.from({ length: 2 * HALF }, (_, k) => {
    const t = k - HALF + 1 - p / OVER
    const w = 0.5 + 0.5 * Math.cos((Math.PI * t) / (HALF + 1))
    return (t === 0 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t)) * w
  }),
)

/** True peak in dBTP: the sample peak of a 4x windowed-sinc upsampling. `-Infinity` for silence. */
export function truePeak(channels: readonly Float32Array[]): number {
  let peak = 0
  for (const x of channels) {
    for (let i = 0; i < x.length; i++) {
      peak = Math.max(peak, Math.abs(x[i] as number))
      for (let p = 1; p < OVER; p++) {
        let v = 0
        const taps = TAPS[p] as readonly number[]
        for (let k = 0; k < 2 * HALF; k++) {
          const j = i + k - HALF + 1
          if (j >= 0 && j < x.length) v += (x[j] as number) * (taps[k] as number)
        }
        peak = Math.max(peak, Math.abs(v))
      }
    }
  }
  return peak > 0 ? 20 * Math.log10(peak) : Number.NEGATIVE_INFINITY
}
