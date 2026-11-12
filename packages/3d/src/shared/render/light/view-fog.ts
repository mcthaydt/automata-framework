// `View3D`'s linear fog (`Pixi3dOptions.fog`). A look's constants once set the same linear fog; here it comes from the
// game's options or its lighting content. Its particle mist is not extracted: it stays out unless a measurement shows
// it within budget, and S7 has not.
import type { Fog } from '@pixi/3d'
import { type SceneFog, sceneFogSchema } from './scene-lighting.schema.ts'

/**
 * The view's fog: the options' when given, else the lighting content's (already checked when content compiled), else
 * none. Options fog is checked by the same schema, so a game's code cannot set what its content could not.
 *
 * The game states the colour `C` as it always did, and the engine is handed the colour that makes beta.2's fog: see `engineFogColour`.
 */
export function viewFog(options: SceneFog | undefined, content: SceneFog | undefined): Fog | null {
  if (options !== undefined) {
    const checked = sceneFogSchema.safeParse(options)
    if (!checked.success)
      throw new Error(`Pixi3dOptions.fog: ${checked.error.issues.map((issue) => issue.message).join('; ')}`)
  }
  const fog = options ?? content
  return fog === undefined
    ? null
    : { type: 'linear', near: fog.near, far: fog.far, color: engineFogColour(fog.color) }
}

/** One sRGB channel (0 to 1) decoded to linear light by the piecewise curve (beta.2's `srgbToLinear`). */
const decodePiecewise = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

/** The pure 2.2 gamma beta.3 encodes with (and decodes with: `srgbToLinear` is its inverse). */
const encodeGamma = (linear: number): number => linear ** (1 / 2.2)

/**
 * The fog colour as `@pixi/3d` should be given it, so its fog is the one beta.2's was. Beta.2 decoded the fog colour with the piecewise
 * sRGB curve into the linear light it mixed toward (`uFogColor = dec_pw(C)`); beta.3 decodes with a 2.2 gamma. Handing beta.3
 * the colour whose 2.2 decode is that same linear light, `F = enc(dec_pw(C))`, makes `uFogColor` the number beta.2 had, so a lit surface
 * (the engine's own fog) shows what it showed, a dark fog included (0x31222a: 52 of 255 where handing it over as written gives 49).
 * It is a float triple, not an 8-bit colour: a dark channel's step would be a visible band.
 * That linear light is also the colour the display-space fog of an unlit surface mixes toward (`UnlitMaterial`) and the sky's
 * (`fogSkyColor`): beta.2 showed an unlit surface and the sky at `dec_pw(C)` itself (0x8b9bb4 as 0x425474).
 */
export function engineFogColour(colour: number): [number, number, number] {
  const channel = (shift: number): number => encodeGamma(decodePiecewise(((colour >> shift) & 0xff) / 255))
  return [channel(16), channel(8), channel(0)]
}

/**
 * The sky behind fog: the colour fully fogged unlit pixels reach on screen, so a wall fades into the sky with no edge. In
 * `@pixi/3d` beta.2 that colour was the fog colour's linear light, drawn as the display value (0x8b9bb4 draws as 0x425474), while a
 * background colour draws as given, so the sky takes the decoded value; `UnlitMaterial` keeps that on beta.3.
 * `lighting.test.ts` checks the two meet.
 */
export function fogSkyColor(fog: SceneFog): number {
  const channel = (shift: number): number =>
    Math.round(255 * decodePiecewise(((fog.color >> shift) & 0xff) / 255))
  return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}
