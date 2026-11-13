// The sky: a panorama indexed by the view's yaw and elevation, so it turns with the camera and never comes nearer. It is
// generated, not painted: the time of day's bands (a two-texel checker where they meet), drifting clouds by day, a horizon
// of silhouette layers (mountains, hills, a city with lit windows at night, a tree line; each a seeded profile round the
// full 360 degrees) standing on it, and below the horizon the haze. Stars are the world kit's pass, drawn over it.
//
// A `PostEffect` in GLSL + WGSL, drawn only where the scene's depth is the far plane (no mesh), so it replaces the flat
// background. Add it first in the view's passes: the haze and the snap come after and treat it like any other colour.

import { type EffectFragment, PostEffect } from '@pixi/3d'
import { UniformGroup } from 'pixi.js'
import type { TimeOfDay } from '../../shared/time-of-day/time-of-day.ts'
import { hazeAt } from './haze.ts'
import { DEFAULT_LOOK } from './look.ts'

/** One silhouette layer of the horizon, its colour already resolved from the level's swatch. */
export interface HorizonLayer {
  readonly kind: 'mountains' | 'hills' | 'city' | 'trees'
  readonly colour: string
  /** Its tallest, in radians of elevation. */
  readonly height: number
  readonly seed?: number | undefined
}

// --- the same value noise and hash the shader uses, for the profile's test and for anything that wants the height ---

const lattice = (x: number, y: number, z: number): number => {
  let n = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(z, 0x9e3779b1)
  n = Math.imul(n ^ (n >>> 15), 0x85ebca6b)
  n ^= n >>> 13
  return (n >>> 0) / 4294967296
}

/** Smooth 3D value noise in [0, 1). */
function noise3(x: number, y: number, z: number): number {
  const [x0, y0, z0] = [Math.floor(x), Math.floor(y), Math.floor(z)]
  const [fx, fy, fz] = [x - x0, y - y0, z - z0]
  const [u, v, w] = [fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy), fz * fz * (3 - 2 * fz)]
  const at = (i: number, j: number, k: number): number => lattice(x0 + i, y0 + j, z0 + k)
  const x00 = at(0, 0, 0) + (at(1, 0, 0) - at(0, 0, 0)) * u
  const x10 = at(0, 1, 0) + (at(1, 1, 0) - at(0, 1, 0)) * u
  const x01 = at(0, 0, 1) + (at(1, 0, 1) - at(0, 0, 1)) * u
  const x11 = at(0, 1, 1) + (at(1, 1, 1) - at(0, 1, 1)) * u
  const y0v = x00 + (x10 - x00) * v
  const y1v = x01 + (x11 - x01) * v
  return y0v + (y1v - y0v) * w
}

/** A layer's height (radians of elevation) at a yaw (degrees). The shader computes the same. */
export function horizonProfile(
  kind: HorizonLayer['kind'],
  height: number,
  seed: number,
  yaw: number,
): number {
  const a = ((yaw % 360) + 360) % 360
  const u = a / 360
  // Seamless round the circle: noise on a ring.
  const ring = (freq: number, s: number): number =>
    noise3(Math.cos(u * 2 * Math.PI) * freq + s, Math.sin(u * 2 * Math.PI) * freq + s * 1.7, seed * 3.1)
  if (kind === 'mountains') {
    const r = Math.abs(ring(2.2, 1) - 0.5) * 2
    const q = Math.abs(ring(6, 4) - 0.5) * 2
    return height * (0.35 + 0.65 * (1 - r) * 0.8 + 0.2 * (1 - q))
  }
  if (kind === 'hills') return height * (0.45 + 0.55 * ring(3, 2))
  if (kind === 'trees') {
    const b = Math.floor(a / 1.6)
    return height * (0.55 + 0.25 * ring(5, 7) + 0.2 * Math.sin((a / 1.6 - b) * Math.PI) * lattice(b, seed, 3))
  }
  // A city: blocks a few degrees wide, of seeded heights, some with a step.
  const b = Math.floor(a / 3.2)
  const r = lattice(b, seed, 1)
  return (
    height * (r < 0.15 ? 0.15 : 0.3 + r * 0.7) * (a / 3.2 - b < 0.3 && lattice(b, seed, 2) < 0.4 ? 0.85 : 1)
  )
}

// --- the shaders ---

const f = (v: number): string => v.toFixed(4)
const rgb = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
const glslVec = (hex: string): string => `vec3(${rgb(hex).map(f).join(', ')})`
const wgslVec = (hex: string): string => `vec3<f32>(${rgb(hex).map(f).join(', ')})`

const GLSL_LIB = `
float hash3(int a, int b, int c) {
  uint n = uint(a) * 0x27d4eb2du ^ uint(b) * 0x165667b1u ^ uint(c) * 0x9e3779b1u;
  n = (n ^ (n >> 15u)) * 0x85ebca6bu;
  n = n ^ (n >> 13u);
  return float(n) / 4294967296.0;
}
float noise3(float x, float y, float z) {
  float x0 = floor(x); float y0 = floor(y); float z0 = floor(z);
  float fx = x - x0; float fy = y - y0; float fz = z - z0;
  float u = fx * fx * (3.0 - 2.0 * fx); float v = fy * fy * (3.0 - 2.0 * fy); float w = fz * fz * (3.0 - 2.0 * fz);
  int xi = int(x0); int yi = int(y0); int zi = int(z0);
  float x00 = mix(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u);
  float x10 = mix(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u);
  float x01 = mix(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u);
  float x11 = mix(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u);
  return mix(mix(x00, x10, v), mix(x01, x11, v), w);
}
float ring(float u, float freq, float s, float seed) {
  float a = u * 6.28318530718;
  return noise3(cos(a) * freq + s, sin(a) * freq + s * 1.7, seed * 3.1);
}
float profileMountains(float yaw, float h, float seed) {
  float u = mod(yaw, 360.0) / 360.0;
  float r = abs(ring(u, 2.2, 1.0, seed) - 0.5) * 2.0;
  float q = abs(ring(u, 6.0, 4.0, seed) - 0.5) * 2.0;
  return h * (0.35 + 0.65 * (1.0 - r) * 0.8 + 0.2 * (1.0 - q));
}
float profileHills(float yaw, float h, float seed) {
  return h * (0.45 + 0.55 * ring(mod(yaw, 360.0) / 360.0, 3.0, 2.0, seed));
}
float profileTrees(float yaw, float h, float seed) {
  float a = mod(yaw, 360.0);
  float b = floor(a / 1.6);
  return h * (0.55 + 0.25 * ring(a / 360.0, 5.0, 7.0, seed) + 0.2 * sin((a / 1.6 - b) * 3.14159265359) * hash3(int(b), int(seed), 3));
}
float profileCity(float yaw, float h, float seed) {
  float a = mod(yaw, 360.0);
  float b = floor(a / 3.2);
  float r = hash3(int(b), int(seed), 1);
  float stepK = ((a / 3.2 - b) < 0.3 && hash3(int(b), int(seed), 2) < 0.4) ? 0.85 : 1.0;
  return h * (r < 0.15 ? 0.15 : 0.3 + r * 0.7) * stepK;
}`

const WGSL_LIB = `
fn hash3(a: i32, b: i32, c: i32) -> f32 {
  var n = (u32(a) * 0x27d4eb2du) ^ (u32(b) * 0x165667b1u) ^ (u32(c) * 0x9e3779b1u);
  n = (n ^ (n >> 15u)) * 0x85ebca6bu;
  n = n ^ (n >> 13u);
  return f32(n) / 4294967296.0;
}
fn noise3(x: f32, y: f32, z: f32) -> f32 {
  let x0 = floor(x); let y0 = floor(y); let z0 = floor(z);
  let fx = x - x0; let fy = y - y0; let fz = z - z0;
  let u = fx * fx * (3.0 - 2.0 * fx); let v = fy * fy * (3.0 - 2.0 * fy); let w = fz * fz * (3.0 - 2.0 * fz);
  let xi = i32(x0); let yi = i32(y0); let zi = i32(z0);
  let x00 = mix(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u);
  let x10 = mix(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u);
  let x01 = mix(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u);
  let x11 = mix(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u);
  return mix(mix(x00, x10, v), mix(x01, x11, v), w);
}
fn wrap360(yaw: f32) -> f32 { return yaw - 360.0 * floor(yaw / 360.0); }
fn ring(u: f32, freq: f32, s: f32, seed: f32) -> f32 {
  let a = u * 6.28318530718;
  return noise3(cos(a) * freq + s, sin(a) * freq + s * 1.7, seed * 3.1);
}
fn profileMountains(yaw: f32, h: f32, seed: f32) -> f32 {
  let u = wrap360(yaw) / 360.0;
  let r = abs(ring(u, 2.2, 1.0, seed) - 0.5) * 2.0;
  let q = abs(ring(u, 6.0, 4.0, seed) - 0.5) * 2.0;
  return h * (0.35 + 0.65 * (1.0 - r) * 0.8 + 0.2 * (1.0 - q));
}
fn profileHills(yaw: f32, h: f32, seed: f32) -> f32 {
  return h * (0.45 + 0.55 * ring(wrap360(yaw) / 360.0, 3.0, 2.0, seed));
}
fn profileTrees(yaw: f32, h: f32, seed: f32) -> f32 {
  let a = wrap360(yaw);
  let b = floor(a / 1.6);
  return h * (0.55 + 0.25 * ring(a / 360.0, 5.0, 7.0, seed) + 0.2 * sin((a / 1.6 - b) * 3.14159265359) * hash3(i32(b), i32(seed), 3));
}
fn profileCity(yaw: f32, h: f32, seed: f32) -> f32 {
  let a = wrap360(yaw);
  let b = floor(a / 3.2);
  let r = hash3(i32(b), i32(seed), 1);
  var stepK = 1.0;
  if ((a / 3.2 - b) < 0.3 && hash3(i32(b), i32(seed), 2) < 0.4) { stepK = 0.85; }
  var tall = 0.3 + r * 0.7;
  if (r < 0.15) { tall = 0.15; }
  return h * tall * stepK;
}`

const KIND = { mountains: 'Mountains', hills: 'Hills', trees: 'Trees', city: 'City' } as const

/** The two fragment bodies for `time` and `layers` (the layers listed back to front). */
export function skyShaders(time: TimeOfDay, layers: readonly HorizonLayer[]): EffectFragment {
  const bands = time.scene.sky
  const last = bands.length - 1
  const top = bands[last]?.at || 1
  const night = time.scene.light.sun === undefined
  const lit = Math.min(1, 0.3 + time.scene.light.ambient.level * 1.6)
  const haze = hazeAt(DEFAULT_LOOK.haze, time).colour

  // The band the sky coordinate `s` falls in, found by a chain of comparisons against the bands' starts.
  const pick = (vec: (hex: string) => string, set: (name: string, v: string) => string): string =>
    bands
      .map((band, i) =>
        i === 0 ? '' : `if (s >= ${f(band.at)}) { ${set('c', vec(band.colour))} i = ${i}; }`,
      )
      .join('\n  ')

  const glslLayers = layers
    .map((layer, k) => {
      const [h, seed] = [f(layer.height), f(layer.seed ?? 1)]
      return `
  { float hgt = profile${KIND[layer.kind]}(yaw, ${h}, ${seed});
    if (elev < hgt) {
      c = ${glslVec(layer.colour)} * ${f(lit)};${
        layer.kind === 'city' && night
          ? `
      // WINDOWS: a city's lit windows at night, in rows, one window a cell, a few of them.
      int row = int(floor(elev * 160.0));
      if ((row & 1) == 0 && hash3(int(floor(yaw * 2.5)), row, ${Math.round(layer.seed ?? 1)}) < 0.12 && elev < hgt - 0.01) c = vec3(1.0, 0.7373, 0.3059);`
          : ''
      }
    } } // layer ${k}`
    })
    .join('')
  const wgslLayers = layers
    .map((layer, k) => {
      const [h, seed] = [f(layer.height), f(layer.seed ?? 1)]
      return `
  { let hgt = profile${KIND[layer.kind]}(yaw, ${h}, ${seed});
    if (elev < hgt) {
      c = ${wgslVec(layer.colour)} * ${f(lit)};${
        layer.kind === 'city' && night
          ? `
      // WINDOWS: a city's lit windows at night, in rows, one window a cell, a few of them.
      let row = i32(floor(elev * 160.0));
      if ((row & 1) == 0 && hash3(i32(floor(yaw * 2.5)), row, ${Math.round(layer.seed ?? 1)}) < 0.12 && elev < hgt - 0.01) { c = vec3<f32>(1.0, 0.7373, 0.3059); }`
          : ''
      }
    } } // layer ${k}`
    })
    .join('')

  const gl = `${GLSL_LIB}
vec4 effect(vec2 uv) {
  vec4 base = sampleColor(uv);
  if (sampleDepth(uv) < 0.9999) return base;
  // uv runs down the frame, so ndc.y is positive below the middle; only the projection's size is wanted from uFxClip.w, never its sign,
  // which is negative where the view draws into a texture (@pixi/3d 0.1.0-beta.3).
  vec2 ndc = uv * 2.0 - 1.0;
  float yaw = degrees(uAimYaw + atan(ndc.x / uFxClip.z));
  float elev = uAimPitch - atan(ndc.y / abs(uFxClip.w));
  // The haze below the horizon: the ground past the map, as the air at the horizon, darker toward the viewer.
  if (elev < 0.0) {
    float k = 1.0 - 0.5 * min(1.0, -elev / 0.25) + ((((int(floor(yaw * 4.0)) + int(floor(elev * 400.0))) & 1) != 0) ? 0.02 : -0.02);
    return vec4(${glslVec(haze)} * k, 1.0);
  }
  // The bands: the time's, from its top (high up) to its horizon band, a dithered seam a little below each start.
  float s = clamp(1.0 - elev / 0.75, 0.0, 1.0) * ${f(top)} * 1.05;
  vec3 c = ${glslVec(bands[0]?.colour ?? '#000000')};
  int i = 0;
  ${pick(glslVec, (n, v) => `${n} = ${v};`)}
  ${seamGl(bands, last)}
  ${night ? '' : cloudsGl()}
  ${glslLayers}
  return vec4(c, 1.0);
}`

  const gpu = `${WGSL_LIB}
fn effect(uv: vec2<f32>) -> vec4<f32> {
  let base = sampleColor(uv);
  if (sampleDepth(uv) < 0.9999) { return base; }
  let ndc = uv * 2.0 - 1.0;
  let yaw = degrees(fx.uAimYaw + atan(ndc.x / fxh.uFxClip.z));
  let elev = fx.uAimPitch - atan(ndc.y / abs(fxh.uFxClip.w));
  if (elev < 0.0) {
    var k = 1.0 - 0.5 * min(1.0, -elev / 0.25) - 0.02;
    if (((i32(floor(yaw * 4.0)) + i32(floor(elev * 400.0))) & 1) != 0) { k = k + 0.04; }
    return vec4<f32>(${wgslVec(haze)} * k, 1.0);
  }
  let s = clamp(1.0 - elev / 0.75, 0.0, 1.0) * ${f(top)} * 1.05;
  var c = ${wgslVec(bands[0]?.colour ?? '#000000')};
  var i = 0;
  ${pick(wgslVec, (n, v) => `${n} = ${v};`)}
  ${seamWgsl(bands, last)}
  ${night ? '' : cloudsWgsl()}
  ${wgslLayers}
  return vec4<f32>(c, 1.0);
}`
  return { gl, gpu }
}

/** `elev` in the shader is radians; the seam is two texels (a checker) just above each band's start. */
function seamGl(bands: TimeOfDay['scene']['sky'], last: number): string {
  if (last === 0) return ''
  const next = bands
    .map((b, k) => `(i == ${k} ? ${glslVec(bands[Math.min(k + 1, last)]?.colour ?? b.colour)} : `)
    .join('')
  const at = bands.map((_b, k) => `(i == ${k} ? ${f(bands[Math.min(k + 1, last)]?.at ?? 0)} : `).join('')
  const closing = ')'.repeat(bands.length)
  return `if (i < ${last}) {
    float e = ${at}0.0${closing} - s;
    if (e > 0.0 && e < 0.012 && (((int(floor(yaw * 4.0)) + int(floor(elev * 400.0))) & 1) == 0)) c = ${next}c${closing};
  }`
}
function seamWgsl(bands: TimeOfDay['scene']['sky'], last: number): string {
  if (last === 0) return ''
  const lines = bands
    .slice(0, last)
    .map((_b, k) => {
      const nb = bands[k + 1]
      return `if (i == ${k}) { let e = ${f(nb?.at ?? 0)} - s; if (e > 0.0 && e < 0.012 && ((i32(floor(yaw * 4.0)) + i32(floor(elev * 400.0))) & 1) == 0) { c = ${wgslVec(nb?.colour ?? '#000000')}; } }`
    })
    .join('\n  ')
  return lines
}

// slow lumps in a band above the horizon, lit on top, drifting with the clock.
function cloudsGl(): string {
  return `// CLOUDS
  if (elev > 0.08 && elev < 0.6) {
    float q = noise3((yaw + uClock * 0.6) / 22.0, elev * 9.0, 4.0) * 0.7 + noise3((yaw + uClock * 0.6) / 9.0, elev * 22.0, 9.0) * 0.3;
    float edge = 0.6 + (elev - 0.3) * 0.3;
    if (q > edge) c = (q > edge + 0.06 && noise3((yaw + uClock * 0.6) / 9.0, elev * 22.0 + 0.4, 9.0) > 0.45) ? vec3(0.9608, 0.9686, 0.9804) : vec3(0.7804, 0.8392, 1.0);
  }`
}
function cloudsWgsl(): string {
  return `// CLOUDS
  if (elev > 0.08 && elev < 0.6) {
    let q = noise3((yaw + fx.uClock * 0.6) / 22.0, elev * 9.0, 4.0) * 0.7 + noise3((yaw + fx.uClock * 0.6) / 9.0, elev * 22.0, 9.0) * 0.3;
    let edge = 0.6 + (elev - 0.3) * 0.3;
    if (q > edge) {
      c = vec3<f32>(0.7804, 0.8392, 1.0);
      if (q > edge + 0.06 && noise3((yaw + fx.uClock * 0.6) / 9.0, elev * 22.0 + 0.4, 9.0) > 0.45) { c = vec3<f32>(0.9608, 0.9686, 0.9804); }
    }
  }`
}

export class SkyEffect extends PostEffect {
  protected override readonly fragment: EffectFragment
  protected override readonly uniforms: UniformGroup

  /** The sky for `time` behind `layers` (back to front). */
  constructor(time: TimeOfDay, layers: readonly HorizonLayer[] = []) {
    // Works on the picture as shown, so it runs after tone mapping (@pixi/3d beta.3 stages a post effect before it by default).
    super({ stage: 'afterToneMapping' })
    this.fragment = skyShaders(time, layers)
    this.uniforms = new UniformGroup({
      uAimYaw: { value: 0, type: 'f32' },
      uAimPitch: { value: 0, type: 'f32' },
      uClock: { value: 0, type: 'f32' },
    })
  }

  /** Where the camera looks, in radians: the heading (clockwise from east, seen from above) and the pitch (up is
   * positive). */
  aim(yaw: number, pitch: number): void {
    this.uniforms.uniforms.uAimYaw = yaw
    this.uniforms.uniforms.uAimPitch = pitch
  }

  /** The time in seconds the clouds drift by. */
  set clock(seconds: number) {
    this.uniforms.uniforms.uClock = seconds
  }
}
