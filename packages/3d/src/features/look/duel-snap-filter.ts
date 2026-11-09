// The one snap: every world and glowing pixel of the frame goes to its nearest DUEL colour (nearest in OKLab, as the
// painter's snap is), with a 4 × 4 Bayer offset first so a colour between two palette colours lands on both, in a
// pattern, instead of one flat patch. The offset is taken before the colour is quantised to a byte, as the figure's cells
// are, so a painted texel and a world pixel meet one rule. A pixel whose alpha says it is a painted cell or the sky is
// left as it is: a cell was snapped on the CPU and the sky draws its own dither. A `PostEffect`, written as a GLSL + WGSL
// pair: WebGL2 stays at parity with WebGPU (ADR 0002). Pixel position comes from the content-space `uv` over one texel
// (`texel()`), not from the vertex stage, which a post effect has none of.

import { type EffectFragment, PostEffect } from '@pixi/3d'
import { UniformGroup } from 'pixi.js'
import { alphaCodeGlsl, alphaCodeWgsl } from '../../shared/render/alpha/alpha-codes.ts'
import { BAYER } from '../../shared/render/texel.ts'
import { duelLabGlsl, duelLabWgsl } from './duel-lab-shader.ts'

const GLSL = `
${alphaCodeGlsl()}
${duelLabGlsl()}
const float BAYER[16] = float[16](${BAYER.join('.0, ')}.0);
vec4 effect(vec2 uv) {
  vec4 c = sampleColor(uv);
  if (!isDrawn(c.a) || isPainted(c.a) || isSky(c.a)) return c;
  vec2 p = floor(uv / texel());
  int cell = int(mod(p.x, 4.0)) + int(mod(p.y, 4.0)) * 4;
  vec3 want = c.rgb + (BAYER[cell] / 16.0 - 0.5) * uDither;
  want = floor(clamp(want, 0.0, 1.0) * 255.0 + 0.5) / 255.0;
  return vec4(DUEL_RGB[nearestDuel(want)], c.a);
}`

const WGSL = `
${alphaCodeWgsl()}
${duelLabWgsl()}
var<private> BAYER: array<f32, 16> = array<f32, 16>(${BAYER.join('.0, ')}.0);
fn effect(uv: vec2<f32>) -> vec4<f32> {
  let c = sampleColor(uv);
  if (!isDrawn(c.a) || isPainted(c.a) || isSky(c.a)) { return c; }
  let p = floor(uv / texel());
  let cell = i32(p.x % 4.0) + i32(p.y % 4.0) * 4;
  var want = c.rgb + (BAYER[cell] / 16.0 - 0.5) * fx.uDither;
  want = floor(clamp(want, vec3<f32>(0.0), vec3<f32>(1.0)) * 255.0 + 0.5) / 255.0;
  return vec4<f32>(DUEL_RGB[nearestDuel(want)], c.a);
}`

export class DuelSnapEffect extends PostEffect {
  protected override readonly fragment: EffectFragment = { gpu: WGSL, gl: GLSL }
  protected override readonly uniforms: UniformGroup

  /** `dither` is the Bayer offset in colour units (0 snaps flat). */
  constructor(dither: number) {
    super()
    this.uniforms = new UniformGroup({ uDither: { value: dither, type: 'f32' } })
  }

  get dither(): number {
    return this.uniforms.uniforms.uDither as number
  }

  set dither(value: number) {
    this.uniforms.uniforms.uDither = value
  }
}
