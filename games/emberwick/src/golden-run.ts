import { createBaseSim, moveCommand } from './base-sim.ts'
import { routeInputs } from './golden.ts'

/** Replays the golden route on a fresh sim (seed 1) and reports what the golden tests compare. */
export async function runGolden(): Promise<{
  hash: string
  goalTicks: number[]
  rejected: number
  seed: number
  ticks: number
}> {
  const sim = await createBaseSim({ seed: 1 })
  const startTick = sim.tick
  const goalTicks: number[] = []
  let rejected = 0
  for (const input of routeInputs()) {
    const result = sim.step([moveCommand(sim, input)])
    rejected += result.rejected.length
    for (const event of result.events) if (event.type === 'goal.reached') goalTicks.push(result.tick)
  }
  const hash = sim.hash()
  const ticks = sim.tick - startTick
  sim.dispose()
  return { hash, goalTicks, rejected, seed: sim.seed, ticks }
}
