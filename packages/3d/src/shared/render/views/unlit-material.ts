// The unlit material of the framework: `@pixi/3d`'s `FlatMaterial` with the fog `@pixi/3d` 0.1.0-beta.2 drew on it.
//
// Beta.2 mixed an unlit colour toward the fog colour as a plain mix of display values: `(1 - s) * colour + s * fog`. Beta.3 mixes in
// linear light and encodes, a power mean (exponent 2.2) of the two, which is brighter everywhere between near and far and by an amount
// that depends on the colour (160 of 255 under a fog of 66 shows 113 at the middle of the range on beta.2 and 149.5 on beta.3), so no
// fog colour, near or far reproduces the old picture on an unlit surface. This material takes the engine's fog off itself and
// mixes the display values itself, with the same factor (`smoothstep(near, far, viewDepth)`) toward the same colour (the view's own
// fog uniform), so a game states one fog and both the lit things (the engine's fog, handed the colour beta.2's was) and the unlit
// ones (this) show what beta.2 showed. The derivation and the measurements are in
// `docs/superpowers/audits/2026-11-12-pixi-3d-beta-3/README.md`, "Item 2" and "Item 3".

import { type BaseMaterial3DOptions, FlatMaterial, type ShaderBit } from '@pixi/3d'
import { toLinear } from '../light/vertex-light.ts'

/**
 * The display-space fog, in both shader stages. It runs at the end slot, after the material's colour and before the engine's
 * encode, and the material is `colorSpace: 'linear'`, so `finalColor` is linear light here: the bit encodes it, mixes toward the
 * fog's colour, and decodes it again for the engine's encode to bring back. `uFogColor` already is the fog colour as the display
 * should show it (the view's fog colour, decoded: see `viewFog`), and `uFogParams` is `(near, far, density)`, zero on a view with no
 * fog, which the `far > near` test passes over. The exposure is not applied: the framework's views keep it at 1.
 */
const unlitFogBit: ShaderBit = {
  name: 'afUnlitFog',
  interStage: { vAfFogDepth: 'f32' },
  gpu: {
    vertex: {
      afterTransform: `
  output.vAfFogDepth = -(camera.uViewMatrix * worldPosition).z;
`,
    },
    fragment: {
      end: `
  if (global.uFogParams.y > global.uFogParams.x) {
    let shown = pow(finalColor, vec3<f32>(1.0 / 2.2));
    let fogged = mix(shown, global.uFogColor, smoothstep(global.uFogParams.x, global.uFogParams.y, input.vAfFogDepth));
    finalColor = pow(fogged, vec3<f32>(2.2));
  }
`,
    },
  },
  gl: {
    vertex: {
      afterTransform: `
  vAfFogDepth = -(uViewMatrix * worldPosition).z;
`,
    },
    fragment: {
      end: `
  if (uFogParams.y > uFogParams.x) {
    vec3 shown = pow(finalColor, vec3(1.0 / 2.2));
    vec3 fogged = mix(shown, uFogColor, smoothstep(uFogParams.x, uFogParams.y, vAfFogDepth));
    finalColor = pow(fogged, vec3(2.2));
  }
`,
    },
  },
}

/**
 * The colour to give an `UnlitMaterial` so it shows what `@pixi/3d` 0.1.0-beta.2's `FlatMaterial` showed for `colour`. Beta.2 decoded an
 * unlit base colour to linear light and drew that value as it stood, no encode (a 128 grey drew as 55, 0xe37840 as 0xc4300d); beta.3 draws
 * it as written. The framework's colours (a game's embers, a figure's flat parts, a baked box) were chosen against the darker picture,
 * so they go through this; a colour a game wants as authored is given to the material as it is.
 */
export function beta2Colour(colour: number): number {
  const channel = (shift: number): number => Math.round(255 * toLinear(((colour >> shift) & 0xff) / 255))
  return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}

/**
 * An unlit material: draws its colour and texture as given, takes no light, and fogs as beta.2 fogged an unlit colour (see the file's
 * header). A drop-in for `FlatMaterial`; the framework's own unlit meshes use it, and so should a game's, or its fog will mix
 * in linear light and read brighter than the game was tuned to.
 *
 * It works in linear light whether or not the view has a fog (the engine's `'display'` space cannot take a mix), so the colour
 * goes through the engine's decode and encode: a round trip that returns the colour it was given (the two curves are one
 * 2.2 power), at the cost of two `pow`s a pixel.
 */
export class UnlitMaterial extends FlatMaterial {
  constructor(options: BaseMaterial3DOptions = {}) {
    super({ ...options, fog: false, extraBits: [...(options.extraBits ?? []), unlitFogBit] })
    // `FlatMaterial` sets its own space after the options are read, so the choice is made here.
    this.colorSpace = 'linear'
  }
}
