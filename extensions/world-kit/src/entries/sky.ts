// @automata/world-kit/sky: the kit's look passes, for a game that wants stars, rain or a glow in its 3D look. Loads
// `@pixi/3d`, so it is its own entry: the kit's root stays free of the renderer.

export type { TrackedCamera } from '../features/sky/camera-track.ts'
export { GlowEffect, type GlowOptions } from '../features/sky/glow-effect.ts'
export { particleSprites, type Sprite } from '../features/sky/particle-sprites.ts'
export {
  type Emitter,
  MAX_SPRITES,
  ParticlesEffect,
  type ParticlesOptions,
} from '../features/sky/particles-effect.ts'
export { RainEffect } from '../features/sky/rain-effect.ts'
export { PUDDLE_STEP, ReflectEffect, type ReflectOptions, WET_STEP } from '../features/sky/reflect-effect.ts'
export {
  MAX_SHAFTS,
  type ShaftLamp,
  ShaftsEffect,
  type ShaftsOptions,
  shaftLamps,
} from '../features/sky/shafts-effect.ts'
export {
  addSkyPasses,
  type RainOptions,
  SKY_PASS_NAMES,
  type SkyPassOptions,
  skyLookPasses,
} from '../features/sky/sky-passes.ts'
export { StarsEffect } from '../features/sky/stars-effect.ts'
