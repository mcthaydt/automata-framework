import { addLcdPanelPass, lcdPanelScreenFilter } from '@automata/lcd-panel/pass'
import { CRISP_CLINIC, crispRendererOptions } from '@automata/retro-crisp'
import { addRetroPass } from '@automata/retro-crisp/pass'
import type { LookProfiles } from './look-profiles.content.ts'

declare const __AUTOMATA_DEBUG__: boolean

/** What a journey reads of the passes the renderer made: whether each is on, and the film's clock (seconds). */
export interface LookState {
  readonly retro: readonly { readonly enabled: boolean; readonly clock: number }[]
  readonly lcd: readonly { readonly enabled: boolean }[]
}

declare global {
  var __lastLightLook: (() => LookState) | undefined
}

// The old game's own picture: the palette snap, then the retro grade and the LCD panel over it (`src/render/retro-filter.ts` and
// `lcd-panel.ts` at 92e6704), drawn at whole pixels. The profiles are `content/look.toml`'s (`look-profiles.content.ts`).

/** The renderer option that draws the picture at whole pixels, as the old game did. */
export const RENDERER_SCALE = crispRendererOptions(CRISP_CLINIC)

/** What the game says about the passes: whether the player asked for less movement, read each frame. */
export interface LookPassOptions {
  readonly reducedMotion?: () => boolean
}

/** The renderer's screen filters for the look: the panel's mesh at the screen's pixels when it has `[lcdScreen]`, else none. */
export function screenFiltersOf(profiles: LookProfiles) {
  if (profiles.lcdScreen === undefined) return []
  const { cellPixels, ...screen } = profiles.lcdScreen
  return [lcdPanelScreenFilter(screen, { cellPixels })]
}

/**
 * Adds the two passes, once, before the renderer is made (a second call under the same name is refused). Both start on, so play and
 * every cutscene wear them. The film's grain, dust and scratch are the grade's only movement and hold still while `reducedMotion`
 * is true. `postFilters` is for the renderer's own option: the panel's mesh at the screen's pixels, when the look has `[lcdScreen]`.
 */
export function lookPassesOf(profiles: LookProfiles, options: LookPassOptions = {}) {
  const retro = addRetroPass({
    profile: profiles.retro,
    // The old game snapped to the palette first and graded the snapped colours: dark gradients stay smooth (the frame is then no longer
    // strictly the palette, as the old game's was not).
    gradeAt: 'after-snap',
    ...(options.reducedMotion === undefined ? {} : { reducedMotion: options.reducedMotion }),
  })
  // After the grade and the snap: the panel simulates the display, so what it draws is not on the palette.
  const lcd = addLcdPanelPass({ profile: profiles.lcd })
  // A development build tells a journey what the renderer made (a release build never has it).
  if (typeof __AUTOMATA_DEBUG__ !== 'undefined' && __AUTOMATA_DEBUG__)
    globalThis.__lastLightLook = () => ({
      retro: retro.passes.map((pass) => ({ enabled: pass.enabled, clock: pass.clock })),
      lcd: lcd.passes.map((pass) => ({ enabled: pass.enabled })),
    })
  return { retro, lcd, postFilters: screenFiltersOf(profiles) }
}
