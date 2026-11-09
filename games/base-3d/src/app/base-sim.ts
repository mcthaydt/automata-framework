// How the game makes its sim from its compiled area. Sim code: `pnpm boundaries` checks it.
import type { PluginDef, Sim } from '@automata/sim'
import type { Area } from '../shared/area.ts'
import { base3dPlugin, spawnArea } from './base3d.plugin.ts'

/** The sim spec `defineGame` takes: what `base3dSim` returns. */
export interface Base3dSim {
  readonly plugins: readonly PluginDef[]
  readonly seed: number
  readonly content: Area
  readonly setup: (sim: Sim) => void
}

/**
 * How the game makes its sim from its compiled area: `main.ts` and the golden replay both start from here (the sim takes
 * content as data, never as an import). It names no `tickHz`, because `defineGame`'s sim spec has none: the
 * page's sim runs at the sim's default, 60 Hz, which is `TICK_HZ` (the page's test checks it).
 */
export function base3dSim(area: Area): Base3dSim {
  return {
    // The heading's plugin is render3dExtension's (`main.ts`): `defineGame` adds an extension's sim plugins (RT.EXT1).
    plugins: [base3dPlugin],
    seed: 1,
    content: area,
    setup: (sim) => spawnArea(sim, area),
  }
}
