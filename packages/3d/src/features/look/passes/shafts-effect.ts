// Light shafts. A spot lamp that shines through dusty air shows its cone: along each pixel's view ray the lamp's light that
// the air scatters is summed (eight samples across the stretch of the ray inside the lamp's reach), and where the sum, with a
// 4×4 ordered dither added, passes a threshold the pixel steps one up its own ramp toward the lamp's colour. A dust mote
// glints now and then where the shaft is thickest. A pixel the sum does not reach is left as it is, and a shaft keeps the
// alpha code of the pixel it lands on.
//
// The lamps are uniforms (at most `MAX_SHAFTS`, in the camera's view space, set each frame by `camera`) so a level's lamps
// can change without the shader being built again. A `PostEffect` in GLSL + WGSL, run after the reflections.

import { PostEffect, type View3D } from '@pixi/3d'
import { UniformGroup } from 'pixi.js'
import { alphaCodeGlsl, alphaCodeWgsl } from '../../../shared/render/alpha/alpha-codes.ts'
import { DUEL_GLSL, DUEL_WGSL, duelGlslVec, duelWgslVec, HASH_GLSL, HASH_WGSL } from './shader-parts.ts'

/** The most lamps whose shafts are drawn: the nearest are kept. */
export const MAX_SHAFTS = 4

/** A mote's colour, snapped to DUEL. */
const MOTE = '#f7f4bf'
/** The farthest a ray is followed, in metres. */
const FAR = 22
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

type V3 = readonly [number, number, number]

/** A spot lamp as the shafts see it, in the world. */
export interface ShaftLamp {
  readonly at: V3
  /** Which way it shines (any length). */
  readonly aim: V3
  /** Degrees across the lamp's cone; the air's is half of it. */
  readonly cone: number
  /** Metres its light reaches. */
  readonly range: number
  /** `0xRRGGBB`. */
  readonly color: number
  /** 0 is off. */
  readonly strength: number
}

const slots = Array.from({ length: MAX_SHAFTS }, (_, i) => i)

const GLSL = `
${HASH_GLSL}
${DUEL_GLSL}
${alphaCodeGlsl()}
const float BAYER[16] = float[16](${BAYER.join('.0, ')}.0);
vec3 viewOf(vec2 uv, float lz) {
  vec2 ndc = uv * 2.0 - 1.0;
  return vec3(ndc.x * lz / uFxClip.z, -ndc.y * lz / uFxClip.w, -lz);
}
float scatter(vec4 P, vec4 A, float strength, vec3 d, float len) {
  float reach = P.w;
  if (strength <= 0.0 || reach <= 0.0) return 0.0;
  float along = dot(P.xyz, d);
  vec3 near = P.xyz - d * clamp(along, 0.0, len);
  float miss = dot(near, near);
  if (miss > reach * reach) return 0.0;
  float chord = sqrt(reach * reach - miss);
  float s0 = max(0.0, along - chord);
  float s1 = min(len, along + chord);
  float st = (s1 - s0) / 8.0;
  if (st <= 0.0) return 0.0;
  float sum = 0.0;
  for (int i = 0; i < 8; i++) {
    vec3 l = P.xyz - d * (s0 + (float(i) + 0.5) * st);
    float d2 = dot(l, l);
    if (d2 >= reach * reach) continue;
    float cosine = -dot(A.xyz, l) / max(sqrt(d2), 1e-6);
    float cone = clamp((cosine - A.w) / (1.0 - A.w) * 3.0, 0.0, 1.0);
    float k = 1.0 - d2 / (reach * reach);
    sum += strength * k * k * cone * st;
  }
  return sum;
}
vec4 effect(vec2 uv) {
  vec4 c = sampleColor(uv);
  if (!isDrawn(c.a)) return c;
  float depth = sampleDepth(uv);
  vec3 d = normalize(viewOf(uv, 1.0));
  float len = depth >= 0.9999 ? ${FAR.toFixed(1)} : min(length(viewOf(uv, linearDepth(depth))), ${FAR.toFixed(1)});
${slots.map((i) => `  float a${i} = scatter(uP${i}, uA${i}, uC${i}.w, d, len);`).join('\n')}
  float sum = ${slots.map((i) => `a${i}`).join(' + ')};
  float best = a0;
  vec3 hue = uC0.rgb;
${slots
  .slice(1)
  .map((i) => `  if (a${i} > best) { best = a${i}; hue = uC${i}.rgb; }`)
  .join('\n')}
  if (best <= 0.0) return c;
  vec2 t = texel();
  ivec2 p = ivec2(floor(uv / t));
  float level = sum * sum * 0.12 + (BAYER[(p.x & 3) + ((p.y & 3) << 2)] / 16.0 - 0.5) * 0.5;
  if (level < 0.5) return c;
  if (level > 0.75 && hash3(p.x, p.y, int(floor(uClock * 6.0))) < 0.012) return vec4(${duelGlslVec(MOTE)}, c.a);
  return vec4(stepBy(nearestIndex(mix(c.rgb, hue, 0.4)), 1), c.a);
}`

const WGSL = `
${HASH_WGSL}
${DUEL_WGSL}
${alphaCodeWgsl()}
var<private> BAYER: array<f32, 16> = array<f32, 16>(${BAYER.join('.0, ')}.0);
fn viewOf(uv: vec2<f32>, lz: f32) -> vec3<f32> {
  let ndc = uv * 2.0 - 1.0;
  return vec3<f32>(ndc.x * lz / fxh.uFxClip.z, -ndc.y * lz / fxh.uFxClip.w, -lz);
}
fn scatter(P: vec4<f32>, A: vec4<f32>, strength: f32, d: vec3<f32>, len: f32) -> f32 {
  let reach = P.w;
  if (strength <= 0.0 || reach <= 0.0) { return 0.0; }
  let along = dot(P.xyz, d);
  let near = P.xyz - d * clamp(along, 0.0, len);
  let miss = dot(near, near);
  if (miss > reach * reach) { return 0.0; }
  let chord = sqrt(reach * reach - miss);
  let s0 = max(0.0, along - chord);
  let s1 = min(len, along + chord);
  let st = (s1 - s0) / 8.0;
  if (st <= 0.0) { return 0.0; }
  var sum = 0.0;
  for (var i = 0; i < 8; i++) {
    let l = P.xyz - d * (s0 + (f32(i) + 0.5) * st);
    let d2 = dot(l, l);
    if (d2 >= reach * reach) { continue; }
    let cosine = -dot(A.xyz, l) / max(sqrt(d2), 1e-6);
    let cone = clamp((cosine - A.w) / (1.0 - A.w) * 3.0, 0.0, 1.0);
    let k = 1.0 - d2 / (reach * reach);
    sum += strength * k * k * cone * st;
  }
  return sum;
}
fn effect(uv: vec2<f32>) -> vec4<f32> {
  let c = sampleColor(uv);
  if (!isDrawn(c.a)) { return c; }
  let depth = sampleDepth(uv);
  let d = normalize(viewOf(uv, 1.0));
  var len = ${FAR.toFixed(1)};
  if (depth < 0.9999) { len = min(length(viewOf(uv, linearDepth(depth))), ${FAR.toFixed(1)}); }
${slots.map((i) => `  let a${i} = scatter(fx.uP${i}, fx.uA${i}, fx.uC${i}.w, d, len);`).join('\n')}
  let sum = ${slots.map((i) => `a${i}`).join(' + ')};
  var best = a0;
  var hue = fx.uC0.rgb;
${slots
  .slice(1)
  .map((i) => `  if (a${i} > best) { best = a${i}; hue = fx.uC${i}.rgb; }`)
  .join('\n')}
  if (best <= 0.0) { return c; }
  let t = texel();
  let p = vec2<i32>(floor(uv / t));
  let level = sum * sum * 0.12 + (BAYER[(p.x & 3) + ((p.y & 3) << 2)] / 16.0 - 0.5) * 0.5;
  if (level < 0.5) { return c; }
  if (level > 0.75 && hash3(p.x, p.y, i32(floor(fx.uClock * 6.0))) < 0.012) { return vec4<f32>(${duelWgslVec(MOTE)}, c.a); }
  return vec4<f32>(stepBy(nearestIndex(mix(c.rgb, hue, 0.4)), 1), c.a);
}`

/** The camera's rotation `q` taken off `v`: a world direction as the camera sees it. */
export function intoView(
  q: { readonly x: number; readonly y: number; readonly z: number; readonly w: number },
  v: V3,
): [number, number, number] {
  // v' = v + w·t + u×t, with u the conjugate's vector part and t = 2 (u × v).
  const ux = -q.x
  const uy = -q.y
  const uz = -q.z
  const tx = 2 * (uy * v[2] - uz * v[1])
  const ty = 2 * (uz * v[0] - ux * v[2])
  const tz = 2 * (ux * v[1] - uy * v[0])
  return [
    v[0] + q.w * tx + (uy * tz - uz * ty),
    v[1] + q.w * ty + (uz * tx - ux * tz),
    v[2] + q.w * tz + (ux * ty - uy * tx),
  ]
}

const rgb = (hex: number): [number, number, number] => [
  ((hex >> 16) & 0xff) / 255,
  ((hex >> 8) & 0xff) / 255,
  (hex & 0xff) / 255,
]

export class ShaftsEffect extends PostEffect {
  protected override readonly fragment: { gpu: string; gl: string } = { gpu: WGSL, gl: GLSL }
  protected override readonly uniforms: UniformGroup
  private spots: readonly ShaftLamp[] = []

  constructor() {
    super()
    const vec4 = (): { value: Float32Array; type: 'vec4<f32>' } => ({
      value: new Float32Array(4),
      type: 'vec4<f32>',
    })
    this.uniforms = new UniformGroup({
      ...Object.fromEntries(
        slots.flatMap((i) => [
          [`uP${i}`, vec4()],
          [`uA${i}`, vec4()],
          [`uC${i}`, vec4()],
        ]),
      ),
      uClock: { value: 0, type: 'f32' },
    })
  }

  /** The spot lamps whose cones are shown, in the world. More than `MAX_SHAFTS` keeps the first. */
  lamps(list: readonly ShaftLamp[]): void {
    this.spots = list.slice(0, MAX_SHAFTS)
  }

  /** How many lamps are shown. */
  get count(): number {
    return this.spots.length
  }

  /** Puts the lamps where the camera sees them, each frame, before the frame is drawn. */
  camera(view: View3D): void {
    const { position: eye, quaternion } = view.camera
    const group = this.uniforms.uniforms as Record<string, Float32Array>
    for (const i of slots) {
      const lamp = this.spots[i]
      const place = group[`uP${i}`] as Float32Array
      const aim = group[`uA${i}`] as Float32Array
      const tint = group[`uC${i}`] as Float32Array
      if (lamp === undefined) {
        place.fill(0)
        aim.fill(0)
        tint.fill(0)
        continue
      }
      const at = intoView(quaternion, [lamp.at[0] - eye.x, lamp.at[1] - eye.y, lamp.at[2] - eye.z])
      const along = Math.hypot(...lamp.aim) || 1
      const to = intoView(quaternion, [lamp.aim[0] / along, lamp.aim[1] / along, lamp.aim[2] / along])
      place.set([...at, lamp.range])
      aim.set([...to, Math.cos((lamp.cone * 0.5 * Math.PI) / 180)])
      tint.set([...rgb(lamp.color), lamp.strength])
    }
  }

  /** The time, in seconds, the motes glint by. */
  set clock(seconds: number) {
    this.uniforms.uniforms.uClock = seconds
  }
}
