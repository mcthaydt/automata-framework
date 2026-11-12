// The mood grade as a post pass (grade.ts has the rule): every colour moved in OKLab by the mood, before the DUEL snap, which
// puts the frame back on the palette. With no mood the pass is off and the frame is untouched, so a colour that is already
// a DUEL colour reaches the snap exactly as it was. A `PostEffect` in GLSL + WGSL.

import { type EffectFragment, PostEffect } from '@pixi/3d'
import { UniformGroup } from 'pixi.js'
import type { Mood } from './grade.ts'

const GLSL = `
vec3 toLin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }
vec3 toSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }
vec3 oklab(vec3 c) {
  vec3 l = toLin(c);
  vec3 lms = pow(max(vec3(0.0), vec3(
    0.4122214708 * l.r + 0.5363325363 * l.g + 0.0514459929 * l.b,
    0.2119034982 * l.r + 0.6806995451 * l.g + 0.1073969566 * l.b,
    0.0883024619 * l.r + 0.2817188376 * l.g + 0.6299787005 * l.b)), vec3(1.0 / 3.0));
  return vec3(
    0.2104542553 * lms.x + 0.7936177850 * lms.y - 0.0040720468 * lms.z,
    1.9779984951 * lms.x - 2.4285922050 * lms.y + 0.4505937099 * lms.z,
    0.0259040371 * lms.x + 0.7827717662 * lms.y - 0.8086757660 * lms.z);
}
vec3 fromOklab(vec3 o) {
  vec3 lms = vec3(o.x + 0.3963377774 * o.y + 0.2158037573 * o.z, o.x - 0.1055613458 * o.y - 0.0638541728 * o.z, o.x - 0.0894841775 * o.y - 1.2914855480 * o.z);
  vec3 q = lms * lms * lms;
  vec3 lin = vec3(
    4.0767416621 * q.x - 3.3077115913 * q.y + 0.2309699292 * q.z,
    -1.2684380046 * q.x + 2.6097574011 * q.y - 0.3413193965 * q.z,
    -0.0041960863 * q.x - 0.7034186147 * q.y + 1.7076147010 * q.z);
  return toSrgb(clamp(lin, 0.0, 1.0));
}
vec4 effect(vec2 uv) {
  vec4 c = sampleColor(uv);
  vec3 o = oklab(c.rgb);
  o.y *= uChroma;
  o.z *= uChroma;
  o.x *= uL;
  o.y += uA;
  o.z += uB;
  o.y += (uPull.y - o.y) * uPull.w;
  o.z += (uPull.z - o.z) * uPull.w;
  return vec4(fromOklab(o), c.a);
}`

const WGSL = `
fn toLin(c: vec3<f32>) -> vec3<f32> { return select(c / 12.92, pow((c + 0.055) / 1.055, vec3<f32>(2.4)), c >= vec3<f32>(0.04045)); }
fn toSrgb(c: vec3<f32>) -> vec3<f32> { return select(c * 12.92, 1.055 * pow(c, vec3<f32>(1.0 / 2.4)) - 0.055, c >= vec3<f32>(0.0031308)); }
fn oklab(c: vec3<f32>) -> vec3<f32> {
  let l = toLin(c);
  let lms = pow(max(vec3<f32>(0.0), vec3<f32>(
    0.4122214708 * l.r + 0.5363325363 * l.g + 0.0514459929 * l.b,
    0.2119034982 * l.r + 0.6806995451 * l.g + 0.1073969566 * l.b,
    0.0883024619 * l.r + 0.2817188376 * l.g + 0.6299787005 * l.b)), vec3<f32>(1.0 / 3.0));
  return vec3<f32>(
    0.2104542553 * lms.x + 0.7936177850 * lms.y - 0.0040720468 * lms.z,
    1.9779984951 * lms.x - 2.4285922050 * lms.y + 0.4505937099 * lms.z,
    0.0259040371 * lms.x + 0.7827717662 * lms.y - 0.8086757660 * lms.z);
}
fn fromOklab(o: vec3<f32>) -> vec3<f32> {
  let lms = vec3<f32>(o.x + 0.3963377774 * o.y + 0.2158037573 * o.z, o.x - 0.1055613458 * o.y - 0.0638541728 * o.z, o.x - 0.0894841775 * o.y - 1.2914855480 * o.z);
  let q = lms * lms * lms;
  let lin = vec3<f32>(
    4.0767416621 * q.x - 3.3077115913 * q.y + 0.2309699292 * q.z,
    -1.2684380046 * q.x + 2.6097574011 * q.y - 0.3413193965 * q.z,
    -0.0041960863 * q.x - 0.7034186147 * q.y + 1.7076147010 * q.z);
  return toSrgb(clamp(lin, vec3<f32>(0.0), vec3<f32>(1.0)));
}
fn effect(uv: vec2<f32>) -> vec4<f32> {
  let c = sampleColor(uv);
  var o = oklab(c.rgb);
  o.y *= fx.uChroma;
  o.z *= fx.uChroma;
  o.x *= fx.uL;
  o.y += fx.uA;
  o.z += fx.uB;
  o.y += (fx.uPull.y - o.y) * fx.uPull.w;
  o.z += (fx.uPull.z - o.z) * fx.uPull.w;
  return vec4<f32>(fromOklab(o), c.a);
}`

export class GradeEffect extends PostEffect {
  protected override readonly fragment: EffectFragment = { gpu: WGSL, gl: GLSL }
  protected override readonly uniforms: UniformGroup

  /** A grade with a mood, or with none (the pass is then off). */
  constructor(mood?: Mood) {
    // Works on the picture as shown, so it runs after tone mapping (@pixi/3d beta.3 stages a post effect before it by default).
    super({ stage: 'afterToneMapping' })
    this.uniforms = new UniformGroup({
      uL: { value: 1, type: 'f32' },
      uA: { value: 0, type: 'f32' },
      uB: { value: 0, type: 'f32' },
      uChroma: { value: 1, type: 'f32' },
      uPull: { value: new Float32Array(4), type: 'vec4<f32>' },
    })
    this.mood(mood)
  }

  /** Sets the mood the frame is graded with; with none, the pass is off and the frame is untouched. */
  mood(mood: Mood | undefined): void {
    const u = this.uniforms.uniforms
    u.uL = mood?.L ?? 1
    u.uA = mood?.a ?? 0
    u.uB = mood?.b ?? 0
    u.uChroma = mood?.chroma ?? 1
    const pull = u.uPull as Float32Array
    pull.set(mood?.pull ?? [0, 0, 0, 0])
    this.uniforms.update()
    this.enabled = mood !== undefined
  }
}
