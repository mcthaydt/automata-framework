// The one snap: every pixel of the frame goes to its nearest DUEL colour, with a 4 × 4 Bayer offset first so a colour
// between two palette colours lands on both, in a pattern, instead of one flat patch (an ordered dither,
// as pixel-art snapping does). The nearest-colour loop runs over a short candidate list for the pixel's colour, read from a
// table built once on the CPU (`duel-snap-table.ts`), not over the whole palette: the same sums in the same order, so the
// same colour, at a few distance sums a pixel instead of 512. `src/testing/duel-snap-reference.ts` keeps the full loop.
// A `PostEffect`, written as a GLSL + WGSL pair: WebGL2 stays at parity with WebGPU (ADR 0002).
// Pixel position comes from the content-space `uv` over one texel (`texel()`), not from the vertex stage, which a
// post effect has none of.

import { DEFAULT_PALETTE } from '@automata/content/palette'
import { type EffectFragment, type EffectIO, PostEffect, type RenderGraph } from '@pixi/3d'
import { BufferImageSource, UniformGroup } from 'pixi.js'
import { EXACT } from './duel-snap.ts'
import { candidateTable, GRID } from './duel-snap-table.ts'
import { TableSnapPass } from './snap-table-pass.ts'

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
const EXACT_GLSL = EXACT.toExponential(6)

/** The 4 × 4 Bayer matrix, 0 to 15, row by row. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

const GLSL = `
${paletteGlsl('DUEL', COLOURS)}
const float BAYER[16] = float[16](${BAYER.join('.0, ')}.0);
// The candidate list of cell 'at': texel 'group' of its column in the table (candidate-table in duel-snap-table.ts).
vec4 candidates(ivec3 at, int group) {
  float x = (float(at.x + ${GRID} * at.y) + 0.5) / ${(GRID * GRID).toFixed(1)};
  float y = (float(at.z) + (float(group) + 0.5) / uGroups) / ${GRID.toFixed(1)};
  return sampleColor2(vec2(x, y));
}
vec4 effect(vec2 uv) {
  vec4 c = sampleColor(uv);
  vec2 p = floor(uv / texel());
  int cell = int(mod(p.x, 4.0)) + int(mod(p.y, 4.0)) * 4;
  vec3 want = c.rgb + (BAYER[cell] / 16.0 - 0.5) * uDither;
  ivec3 at = clamp(ivec3(floor(c.rgb * ${GRID.toFixed(1)})), ivec3(0), ivec3(${GRID - 1}));
  vec4 t = candidates(at, 0);
  int count = int(t.x * 255.0 + 0.5) + 1;
  float best = 1e9;
  vec3 pick = want;
  float exact = 1e9;
  vec3 same = c.rgb;
  for (int s = 1; s <= count; s++) {
    if ((s & 3) == 0) t = candidates(at, s >> 2);
    vec3 colour = DUEL[int(t[s & 3] * 255.0 + 0.5)];
    vec3 d = colour - want;
    float e = dot(d, d);
    if (e < best) { best = e; pick = colour; }
    vec3 x = colour - c.rgb;
    float ex = dot(x, x);
    if (ex < exact) { exact = ex; same = colour; }
  }
  // A colour that is already a DUEL colour (a figure's texel) stays itself: the dither does not tip it onto a neighbour.
  if (exact < ${EXACT_GLSL}) pick = same;
  return vec4(pick, c.a);
}`

const WGSL = `
${paletteWgsl('DUEL', COLOURS)}
var<private> BAYER: array<f32, 16> = array<f32, 16>(${BAYER.join('.0, ')}.0);
// The candidate list of cell 'at': texel 'group' of its column in the table (candidate-table in duel-snap-table.ts).
fn candidates(at: vec3<i32>, group: i32) -> vec4<f32> {
  let x = (f32(at.x + ${GRID} * at.y) + 0.5) / ${(GRID * GRID).toFixed(1)};
  let y = (f32(at.z) + (f32(group) + 0.5) / fx.uGroups) / ${GRID.toFixed(1)};
  return sampleColor2(vec2<f32>(x, y));
}
fn effect(uv: vec2<f32>) -> vec4<f32> {
  let c = sampleColor(uv);
  let p = floor(uv / texel());
  let cell = i32(p.x % 4.0) + i32(p.y % 4.0) * 4;
  let want = c.rgb + (BAYER[cell] / 16.0 - 0.5) * fx.uDither;
  let at = clamp(vec3<i32>(floor(c.rgb * ${GRID.toFixed(1)})), vec3<i32>(0), vec3<i32>(${GRID - 1}));
  var t = candidates(at, 0);
  let count = i32(t.x * 255.0 + 0.5) + 1;
  var best = 1e9;
  var pick = want;
  var exact = 1e9;
  var same = c.rgb;
  for (var s = 1; s <= count; s++) {
    if ((s & 3) == 0) { t = candidates(at, s >> 2u); }
    let colour = DUEL[i32(t[s & 3] * 255.0 + 0.5)];
    let d = colour - want;
    let e = dot(d, d);
    if (e < best) { best = e; pick = colour; }
    let x = colour - c.rgb;
    let ex = dot(x, x);
    if (ex < exact) { exact = ex; same = colour; }
  }
  // A colour that is already a DUEL colour (a figure's texel) stays itself: the dither does not tip it onto a neighbour.
  if (exact < ${EXACT_GLSL}) { pick = same; }
  return vec4<f32>(pick, c.a);
}`

export class DuelSnapEffect extends PostEffect {
  protected override readonly fragment: EffectFragment = { gpu: WGSL, gl: GLSL }
  protected override readonly uniforms: UniformGroup
  /** The candidate table for the current dither strength, as a texture; made once, replaced when the strength changes. */
  #table: BufferImageSource | undefined
  #strength: number

  /** `dither` is the Bayer offset in colour units (0 snaps flat). */
  constructor(dither: number) {
    super()
    this.#strength = dither
    this.uniforms = new UniformGroup({
      uDither: { value: dither, type: 'f32' },
      uGroups: { value: candidateTable(dither).groups, type: 'f32' },
    })
  }

  /** Reads the colour only: this is the pass that draws to the canvas, and it must not sample the depth (`present-pass.ts`). */
  override build(graph: RenderGraph, io: EffectIO): void {
    graph.addPass(
      new TableSnapPass({
        renderer: io.renderer,
        label: 'DuelSnapEffect',
        fragment: this.fragment,
        uniforms: this.uniforms,
        input: io.input,
        writes: io.output,
        table: () => this.#tableSource(),
      }),
    )
  }

  /** The table's texture, made on first use: nearest-sampled, no mips, so a texel is a candidate index and nothing blended. */
  #tableSource(): BufferImageSource {
    if (this.#table === undefined) {
      const table = candidateTable(this.#strength)
      this.#table = new BufferImageSource({
        resource: table.data,
        width: table.width,
        height: table.height,
        format: 'rgba8unorm',
        scaleMode: 'nearest',
        autoGenerateMipmaps: false,
        // The bytes are candidate indices, the fourth lane included: no premultiply on upload.
        alphaMode: 'no-premultiply-alpha',
      })
    }
    return this.#table
  }

  get dither(): number {
    return this.uniforms.uniforms.uDither as number
  }

  set dither(value: number) {
    if (value === this.#strength) return
    this.#strength = value
    this.uniforms.uniforms.uDither = value
    this.uniforms.uniforms.uGroups = candidateTable(value).groups
    // The next frame's import takes a new table, built for this strength; the old texture goes with the old strength.
    this.#table?.destroy()
    this.#table = undefined
  }

  /** Frees the table's texture. The view never calls this itself (a pass may be shared), the renderer's teardown does. */
  override destroy(): void {
    this.#table?.destroy()
    this.#table = undefined
  }
}
