import type { HudScale } from '../../shared/draw/hud-scale.ts'

/** The smallest `ctx.text` letter, in CSS px: a phone held upright still reads it. */
export const HUD_TEXT_FLOOR = 12
/** The smallest Feel word, in CSS px: a word is a glance, so it is larger. */
export const WORD_TEXT_FLOOR = 14
/** How far a label's shadow sits right and down, in CSS px. */
const SHADOW_CSS_PX = 1.5

/** A label's size in logical px: the asked size, or the floor in CSS px (scaled by the host's hint) if that is larger. */
export function hudFontSize(size: number, floorCss: number, scale: HudScale): number {
  return Math.max(size, (floorCss * scale.hostScale) / scale.cssPerLogical)
}

/** The shadow's offset in logical px. */
export function shadowOffset(scale: HudScale): number {
  return SHADOW_CSS_PX / scale.cssPerLogical
}
