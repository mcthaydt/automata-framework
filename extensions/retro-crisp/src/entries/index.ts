// @automataframework/retro-crisp: a retro grade and film fade, and a crisp whole-pixel upscale, for AF's pixel-art look. This
// entry is the settings and the maths, with no renderer in it; the pass is `@automataframework/retro-crisp/pass`.
export { applyCrispLayout, crispCanvasStyle } from '../features/crisp/crisp-canvas.ts'
export {
  CRISP_CLINIC,
  type CrispProfile,
  crispFromQuery,
  crispProfileSchema,
  parseCrispProfile,
} from '../features/crisp/crisp-profile.schema.ts'
export { crispRendererOptions } from '../features/crisp/crisp-renderer.ts'
export {
  type CrispLayout,
  figureSnap,
  letterboxScale,
  snapRatio,
  texelRatio,
} from '../features/crisp/crisp-scale.ts'
export {
  applyGrade,
  bayer8,
  fadeBlack,
  lumaWeightedThreshold,
  type Rgb,
  retroColour,
} from '../features/retro/retro-colour.ts'
export {
  parseRetroProfile,
  RETRO_CLINIC,
  RETRO_NEUTRAL,
  type RetroGrade,
  type RetroProfile,
  retroProfileSchema,
} from '../features/retro/retro-profile.schema.ts'
export {
  RETRO_UNIFORMS,
  type RetroUniformValues,
  retroUniformValues,
} from '../features/retro/retro-uniforms.ts'
