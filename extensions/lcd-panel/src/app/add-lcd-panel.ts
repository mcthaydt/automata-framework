// Adds the LCD panel to core's look: call it once, before the renderer is created, after any pass the panel should sit on
// top of (passes run in the order they were added, after core's). A name already taken is refused by core (`RegistryClash`).

import { addLookPass } from '@automata/3d'
import { LcdPanelEffect } from '../features/lcd-panel/lcd-effect.ts'
import { parseLcdProfile } from '../features/lcd-panel/lcd-profile.schema.ts'

/** The name the pass is added under. */
export const LCD_PANEL_PASS = 'lcd-panel'

/** What a game says: its profile, and whether the pass starts on. */
export interface LcdPanelOptions {
  readonly profile?: unknown
  readonly enabled?: boolean
}

/** Adds the pass. The returned list holds the panels the renderer made (newest last), so a game can switch or retune one. */
export function addLcdPanelPass(options: LcdPanelOptions = {}): {
  readonly passes: readonly LcdPanelEffect[]
} {
  const profile = parseLcdProfile(options.profile ?? {})
  const made: LcdPanelEffect[] = []
  addLookPass({
    name: LCD_PANEL_PASS,
    make: () => {
      const pass = new LcdPanelEffect(profile, { enabled: options.enabled ?? true })
      made.push(pass)
      const destroy = pass.destroy.bind(pass)
      pass.destroy = (): void => {
        made.splice(made.indexOf(pass), 1)
        destroy()
      }
      return pass
    },
  })
  return { passes: made }
}
