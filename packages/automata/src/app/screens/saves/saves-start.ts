// What the default screens share when a save starts or replaces the game being played: the title starts one
// from a slot, and the paused screen replaces it with the newer progress another device wrote.
import type { Sim } from '@automataframework/automata-sim'
import type { Result } from '../../../shared/lib/result.ts'

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

/** A save call's answer as a promise that rejects on a refusal, for the screens' one-thing-at-a-time attempts. */
export async function orThrow<A>(answer: Promise<Result<A, unknown>>): Promise<A> {
  const result = await answer
  if (!result.ok) throw result.reason
  return result.value
}
