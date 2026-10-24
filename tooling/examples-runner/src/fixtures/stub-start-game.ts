// A test stub standing in for DX.2's `startGame`, so the runner, the smoke test and the parity test can be proven
// before DX.2 lands (EX plan, Task EX.1). It is not the real API and is only ever given to the runner's own
// fixture config (fixtures.vite.config.ts): it runs the example's sim for a few ticks, shows the tick and the
// state hash, and marks the page ready.
import { createSim } from '@mcthaydt/automata-sim'
import type { GoldenExample } from '../parity.ts'

export async function startGame(example: GoldenExample): Promise<void> {
  const sim = await createSim({ seed: example.sim.seed, plugins: example.sim.plugins })
  example.sim.setup?.(sim)
  for (let tick = 0; tick < 10; tick++) sim.step([])
  const status = document.createElement('p')
  status.textContent = `${example.id}: tick ${sim.tick}, hash ${sim.hash()}`
  document.body.append(status)
  document.documentElement.dataset.state = 'ready'
}
