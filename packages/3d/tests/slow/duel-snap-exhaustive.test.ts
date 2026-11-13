// Every 8-bit colour (16,777,216 of them) in every Bayer cell (16), at three dither strengths: the table's snap gives the
// full 256-colour loop's answer, on the CPU models of both. About 800 million comparisons, spread over the cores, so it is
// run by hand (`pnpm --filter @automata/3d test:slow`) and not by the gate; the unit test samples the cube densely.
import { availableParallelism } from 'node:os'
import { Worker } from 'node:worker_threads'
import { describe, expect, it } from 'vitest'

interface Slice {
  readonly checked: number
  readonly wrong: string[]
}

function run(strength: number, blues: number[]): Promise<Slice> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./duel-snap-slice.ts', import.meta.url), {
      workerData: { strength, blues },
    })
    worker.once('message', resolve)
    worker.once('error', reject)
  })
}

describe('the candidate table over the whole colour cube', () => {
  for (const strength of [0.04, 0, 0.13]) {
    it(`gives the loop's answer for all 16,777,216 colours in all 16 Bayer cells, at dither ${strength}`, async () => {
      const workers = Math.max(1, availableParallelism())
      const shares: number[][] = Array.from({ length: workers }, () => [])
      for (let b = 0; b < 256; b++) shares[b % workers]?.push(b)
      const slices = await Promise.all(shares.map((blues) => run(strength, blues)))
      expect(slices.reduce((sum, slice) => sum + slice.checked, 0)).toBe(256 ** 3 * 16)
      expect(slices.flatMap((slice) => slice.wrong)).toEqual([])
    }, 3_600_000)
  }
})
