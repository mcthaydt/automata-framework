// The outline, in the source look's selective outlining ("selout"): a pixel beside a nearer shape takes that shape's own
// colour, a few steps down its ramp (two on the side the key comes from, three off it), so the line is the shape's own
// deep shade, never a black one. It runs after the snap, so the line is a DUEL colour and the colour to step is
// exact. A shape is nearer when it is more than `gap` metres closer (plus `perMetre` of the pixel's own distance in
// a perspective view); the sky is far, so a shape against it is outlined in the sky. Off by default.
// A `PostEffect` in GLSL + WGSL.

import { DEFAULT_PALETTE } from '@automata/content/palette'
import { type EffectFragment, PostEffect } from '@pixi/3d'
import { UniformGroup } from 'pixi.js'
import { paletteGlsl, paletteWgsl } from './duel-snap-filter.ts'

const COLOURS = DEFAULT_PALETTE.colors

/** Steps down the near shape's ramp: on the key's side, and off it. */
export const KEY_SIDE_STEP = -2
export const OFF_KEY_STEP = -3

/** A palette colour (its index) moved `by` steps along its own ramp of 8: never off the ramp, never onto step 0 (the ramp's ink). */
export function stepBy(index: number, by: number): number {
  const row = Math.floor(index / 8)
  return row * 8 + Math.max(1, Math.min(7, (index % 8) + by))
}

/** Whether a pixel at distance `z` is beside a nearer shape at `near`: closer by more than the gap, which grows with distance in a perspective view. */
export const beside = (z: number, near: number, gap: number, perMetre: number): boolean =>
  z - near > gap + perMetre * z

/**
 * Whether the pixel the near shape is at `owner` (pixels from it, y down) from lies toward the key from the shape.
 * `key` is the screen direction the key comes from, a unit vector.
 */
export const onKeySide = (owner: readonly [number, number], key: readonly [number, number]): boolean =>
  -(owner[0] * key[0] + owner[1] * key[1]) > 0.3

/** The outline's colour for a near shape's palette colour: its own ramp, two steps down on the key's side, three off it. */
export const outlineColour = (owner: number, keySide: boolean): string =>
  COLOURS[stepBy(owner, keySide ? KEY_SIDE_STEP : OFF_KEY_STEP)] as string

const GLSL = `
${paletteGlsl('DUEL', COLOURS)}
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
float viewDepth(float d) {
  return uOrtho > 0.5 ? uFxClip.x + d * (uFxClip.y - uFxClip.x) : linearDepth(d);
}
vec4 effect(vec2 uv) {
  vec4 c = sampleColor(uv);
  vec2 t = texel();
  float z = viewDepth(sampleDepth(uv));
  float gap = uGap + (uOrtho > 0.5 ? 0.0 : uPerMetre * z);
  float nearest = 1e9;
  vec2 at = vec2(0.0);
  for (int i = 0; i < 4; i++) {
    vec2 o = i == 0 ? vec2(-1.0, 0.0) : i == 1 ? vec2(1.0, 0.0) : i == 2 ? vec2(0.0, -1.0) : vec2(0.0, 1.0);
    float zn = viewDepth(sampleDepth(uv + o * t));
    if (z - zn > gap && zn < nearest) { nearest = zn; at = o; }
  }
  if (nearest > 1e8) return c;
  int index = nearestIndex(sampleColor(uv + at * t).rgb);
  bool keySide = -dot(at, uKey) > 0.3;
  int row = index / 8;
  int step = clamp(index - row * 8 + (keySide ? ${KEY_SIDE_STEP} : ${OFF_KEY_STEP}), 1, 7);
  return vec4(DUEL[row * 8 + step], c.a);
}`

const WGSL = `
${paletteWgsl('DUEL', COLOURS)}
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
fn viewDepth(d: f32) -> f32 {
  if (fx.uOrtho > 0.5) { return fxh.uFxClip.x + d * (fxh.uFxClip.y - fxh.uFxClip.x); }
  return linearDepth(d);
}
fn effect(uv: vec2<f32>) -> vec4<f32> {
  let c = sampleColor(uv);
  let t = texel();
  let z = viewDepth(sampleDepth(uv));
  var gap = fx.uGap;
  if (fx.uOrtho < 0.5) { gap += fx.uPerMetre * z; }
  var nearest = 1e9;
  var at = vec2<f32>(0.0);
  for (var i = 0; i < 4; i++) {
    var o = vec2<f32>(0.0, 1.0);
    if (i == 0) { o = vec2<f32>(-1.0, 0.0); } else if (i == 1) { o = vec2<f32>(1.0, 0.0); } else if (i == 2) { o = vec2<f32>(0.0, -1.0); }
    let zn = viewDepth(sampleDepth(uv + o * t));
    if (z - zn > gap && zn < nearest) { nearest = zn; at = o; }
  }
  if (nearest > 1e8) { return c; }
  let index = nearestIndex(sampleColor(uv + at * t).rgb);
  let keySide = -dot(at, fx.uKey) > 0.3;
  let row = index / 8;
  var by = ${OFF_KEY_STEP};
  if (keySide) { by = ${KEY_SIDE_STEP}; }
  let step = clamp(index - row * 8 + by, 1, 7);
  return vec4<f32>(DUEL[row * 8 + step], c.a);
}`

export interface OutlineOptions {
  /** The depth gap (metres) beyond which a nearer shape outlines what is behind it. */
  readonly gap: number
  /** In a perspective view the gap grows by this much per metre of the pixel's own distance. */
  readonly perMetre: number
  /** The screen direction the key comes from (x right, y down), a unit vector; default the upper left. */
  readonly key?: readonly [number, number] | undefined
}

export class OutlineEffect extends PostEffect {
  protected override readonly fragment: EffectFragment = { gpu: WGSL, gl: GLSL }
  protected override readonly uniforms: UniformGroup

  constructor(options: OutlineOptions) {
    super()
    const [kx, ky] = options.key ?? [-0.7071, -0.7071]
    this.uniforms = new UniformGroup({
      uGap: { value: options.gap, type: 'f32' },
      uPerMetre: { value: options.perMetre, type: 'f32' },
      uOrtho: { value: 0, type: 'f32' },
      uKey: { value: new Float32Array([kx, ky]), type: 'vec2<f32>' },
    })
  }

  get gap(): number {
    return this.uniforms.uniforms.uGap as number
  }

  set gap(value: number) {
    this.uniforms.uniforms.uGap = value
  }

  /** An orthographic camera (the diorama): depth is a straight line, and the gap does not grow with distance. */
  orthographic(on = true): void {
    this.uniforms.uniforms.uOrtho = on ? 1 : 0
  }

  /** The screen direction the key comes from (x right, y down); it is made a unit vector. */
  key(x: number, y: number): void {
    const length = Math.hypot(x, y) || 1
    const lanes = this.uniforms.uniforms.uKey as Float32Array
    lanes[0] = x / length
    lanes[1] = y / length
    this.uniforms.update()
  }
}
