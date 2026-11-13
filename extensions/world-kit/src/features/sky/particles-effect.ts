// Particles on the frame, as the source look draws them: the sprites of the scene's emitters (steam, drips,
// a flame, moths; particle-sprites.ts works them out from the time) laid on the frame in their own DUEL colours, one to a few
// pixels across, depth-tested against what was drawn. A `PostEffect` in GLSL + WGSL, run after the snap. The sprites are
// in the world and the pass works in view space, so `track` is told the camera once and follows it from then on.

import { UniformGroup } from 'pixi.js'
import { TrackingEffect } from './camera-track.ts'
import { type Emitter, particleSprites } from './particle-sprites.ts'
import { SURFACE_GLSL, SURFACE_WGSL } from './shader-parts.ts'

export type { Emitter }

/** The most sprites a frame holds: each is a slot of uniforms of its own (an array's size is not carried to the shader). */
export const MAX_SPRITES = 48
const SLOTS = Array.from({ length: MAX_SPRITES }, (_, i) => i)

const GLSL = `
${SURFACE_GLSL}
vec4 effect(vec2 uv) {
  vec4 c = sampleColor(uv);
  vec2 t = texel();
  vec2 p = floor(uv / t);
  float surface = surfaceDepth(sampleDepth(uv));
  vec4 hit = vec4(0.0);
  vec3 Q;
  float zq;
  vec2 at;
  vec2 d;
  float reach;
${SLOTS.map(
  (i) => `  if (uK${i}.w > 0.5) {
    Q = uS${i}.xyz;
    zq = -Q.z;
    if (uOrtho > 0.5 || zq > 0.01) {
      float w = uOrtho > 0.5 ? 1.0 : zq;
      at = vec2(Q.x * uFxClip.z / w * 0.5 + 0.5, 0.5 - Q.y * abs(uFxClip.w) / w * 0.5);
      d = p - floor(at / t);
      reach = uS${i}.w;
      if (d.x * d.x + d.y * d.y <= reach * reach + reach && zq <= surface + 0.05) hit = vec4(uK${i}.rgb, 1.0);
    }
  }`,
).join('\n')}
  return hit.a > 0.5 ? vec4(hit.rgb, c.a) : c;
}`

const WGSL = `
${SURFACE_WGSL}
fn effect(uv: vec2<f32>) -> vec4<f32> {
  let c = sampleColor(uv);
  let t = texel();
  let p = floor(uv / t);
  let surface = surfaceDepth(sampleDepth(uv));
  var hit = vec4<f32>(0.0);
${SLOTS.map(
  (i) => `  if (fx.uK${i}.w > 0.5) {
    let Q = fx.uS${i}.xyz;
    let zq = -Q.z;
    if (fx.uOrtho > 0.5 || zq > 0.01) {
      var w = zq;
      if (fx.uOrtho > 0.5) { w = 1.0; }
      let at = vec2<f32>(Q.x * fxh.uFxClip.z / w * 0.5 + 0.5, 0.5 - Q.y * abs(fxh.uFxClip.w) / w * 0.5);
      let d = p - floor(at / t);
      let reach = fx.uS${i}.w;
      if (d.x * d.x + d.y * d.y <= reach * reach + reach && zq <= surface + 0.05) { hit = vec4<f32>(fx.uK${i}.rgb, 1.0); }
    }
  }`,
).join('\n')}
  if (hit.a > 0.5) { return vec4<f32>(hit.rgb, c.a); }
  return c;
}`

export interface ParticlesOptions {
  /** Pixels a unit of a sprite's radius spans (default 2, the source's density at its field). */
  readonly scale?: number
}

export class ParticlesEffect extends TrackingEffect {
  protected override readonly fragment = { gpu: WGSL, gl: GLSL }
  protected override readonly uniforms: UniformGroup
  private emitters: readonly Emitter[]
  private seconds = 0
  private step = 0
  private view: ArrayLike<number> = TrackingEffect.NO_VIEW
  private readonly scale: number

  constructor(emitters: readonly Emitter[] = [], options: ParticlesOptions = {}) {
    // Works on the picture as shown, so it runs after tone mapping (@pixi/3d beta.3 stages a post effect before it by default).
    super({ stage: 'afterToneMapping' })
    this.emitters = emitters
    this.scale = options.scale ?? 2
    this.uniforms = new UniformGroup({
      uOrtho: { value: 0, type: 'f32' },
      ...Object.fromEntries(
        SLOTS.flatMap((i) => [
          [`uS${i}`, { value: new Float32Array(4), type: 'vec4<f32>' as const }],
          [`uK${i}`, { value: new Float32Array(4), type: 'vec4<f32>' as const }],
        ]),
      ),
    })
    this.write()
  }

  /** The scene's emitters. Sprites past `MAX_SPRITES` are left out. */
  setEmitters(emitters: readonly Emitter[]): void {
    this.emitters = emitters
    this.write()
  }

  /** The seconds the sprites move by; they step twelve times a second. */
  set clock(seconds: number) {
    this.seconds = seconds
    const step = Math.floor(seconds * 12)
    if (step === this.step) return
    this.step = step
    this.write()
  }

  protected override viewChanged(view: ArrayLike<number>, ortho: boolean): void {
    this.view = view
    this.uniforms.uniforms.uOrtho = ortho ? 1 : 0
    this.write()
  }

  private write(): void {
    const m = this.view
    const at = (i: number): number => m[i] ?? 0
    const sprites = particleSprites(this.emitters, this.seconds)
    for (const i of SLOTS) {
      const place = this.uniforms.uniforms[`uS${i}`] as Float32Array
      const colour = this.uniforms.uniforms[`uK${i}`] as Float32Array
      const sprite = sprites[i]
      if (sprite === undefined) {
        colour[3] = 0
        continue
      }
      const [x, y, z] = sprite.at
      place[0] = at(0) * x + at(4) * y + at(8) * z + at(12)
      place[1] = at(1) * x + at(5) * y + at(9) * z + at(13)
      place[2] = at(2) * x + at(6) * y + at(10) * z + at(14)
      place[3] = Math.max(0, Math.round(sprite.radius * this.scale))
      colour[0] = ((sprite.colour >> 16) & 255) / 255
      colour[1] = ((sprite.colour >> 8) & 255) / 255
      colour[2] = (sprite.colour & 255) / 255
      colour[3] = 1
    }
    this.uniforms.update()
  }
}
