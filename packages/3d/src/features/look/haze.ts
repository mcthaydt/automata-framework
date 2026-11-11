// The haze: far things fade toward a veil, as the source look does (`hazeShare`, `hazeOf`, `hazed`). The rules are
// pure functions the shader repeats; the pass reads each pixel's depth, takes the distance behind the focus and mixes
// the colour toward the veil. A pixel with no mesh (the sky) is left alone: the sky is drawn on the haze already.
//
// A `PostEffect` in GLSL + WGSL. It runs before the snap, so the veil is snapped like any other colour.

import { type EffectFragment, PostEffect } from '@pixi/3d'
import { UniformGroup } from 'pixi.js'
import type { HazeProfile } from './look.schema.ts'

/** The haze's share at a texel `behind` metres past the focus: 0 before `near`, rising linearly to `amount` at `far`. */
export function hazeShare(behind: number, h: HazeProfile): number {
  return Math.min(1, Math.max(0, (behind - h.near) / (h.far - h.near))) * h.amount
}

/** The haze at a time: the profile's, with the time's own colour and amount where it sets them. */
export function hazeOf(
  h: HazeProfile,
  time: { readonly colour: string; readonly amount: number } | undefined,
): HazeProfile {
  return time === undefined ? h : { ...h, colour: time.colour, amount: time.amount }
}

const channels = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/** A colour mixed toward the veil by `share`; the veil is the haze colour plus `glow` × the texel's light. */
export function hazed(
  c: readonly [number, number, number],
  light: readonly [number, number, number],
  share: number,
  h: HazeProfile,
): [number, number, number] {
  if (share <= 0) return [c[0], c[1], c[2]]
  const veil = channels(h.colour)
  const out = [0, 0, 0] as [number, number, number]
  for (let i = 0; i < 3; i++) {
    const v = c[i] as number
    out[i] = v + (Math.min(1, (veil[i] as number) + h.glow * (light[i] as number)) - v) * share
  }
  return out
}

// The depth buffer holds a perspective camera's depth as (ndc + 1) / 2 and an orthographic one's as a straight line
// between near and far, so the distance is read by `uOrtho`.
const GLSL = `
float viewDepth(float d) {
  return uOrtho > 0.5 ? uFxClip.x + d * (uFxClip.y - uFxClip.x) : linearDepth(d);
}
vec4 effect(vec2 uv) {
  vec4 c = sampleColor(uv);
  float d = sampleDepth(uv);
  if (d >= 0.9999) return c;
  float centre = sampleDepth(vec2(0.5));
  float focus = (uOrtho > 0.5 && centre < 0.9999) ? viewDepth(centre) : uFocus;
  float behind = viewDepth(d) - focus;
  float share = clamp((behind - uNear) / (uFar - uNear), 0.0, 1.0) * uAmount;
  if (share <= 0.0) return c;
  vec3 veil = min(vec3(1.0), vec3(uR, uG, uB) + uGlow * c.rgb);
  return vec4(mix(c.rgb, veil, share), c.a);
}`

const WGSL = `
fn viewDepth(d: f32) -> f32 {
  if (fx.uOrtho > 0.5) { return fxh.uFxClip.x + d * (fxh.uFxClip.y - fxh.uFxClip.x); }
  return linearDepth(d);
}
fn effect(uv: vec2<f32>) -> vec4<f32> {
  let c = sampleColor(uv);
  let d = sampleDepth(uv);
  if (d >= 0.9999) { return c; }
  let centre = sampleDepth(vec2<f32>(0.5));
  var focus = fx.uFocus;
  if (fx.uOrtho > 0.5 && centre < 0.9999) { focus = viewDepth(centre); }
  let behind = viewDepth(d) - focus;
  let share = clamp((behind - fx.uNear) / (fx.uFar - fx.uNear), 0.0, 1.0) * fx.uAmount;
  if (share <= 0.0) { return c; }
  let veil = min(vec3<f32>(1.0), vec3<f32>(fx.uR, fx.uG, fx.uB) + fx.uGlow * c.rgb);
  return vec4<f32>(mix(c.rgb, veil, share), c.a);
}`

export class HazeEffect extends PostEffect {
  protected override readonly fragment: EffectFragment = { gpu: WGSL, gl: GLSL }
  protected override readonly uniforms: UniformGroup

  /** The pass for `haze` (already `hazeOf` the time). It is focused `focusFp` m from the eye until `focus` says more. */
  constructor(haze: HazeProfile) {
    super()
    const [r, g, b] = channels(haze.colour)
    this.uniforms = new UniformGroup({
      uR: { value: r, type: 'f32' },
      uG: { value: g, type: 'f32' },
      uB: { value: b, type: 'f32' },
      uNear: { value: haze.near, type: 'f32' },
      uFar: { value: haze.far, type: 'f32' },
      uAmount: { value: haze.amount, type: 'f32' },
      uGlow: { value: haze.glow, type: 'f32' },
      uFocus: { value: haze.focusFp, type: 'f32' },
      uOrtho: { value: 0, type: 'f32' },
    })
  }

  /** A lens camera (first person): the haze starts `metres` from the eye, the profile's `focusFp` until told. */
  focus(metres: number): void {
    this.uniforms.uniforms.uFocus = metres
    this.uniforms.uniforms.uOrtho = 0
  }

  /** An orthographic camera (the diorama): depth is a straight line, and the haze starts at whatever is at the middle of
   * the frame, as the source look focuses it. Where the middle shows no mesh, `metres` (default the profile's) holds. */
  focusCentre(metres?: number): void {
    if (metres !== undefined) this.uniforms.uniforms.uFocus = metres
    this.uniforms.uniforms.uOrtho = 1
  }

  get amount(): number {
    return this.uniforms.uniforms.uAmount as number
  }
}
