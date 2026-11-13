// The DUEL snap as it was before its candidate table: the whole palette looped for every pixel, twice. It is not in the
// look's passes; the tests draw a gradient through it and through `DuelSnapEffect` and hold the two to the same bytes
// (`tests/browser/parity/look/duel-snap-table.test.ts`). The shader text is the old one unchanged.

import { DEFAULT_PALETTE } from '@automata/content/palette'
import { type EffectFragment, type EffectIO, PostEffect, type RenderGraph } from '@pixi/3d'
import { UniformGroup } from 'pixi.js'
import { BAYER, EXACT } from '../features/look/duel-snap.ts'
import { paletteGlsl, paletteWgsl } from '../features/look/duel-snap-filter.ts'
import { addColourOnlyPass } from '../features/look/present-pass.ts'

const COLOURS = DEFAULT_PALETTE.colors
const EXACT_GLSL = EXACT.toExponential(6)

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
  float exact = 1e9;
  vec3 same = c.rgb;
  for (int i = 0; i < ${COLOURS.length}; i++) {
    vec3 d = DUEL[i] - want;
    float e = dot(d, d);
    if (e < best) { best = e; pick = DUEL[i]; }
    vec3 x = DUEL[i] - c.rgb;
    float ex = dot(x, x);
    if (ex < exact) { exact = ex; same = DUEL[i]; }
  }
  if (exact < ${EXACT_GLSL}) pick = same;
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
  var exact = 1e9;
  var same = c.rgb;
  for (var i = 0; i < ${COLOURS.length}; i++) {
    let d = DUEL[i] - want;
    let e = dot(d, d);
    if (e < best) { best = e; pick = DUEL[i]; }
    let x = DUEL[i] - c.rgb;
    let ex = dot(x, x);
    if (ex < exact) { exact = ex; same = DUEL[i]; }
  }
  if (exact < ${EXACT_GLSL}) { pick = same; }
  return vec4<f32>(pick, c.a);
}`

/** The snap with the 256-colour loop, for comparison with the table's. Same constructor and uniform as `DuelSnapEffect`. */
export class DuelSnapReferenceEffect extends PostEffect {
  protected override readonly fragment: EffectFragment = { gpu: WGSL, gl: GLSL }
  protected override readonly uniforms: UniformGroup

  constructor(dither: number) {
    super()
    this.uniforms = new UniformGroup({ uDither: { value: dither, type: 'f32' } })
  }

  override build(graph: RenderGraph, io: EffectIO): void {
    addColourOnlyPass(graph, io, 'DuelSnapReferenceEffect', this.fragment, this.uniforms)
  }
}
