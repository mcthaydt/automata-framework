// Rain: streaks that fall in front of what is drawn. Three layers of columns, each streak a few pixels long and leaning a
// little, falling at its own speed; a streak has a depth, and is seen only where the scene behind it is farther, so rain
// does not draw over a wall that stands between the camera and the drop. Streaks are a single DUEL colour (never blended).
// A `PostEffect` in GLSL + WGSL.

import { PostEffect } from '@pixi/3d'
import { UniformGroup } from 'pixi.js'
import { HASH_GLSL, HASH_WGSL } from './shader-parts.ts'

/** Three layers of columns; each streak shows only where the scene is farther than its depth. */
const LAYERS = 3

const GLSL = `
${HASH_GLSL}
vec4 effect(vec2 uv) {
  vec4 c = sampleColor(uv);
  vec2 size = 1.0 / texel();
  vec2 p = floor(uv * size);
  float behind = linearDepth(sampleDepth(uv));
  for (int layer = 0; layer < ${LAYERS}; layer++) {
    float x = p.x + floor(p.y * 0.2);
    if (int(mod(x, 3.0)) != 1) continue;
    int column = int(floor(x / 3.0)) + layer * 977;
    if (hash3(column, layer, 5) >= uDensity * 0.34) continue;
    float speed = 90.0 + hash3(column, layer, 6) * 60.0;
    float span = size.y + 30.0;
    float head = fract(hash3(column, layer, 7) + uClock * speed / span) * span - 15.0;
    float length = 4.0 + floor(hash3(column, layer, 8) * 4.0);
    if (p.y > head || p.y <= head - length) continue;
    if (behind < 2.0 + hash3(column, layer, 9) * 12.0) continue;
    return vec4(uColour, 1.0);
  }
  return c;
}`

const WGSL = `
${HASH_WGSL}
fn effect(uv: vec2<f32>) -> vec4<f32> {
  let c = sampleColor(uv);
  let size = 1.0 / texel();
  let p = floor(uv * size);
  let behind = linearDepth(sampleDepth(uv));
  for (var layer = 0; layer < ${LAYERS}; layer++) {
    let x = p.x + floor(p.y * 0.2);
    if (i32(x % 3.0) != 1) { continue; }
    let column = i32(floor(x / 3.0)) + layer * 977;
    if (hash3(column, layer, 5) >= fx.uDensity * 0.34) { continue; }
    let speed = 90.0 + hash3(column, layer, 6) * 60.0;
    let span = size.y + 30.0;
    let head = fract(hash3(column, layer, 7) + fx.uClock * speed / span) * span - 15.0;
    let len = 4.0 + floor(hash3(column, layer, 8) * 4.0);
    if (p.y > head || p.y <= head - len) { continue; }
    if (behind < 2.0 + hash3(column, layer, 9) * 12.0) { continue; }
    return vec4<f32>(fx.uColour, 1.0);
  }
  return c;
}`

export class RainEffect extends PostEffect {
  protected override readonly fragment = { gpu: WGSL, gl: GLSL }
  protected override readonly uniforms: UniformGroup

  /** `density` 0 to 1 (how many columns have a streak); `colour` a 0 to 1 triple, already a DUEL colour. */
  constructor(density: number, colour: readonly [number, number, number]) {
    super()
    this.uniforms = new UniformGroup({
      uDensity: { value: density, type: 'f32' },
      uClock: { value: 0, type: 'f32' },
      uColour: { value: new Float32Array(colour), type: 'vec3<f32>' },
    })
  }

  /** The time, in seconds, the streaks fall by. */
  set clock(seconds: number) {
    this.uniforms.uniforms.uClock = seconds
  }

  get density(): number {
    return this.uniforms.uniforms.uDensity as number
  }
}
