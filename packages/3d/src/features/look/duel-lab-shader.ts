// The DUEL palette and the nearest-colour search in OKLab, as GLSL and WGSL, for the snap and the finish. The CPU snap
// (`shared/math/duel.ts`) picks the nearest colour in OKLab, so the shader must too: an sRGB distance picks other colours
// for a third of the palette's neighbours. The shader linearises with the piecewise sRGB curve and takes cube roots with
// `pow`, so a colour exactly between two palette colours can fall either way: the tests count those and name them.

import { DUEL } from '../../shared/math/duel.ts'

const f = (v: number, places = 6): string => v.toFixed(places)
const channels = (c: number): number[] => [(c >> 16) & 255, (c >> 8) & 255, c & 255].map((v) => v / 255)

/** The palette's colours in OKLab, then as `0..1` triples, as one constant array each. */
const COUNT = DUEL.length

const OKLAB = `0.4122214708, 0.5363325363, 0.0514459929, 0.2119034982, 0.6806995451, 0.1073969566, 0.0883024619, 0.2817188376, 0.6299787005`

/** GLSL: `DUEL_RGB`, `DUEL_LAB`, `oklabOf(rgb)` and `nearestDuel(rgb)` (an index). */
export function duelLabGlsl(): string {
  const rgb = DUEL.map(
    (d) =>
      `vec3(${channels(d.c)
        .map((v) => f(v, 5))
        .join(', ')})`,
  )
  const lab = DUEL.map((d) => `vec3(${d.lab.map((v) => f(v, 8)).join(', ')})`)
  return `
const vec3 DUEL_RGB[${COUNT}] = vec3[${COUNT}](${rgb.join(', ')});
const vec3 DUEL_LAB[${COUNT}] = vec3[${COUNT}](${lab.join(', ')});
vec3 oklabOf(vec3 c) {
  vec3 lin = mix(c / 12.92, pow((max(c, vec3(0.0)) + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
  float l = pow(max(dot(vec3(${OKLAB.split(', ').slice(0, 3).join(', ')}), lin), 1e-9), 1.0 / 3.0);
  float m = pow(max(dot(vec3(${OKLAB.split(', ').slice(3, 6).join(', ')}), lin), 1e-9), 1.0 / 3.0);
  float s = pow(max(dot(vec3(${OKLAB.split(', ').slice(6, 9).join(', ')}), lin), 1e-9), 1.0 / 3.0);
  return vec3(
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  );
}
int nearestDuel(vec3 c) {
  vec3 want = oklabOf(c);
  float best = 1e9;
  int pick = 0;
  for (int i = 0; i < ${COUNT}; i++) {
    vec3 d = DUEL_LAB[i] - want;
    float e = dot(d, d);
    if (e < best) { best = e; pick = i; }
  }
  return pick;
}`
}

/** WGSL twin of {@link duelLabGlsl}. */
export function duelLabWgsl(): string {
  const rgb = DUEL.map(
    (d) =>
      `vec3<f32>(${channels(d.c)
        .map((v) => f(v, 5))
        .join(', ')})`,
  )
  const lab = DUEL.map((d) => `vec3<f32>(${d.lab.map((v) => f(v, 8)).join(', ')})`)
  const [a, b, c] = [
    OKLAB.split(', ').slice(0, 3),
    OKLAB.split(', ').slice(3, 6),
    OKLAB.split(', ').slice(6, 9),
  ]
  return `
var<private> DUEL_RGB: array<vec3<f32>, ${COUNT}> = array<vec3<f32>, ${COUNT}>(${rgb.join(', ')});
var<private> DUEL_LAB: array<vec3<f32>, ${COUNT}> = array<vec3<f32>, ${COUNT}>(${lab.join(', ')});
fn oklabOf(c: vec3<f32>) -> vec3<f32> {
  let hi = pow((max(c, vec3<f32>(0.0)) + 0.055) / 1.055, vec3<f32>(2.4));
  let lin = select(hi, c / 12.92, c <= vec3<f32>(0.04045));
  let l = pow(max(dot(vec3<f32>(${a.join(', ')}), lin), 1e-9), 1.0 / 3.0);
  let m = pow(max(dot(vec3<f32>(${b.join(', ')}), lin), 1e-9), 1.0 / 3.0);
  let s = pow(max(dot(vec3<f32>(${c.join(', ')}), lin), 1e-9), 1.0 / 3.0);
  return vec3<f32>(
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  );
}
fn nearestDuel(c: vec3<f32>) -> i32 {
  let want = oklabOf(c);
  var best = 1e9;
  var pick = 0;
  for (var i = 0; i < ${COUNT}; i++) {
    let d = DUEL_LAB[i] - want;
    let e = dot(d, d);
    if (e < best) { best = e; pick = i; }
  }
  return pick;
}`
}
