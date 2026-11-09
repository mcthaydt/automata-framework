import { test } from 'vitest'
import { apply, type V3 } from '../math/math'
import { at, fk, J, restPose } from '../rig/rig'
import { fixtureLimits } from '../testing/fixture-limits'
import { at3, KEEPER, NO_TARGETS, unit, WICK } from '../testing/solve-fixtures'
import { solve } from './solve'
import type { Targets, Vec3 } from './targets'

// S7-Q8 (M3 spec §3): a figure's rig solve should cost at most 0.1 ms. Measured and printed, never asserted:
// not part of the gate; `pnpm --filter @automata/figures bench` runs it.
const { performance } = globalThis as unknown as { performance: { now(): number } }

function medianMs(run: () => void, times: number): number {
  const samples: number[] = []
  for (let i = 0; i < times; i++) {
    const t = performance.now()
    run()
    samples.push(performance.now() - t)
  }
  samples.sort((a, b) => a - b)
  return samples[Math.floor(samples.length / 2)] as number
}

test('bench: median ms per solve, a pose step (every handle) and a frame (pins and aim)', async () => {
  const limits = await fixtureLimits()
  const rows: string[] = []
  for (const [name, s] of [
    ['wick', WICK],
    ['keeper', KEEPER],
  ] as const) {
    const k = unit(s)
    const base = restPose()
    const rest = fk(s, base)
    const shoulder = at(s.rest, J['upperArm.R'])
    const pelvis = at(s.rest, J.pelvis)
    const pins = {
      footL: at3(rest, J['foot.L']) as Vec3,
      footR: at3(rest, J['foot.R']) as Vec3,
    }
    const look: Vec3 = apply(at(rest, J.root), [1, 1.2 * k, 3]) as V3
    // A pose step: four limbs (two pinned feet, two hand effectors), the hips, the chest, a head aim.
    const step = (i: number): Targets => ({
      ...NO_TARGETS,
      effectors: {
        pelvis: { pos: [pelvis[0] / k, pelvis[1] / k - 0.03 - 0.01 * Math.sin(i), pelvis[2] / k] },
        chest: { rot: [5, 10 * Math.sin(i), 0] },
        handL: { pos: [-shoulder[0] / k, shoulder[1] / k - 0.2, 0.25] },
        handR: { pos: [shoulder[0] / k, shoulder[1] / k - 0.15, 0.3] },
      },
      aim: [{ at: look, part: 'head' }],
      pins,
    })
    // A frame between pose steps: the pins and the aim only.
    const frame: Targets = { ...NO_TARGETS, aim: [{ at: look, part: 'head' }], pins }
    for (let i = 0; i < 200; i++) solve(s, base, step(i), limits) // warm-up
    let i = 0
    const stepMs = medianMs(() => solve(s, base, step(i++), limits), 2000)
    const frameMs = medianMs(() => solve(s, base, frame, limits), 2000)
    rows.push(`${name}: pose step ${stepMs.toFixed(4)} ms, frame ${frameMs.toFixed(4)} ms (target <= 0.1 ms)`)
  }
  // The package has no DOM types, so reach console through globalThis.
  ;(globalThis as unknown as { console: { log(text: string): void } }).console.log(rows.join('\n'))
})
