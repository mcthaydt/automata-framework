// What the three passes share, written once for both shading languages (WebGL2 stays at parity with WebGPU, ADR 0002):
// an integer hash that wraps the same in GLSL and WGSL, the DUEL palette as a constant array with a nearest-colour lookup
// and a step up its ramp, and a colour as a 0 to 1 triple.

import { DEFAULT_PALETTE, nearestDuel } from '@automata/content/palette'

const COLOURS = DEFAULT_PALETTE.colors
const f = (v: number): string => v.toFixed(4)

/** `#rrggbb` as a 0 to 1 triple. */
const channels = (hex: string): [number, number, number] => [
  ((Number.parseInt(hex.slice(1), 16) >> 16) & 0xff) / 255,
  ((Number.parseInt(hex.slice(1), 16) >> 8) & 0xff) / 255,
  (Number.parseInt(hex.slice(1), 16) & 0xff) / 255,
]

/** The DUEL colour nearest `hex`, as a 0 to 1 triple to hand a shader as a constant or a uniform. */
export const duelTriple = (hex: string): [number, number, number] =>
  channels(COLOURS[nearestDuel(hex)] as string)

const glslVec = (c: readonly number[]): string => `vec3(${c.map(f).join(', ')})`
const wgslVec = (c: readonly number[]): string => `vec3<f32>(${c.map(f).join(', ')})`

/** A DUEL colour as a GLSL / WGSL constant expression. */
export const duelGlslVec = (hex: string): string => glslVec(duelTriple(hex))
export const duelWgslVec = (hex: string): string => wgslVec(duelTriple(hex))

/** A hash of three integers to [0, 1), the same on both backends (32-bit wrap-around multiplication). */
export const HASH_GLSL = `
float hash3(int a, int b, int c) {
  uint n = uint(a) * 0x27d4eb2du ^ uint(b) * 0x165667b1u ^ uint(c) * 0x9e3779b1u;
  n = (n ^ (n >> 15u)) * 0x85ebca6bu;
  n = n ^ (n >> 13u);
  return float(n) / 4294967296.0;
}`
export const HASH_WGSL = `
fn hash3(a: i32, b: i32, c: i32) -> f32 {
  var n = u32(a) * 0x27d4eb2du ^ u32(b) * 0x165667b1u ^ u32(c) * 0x9e3779b1u;
  n = (n ^ (n >> 15u)) * 0x85ebca6bu;
  n = n ^ (n >> 13u);
  return f32(n) / 4294967296.0;
}`

const list = (wrap: (c: readonly number[]) => string): string =>
  COLOURS.map((hex) => wrap(channels(hex))).join(', ')

/** The palette, the index of the colour nearest a colour, and a colour a step up its own ramp (a ramp is 8 steps; a step
 * stops at the ramp's end and never goes darker than step 1, as a glow only lightens). */
export const DUEL_GLSL = `
const vec3 DUEL[${COLOURS.length}] = vec3[${COLOURS.length}](${list(glslVec)});
int nearestIndex(vec3 c) {
  float best = 1e9;
  int pick = 0;
  for (int i = 0; i < ${COLOURS.length}; i++) {
    vec3 d = DUEL[i] - c;
    float e = dot(d, d);
    if (e < best) { best = e; pick = i; }
  }
  return pick;
}
vec3 stepUp(int index) {
  int row = index / 8;
  int step = clamp(index - row * 8 + 1, 1, 7);
  return DUEL[row * 8 + step];
}`
export const DUEL_WGSL = `
var<private> DUEL: array<vec3<f32>, ${COLOURS.length}> = array<vec3<f32>, ${COLOURS.length}>(${list(wgslVec)});
fn nearestIndex(c: vec3<f32>) -> i32 {
  var best = 1e9;
  var pick = 0;
  for (var i = 0; i < ${COLOURS.length}; i++) {
    let d = DUEL[i] - c;
    let e = dot(d, d);
    if (e < best) { best = e; pick = i; }
  }
  return pick;
}
fn stepUp(index: i32) -> vec3<f32> {
  let row = index / 8;
  let step = clamp(index - row * 8 + 1, 1, 7);
  return DUEL[row * 8 + step];
}`

/** OKLab in a shader: a colour in and out of it, and the source's `toward` (a colour moved `amt` of the way to another, the lightness half as far). */
export const OKLAB_GLSL = `
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
// The source toward: a colour moved amt of the way to another in OKLab, the lightness half as far.
vec3 toward(vec3 c, vec3 t, float amt) {
  vec3 a = oklab(c);
  vec3 b = oklab(t);
  return fromOklab(vec3(a.x + (b.x - a.x) * amt * 0.5, a.yz + (b.yz - a.yz) * amt));
}
`
export const OKLAB_WGSL = `
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
`

/**
 * Where the surface a pixel shows is, in view space (x right, y up, z toward the viewer, so -z is the distance in front): the
 * pixel's content-space `uv` runs y down, the clip terms (`uFxClip` .z and .w, the projection's scale) say how wide the view
 * is, and an orthographic camera (`uOrtho` over 0.5) does not widen it with distance. `viewPos` is the engine's for a lens
 * camera and takes y the other way up here, so the passes that need a place use this.
 */
export const SURFACE_GLSL = `
float surfaceDepth(float d) {
  return uOrtho > 0.5 ? uFxClip.x + d * (uFxClip.y - uFxClip.x) : linearDepth(d);
}
vec3 surfacePos(vec2 uv) {
  float lz = surfaceDepth(sampleDepth(uv));
  vec2 ndc = vec2(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
  float w = uOrtho > 0.5 ? 1.0 : lz;
  return vec3(ndc.x * w / uFxClip.z, ndc.y * w / uFxClip.w, -lz);
}
`
export const SURFACE_WGSL = `
fn surfaceDepth(d: f32) -> f32 {
  if (fx.uOrtho > 0.5) { return fxh.uFxClip.x + d * (fxh.uFxClip.y - fxh.uFxClip.x); }
  return linearDepth(d);
}
fn surfacePos(uv: vec2<f32>) -> vec3<f32> {
  let lz = surfaceDepth(sampleDepth(uv));
  let ndc = vec2<f32>(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
  var w = lz;
  if (fx.uOrtho > 0.5) { w = 1.0; }
  return vec3<f32>(ndc.x * w / fxh.uFxClip.z, ndc.y * w / fxh.uFxClip.w, -lz);
}
`
