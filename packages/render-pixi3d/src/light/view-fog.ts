// `View3D`'s linear fog (M3 spec §4.1 `Pixi3dOptions.fog`, §4.3). The Last Light (`mcthaydt/PixiJS3D_Experiment_001`,
// 92e6704) `src/render/fog.ts` `hazeFor` set the same linear fog from its look constants; here it comes from the
// game's options or its lighting content. Its particle mist is not extracted: spec §4.3 keeps it only if S7 measures
// it within budget, and S7 has not.
import type { Fog } from '@pixi/3d'
import type { SceneFog } from './scene-lighting.schema.js'

/** The view's fog: the options' when given, else the lighting content's, else none. */
export function viewFog(options: SceneFog | undefined, content: SceneFog | undefined): Fog | null {
  const fog = options ?? content
  return fog === undefined ? null : { type: 'linear', near: fog.near, far: fog.far, color: fog.color }
}
