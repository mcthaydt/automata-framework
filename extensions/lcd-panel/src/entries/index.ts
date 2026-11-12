// @automataframework/lcd-panel: the LCD screen look for AF's pixel-art look. This entry is the settings and the maths, with no
// renderer in it; the pass is `@automataframework/lcd-panel/pass`.
export {
  derivePitch,
  LCD_UNIFORMS,
  type LcdUniformValues,
  lcdUniformValues,
  smoothstep,
  vignetteShade,
} from '../features/lcd-panel/lcd-geometry.ts'
export {
  LCD_CLINIC,
  LCD_OFF,
  type LcdProfile,
  lcdProfileSchema,
  parseLcdProfile,
} from '../features/lcd-panel/lcd-profile.schema.ts'
