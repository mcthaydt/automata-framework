import { createSim, type Sim } from '@mcthaydt/automata-sim'
import { test } from 'vitest'
import { body2d, collider2d, physics2d, transform2d } from './2d'
import { BodyKind, body3d, collider3d, physics3d, transform3d } from './3d'

// M2.1 spec §8: ms/tick and init time, measured, never asserted. Runs only with AF_BENCH=1.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
const { performance } = globalThis as unknown as { performance: { now(): number } }

function medianTickMs(sim: Sim, ticks: number): number {
  const times: number[] = []
  for (let i = 0; i < ticks; i++) {
    const t = performance.now()
    sim.step([])
    times.push(performance.now() - t)
  }
  times.sort((a, b) => a - b)
  return times[Math.floor(times.length / 2)] as number
}

test.skipIf(env.AF_BENCH !== '1')(
  'bench: init time and median ms/tick at 100 and 500 dynamic bodies',
  async () => {
    const rows: string[] = []
    for (const dim of ['3d', '2d'] as const) {
      const t0 = performance.now()
      const first = await createSim({ seed: 1, plugins: [dim === '3d' ? physics3d() : physics2d()] })
      rows.push(`${dim} first createSim (includes RAPIER.init): ${(performance.now() - t0).toFixed(1)} ms`)
      first.dispose()
      for (const n of [100, 500]) {
        const sim = await createSim({ seed: 1, plugins: [dim === '3d' ? physics3d() : physics2d()] })
        if (dim === '3d') {
          sim.spawn([transform3d({ y: -0.1 }), collider3d.cuboid(50, 0.1, 50)])
          for (let i = 0; i < n; i++)
            sim.spawn([
              transform3d({
                x: (i % 20) - 10,
                y: 1 + Math.floor(i / 400) * 1.1,
                z: (Math.floor(i / 20) % 20) - 10,
              }),
              body3d(BodyKind.dynamic),
              collider3d.ball(0.4),
            ])
        } else {
          sim.spawn([transform2d({ y: -0.1 }), collider2d.cuboid(200, 0.1)])
          for (let i = 0; i < n; i++)
            sim.spawn([
              transform2d({ x: (i % 100) - 50, y: 1 + Math.floor(i / 100) }),
              body2d(BodyKind.dynamic),
              collider2d.ball(0.4),
            ])
        }
        sim.step([]) // creates the bodies
        rows.push(`${dim} ${n} bodies: median ${medianTickMs(sim, 300).toFixed(3)} ms/tick over 300 ticks`)
        sim.dispose()
      }
    }
    // The package has no DOM or Node types, so reach console through globalThis.
    ;(globalThis as unknown as { console: { log(text: string): void } }).console.log(rows.join('\n'))
  },
)
