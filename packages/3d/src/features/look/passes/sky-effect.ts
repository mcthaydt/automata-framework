// The sky, painted where nothing else is: the time of day's bands from the zenith to the horizon (a two-texel checker where
// they meet), a horizon of silhouette layers standing on it (mountains, hills, a city with lit windows at night, a tree
// line, each a seeded profile round the full circle), drifting clouds by day and fixed stars by night; below the horizon,
// the air at the horizon, darkening toward the viewer. The sky is a direction, not a place: a pixel's yaw and elevation
// come from the camera's aim and the lens, so the sky turns with the camera and never comes nearer.
//
// Every colour it writes is a DUEL colour, and it writes the sky's alpha code, so the passes after it (the glow, the
// reflections) and the finish know it is sky. A `PostEffect` in GLSL + WGSL; it draws only where the scene's depth is the far
// plane. The bands and the horizon are baked into the shader (a pass's uniforms carry no arrays), so a new time of day or a
// new level's horizon is a new pass.

import { PostEffect } from '@pixi/3d'
import { UniformGroup } from 'pixi.js'
import { ALPHA } from '../../../shared/render/alpha/alpha-codes.ts'
import type { TimeOfDay } from '../../../shared/time-of-day/time-of-day.ts'
import {
  DUEL_GLSL,
  DUEL_WGSL,
  duelGlslVec,
  duelTriple,
  duelWgslVec,
  HASH_GLSL,
  HASH_WGSL,
} from './shader-parts.ts'

/** What a horizon layer is a silhouette of. */
export type HorizonKind = 'mountains' | 'hills' | 'city' | 'trees'

/** A horizon layer with its colour resolved: layers are drawn in order, the first the farthest. */
export interface HorizonLayer {
  readonly kind: HorizonKind
  /** `#rrggbb`: the swatch's colour. */
  readonly colour: string
  /** The layer's height, radians of elevation. */
  readonly height: number
  readonly seed?: number | undefined
}

const KINDS: readonly HorizonKind[] = ['mountains', 'hills', 'trees', 'city']
const BRIGHT = '#f5f7fa'
const COOL = '#c6ecff'
const DIM = '#7a7799'
const CLOUD = '#c7d6ff'
const WINDOW = '#ffbc4e'
const HAZE = '#47655a'

const f = (v: number): string => v.toFixed(5)
const vec3 = (c: readonly number[], wgsl: boolean): string =>
  `${wgsl ? 'vec3<f32>' : 'vec3'}(${c.map(f).join(', ')})`

/** The bands and the horizon as constants and a function, for one shading language. */
function baked(time: TimeOfDay, horizon: readonly HorizonLayer[], wgsl: boolean): string {
  const bands = time.scene.sky
  const n = bands.length
  const at = bands.map((b) => f(b.at)).join(', ')
  const colours = bands.map((b) => vec3(duelTriple(b.colour), wgsl)).join(', ')
  const ambient = time.scene.light.ambient.level
  const lit = Math.min(1, 0.3 + ambient * 1.6)
  const haze = vec3(duelTriple(time.scene.haze?.colour ?? HAZE), wgsl)
  const night = time.scene.light.sun === undefined
  const layers = horizon
    .map((layer) => {
      const kind = KINDS.indexOf(layer.kind)
      const seed = layer.seed ?? 1
      const colour = vec3(duelTriple(layer.colour), wgsl)
      return wgsl
        ? `  { let hgt = profile(${kind}, ${f(layer.height)}, ${seed}, a);
    if (elev < hgt) {
      let s = ${colour};
      c = ${lit >= 1 ? 's' : `DUEL[nearestIndex(s * ${f(lit)})]`};
      let row = i32(floor(elev * 160.0));
      if (${kind === 3 && night ? 'true' : 'false'} && (row & 1) == 0 && hash3(i32(floor(yaw * 2.5)), row, ${seed}) < 0.12 && elev < hgt - 0.01) { c = ${duelWgslVec(WINDOW)}; }
    } }`
        : `  { float hgt = profile(${kind}, ${f(layer.height)}, ${seed}, a);
    if (elev < hgt) {
      vec3 s = ${colour};
      c = ${lit >= 1 ? 's' : `DUEL[nearestIndex(s * ${f(lit)})]`};
      int row = int(floor(elev * 160.0));
      if (${kind === 3 && night ? 'true' : 'false'} && (row & 1) == 0 && hash3(int(floor(yaw * 2.5)), row, ${seed}) < 0.12 && elev < hgt - 0.01) c = ${duelGlslVec(WINDOW)};
    } }`
    })
    .join('\n')
  return wgsl
    ? `const BAND_COUNT: i32 = ${n};
var<private> BAND_AT: array<f32, ${n}> = array<f32, ${n}>(${at});
var<private> BAND: array<vec3<f32>, ${n}> = array<vec3<f32>, ${n}>(${colours});
const HAZE_COLOUR = ${haze};
const NIGHT: bool = ${night};
fn horizonLayers(a: f32, yaw: f32, elev: f32, base: vec3<f32>) -> vec3<f32> {
  var c = base;
${layers}
  return c;
}`
    : `const int BAND_COUNT = ${n};
const float BAND_AT[${n}] = float[${n}](${at});
const vec3 BAND[${n}] = vec3[${n}](${colours});
const vec3 HAZE_COLOUR = ${haze};
const bool NIGHT = ${night};
vec3 horizonLayers(float a, float yaw, float elev, vec3 base) {
  vec3 c = base;
${layers}
  return c;
}`
}

const NOISE_GLSL = `
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  int x = int(i.x); int y = int(i.y); int z = int(i.z);
  float a = mix(mix(hash3(x, y, z), hash3(x + 1, y, z), f.x), mix(hash3(x, y + 1, z), hash3(x + 1, y + 1, z), f.x), f.y);
  float b = mix(mix(hash3(x, y, z + 1), hash3(x + 1, y, z + 1), f.x), mix(hash3(x, y + 1, z + 1), hash3(x + 1, y + 1, z + 1), f.x), f.y);
  return mix(a, b, f.z);
}
float ring(float u, float freq, float s, int seed) {
  return vnoise(vec3(cos(u * 6.2831853) * freq + s, sin(u * 6.2831853) * freq + s * 1.7, float(seed) * 3.1));
}
float profile(int kind, float height, int seed, float a) {
  float u = a / 360.0;
  if (kind == 0) {
    float r = abs(ring(u, 2.2, 1.0, seed) - 0.5) * 2.0;
    float q = abs(ring(u, 6.0, 4.0, seed) - 0.5) * 2.0;
    return height * (0.35 + 0.65 * (1.0 - r) * 0.8 + 0.2 * (1.0 - q));
  }
  if (kind == 1) return height * (0.45 + 0.55 * ring(u, 3.0, 2.0, seed));
  if (kind == 2) {
    float b = floor(a / 1.6);
    return height * (0.55 + 0.25 * ring(u, 5.0, 7.0, seed) + 0.2 * sin((a / 1.6 - b) * 3.14159265) * hash3(int(b), seed, 3));
  }
  float b = floor(a / 3.2);
  float r = hash3(int(b), seed, 1);
  float notch = (a / 3.2 - b < 0.3 && hash3(int(b), seed, 2) < 0.4) ? 0.85 : 1.0;
  return height * (r < 0.15 ? 0.15 : 0.3 + r * 0.7) * notch;
}`

const NOISE_WGSL = `
fn vnoise(p: vec3<f32>) -> f32 {
  let i = floor(p);
  var f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  let x = i32(i.x); let y = i32(i.y); let z = i32(i.z);
  let a = mix(mix(hash3(x, y, z), hash3(x + 1, y, z), f.x), mix(hash3(x, y + 1, z), hash3(x + 1, y + 1, z), f.x), f.y);
  let b = mix(mix(hash3(x, y, z + 1), hash3(x + 1, y, z + 1), f.x), mix(hash3(x, y + 1, z + 1), hash3(x + 1, y + 1, z + 1), f.x), f.y);
  return mix(a, b, f.z);
}
fn ring(u: f32, freq: f32, s: f32, seed: i32) -> f32 {
  return vnoise(vec3<f32>(cos(u * 6.2831853) * freq + s, sin(u * 6.2831853) * freq + s * 1.7, f32(seed) * 3.1));
}
fn profile(kind: i32, height: f32, seed: i32, a: f32) -> f32 {
  let u = a / 360.0;
  if (kind == 0) {
    let r = abs(ring(u, 2.2, 1.0, seed) - 0.5) * 2.0;
    let q = abs(ring(u, 6.0, 4.0, seed) - 0.5) * 2.0;
    return height * (0.35 + 0.65 * (1.0 - r) * 0.8 + 0.2 * (1.0 - q));
  }
  if (kind == 1) { return height * (0.45 + 0.55 * ring(u, 3.0, 2.0, seed)); }
  if (kind == 2) {
    let b = floor(a / 1.6);
    return height * (0.55 + 0.25 * ring(u, 5.0, 7.0, seed) + 0.2 * sin((a / 1.6 - b) * 3.14159265) * hash3(i32(b), seed, 3));
  }
  let b = floor(a / 3.2);
  let r = hash3(i32(b), seed, 1);
  var notch = 1.0;
  if (a / 3.2 - b < 0.3 && hash3(i32(b), seed, 2) < 0.4) { notch = 0.85; }
  var rise = 0.3 + r * 0.7;
  if (r < 0.15) { rise = 0.15; }
  return height * rise * notch;
}`

/** The shader for a time of day and a horizon, in GLSL (`gl`) and WGSL (`gpu`). */
function fragments(time: TimeOfDay, horizon: readonly HorizonLayer[]): { gpu: string; gl: string } {
  const code = f(ALPHA.sky)
  const gl = `
${HASH_GLSL}
${DUEL_GLSL}
${NOISE_GLSL}
${baked(time, horizon, false)}
vec4 effect(vec2 uv) {
  vec4 c = sampleColor(uv);
  if (sampleDepth(uv) < 0.9999) return c;
  vec2 ndc = uv * 2.0 - 1.0;
  float yaw = degrees(uAimYaw + atan(ndc.x / uFxClip.z));
  float elev = uAimPitch - atan(ndc.y / uFxClip.w);
  float a = mod(yaw, 360.0);
  int checker = int(floor(yaw * 4.0)) + int(floor(elev * 400.0));
  float top = BAND_AT[BAND_COUNT - 1] > 0.0 ? BAND_AT[BAND_COUNT - 1] : 1.0;
  float s = clamp(1.0 - elev / 0.75, 0.0, 1.0) * top * 1.05;
  int i = 0;
  for (int k = 0; k < BAND_COUNT - 1; k++) { if (s >= BAND_AT[k + 1]) i = k + 1; }
  vec3 col = BAND[i];
  if (i < BAND_COUNT - 1) {
    float e = BAND_AT[i + 1] - s;
    if (e > 0.0 && e < 0.012 && (checker & 1) == 0) col = BAND[i + 1];
  }
  if (uStars > 0.0 && elev > 0.06) {
    int sx = int(floor(yaw * 3.0));
    int sy = int(floor(elev * 180.0));
    float r = hash3(sx, sy, 77);
    if (r < uStars * 1.2) {
      col = hash3(sx, sy, int(floor(uClock * 3.0))) < 0.15 ? ${duelGlslVec(DIM)}
        : r < uStars * 0.3 ? ${duelGlslVec(BRIGHT)} : ${duelGlslVec(COOL)};
    }
  }
  if (!NIGHT && elev > 0.08 && elev < 0.6) {
    float drift = yaw + uClock * 0.6;
    float q = vnoise(vec3(drift / 22.0, elev * 9.0, 4.0)) * 0.7 + vnoise(vec3(drift / 9.0, elev * 22.0, 9.0)) * 0.3;
    float edge = 0.6 + (elev - 0.3) * 0.3;
    if (q > edge) col = (q > edge + 0.06 && vnoise(vec3(drift / 9.0, elev * 22.0 + 0.4, 9.0)) > 0.45) ? ${duelGlslVec(BRIGHT)} : ${duelGlslVec(CLOUD)};
  }
  if (elev < 0.0) {
    float k = 1.0 - 0.5 * min(1.0, -elev / 0.25) + ((checker & 1) != 0 ? 0.02 : -0.02);
    return vec4(DUEL[nearestIndex(HAZE_COLOUR * k)], ${code});
  }
  col = horizonLayers(a, yaw, elev, col);
  return vec4(col, ${code});
}`
  const gpu = `
${HASH_WGSL}
${DUEL_WGSL}
${NOISE_WGSL}
${baked(time, horizon, true)}
fn effect(uv: vec2<f32>) -> vec4<f32> {
  let c = sampleColor(uv);
  if (sampleDepth(uv) < 0.9999) { return c; }
  let ndc = uv * 2.0 - 1.0;
  let yaw = degrees(fx.uAimYaw + atan(ndc.x / fxh.uFxClip.z));
  let elev = fx.uAimPitch - atan(ndc.y / fxh.uFxClip.w);
  let a = yaw - 360.0 * floor(yaw / 360.0);
  let checker = i32(floor(yaw * 4.0)) + i32(floor(elev * 400.0));
  var top = BAND_AT[BAND_COUNT - 1];
  if (top <= 0.0) { top = 1.0; }
  let s = clamp(1.0 - elev / 0.75, 0.0, 1.0) * top * 1.05;
  var i = 0;
  for (var k = 0; k < BAND_COUNT - 1; k++) { if (s >= BAND_AT[k + 1]) { i = k + 1; } }
  var col = BAND[i];
  if (i < BAND_COUNT - 1) {
    let e = BAND_AT[i + 1] - s;
    if (e > 0.0 && e < 0.012 && (checker & 1) == 0) { col = BAND[i + 1]; }
  }
  if (fx.uStars > 0.0 && elev > 0.06) {
    let sx = i32(floor(yaw * 3.0));
    let sy = i32(floor(elev * 180.0));
    let r = hash3(sx, sy, 77);
    if (r < fx.uStars * 1.2) {
      col = ${duelWgslVec(COOL)};
      if (r < fx.uStars * 0.3) { col = ${duelWgslVec(BRIGHT)}; }
      if (hash3(sx, sy, i32(floor(fx.uClock * 3.0))) < 0.15) { col = ${duelWgslVec(DIM)}; }
    }
  }
  if (!NIGHT && elev > 0.08 && elev < 0.6) {
    let drift = yaw + fx.uClock * 0.6;
    let q = vnoise(vec3<f32>(drift / 22.0, elev * 9.0, 4.0)) * 0.7 + vnoise(vec3<f32>(drift / 9.0, elev * 22.0, 9.0)) * 0.3;
    let edge = 0.6 + (elev - 0.3) * 0.3;
    if (q > edge) {
      col = ${duelWgslVec(CLOUD)};
      if (q > edge + 0.06 && vnoise(vec3<f32>(drift / 9.0, elev * 22.0 + 0.4, 9.0)) > 0.45) { col = ${duelWgslVec(BRIGHT)}; }
    }
  }
  if (elev < 0.0) {
    var k = 1.0 - 0.5 * min(1.0, -elev / 0.25) - 0.02;
    if ((checker & 1) != 0) { k = k + 0.04; }
    return vec4<f32>(DUEL[nearestIndex(HAZE_COLOUR * k)], ${code});
  }
  col = horizonLayers(a, yaw, elev, col);
  return vec4<f32>(col, ${code});
}`
  return { gpu, gl }
}

export class SkyEffect extends PostEffect {
  protected override readonly fragment: { gpu: string; gl: string }
  protected override readonly uniforms: UniformGroup

  /** The sky of `time`, with the level's horizon (layers in order, the farthest first). */
  constructor(time: TimeOfDay, horizon: readonly HorizonLayer[] = []) {
    super()
    this.fragment = fragments(time, horizon)
    this.uniforms = new UniformGroup({
      uStars: { value: time.scene.stars ?? 0, type: 'f32' },
      uAimYaw: { value: 0, type: 'f32' },
      uAimPitch: { value: 0, type: 'f32' },
      uClock: { value: 0, type: 'f32' },
    })
  }

  /**
   * Where the camera looks, in radians: the bearing to the right of the heading's zero (it grows as the camera turns to the
   * right, so a turn to the right moves the sky left) and the pitch (up is positive). The sky holds its place as the camera
   * turns; with no aim it holds to the screen.
   */
  aim(yaw: number, pitch: number): void {
    this.uniforms.uniforms.uAimYaw = yaw
    this.uniforms.uniforms.uAimPitch = pitch
  }

  /** The time, in seconds, the clouds drift and the stars blink by. */
  set clock(seconds: number) {
    this.uniforms.uniforms.uClock = seconds
  }

  /** How thick the stars are, 0 to 1. */
  get stars(): number {
    return this.uniforms.uniforms.uStars as number
  }
}
