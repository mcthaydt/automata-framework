import type { DrawSim } from '@automata/framework'

// What the screen holds of the running game. The play screen's overlay is given the sim (read only) and a way to send a
// command; it sets them here while it is on screen, so the picture, the sound and the controls read one place and none of
// them writes the sim (law 2). Nothing here is gameplay state: when the overlay is gone, so is it.

/** Queues a command for the next tick: the only way the screen reaches the sim (law 1). */
export type Send = (command: { readonly type: string; readonly payload: unknown }) => void

export interface Live {
  /** The sim as the draw layer sees it, while the play screen is up. */
  sim: DrawSim | undefined
  send: Send
}

export const live: Live = { sim: undefined, send: () => undefined }

/** Hands the screen the running game; returns what undoes it (the overlay going away). */
export function bindLive(sim: DrawSim | undefined, send: Send): () => void {
  live.sim = sim
  live.send = send
  return () => {
    if (live.sim === sim) {
      live.sim = undefined
      live.send = () => undefined
    }
  }
}
