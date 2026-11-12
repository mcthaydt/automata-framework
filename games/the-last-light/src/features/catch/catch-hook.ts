import type { SimContext } from '@automata/sim'
import type { SystemsWorld } from '@automata/systems/sim'
import { Checkpoint } from './checkpoint.resource.ts'

/** What the catch needs from the cutscenes, given by the app (a feature never imports an extension's player). */
export interface CatchOptions {
  readonly start: (ctx: SimContext, id: string) => void
  /** Whether a cutscene is playing (which holds input). */
  readonly playing: (ctx: SimContext) => boolean
}

/**
 * The creature's `caught` call, made when her touch finds Ada. A practice catch does nothing while a cutscene is playing
 * (the player has no hand on anything); otherwise it plays `found`, and the checkpoint is restored when that ends. A second
 * touch while the first is being told is the same catch.
 */
export const caught =
  (options: CatchOptions) =>
  (w: SystemsWorld): void => {
    const checkpoint = w.ctx.resource(Checkpoint)
    if (!checkpoint.saved || checkpoint.pending || options.playing(w.ctx)) return
    checkpoint.pending = true
    options.start(w.ctx, 'found')
  }
