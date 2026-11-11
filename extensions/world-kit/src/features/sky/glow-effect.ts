// Glow: a stepped bloom round whatever glows, as the source's bloom is. A glowing pixel is told by its colour: `setColours`
// names the colours a scene's glowing things show (a bulb's steps, a lit window's), and a pixel of one of them glows;
// without any, a pixel glows when its luma is at least `threshold` (lamps, windows and neon are the brightest things a DUEL
// frame holds). Round each glowing pixel the nearest `inner` pixels (Chebyshev) take their colour moved 0.45 of the way
// toward the glow in OKLab (the lightness half as far), snapped to DUEL and a step up its own ramp, and the next up to
// `outer` take a step up on every second pixel, a checker: the glow is whole steps and a dither, never a blur, so every
// pixel stays a DUEL colour. Empty sky has no colour of its own to light, so a pixel nothing was drawn in is left as it is.
// A `PostEffect` in GLSL + WGSL, run after the DUEL snap.

import { PostEffect } from '@pixi/3d'
import { UniformGroup } from 'pixi.js'
import { DUEL_GLSL, DUEL_WGSL } from './shader-parts.ts'

/** The most pixels out the glow reaches; the shader scans a (2 * 4 + 1)² window. */
export const MAX_REACH = 4
/**
 * The most colours `setColours` takes. The effect's uniforms are declared one to a name (an array's size is not carried to
 * the shader), so each colour is a uniform of its own and the test is unrolled.
 */
export const MAX_COLOURS = 24
/**
 * How near (squared, in RGB) a pixel is to a glow colour to count as that glow: the haze and the dither move a glowing
 * pixel off its exact colour, to a neighbour on the palette, so the match is a little wider than the colour itself.
 */
const TOLERANCE = '0.02'
const SLOTS = Array.from({ length: MAX_COLOURS }, (_, i) => i)
const GLSL_TESTS = SLOTS.map(
  (i) => `  if (${i}.0 < uCount) { d = uC${i}.rgb - c; if (dot(d, d) < ${TOLERANCE}) return true; }`,
).join('\n')
const WGSL_TESTS = SLOTS.map(
  (i) =>
    `  if (${i}.0 < fx.uCount) { d = fx.uC${i}.rgb - c; if (dot(d, d) < ${TOLERANCE}) { return true; } }`,
).join('\n')

const GLSL = `
${DUEL_GLSL}
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
bool glows(vec3 c) {
  if (uCount < 0.5) return luma(c) >= uThreshold;
  vec3 d;
${GLSL_TESTS}
  return false;
}
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
// The source's \`toward\`: a colour moved \`amt\` of the way to another in OKLab, the lightness half as far.
vec3 toward(vec3 c, vec3 t, float amt) {
  vec3 a = oklab(c);
  vec3 b = oklab(t);
  return fromOklab(vec3(a.x + (b.x - a.x) * amt * 0.5, a.yz + (b.yz - a.yz) * amt));
}
vec4 effect(vec2 uv) {
  vec4 c = sampleColor(uv);
  if (c.a < 0.5 || glows(c.rgb)) return c;
  vec2 t = texel();
  float nearest = 1e9;
  vec3 glow = c.rgb;
  for (int dy = -${MAX_REACH}; dy <= ${MAX_REACH}; dy++) {
    for (int dx = -${MAX_REACH}; dx <= ${MAX_REACH}; dx++) {
      float d = float(max(abs(dx), abs(dy)));
      if (d == 0.0 || d >= nearest || d > uOuter) continue;
      vec3 s = sampleColor(uv + vec2(float(dx), float(dy)) * t).rgb;
      if (glows(s)) { nearest = d; glow = s; }
    }
  }
  if (nearest > uOuter) return c;
  if (nearest <= uInner) return vec4(stepUp(nearestIndex(toward(c.rgb, glow, 0.45))), 1.0);
  vec2 p = floor(uv / t);
  if (int(mod(p.x + p.y, 2.0)) == 0) return vec4(stepUp(nearestIndex(c.rgb)), 1.0);
  return c;
}`

const WGSL = `
${DUEL_WGSL}
fn luma(c: vec3<f32>) -> f32 { return dot(c, vec3<f32>(0.2126, 0.7152, 0.0722)); }
fn glows(c: vec3<f32>) -> bool {
  if (fx.uCount < 0.5) { return luma(c) >= fx.uThreshold; }
  var d: vec3<f32>;
${WGSL_TESTS}
  return false;
}
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
fn toward(c: vec3<f32>, t: vec3<f32>, amt: f32) -> vec3<f32> {
  let a = oklab(c);
  let b = oklab(t);
  return fromOklab(vec3<f32>(a.x + (b.x - a.x) * amt * 0.5, a.y + (b.y - a.y) * amt, a.z + (b.z - a.z) * amt));
}
fn effect(uv: vec2<f32>) -> vec4<f32> {
  let c = sampleColor(uv);
  if (c.a < 0.5 || glows(c.rgb)) { return c; }
  let t = texel();
  var nearest = 1e9;
  var glow = c.rgb;
  for (var dy = -${MAX_REACH}; dy <= ${MAX_REACH}; dy++) {
    for (var dx = -${MAX_REACH}; dx <= ${MAX_REACH}; dx++) {
      let d = f32(max(abs(dx), abs(dy)));
      if (d == 0.0 || d >= nearest || d > fx.uOuter) { continue; }
      let s = sampleColor(uv + vec2<f32>(f32(dx), f32(dy)) * t).rgb;
      if (glows(s)) { nearest = d; glow = s; }
    }
  }
  if (nearest > fx.uOuter) { return c; }
  if (nearest <= fx.uInner) { return vec4<f32>(stepUp(nearestIndex(toward(c.rgb, glow, 0.45))), 1.0); }
  let p = floor(uv / t);
  if (i32((p.x + p.y) % 2.0) == 0) { return vec4<f32>(stepUp(nearestIndex(c.rgb)), 1.0); }
  return c;
}`

export interface GlowOptions {
  /** Luma, 0 to 1, from which a pixel glows when no colours are named (default 0.85). */
  readonly threshold?: number
  /** Pixels out the tinted ring reaches (default 1: the source's two texels, at the look's field). */
  readonly inner?: number
  /** Pixels out the dithered ring reaches, at most `MAX_REACH` (default 2: the source's four texels). */
  readonly outer?: number
  /** The colours that glow (`0xRRGGBB`, at most `MAX_COLOURS`), as `glowColours` gives a scene's. */
  readonly colours?: readonly number[]
}

export class GlowEffect extends PostEffect {
  protected override readonly fragment = { gpu: WGSL, gl: GLSL }
  protected override readonly uniforms: UniformGroup

  constructor(options: GlowOptions = {}) {
    super()
    const outer = Math.min(MAX_REACH, options.outer ?? 2)
    this.uniforms = new UniformGroup({
      uThreshold: { value: options.threshold ?? 0.85, type: 'f32' },
      uInner: { value: Math.min(outer, options.inner ?? 1), type: 'f32' },
      uOuter: { value: outer, type: 'f32' },
      uCount: { value: 0, type: 'f32' },
      ...Object.fromEntries(
        SLOTS.map((i) => [`uC${i}`, { value: new Float32Array(4), type: 'vec4<f32>' as const }]),
      ),
    })
    if (options.colours !== undefined) this.setColours(options.colours)
  }

  get threshold(): number {
    return this.uniforms.uniforms.uThreshold as number
  }

  /**
   * Names the colours that glow: a pixel of one of them is a glow, and the rings are drawn round it. With none (the
   * default) a pixel glows by its luma. Colours past `MAX_COLOURS` are left out.
   */
  setColours(colours: readonly number[]): void {
    const used = colours.slice(0, MAX_COLOURS)
    used.forEach((rgb, i) => {
      const lanes = this.uniforms.uniforms[`uC${i}`] as Float32Array
      lanes[0] = ((rgb >> 16) & 255) / 255
      lanes[1] = ((rgb >> 8) & 255) / 255
      lanes[2] = (rgb & 255) / 255
      lanes[3] = 1
    })
    this.uniforms.uniforms.uCount = used.length
    this.uniforms.update()
  }
}
