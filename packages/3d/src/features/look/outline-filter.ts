// The outline: a pixel whose depth jumps by more than `edge` of its own depth over the next pixel to the right or
// below is drawn in DUEL's outline colour (ramp 6, step 0), never shaded (EnvironmentBuilder's outline switch, off by
// default). Depth edges only, so a texture's own lines are left alone. A `PostEffect` in GLSL + WGSL.

import { DUEL_RAMPS } from '@automata/content/palette'
import { type EffectFragment, PostEffect } from '@pixi/3d'
import { UniformGroup } from 'pixi.js'

const INK = DUEL_RAMPS[6]?.[0] ?? '#002219'
const ink = [16, 8, 0].map((shift) =>
  (((Number.parseInt(INK.slice(1), 16) >> shift) & 0xff) / 255).toFixed(4),
)

const GLSL = `
vec4 effect(vec2 uv) {
  vec4 c = sampleColor(uv);
  vec2 t = texel();
  float z = linearDepth(sampleDepth(uv));
  float zx = linearDepth(sampleDepth(uv + vec2(t.x, 0.0)));
  float zy = linearDepth(sampleDepth(uv + vec2(0.0, t.y)));
  if (abs(z - zx) + abs(z - zy) > uEdge * z) return vec4(${ink.join(', ')}, c.a);
  return c;
}`

const WGSL = `
fn effect(uv: vec2<f32>) -> vec4<f32> {
  let c = sampleColor(uv);
  let t = texel();
  let z = linearDepth(sampleDepth(uv));
  let zx = linearDepth(sampleDepth(uv + vec2<f32>(t.x, 0.0)));
  let zy = linearDepth(sampleDepth(uv + vec2<f32>(0.0, t.y)));
  if (abs(z - zx) + abs(z - zy) > fx.uEdge * z) { return vec4<f32>(${ink.join(', ')}, c.a); }
  return c;
}`

export class OutlineEffect extends PostEffect {
  protected override readonly fragment: EffectFragment = { gpu: WGSL, gl: GLSL }
  protected override readonly uniforms: UniformGroup

  /** `edge` is the depth jump, as a share of the nearer depth, that draws an outline. */
  constructor(edge: number) {
    super()
    this.uniforms = new UniformGroup({ uEdge: { value: edge, type: 'f32' } })
  }

  get edge(): number {
    return this.uniforms.uniforms.uEdge as number
  }

  set edge(value: number) {
    this.uniforms.uniforms.uEdge = value
  }
}
