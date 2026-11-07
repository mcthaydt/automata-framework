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
