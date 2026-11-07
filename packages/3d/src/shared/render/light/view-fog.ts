// `View3D`'s linear fog (`Pixi3dOptions.fog`). The Last Light (`mcthaydt/PixiJS3D_Experiment_001`,
// 92e6704) `src/render/fog.ts` `hazeFor` set the same linear fog from its look constants; here it comes from the
// game's options or its lighting content. Its particle mist is not extracted: it stays out unless a measurement shows
// it within budget, and S7 has not.
import type { Fog } from '@pixi/3d'
import { type SceneFog, sceneFogSchema } from './scene-lighting.schema.ts'

/**
 * The view's fog: the options' when given, else the lighting content's (already checked when content compiled), else
 * none. Options fog is checked by the same schema, so a game's code cannot set what its content could not.
 */
export function viewFog(options: SceneFog | undefined, content: SceneFog | undefined): Fog | null {
  if (options !== undefined) {
    const checked = sceneFogSchema.safeParse(options)
    if (!checked.success)
      throw new Error(`Pixi3dOptions.fog: ${checked.error.issues.map((issue) => issue.message).join('; ')}`)
  }
  const fog = options ?? content
  return fog === undefined ? null : { type: 'linear', near: fog.near, far: fog.far, color: fog.color }
}

/** One sRGB channel (0–255) decoded to linear light, back on the 0–255 scale. */
const linearChannel = (channel: number): number => {
  const c = channel / 255
  return Math.round(255 * (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
}

/**
 * The sky behind fog: the colour fully fogged pixels reach on screen, so a wall fades into the sky with no edge
 *. In `@pixi/3d` 0.1.0-beta.2 that colour is the fog colour's linear value, drawn as if it were
 * sRGB (0x8b9bb4 draws as 0x425474), while a background colour draws as given, so the sky takes the decoded value.
 * `lighting.parity.test.ts` checks the two meet; if the beta changes its fog mix, that test fails here first.
 */
export function fogSkyColor(fog: SceneFog): number {
  const r = linearChannel((fog.color >> 16) & 0xff)
  const g = linearChannel((fog.color >> 8) & 0xff)
  const b = linearChannel(fog.color & 0xff)
  return (r << 16) | (g << 8) | b
}
