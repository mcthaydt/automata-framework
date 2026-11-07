// Stars: fixed points of light on the sky, where nothing is drawn. The sky is a direction, not a place, so a star's cell is
// found from the pixel's direction (yaw in degrees, elevation in radians, the cells 1/3 degree and 1/180 radian: about a
// pixel at the look's 180-pixel field), which the camera's heading and pitch (`aim`) and the lens give. A star is one of
// three DUEL colours, thicker with the time of day's `stars`; one in seven blinks to a dim colour.
//
// A `PostEffect` in GLSL + WGSL. It draws only where the scene's depth is the far plane (no mesh), above the horizon band.

import { PostEffect } from '@pixi/3d'
import { UniformGroup } from 'pixi.js'
import { duelGlslVec, duelWgslVec, HASH_GLSL, HASH_WGSL } from './shader-parts.ts'

const BRIGHT = '#f5f7fa'
const COOL = '#c6ecff'
const DIM = '#7a7799'

const GLSL = `
${HASH_GLSL}
vec4 effect(vec2 uv) {
  vec4 c = sampleColor(uv);
  if (sampleDepth(uv) < 0.9999) return c;
  vec2 ndc = uv * 2.0 - 1.0;
  float yaw = uAimYaw + atan(ndc.x / uFxClip.z);
  float elev = uAimPitch - atan(ndc.y / uFxClip.w);
  if (elev <= 0.06) return c;
  int sx = int(floor(degrees(yaw) * 3.0));
  int sy = int(floor(elev * 180.0));
  float r = hash3(sx, sy, 77);
  if (r >= uDensity * 1.2) return c;
  vec3 colour = hash3(sx, sy, int(floor(uClock * 3.0))) < 0.15 ? ${duelGlslVec(DIM)}
    : r < uDensity * 0.3 ? ${duelGlslVec(BRIGHT)} : ${duelGlslVec(COOL)};
  return vec4(colour, 1.0);
}`

const WGSL = `
${HASH_WGSL}
fn effect(uv: vec2<f32>) -> vec4<f32> {
  let c = sampleColor(uv);
  if (sampleDepth(uv) < 0.9999) { return c; }
  let ndc = uv * 2.0 - 1.0;
  let yaw = fx.uAimYaw + atan(ndc.x / fxh.uFxClip.z);
  let elev = fx.uAimPitch - atan(ndc.y / fxh.uFxClip.w);
  if (elev <= 0.06) { return c; }
  let sx = i32(floor(degrees(yaw) * 3.0));
  let sy = i32(floor(elev * 180.0));
  let r = hash3(sx, sy, 77);
  if (r >= fx.uDensity * 1.2) { return c; }
  var colour = ${duelWgslVec(COOL)};
  if (r < fx.uDensity * 0.3) { colour = ${duelWgslVec(BRIGHT)}; }
  if (hash3(sx, sy, i32(floor(fx.uClock * 3.0))) < 0.15) { colour = ${duelWgslVec(DIM)}; }
  return vec4<f32>(colour, 1.0);
}`

export class StarsEffect extends PostEffect {
  protected override readonly fragment = { gpu: WGSL, gl: GLSL }
  protected override readonly uniforms: UniformGroup

  /** `density` is the time of day's `stars` (0 none, 1 thick). */
  constructor(density: number, options: { readonly enabled?: boolean } = {}) {
    super(options)
    this.uniforms = new UniformGroup({
      uDensity: { value: density, type: 'f32' },
      uAimYaw: { value: 0, type: 'f32' },
      uAimPitch: { value: 0, type: 'f32' },
      uClock: { value: 0, type: 'f32' },
    })
  }

  /** Where the camera looks, in radians: the heading (yaw) and the pitch (up is positive). Stars hold their place in the
   * sky as it turns; with no aim they hold to the screen. */
  aim(yaw: number, pitch: number): void {
    this.uniforms.uniforms.uAimYaw = yaw
    this.uniforms.uniforms.uAimPitch = pitch
  }

  /** The time, in seconds, the blinking is read from. */
  set clock(seconds: number) {
    this.uniforms.uniforms.uClock = seconds
  }

  get density(): number {
    return this.uniforms.uniforms.uDensity as number
  }
}
