// What the parity test and the runner's stub read from an example's default export (EX spec §4). DX.2's
// `defineGame` settles the real shape; until then this is the part the golden replay needs.
import type { PluginDef, Sim } from '@mcthaydt/automata-sim'

export interface GoldenExample {
  readonly id: string
  readonly sim: {
    readonly plugins: readonly PluginDef[]
    readonly seed: number
    /** Spawns before tick 0. */
    readonly setup?: (sim: Sim) => void
  }
}
