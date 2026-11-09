// Wet ground mirrors what glows. Where it rains, the ground (the plane at height 0) takes the reflection of a lit window, a
// lamp's bulb or a neon sign: the pixel's view ray is bounced about the ground plane and marched through the depth buffer
// until it passes behind what was drawn, and a hit that glows lends its colour two steps down its own ramp, rippled by a
// texel where a slow noise in the water's place and time says. Nothing else reflects, so a wet street shows the lights and
// not the walls. Dry ground (no rain) mirrors nothing.
//
// The ground is found from the depth and the camera: a pixel whose view-space position lies on the plane at height 0 (the
// camera's height and the world's up in the view are the pass's uniforms, `camera` sets them each frame). A `PostEffect` in
// GLSL + WGSL, run after the glow.

import { PostEffect, type View3D } from '@pixi/3d'
import { UniformGroup } from 'pixi.js'
import { alphaCodeGlsl, alphaCodeWgsl } from '../../../shared/render/alpha/alpha-codes.ts'
import { DUEL_GLSL, DUEL_WGSL, HASH_GLSL, HASH_WGSL } from './shader-parts.ts'

/** How far down its ramp a reflected colour goes. */
const DROP = -2

const GLSL = `
${HASH_GLSL}
${DUEL_GLSL}
${alphaCodeGlsl()}
vec3 viewOf(vec2 uv, float lz) {
  vec2 ndc = uv * 2.0 - 1.0;
  return vec3(ndc.x * lz / uFxClip.z, -ndc.y * lz / uFxClip.w, -lz);
}
vec4 effect(vec2 uv) {
  vec4 c = sampleColor(uv);
  float depth = sampleDepth(uv);
  if (uWet <= 0.0 || depth >= 0.9999 || !isWorld(c.a)) return c;
  float lz = linearDepth(depth);
  vec3 p = viewOf(uv, lz);
  if (abs(uHeight + dot(p, uUp)) > 0.05 + 0.012 * lz) return c;
  vec3 v = normalize(p);
  vec3 r = v - 2.0 * dot(v, uUp) * uUp;
  float s = 0.06;
  vec2 hit = vec2(-1.0);
  for (int i = 0; i < 40; i++) {
    vec3 q = p + r * s;
    float qz = -q.z;
    if (qz < 0.05) break;
    vec2 w = (vec2(q.x * uFxClip.z, -q.y * uFxClip.w) / qz) * 0.5 + 0.5;
    if (w.x < 0.0 || w.y < 0.0 || w.x > 1.0 || w.y > 1.0) break;
    float d = sampleDepth(w);
    if (d >= 0.9999) { if (i > 6) { hit = w; break; } }
    else if (qz > linearDepth(d) + 0.06) { hit = w; break; }
    s *= 1.17;
    if (s > 30.0) break;
  }
  if (hit.x < 0.0) return c;
  vec2 t = texel();
  vec2 size = 1.0 / t;
  bool ripple = hash3(int(floor(uv.x * size.x / 6.0)), int(floor(uv.y * size.y / 6.0)), int(floor(uClock * 4.2))) > 0.62;
  vec4 m = sampleColor(hit + (ripple ? vec2(t.x, 0.0) : vec2(0.0)));
  if (!isGlowing(sampleColor(hit).a)) return c;
  return vec4(stepBy(nearestIndex(m.rgb), ${DROP}), c.a);
}`

const WGSL = `
${HASH_WGSL}
${DUEL_WGSL}
${alphaCodeWgsl()}
fn viewOf(uv: vec2<f32>, lz: f32) -> vec3<f32> {
  let ndc = uv * 2.0 - 1.0;
  return vec3<f32>(ndc.x * lz / fxh.uFxClip.z, -ndc.y * lz / fxh.uFxClip.w, -lz);
}
fn effect(uv: vec2<f32>) -> vec4<f32> {
  let c = sampleColor(uv);
  let depth = sampleDepth(uv);
  if (fx.uWet <= 0.0 || depth >= 0.9999 || !isWorld(c.a)) { return c; }
  let lz = linearDepth(depth);
  let p = viewOf(uv, lz);
  if (abs(fx.uHeight + dot(p, fx.uUp)) > 0.05 + 0.012 * lz) { return c; }
  let v = normalize(p);
  let r = v - 2.0 * dot(v, fx.uUp) * fx.uUp;
  var s = 0.06;
  var hit = vec2<f32>(-1.0);
  for (var i = 0; i < 40; i++) {
    let q = p + r * s;
    let qz = -q.z;
    if (qz < 0.05) { break; }
    let w = (vec2<f32>(q.x * fxh.uFxClip.z, -q.y * fxh.uFxClip.w) / qz) * 0.5 + 0.5;
    if (w.x < 0.0 || w.y < 0.0 || w.x > 1.0 || w.y > 1.0) { break; }
    let d = sampleDepth(w);
    if (d >= 0.9999) { if (i > 6) { hit = w; break; } }
    else if (qz > linearDepth(d) + 0.06) { hit = w; break; }
    s = s * 1.17;
    if (s > 30.0) { break; }
  }
  if (hit.x < 0.0) { return c; }
  let t = texel();
  let size = 1.0 / t;
  let ripple = hash3(i32(floor(uv.x * size.x / 6.0)), i32(floor(uv.y * size.y / 6.0)), i32(floor(fx.uClock * 4.2))) > 0.62;
  var aside = vec2<f32>(0.0);
  if (ripple) { aside = vec2<f32>(t.x, 0.0); }
  let m = sampleColor(hit + aside);
  if (!isGlowing(sampleColor(hit).a)) { return c; }
  return vec4<f32>(stepBy(nearestIndex(m.rgb), ${DROP}), c.a);
}`

/**
 * The world's up as a camera sees it, and the camera's height: what the pass needs to find the ground. `q` is the camera's
 * rotation (x, y, z, w). The camera's local y of a world-up vector is the second row of its rotation matrix.
 */
export function groundOf(
  height: number,
  q: { readonly x: number; readonly y: number; readonly z: number; readonly w: number },
): { readonly up: readonly [number, number, number]; readonly height: number } {
  return {
    up: [2 * (q.x * q.y + q.w * q.z), 1 - 2 * (q.x * q.x + q.z * q.z), 2 * (q.y * q.z - q.w * q.x)],
    height,
  }
}

export class ReflectEffect extends PostEffect {
  protected override readonly fragment: { gpu: string; gl: string } = { gpu: WGSL, gl: GLSL }
  protected override readonly uniforms: UniformGroup

  /** `wet` is how hard it rains, 0 to 1: nothing reflects at 0. */
  constructor(wet: number) {
    super()
    this.uniforms = new UniformGroup({
      uWet: { value: wet, type: 'f32' },
      uHeight: { value: 0, type: 'f32' },
      uUp: { value: new Float32Array([0, 1, 0]), type: 'vec3<f32>' },
      uClock: { value: 0, type: 'f32' },
    })
  }

  /** Reads the camera's height and tilt, each frame, before the frame is drawn. */
  camera(view: View3D): void {
    const { up, height } = groundOf(view.camera.position.y, view.camera.quaternion)
    ;(this.uniforms.uniforms.uUp as Float32Array).set(up)
    this.uniforms.uniforms.uHeight = height
  }

  /** The time, in seconds, the ripples change by. */
  set clock(seconds: number) {
    this.uniforms.uniforms.uClock = seconds
  }

  get wet(): number {
    return this.uniforms.uniforms.uWet as number
  }
}
