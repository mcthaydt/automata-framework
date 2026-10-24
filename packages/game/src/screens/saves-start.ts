// What the default screens share when a save starts or replaces the game being played (M5.2): the title starts one
// from a slot, and the paused screen replaces it with the newer progress another device wrote.
import type { Sim } from '@mcthaydt/automata-sim'

/** What starting play from a slot needs from the screens. */
export interface SavesStart {
  /** A sim set up from the game's seed, plugins, content and `setup`, at tick 0. The caller owns it until `play`. */
  fresh(): Promise<Sim>
  /** Hands the started sim to play, and plays. */
  play(sim: Sim): void
}

/** Runs `work`; if it fails, the sim is disposed before the failure goes on, so a refused start leaks nothing. */
export async function orDispose<T>(sim: Sim, work: () => T | Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (error) {
    sim.dispose()
    throw error
  }
}
