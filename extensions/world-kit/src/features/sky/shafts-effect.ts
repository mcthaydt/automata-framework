// Light shafts, as the source look has them (post.ts shafts): in the cones of the lamps that aim and throw a shaft (street
// lamps, spots), the air catches light. Along each pixel's view ray the lamps' in-scatter is summed (the lamp's falloff
// and its cone, sampled eight times across the stretch of the ray inside the lamp's reach); where the sum passes a 4 × 4
// ordered threshold the pixel steps up its own ramp toward the lamp's colour, and in the thickest part dust glints. Whole
// steps and a fixed dither, never a blur, so every pixel stays a DUEL colour. A pixel nothing was drawn in (the sky) is
// left alone. A `PostEffect` in GLSL + WGSL, run after the snap.
//
// The lamps are in the world; the pass works in view space, so `track` is told the camera whenever it moves (once, for a
// camera that stays).

import type { WorldLamp } from '@automata/3d'
import { PostEffect } from '@pixi/3d'
import { UniformGroup } from 'pixi.js'
import { DUEL_GLSL, DUEL_WGSL, HASH_GLSL, HASH_WGSL, OKLAB_GLSL, OKLAB_WGSL } from './shader-parts.ts'

/** The most lamps the pass takes: each is a slot of uniforms of its own (an array's size is not carried to the shader). */
export const MAX_SHAFTS = 4

/** A spot lamp that throws a shaft: where it is, which way it points and how wide (the cone's half angle, degrees), its reach, colour and level. */
export interface ShaftLamp {
  readonly at: readonly [number, number, number]
  readonly aim: readonly [number, number, number]
  readonly cone: number
  readonly range: number
  /** `0xRRGGBB`. */
  readonly colour: number
  /** 0 is out, 1 full. */
  readonly level: number
}

/** The lamps of a world that throw a shaft: the ones that aim, with a cone, and say they shaft (a street lamp). */
export function shaftLamps(lamps: readonly WorldLamp[]): ShaftLamp[] {
  return lamps.flatMap((lamp) =>
    lamp.shaft === true && lamp.aim !== undefined && lamp.cone !== undefined
      ? [
          {
            at: [lamp.at[0], lamp.at[1], lamp.at[2]] as const,
            aim: [lamp.aim[0], lamp.aim[1], lamp.aim[2]] as const,
            cone: lamp.cone,
            range: lamp.range,
            colour: lamp.color,
            level: lamp.level,
          },
        ]
      : [],
  )
}

/** The part of a camera the pass reads: its world-to-view matrix (column by column) and whether it is orthographic. */
export interface TrackedCamera {
  readonly mode?: string | undefined
  readonly view: { readonly elements: ArrayLike<number> }
}

const SLOTS = Array.from({ length: MAX_SHAFTS }, (_, i) => i)
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const MOTE = '0.0120'

const GLSL = `
${DUEL_GLSL}
${OKLAB_GLSL}
${HASH_GLSL}
const float BAYER[16] = float[16](${BAYER.join('.0, ')}.0);
// One lamp's in-scatter along a ray: eight samples across the stretch of it inside the lamp's reach.
float scatter(vec4 P, vec4 A, float strength, vec3 o, vec3 d, float rayLen) {
  if (strength <= 0.0) return 0.0;
  vec3 oc = P.xyz - o;
  float along = dot(oc, d);
  float reach2 = P.w * P.w;
  vec3 cc = oc - d * clamp(along, 0.0, rayLen);
  float d2 = dot(cc, cc);
  if (d2 > reach2) return 0.0;
  float half2 = sqrt(reach2 - d2);
  float s0 = max(0.0, along - half2);
  float s1 = min(rayLen, along + half2);
  float st = (s1 - s0) / 8.0;
  if (st <= 0.0) return 0.0;
  float sum = 0.0;
  for (int i = 0; i < 8; i++) {
    vec3 l = P.xyz - (o + d * (s0 + (float(i) + 0.5) * st));
    float dd2 = dot(l, l);
    if (dd2 >= reach2) continue;
    float k = 1.0 - dd2 / reach2;
    float c = -dot(A.xyz, l) / sqrt(dd2);
    float cone = clamp((c - A.w) / (1.0 - A.w) * 3.0, 0.0, 1.0);
    sum += strength * k * k * cone * st;
  }
  return sum;
}
vec4 effect(vec2 uv) {
  vec4 c = sampleColor(uv);
  if (c.a < 0.5 || sampleDepth(uv) >= 0.9999) return c;
  vec3 P = viewPos(uv);
  vec3 o = vec3(0.0);
  vec3 d = vec3(0.0, 0.0, -1.0);
  float rayLen = -P.z;
  if (uOrtho > 0.5) { o = vec3(P.xy, 0.0); } else { rayLen = length(P); d = P / rayLen; }
  rayLen = min(rayLen, 22.0);
  float sum = 0.0;
  float best = 0.0;
  vec3 top = vec3(0.0);
  float a;
${SLOTS.map((i) => `  a = scatter(uP${i}, uA${i}, uC${i}.w, o, d, rayLen); sum += a; if (a > best) { best = a; top = uC${i}.rgb; }`).join('\n')}
  vec2 p = floor(uv / texel());
  float level = sum * sum * 0.12 + (BAYER[int(mod(p.x, 4.0)) + int(mod(p.y, 4.0)) * 4] / 16.0 - 0.5) * 0.5;
  if (level < 0.5 || best <= 0.0) return c;
  vec3 lit = stepUp(nearestIndex(toward(c.rgb, top, 0.4)));
  if (uMotes > 0.5 && level > 0.75 && hash3(int(p.x), int(p.y), int(floor(uClock * 6.0))) < ${MOTE}) lit = vec3(0.9686, 0.9569, 0.7490);
  return vec4(lit, c.a);
}`

const WGSL = `
${DUEL_WGSL}
${OKLAB_WGSL}
${HASH_WGSL}
var<private> BAYER: array<f32, 16> = array<f32, 16>(${BAYER.join('.0, ')}.0);
fn scatter(P: vec4<f32>, A: vec4<f32>, strength: f32, o: vec3<f32>, d: vec3<f32>, rayLen: f32) -> f32 {
  if (strength <= 0.0) { return 0.0; }
  let oc = P.xyz - o;
  let along = dot(oc, d);
  let reach2 = P.w * P.w;
  let cc = oc - d * clamp(along, 0.0, rayLen);
  let d2 = dot(cc, cc);
  if (d2 > reach2) { return 0.0; }
  let half2 = sqrt(reach2 - d2);
  let s0 = max(0.0, along - half2);
  let s1 = min(rayLen, along + half2);
  let st = (s1 - s0) / 8.0;
  if (st <= 0.0) { return 0.0; }
  var sum = 0.0;
  for (var i = 0; i < 8; i++) {
    let l = P.xyz - (o + d * (s0 + (f32(i) + 0.5) * st));
    let dd2 = dot(l, l);
    if (dd2 >= reach2) { continue; }
    let k = 1.0 - dd2 / reach2;
    let c = -dot(A.xyz, l) / sqrt(dd2);
    let cone = clamp((c - A.w) / (1.0 - A.w) * 3.0, 0.0, 1.0);
    sum += strength * k * k * cone * st;
  }
  return sum;
}
fn effect(uv: vec2<f32>) -> vec4<f32> {
  let c = sampleColor(uv);
  if (c.a < 0.5 || sampleDepth(uv) >= 0.9999) { return c; }
  let P = viewPos(uv);
  var o = vec3<f32>(0.0);
  var d = vec3<f32>(0.0, 0.0, -1.0);
  var rayLen = -P.z;
  if (fx.uOrtho > 0.5) { o = vec3<f32>(P.xy, 0.0); } else { rayLen = length(P); d = P / rayLen; }
  rayLen = min(rayLen, 22.0);
  var sum = 0.0;
  var best = 0.0;
  var top = vec3<f32>(0.0);
  var a = 0.0;
${SLOTS.map((i) => `  a = scatter(fx.uP${i}, fx.uA${i}, fx.uC${i}.w, o, d, rayLen); sum += a; if (a > best) { best = a; top = fx.uC${i}.rgb; }`).join('\n')}
  let p = floor(uv / texel());
  let level = sum * sum * 0.12 + (BAYER[i32(p.x % 4.0) + i32(p.y % 4.0) * 4] / 16.0 - 0.5) * 0.5;
  if (level < 0.5 || best <= 0.0) { return c; }
  var lit = stepUp(nearestIndex(toward(c.rgb, top, 0.4)));
  if (fx.uMotes > 0.5 && level > 0.75 && hash3(i32(p.x), i32(p.y), i32(floor(fx.uClock * 6.0))) < ${MOTE}) { lit = vec3<f32>(0.9686, 0.9569, 0.7490); }
  return vec4<f32>(lit, c.a);
}`

export interface ShaftsOptions {
  /** Dust glints in the thickest of the light (default on). */
  readonly motes?: boolean
}

export class ShaftsEffect extends PostEffect {
  protected override readonly fragment = { gpu: WGSL, gl: GLSL }
  protected override readonly uniforms: UniformGroup
  private lamps: readonly ShaftLamp[] = []
  private levels: number[] = []
  private view: ArrayLike<number> = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

  constructor(lamps: readonly ShaftLamp[] = [], options: ShaftsOptions = {}) {
    super()
    this.uniforms = new UniformGroup({
      uOrtho: { value: 0, type: 'f32' },
      uMotes: { value: options.motes === false ? 0 : 1, type: 'f32' },
      uClock: { value: 0, type: 'f32' },
      ...Object.fromEntries(
        SLOTS.flatMap((i) => [
          [`uP${i}`, { value: new Float32Array(4), type: 'vec4<f32>' as const }],
          [`uA${i}`, { value: new Float32Array(4), type: 'vec4<f32>' as const }],
          [`uC${i}`, { value: new Float32Array(4), type: 'vec4<f32>' as const }],
        ]),
      ),
    })
    this.setLamps(lamps)
  }

  /** The seconds the dust's glints move by. */
  set clock(seconds: number) {
    this.uniforms.uniforms.uClock = seconds
  }

  /** The lamps that throw shafts (at most `MAX_SHAFTS`; the rest are left out), in the world. */
  setLamps(lamps: readonly ShaftLamp[]): void {
    this.lamps = lamps.slice(0, MAX_SHAFTS)
    this.levels = this.lamps.map((lamp) => lamp.level)
    this.write()
  }

  /** A lamp's level now (0 out, 1 full), by its place in `setLamps`: a flicker, a switch. */
  setLevel(index: number, level: number): void {
    if (index < 0 || index >= this.lamps.length) return
    this.levels[index] = level
    this.write()
  }

  /** The camera the lamps are seen from: call it whenever the camera moves (once, for one that stays). */
  track(camera: TrackedCamera): void {
    this.view = Float32Array.from(camera.view.elements)
    this.uniforms.uniforms.uOrtho = camera.mode === 'orthographic' ? 1 : 0
    this.write()
  }

  private write(): void {
    const m = this.view
    const at = (i: number): number => m[i] ?? 0
    for (const i of SLOTS) {
      const position = this.uniforms.uniforms[`uP${i}`] as Float32Array
      const aim = this.uniforms.uniforms[`uA${i}`] as Float32Array
      const colour = this.uniforms.uniforms[`uC${i}`] as Float32Array
      const lamp = this.lamps[i]
      if (lamp === undefined) {
        colour[3] = 0
        continue
      }
      const [x, y, z] = lamp.at
      position[0] = at(0) * x + at(4) * y + at(8) * z + at(12)
      position[1] = at(1) * x + at(5) * y + at(9) * z + at(13)
      position[2] = at(2) * x + at(6) * y + at(10) * z + at(14)
      position[3] = lamp.range
      const [ax, ay, az] = lamp.aim
      const length = Math.hypot(ax, ay, az) || 1
      aim[0] = (at(0) * ax + at(4) * ay + at(8) * az) / length
      aim[1] = (at(1) * ax + at(5) * ay + at(9) * az) / length
      aim[2] = (at(2) * ax + at(6) * ay + at(10) * az) / length
      // The air's cone is half the lamp's.
      aim[3] = Math.cos((lamp.cone * 0.5 * Math.PI) / 180)
      colour[0] = ((lamp.colour >> 16) & 255) / 255
      colour[1] = ((lamp.colour >> 8) & 255) / 255
      colour[2] = (lamp.colour & 255) / 255
      colour[3] = this.levels[i] ?? 0
    }
    this.uniforms.update()
  }
}
