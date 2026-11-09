// Glow: a stepped bloom round whatever glows. A pixel glows when it carries the glowing alpha code (a lamp's bulb, a lit
// window, neon: the emissive swatches), not when it is merely bright, so a white wall never blooms. Round each glowing
// pixel, the nearest `inner` pixels (Chebyshev) take their colour a step up their own ramp, tinted a little toward the glow,
// and the next up to `outer` take a step up on every second pixel, a checker: the glow is whole steps and a dither, never a
// blur, so every pixel stays a DUEL colour. A pixel nothing was drawn in is left as it is, and a ring keeps the alpha code of
// the pixel it lands on (a ring over the sky is still sky).
// A `PostEffect` in GLSL + WGSL, run after the DUEL snap.

import { PostEffect } from '@pixi/3d'
import { UniformGroup } from 'pixi.js'
import { alphaCodeGlsl, alphaCodeWgsl } from '../../../shared/render/alpha/alpha-codes.ts'
import { DUEL_GLSL, DUEL_WGSL } from './shader-parts.ts'

/** The most pixels out the glow reaches; the shader scans a (2 * 4 + 1)² window. */
export const MAX_REACH = 4

const GLSL = `
${alphaCodeGlsl()}
${DUEL_GLSL}
vec4 effect(vec2 uv) {
  vec4 c = sampleColor(uv);
  if (!isDrawn(c.a) || isGlowing(c.a)) return c;
  vec2 t = texel();
  float nearest = 1e9;
  vec3 glow = c.rgb;
  for (int dy = -${MAX_REACH}; dy <= ${MAX_REACH}; dy++) {
    for (int dx = -${MAX_REACH}; dx <= ${MAX_REACH}; dx++) {
      float d = float(max(abs(dx), abs(dy)));
      if (d == 0.0 || d >= nearest || d > uOuter) continue;
      vec4 s = sampleColor(uv + vec2(float(dx), float(dy)) * t);
      if (isGlowing(s.a)) { nearest = d; glow = s.rgb; }
    }
  }
  if (nearest > uOuter) return c;
  if (nearest <= uInner) return vec4(stepUp(nearestIndex(mix(c.rgb, glow, 0.3))), c.a);
  vec2 p = floor(uv / t);
  if (int(mod(p.x + p.y, 2.0)) == 0) return vec4(stepUp(nearestIndex(c.rgb)), c.a);
  return c;
}`

const WGSL = `
${alphaCodeWgsl()}
${DUEL_WGSL}
fn effect(uv: vec2<f32>) -> vec4<f32> {
  let c = sampleColor(uv);
  if (!isDrawn(c.a) || isGlowing(c.a)) { return c; }
  let t = texel();
  var nearest = 1e9;
  var glow = c.rgb;
  for (var dy = -${MAX_REACH}; dy <= ${MAX_REACH}; dy++) {
    for (var dx = -${MAX_REACH}; dx <= ${MAX_REACH}; dx++) {
      let d = f32(max(abs(dx), abs(dy)));
      if (d == 0.0 || d >= nearest || d > fx.uOuter) { continue; }
      let s = sampleColor(uv + vec2<f32>(f32(dx), f32(dy)) * t);
      if (isGlowing(s.a)) { nearest = d; glow = s.rgb; }
    }
  }
  if (nearest > fx.uOuter) { return c; }
  if (nearest <= fx.uInner) { return vec4<f32>(stepUp(nearestIndex(mix(c.rgb, glow, 0.3))), c.a); }
  let p = floor(uv / t);
  if (i32((p.x + p.y) % 2.0) == 0) { return vec4<f32>(stepUp(nearestIndex(c.rgb)), c.a); }
  return c;
}`

export interface GlowOptions {
  /** Pixels out the tinted ring reaches (default 1). */
  readonly inner?: number
  /** Pixels out the dithered ring reaches, at most `MAX_REACH` (default 3). */
  readonly outer?: number
}

export class GlowEffect extends PostEffect {
  protected override readonly fragment: { gpu: string; gl: string } = { gpu: WGSL, gl: GLSL }
  protected override readonly uniforms: UniformGroup

  constructor(options: GlowOptions = {}) {
    super()
    const outer = Math.min(MAX_REACH, options.outer ?? 3)
    this.uniforms = new UniformGroup({
      uInner: { value: Math.min(outer, options.inner ?? 1), type: 'f32' },
      uOuter: { value: outer, type: 'f32' },
    })
  }

  /** Pixels out the dithered ring reaches. */
  get reach(): number {
    return this.uniforms.uniforms.uOuter as number
  }
}
