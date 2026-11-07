// @automata/world-kit/sky: the kit's look passes, for a game that wants stars, rain or a glow in its 3D look. Loads
// `@pixi/3d`, so it is its own entry: the kit's root stays free of the renderer.
export { GlowEffect, type GlowOptions } from '../features/sky/glow-effect.ts'
export { RainEffect } from '../features/sky/rain-effect.ts'
export {
  addSkyPasses,
  type RainOptions,
  SKY_PASS_NAMES,
  type SkyPassOptions,
  skyLookPasses,
} from '../features/sky/sky-passes.ts'
export { StarsEffect } from '../features/sky/stars-effect.ts'
