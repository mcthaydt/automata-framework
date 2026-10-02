import { expect, test } from 'vitest'
import { detectEngine, expectedEngine } from './engine'
import { f64Bytes, sha256Hex } from './hash'
import { mulberry32 } from './prng'

test('each run is really the engine the project says it is', () => {
  expect(detectEngine()).toBe(expectedEngine())
})

test('mulberry32 + sha256 are identical in every engine', async () => {
  const rand = mulberry32(42)
  const values = Array.from({ length: 10_000 }, () => rand())
  expect(new Set(values).size).toBeGreaterThan(9_990) // not degenerate
  expect(await sha256Hex(f64Bytes(values))).toBe(SMOKE_EXPECTED)
})

test('negative control: native Math.* hashes (informational; shows why S5 exists)', async () => {
  const rand = mulberry32(7)
  const out = new Float64Array(300_000)
  for (let i = 0; i < 100_000; i++) {
    const x = rand() * 2000 - 1000
    out[i * 3] = Math.sin(x)
    out[i * 3 + 1] = Math.exp(x / 15)
    out[i * 3 + 2] = (rand() * 100) ** (rand() * 20 - 10)
  }
  console.log(`[harness] engine=${detectEngine()} native-math-sha=${await sha256Hex(f64Bytes(out))}`)
})

const SMOKE_EXPECTED = '6dda73d868a3f5f0449b52e4291ed564485e94eb0cd5ee7fc2ef5f482b5ee303'
