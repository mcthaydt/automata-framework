// Wet-ground reflections, as the source look has them: a ground pixel mirrors the frame about the ground
// plane. Its reflected view ray is marched through the depth buffer, steps growing, until it passes behind what was drawn
// (or runs out into the sky), and the pixel takes the colour it met, a step down its own ramp: one in a puddle, where
// everything reflects, two on wet ground between puddles, where only what glows does. Whole steps, never a blur, so every
// pixel stays a DUEL colour. A `PostEffect` in GLSL + WGSL, run after the snap.
//
// Where the puddles are is a slow value noise over the ground's own x and z (`puddles` is the noise below which ground is
// puddle: 1 makes all of it one). The pass works in view space, so `track` is told the camera once and follows it from then on.

import { UniformGroup } from 'pixi.js'
import { TrackingEffect } from './camera-track.ts'
import { DUEL_GLSL, DUEL_WGSL, HASH_GLSL, HASH_WGSL, SURFACE_GLSL, SURFACE_WGSL } from './shader-parts.ts'

/** Steps down the reflected colour's ramp: in a puddle, and on wet ground. */
export const PUDDLE_STEP = -1
export const WET_STEP = -2

/** How far a pixel's own height may stray from the ground plane and still be ground (metres). */
const ON_GROUND = '0.04'
/** The reflected ray's march: 40 steps, the first 0.06 m long and each 1.17 times the last, to 30 m. */
const STEPS = 40

const GLSL = `
${DUEL_GLSL}
${HASH_GLSL}
${SURFACE_GLSL}
float corner(vec2 i) { return hash3(int(i.x), int(i.y), 7); }
float puddleNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(corner(i), corner(i + vec2(1.0, 0.0)), f.x), mix(corner(i + vec2(0.0, 1.0)), corner(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec4 effect(vec2 uv) {
  vec4 c = sampleColor(uv);
  if (c.a < 0.5 || sampleDepth(uv) >= 0.9999) return c;
  vec3 P = surfacePos(uv);
  if (abs(dot(uPlane.xyz, P) + uPlane.w) > ${ON_GROUND}) return c;
  vec3 v = uOrtho > 0.5 ? vec3(0.0, 0.0, -1.0) : normalize(P);
  vec3 r = v - 2.0 * dot(v, uPlane.xyz) * uPlane.xyz;
  vec2 world = (uWorld * vec4(P, 1.0)).xz;
  bool puddle = uPuddles >= 1.0 || puddleNoise(vec2(world.x * 0.55, world.y * 0.9)) < uPuddles;
  float s = 0.06;
  for (int i = 0; i < ${STEPS}; i++) {
    if (s >= 30.0) break;
    vec3 Q = P + r * s;
    float zq = -Q.z;
    if (uOrtho < 0.5 && zq <= 0.01) break;
    float w = uOrtho > 0.5 ? 1.0 : zq;
    vec2 at = vec2(Q.x * uFxClip.z / w * 0.5 + 0.5, 0.5 - Q.y * uFxClip.w / w * 0.5);
    if (at.x < 0.0 || at.y < 0.0 || at.x > 1.0 || at.y > 1.0) break;
    float d = sampleDepth(at);
    bool sky = d >= 0.9999;
    if ((sky && i > 6) || (!sky && zq > surfaceDepth(d) + 0.06)) {
      vec3 seen = sampleColor(at).rgb;
      if (!puddle && dot(seen, vec3(0.2126, 0.7152, 0.0722)) < uGlow) return c;
      int index = nearestIndex(seen);
      int row = index / 8;
      int level = clamp(index - row * 8 + (puddle ? ${PUDDLE_STEP} : ${WET_STEP}), 1, 7);
      return vec4(DUEL[row * 8 + level], c.a);
    }
    s *= 1.17;
  }
  return c;
}`

const WGSL = `
${DUEL_WGSL}
${HASH_WGSL}
${SURFACE_WGSL}
fn corner(i: vec2<f32>) -> f32 { return hash3(i32(i.x), i32(i.y), 7); }
fn puddleNoise(p: vec2<f32>) -> f32 {
  let i = floor(p);
  var f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(corner(i), corner(i + vec2<f32>(1.0, 0.0)), f.x), mix(corner(i + vec2<f32>(0.0, 1.0)), corner(i + vec2<f32>(1.0, 1.0)), f.x), f.y);
}
fn effect(uv: vec2<f32>) -> vec4<f32> {
  let c = sampleColor(uv);
  if (c.a < 0.5 || sampleDepth(uv) >= 0.9999) { return c; }
  let P = surfacePos(uv);
  if (abs(dot(fx.uPlane.xyz, P) + fx.uPlane.w) > ${ON_GROUND}) { return c; }
  var v = vec3<f32>(0.0, 0.0, -1.0);
  if (fx.uOrtho < 0.5) { v = normalize(P); }
  let r = v - 2.0 * dot(v, fx.uPlane.xyz) * fx.uPlane.xyz;
  let world = (fx.uWorld * vec4<f32>(P, 1.0)).xz;
  let puddle = fx.uPuddles >= 1.0 || puddleNoise(vec2<f32>(world.x * 0.55, world.y * 0.9)) < fx.uPuddles;
  var s = 0.06;
  for (var i = 0; i < ${STEPS}; i++) {
    if (s >= 30.0) { break; }
    let Q = P + r * s;
    let zq = -Q.z;
    if (fx.uOrtho < 0.5 && zq <= 0.01) { break; }
    var w = zq;
    if (fx.uOrtho > 0.5) { w = 1.0; }
    let at = vec2<f32>(Q.x * fxh.uFxClip.z / w * 0.5 + 0.5, 0.5 - Q.y * fxh.uFxClip.w / w * 0.5);
    if (at.x < 0.0 || at.y < 0.0 || at.x > 1.0 || at.y > 1.0) { break; }
    let d = sampleDepth(at);
    let sky = d >= 0.9999;
    if ((sky && i > 6) || (!sky && zq > surfaceDepth(d) + 0.06)) {
      let seen = sampleColor(at).rgb;
      if (!puddle && dot(seen, vec3<f32>(0.2126, 0.7152, 0.0722)) < fx.uGlow) { return c; }
      let index = nearestIndex(seen);
      let row = index / 8;
      var by = ${WET_STEP};
      if (puddle) { by = ${PUDDLE_STEP}; }
      let level = clamp(index - row * 8 + by, 1, 7);
      return vec4<f32>(DUEL[row * 8 + level], c.a);
    }
    s *= 1.17;
  }
  return c;
}`

export interface ReflectOptions {
  /** The height of the wet ground in the world (default 0). */
  readonly ground?: number
  /** The slow noise below which the ground is puddle (default 0.35); 1 is all puddle, 0 is wet ground only. */
  readonly puddles?: number
  /** The luma, 0 to 1, from which a reflected colour glows, for the wet ground between puddles (default 0.85). */
  readonly glow?: number
}

export class ReflectEffect extends TrackingEffect {
  protected override readonly fragment = { gpu: WGSL, gl: GLSL }
  protected override readonly uniforms: UniformGroup
  private ground: number
  private view: ArrayLike<number> = TrackingEffect.NO_VIEW

  constructor(options: ReflectOptions = {}) {
    // Works on the picture as shown, so it runs after tone mapping (@pixi/3d beta.3 stages a post effect before it by default).
    super({ stage: 'afterToneMapping' })
    this.ground = options.ground ?? 0
    this.uniforms = new UniformGroup({
      uOrtho: { value: 0, type: 'f32' },
      uPuddles: { value: options.puddles ?? 0.35, type: 'f32' },
      uGlow: { value: options.glow ?? 0.85, type: 'f32' },
      uPlane: { value: new Float32Array(4), type: 'vec4<f32>' },
      uWorld: { value: new Float32Array(16), type: 'mat4x4<f32>' },
    })
    this.write()
  }

  /** The height of the wet ground in the world. */
  setGround(y: number): void {
    this.ground = y
    this.write()
  }

  /** The noise below which the ground is puddle: 1 is all puddle, 0 is wet ground only. */
  setPuddles(share: number): void {
    this.uniforms.uniforms.uPuddles = share
  }

  protected override viewChanged(view: ArrayLike<number>, ortho: boolean): void {
    this.view = view
    this.uniforms.uniforms.uOrtho = ortho ? 1 : 0
    this.write()
  }

  private write(): void {
    const m = this.view
    const at = (i: number): number => m[i] ?? 0
    const plane = this.uniforms.uniforms.uPlane as Float32Array
    // The plane's normal in view space is the world's up turned by the view; its offset puts a point of the plane at 0.
    const [nx, ny, nz] = [at(4), at(5), at(6)]
    const [px, py, pz] = [
      at(4) * this.ground + at(12),
      at(5) * this.ground + at(13),
      at(6) * this.ground + at(14),
    ]
    plane[0] = nx
    plane[1] = ny
    plane[2] = nz
    plane[3] = -(nx * px + ny * py + nz * pz)
    // View to world: the view is a turn and a shift, so its inverse is the turn's transpose and the shift turned back.
    const world = this.uniforms.uniforms.uWorld as Float32Array
    for (let j = 0; j < 3; j++) {
      world[j * 4] = at(j)
      world[j * 4 + 1] = at(4 + j)
      world[j * 4 + 2] = at(8 + j)
      world[12 + j] = -(at(j * 4) * at(12) + at(j * 4 + 1) * at(13) + at(j * 4 + 2) * at(14))
    }
    world[15] = 1
    this.uniforms.update()
  }
}
