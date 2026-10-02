import { test } from 'vitest'
import * as d from './dmath'

test('cost vs Math.* (informational)', () => {
  const xs = Float64Array.from({ length: 1_000_000 }, (_, i) => (i % 2000) - 1000.5)
  const time = (f: (x: number) => number): number => {
    let s = 0
    const t0 = performance.now()
    for (const x of xs) s += f(x)
    if (Number.isNaN(s)) console.log('unreachable')
    return Math.round(performance.now() - t0)
  }
  const rows = {
    sin: [time(d.sin), time(Math.sin)],
    atan: [time(d.atan), time(Math.atan)],
    exp: [time((x) => d.exp(x / 15)), time((x) => Math.exp(x / 15))],
    log: [time((x) => d.log(Math.abs(x))), time((x) => Math.log(Math.abs(x)))],
  }
  console.log('[S5] ms per 1M [dmath, Math]', JSON.stringify(rows))
})
