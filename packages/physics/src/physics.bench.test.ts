import { createSim, type Sim } from '@mcthaydt/automata-sim'
import { test } from 'vitest'
import { body2d, collider2d, physics2d, RigidBody2D, transform2d } from './2d'
import { BodyKind, body3d, collider3d, physics3d, RigidBody3D, transform3d } from './3d'

// M2.1 spec §8: ms/tick and init time, measured, never asserted. Runs only with AF_BENCH=1.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
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

/**
 * The awake case: no gravity, and every body bouncing around a closed box with restitution 1 and no damping,
 * so none can sleep. This is the cost a busy scene pays; the resting piles above mostly measure sleep.
 */
async function awakeSim(dim: '2d' | '3d', n: number): Promise<Sim> {
  if (dim === '3d') {
    const sim = await createSim({ seed: 1, plugins: [physics3d({ gravity: { x: 0, y: 0, z: 0 } })] })
    const walls = [
      [0, -6.1, 0, 6, 0.1, 6],
      [0, 6.1, 0, 6, 0.1, 6],
      [-6.1, 0, 0, 0.1, 6, 6],
      [6.1, 0, 0, 0.1, 6, 6],
      [0, 0, -6.1, 6, 6, 0.1],
      [0, 0, 6.1, 6, 6, 0.1],
    ] as const
    for (const [x, y, z, hx, hy, hz] of walls)
      sim.spawn([transform3d({ x, y, z }), collider3d.cuboid(hx, hy, hz, { restitution: 1 })])
    for (let i = 0; i < n; i++)
      sim.spawn([
        transform3d({ x: (i % 10) - 4.5, y: (Math.floor(i / 10) % 10) - 4.5, z: Math.floor(i / 100) - 2 }),
        body3d(BodyKind.dynamic, { vx: ((i * 7) % 11) - 5, vy: ((i * 3) % 7) - 3, vz: ((i * 5) % 9) - 4 }),
        collider3d.ball(0.3, { restitution: 1, friction: 0 }),
      ])
    return sim
  }
  const sim = await createSim({ seed: 1, plugins: [physics2d({ gravity: { x: 0, y: 0 } })] })
  const walls = [
    [0, -15.1, 15, 0.1],
    [0, 15.1, 15, 0.1],
    [-15.1, 0, 0.1, 15],
    [15.1, 0, 0.1, 15],
  ] as const
  for (const [x, y, hx, hy] of walls)
    sim.spawn([transform2d({ x, y }), collider2d.cuboid(hx, hy, { restitution: 1 })])
  for (let i = 0; i < n; i++)
    sim.spawn([
      transform2d({ x: (i % 25) - 12, y: Math.floor(i / 25) - 10 }),
      body2d(BodyKind.dynamic, { vx: ((i * 7) % 11) - 5, vy: ((i * 3) % 7) - 3 }),
      collider2d.ball(0.3, { restitution: 1, friction: 0 }),
    ])
  return sim
}

/** Bodies still moving, to show the awake case stayed awake. */
function moving(sim: Sim, dim: '2d' | '3d'): number {
  const velocities =
    dim === '3d'
      ? sim.query(RigidBody3D).map((e) => e.get(RigidBody3D))
      : sim.query(RigidBody2D).map((e) => e.get(RigidBody2D))
  return velocities.filter((b) => b.vx !== 0 || b.vy !== 0).length
}

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
      for (const n of [100, 500]) {
        const sim = await awakeSim(dim, n)
        sim.step([])
        const ms = medianTickMs(sim, 300)
        const hashMs = medianMs(() => sim.hash(), 20)
        rows.push(
          `${dim} ${n} awake bodies: median ${ms.toFixed(3)} ms/tick over 300 ticks, ${moving(sim, dim)} still moving; sim.hash() ${hashMs.toFixed(2)} ms`,
        )
        sim.dispose()
      }
    }
    // The package has no DOM or Node types, so reach console through globalThis.
    ;(globalThis as unknown as { console: { log(text: string): void } }).console.log(rows.join('\n'))
  },
)
