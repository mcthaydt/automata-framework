import { createSim, type Order, populate, tick } from './world'

function bench(order: Order): { live: number; msPerTick: number } {
  const sim = createSim(5)
  populate(sim, 2_000) // exactly 2k live at start; each tick adds net +1, so ~2.6k by the end
  const TICKS = 600
  const t0 = performance.now()
  for (let t = 0; t < TICKS; t++) tick(sim, order)
  const msPerTick = (performance.now() - t0) / TICKS
  const live = sim.world.query().length
  sim.world.destroy()
  return { live, msPerTick: Math.round(msPerTick * 1000) / 1000 }
}

;(window as unknown as { __result: unknown }).__result = {
  ok: true,
  native: bench('native'),
  sorted: bench('sorted'),
}
