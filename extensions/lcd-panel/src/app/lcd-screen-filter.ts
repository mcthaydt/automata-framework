// The panel's mesh, stripes and scanlines as a framework screen filter: declared in the renderer's `postFilters`, it runs on the
// upscaled picture, a mesh cell `cellPixels` device pixels with its line on the cell's last pixel. Use it with the field pass's
// own profile at `grid`, `subpixels` and `scanlines` 0 and `brightness` 1, so the field pass keeps the colour split, halation,
// gamma and vignette, and this pass draws the lines and gives back what they take. Read once: a new profile is a new renderer.

import { type PostFilterDef, postFilter } from '@automata/framework'
import { parseLcdProfile } from '../features/lcd-panel/lcd-profile.schema.ts'
import {
  type LcdScreenOptions,
  lcdScreenGlsl,
  lcdScreenValues,
  lcdScreenWgsl,
} from '../features/lcd-panel/lcd-screen.ts'

/** The name the screen filter is declared under. */
export const LCD_SCREEN_FILTER = 'lcd-panel-screen'

/** The screen filter for `profile` (Zod-checked, the rest the clinic's): `renderer: { postFilters: [lcdPanelScreenFilter(...)] }`. */
export function lcdPanelScreenFilter(profile: unknown = {}, options: LcdScreenOptions = {}): PostFilterDef {
  const values = lcdScreenValues(parseLcdProfile(profile), options)
  return postFilter(LCD_SCREEN_FILTER, {
    glsl: lcdScreenGlsl(values),
    wgsl: lcdScreenWgsl(values),
    at: 'screen',
  })
}
