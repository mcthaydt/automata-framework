// The one snap: every pixel of the frame goes to its nearest DUEL colour, with a 4 × 4 Bayer offset first so a colour
// between two palette colours lands on both, in a pattern, instead of one flat patch (EnvironmentBuilder
// `paint/colour.ts snap`). A `PostEffect`, written as a GLSL + WGSL pair: WebGL2 stays at parity with WebGPU (ADR 0002).
// Pixel position comes from the content-space `uv` over one texel (`texel()`), not from the vertex stage, which a
// post effect has none of.

import { DEFAULT_PALETTE } from '@automata/content/palette'
import { type EffectFragment, PostEffect } from '@pixi/3d'
import { UniformGroup } from 'pixi.js'

/** A palette as 0 to 1 channel triples, in palette order. */
const triples = (hexes: readonly string[]): number[][] =>
  hexes.map((hex) => [16, 8, 0].map((shift) => ((Number.parseInt(hex.slice(1), 16) >> shift) & 0xff) / 255))
const f = (v: number): string => v.toFixed(4)

/** The palette's colours as a GLSL constant array of `vec3`. */
export function paletteGlsl(name: string, hexes: readonly string[]): string {
  const list = triples(hexes).map((c) => `vec3(${c.map(f).join(', ')})`)
  return `const vec3 ${name}[${hexes.length}] = vec3[${hexes.length}](${list.join(', ')});`
}

/** The palette's colours as a WGSL private array (a `const` array cannot be indexed by a loop variable). */
export function paletteWgsl(name: string, hexes: readonly string[]): string {
  const list = triples(hexes).map((c) => `vec3<f32>(${c.map(f).join(', ')})`)
  return `var<private> ${name}: array<vec3<f32>, ${hexes.length}> = array<vec3<f32>, ${hexes.length}>(${list.join(', ')});`
}

const COLOURS = DEFAULT_PALETTE.colors

/** The 4 × 4 Bayer matrix, 0 to 15, row by row. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

const GLSL = `
${paletteGlsl('DUEL', COLOURS)}
const float BAYER[16] = float[16](${BAYER.join('.0, ')}.0);
vec4 effect(vec2 uv) {
  vec4 c = sampleColor(uv);
  vec2 p = floor(uv / texel());
  int cell = int(mod(p.x, 4.0)) + int(mod(p.y, 4.0)) * 4;
  vec3 want = c.rgb + (BAYER[cell] / 16.0 - 0.5) * uDither;
  float best = 1e9;
  vec3 pick = want;
  for (int i = 0; i < ${COLOURS.length}; i++) {
    vec3 d = DUEL[i] - want;
    float e = dot(d, d);
    if (e < best) { best = e; pick = DUEL[i]; }
  }
  return vec4(pick, c.a);
}`

const WGSL = `
${paletteWgsl('DUEL', COLOURS)}
var<private> BAYER: array<f32, 16> = array<f32, 16>(${BAYER.join('.0, ')}.0);
fn effect(uv: vec2<f32>) -> vec4<f32> {
  let c = sampleColor(uv);
  let p = floor(uv / texel());
  let cell = i32(p.x % 4.0) + i32(p.y % 4.0) * 4;
  let want = c.rgb + (BAYER[cell] / 16.0 - 0.5) * fx.uDither;
  var best = 1e9;
  var pick = want;
  for (var i = 0; i < ${COLOURS.length}; i++) {
    let d = DUEL[i] - want;
    let e = dot(d, d);
    if (e < best) { best = e; pick = DUEL[i]; }
  }
  return vec4<f32>(pick, c.a);
}`

export class DuelSnapEffect extends PostEffect {
  protected override readonly fragment: EffectFragment = { gpu: WGSL, gl: GLSL }
  protected override readonly uniforms: UniformGroup

  /** `dither` is the Bayer offset in colour units (0 snaps flat). */
  constructor(dither: number) {
    super()
    this.uniforms = new UniformGroup({ uDither: { value: dither, type: 'f32' } })
  }

  get dither(): number {
    return this.uniforms.uniforms.uDither as number
  }

  set dither(value: number) {
    this.uniforms.uniforms.uDither = value
  }
}
