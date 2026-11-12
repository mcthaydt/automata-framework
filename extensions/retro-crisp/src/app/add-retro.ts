// Adds the retro pass to core's look: call it once, before the renderer is created. It runs before core's DUEL snap, so
// the colours it grades, fades and grains are snapped to the palette (the final frame is DUEL, as the look's rule is). A name
// already taken is refused by core (`RegistryClash`).

import { addLookPass } from '@automataframework/3d'
import { reducedMotion } from '@automataframework/framework'
import { Ticker } from 'pixi.js'
import { filmClock } from '../features/retro/film-clock.ts'
import { RetroEffect } from '../features/retro/retro-effect.ts'
import { parseRetroProfile } from '../features/retro/retro-profile.schema.ts'

/** The name the pass is added under. */
export const RETRO_PASS = 'retro'

/** What a game says: its profile, and whether the pass starts on. */
export interface RetroOptions {
  readonly profile?: unknown
  readonly enabled?: boolean
  /** Whether the player asked for less movement, read each frame: the film's grain, dust and scratch hold still while it is true. Default: `prefers-reduced-motion`. */
  readonly reducedMotion?: () => boolean
}

/** Adds the pass. The returned list holds the passes the renderer made (newest last), so a game can switch or retune one. */
export function addRetroPass(options: RetroOptions = {}): { readonly passes: readonly RetroEffect[] } {
  const profile = parseRetroProfile(options.profile ?? {})
  const made: RetroEffect[] = []
  addLookPass({
    name: RETRO_PASS,
    beforeSnap: true,
    make: () => {
      const pass = new RetroEffect(profile, { enabled: options.enabled ?? true })
      made.push(pass)
      // The film's clock is Pixi's shared ticker until the pass is destroyed; it stands still under reduced motion.
      const film = filmClock(options.reducedMotion ?? (() => reducedMotion()))
      const tick = (ticker: Ticker): void => {
        pass.clock = film.tick(ticker.deltaMS)
      }
      Ticker.shared.add(tick)
      const destroy = pass.destroy.bind(pass)
      pass.destroy = (): void => {
        Ticker.shared.remove(tick)
        made.splice(made.indexOf(pass), 1)
        destroy()
      }
      return pass
    },
  })
  return { passes: made }
}
