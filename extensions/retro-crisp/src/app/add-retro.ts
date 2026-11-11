// Adds the retro pass to core's look: call it once, before the renderer is created. Passes run in the order they were
// added, after core's, so add it before the LCD panel. A name already taken is refused by core (`RegistryClash`).

import { addLookPass } from '@automata/3d'
import { Ticker } from 'pixi.js'
import { RetroEffect } from '../features/retro/retro-effect.ts'
import { parseRetroProfile } from '../features/retro/retro-profile.schema.ts'

/** The name the pass is added under. */
export const RETRO_PASS = 'retro'

/** What a game says: its profile, and whether the pass starts on. */
export interface RetroOptions {
  readonly profile?: unknown
  readonly enabled?: boolean
}

/** Adds the pass. The returned list holds the passes the renderer made (newest last), so a game can switch or retune one. */
export function addRetroPass(options: RetroOptions = {}): { readonly passes: readonly RetroEffect[] } {
  const profile = parseRetroProfile(options.profile ?? {})
  const made: RetroEffect[] = []
  addLookPass({
    name: RETRO_PASS,
    make: () => {
      const pass = new RetroEffect(profile, { enabled: options.enabled ?? true })
      made.push(pass)
      // The film's clock is Pixi's shared ticker until the pass is destroyed.
      let seconds = 0
      const tick = (ticker: Ticker): void => {
        seconds += ticker.deltaMS / 1000
        pass.clock = seconds
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
