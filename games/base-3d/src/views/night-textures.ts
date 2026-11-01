// The night's textures, painted and wrapped once per page (art direction spec §5): a renderer rebuilt after a lost
// context reuses them, and Pixi uploads their pixels again to the new context.
import type { Texture } from 'pixi.js'
import {
  paintGlow,
  paintGrass,
  paintMoon,
  paintShaft,
  paintSilhouette,
  paintVine,
  toTexture,
} from './textures.ts'

export interface NightTextures {
  readonly grass: Texture
  readonly vine: Texture
  readonly glow: Texture
  readonly shaft: Texture
  readonly pine: Texture
  readonly tower: Texture
  readonly moon: Texture
}

let painted: NightTextures | undefined

export function nightTextures(): NightTextures {
  painted ??= {
    grass: toTexture(paintGrass(), false),
    vine: toTexture(paintVine(), false),
    glow: toTexture(paintGlow(), false, true),
    shaft: toTexture(paintShaft(), false, true),
    pine: toTexture(paintSilhouette('pine'), false),
    tower: toTexture(paintSilhouette('tower'), false),
    moon: toTexture(paintMoon(), false),
  }
  return painted
}
