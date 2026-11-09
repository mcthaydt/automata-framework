// The last pass of the frame. The scene's alpha carries what each pixel is (alpha-codes.ts); here it becomes what the
// stage blends: alpha 1 wherever anything was drawn and colour 0 (alpha 0) where nothing was, because the view is blended
// onto the 2D stage as premultiplied colour. A mood's table of 256 palette indices is applied here, so a grade is a lookup
// on a pixel that is already a palette colour. A pass an extension adds runs before this one and must keep alpha, marking
// a pixel it paints with alpha 0 as world.

import { type EffectFragment, PostEffect } from '@pixi/3d'
import { alphaCodeGlsl, alphaCodeWgsl } from '../../shared/render/alpha/alpha-codes.ts'
import { duelLabGlsl, duelLabWgsl } from './duel-lab-shader.ts'

/** A pass's uniforms reach its shader by type alone, so an array cannot be one; the table is baked into the shader instead,
 * and a grade that changes is a new pass (a grade changes with the look, not with the frame). */
function fragment(remap: Uint8Array | undefined): EffectFragment {
  const table = remap === undefined ? '' : [...remap].join(', ')
  const glsl = `
${alphaCodeGlsl()}
${duelLabGlsl()}
${remap === undefined ? '' : `const int REMAP[256] = int[256](${table});`}
vec4 effect(vec2 uv) {
  vec4 c = sampleColor(uv);
  if (!isDrawn(c.a)) return vec4(0.0);
  vec3 rgb = c.rgb;
  ${remap === undefined ? '' : 'rgb = DUEL_RGB[REMAP[nearestDuel(rgb)]];'}
  return vec4(rgb, 1.0);
}`
  const wgsl = `
${alphaCodeWgsl()}
${duelLabWgsl()}
${remap === undefined ? '' : `var<private> REMAP: array<i32, 256> = array<i32, 256>(${table});`}
fn effect(uv: vec2<f32>) -> vec4<f32> {
  let c = sampleColor(uv);
  if (!isDrawn(c.a)) { return vec4<f32>(0.0); }
  var rgb = c.rgb;
  ${remap === undefined ? '' : 'rgb = DUEL_RGB[REMAP[nearestDuel(rgb)]];'}
  return vec4<f32>(rgb, 1.0);
}`
  return { gpu: wgsl, gl: glsl }
}

export class FinishEffect extends PostEffect {
  protected override readonly fragment: EffectFragment
  private readonly active: boolean

  /** `remap` is each DUEL colour's new index (a mood's grade), or none to leave the palette as it is. */
  constructor(remap: Uint8Array | undefined) {
    super()
    this.fragment = fragment(remap)
    this.active = remap !== undefined
  }

  /** Whether a grade is applied. */
  get graded(): boolean {
    return this.active
  }
}
