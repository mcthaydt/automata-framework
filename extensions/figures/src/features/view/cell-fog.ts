import type { ShaderBit } from '@pixi/3d'

/**
 * The fog of a painted cell: a plain mix of display values toward the fog's colour, which is how `@pixi/3d` 0.1.0-beta.2 fogged an unlit
 * colour and how the framework's own unlit material (`UnlitMaterial` in `@automata/3d`, which this package does not import) keeps
 * fogging it. A cell is a picture of display colours, drawn with no light, so the engine's own fog, which beta.3 mixes in linear light
 * and encodes again, would read lighter than every other unlit thing in the room and than beta.2 drew the figure: a power mean of the
 * cell and the fog, brighter everywhere between near and far by an amount that depends on the colour. `CellMaterial` turns the engine's
 * fog off for itself (`fog: false`), so it draws in the display colour space and `finalColor` is already the display value; this bit
 * runs at the end slot with the engine's own factor, `smoothstep(near, far, viewDepth)`, toward the engine's own fog colour
 * (`uFogColor`, which the view's fog colour decodes to, so the game states one fog), and does nothing where the view has none
 * (`uFogParams` is zero there). The exposure is not applied: the framework's views keep it at 1. Only linear fog is mixed: the
 * framework sets no other.
 */
export const cellFogBit: ShaderBit = {
  name: 'cellFog',
  interStage: { vCellFogDepth: 'f32' },
  gpu: {
    vertex: {
      afterTransform: `
  output.vCellFogDepth = -(camera.uViewMatrix * worldPosition).z;
`,
    },
    fragment: {
      end: `
  if (global.uFogParams.y > global.uFogParams.x) {
    finalColor = mix(finalColor, global.uFogColor, smoothstep(global.uFogParams.x, global.uFogParams.y, input.vCellFogDepth));
  }
`,
    },
  },
  gl: {
    vertex: {
      afterTransform: `
  vCellFogDepth = -(uViewMatrix * worldPosition).z;
`,
    },
    fragment: {
      end: `
  if (uFogParams.y > uFogParams.x) {
    finalColor = mix(finalColor, uFogColor, smoothstep(uFogParams.x, uFogParams.y, vCellFogDepth));
  }
`,
    },
  },
}
