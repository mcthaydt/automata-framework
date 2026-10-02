import { expect, test } from 'vitest'
import { f64Bytes, sha256Hex } from '../shared/hash'
import { mulberry32 } from '../shared/prng'
import { atan2, cos, exp, hypot, log, pow, sin, tan } from './dmath'
import { DMATH_EXPECTED } from './expected'

const N = 125_000 // x 8 functions = 1,000,000 samples

test('dmath outputs are bit-identical in every engine (1M samples)', async () => {
  const rand = mulberry32(2026)
  const out = new Float64Array(N * 8)
  for (let i = 0; i < N; i++) {
    const a = rand() * 2000 - 1000
    const b = rand() * 2000 - 1000
    const o = i * 8
    out[o] = sin(a)
    out[o + 1] = cos(a)
    out[o + 2] = tan(a)
    out[o + 3] = atan2(a, b)
    out[o + 4] = exp(a / 15) // [-66, 66]
    out[o + 5] = log(Math.abs(a) * 1e3 + 1e-300)
    out[o + 6] = pow(rand() * 100 + 1e-9, rand() * 20 - 10)
    out[o + 7] = hypot(a, b)
  }
  expect(out.filter(Number.isFinite).length).toBe(N * 8) // Review Focus #1: no NaN/Infinity padding
  expect(await sha256Hex(f64Bytes(out))).toBe(DMATH_EXPECTED)
})
