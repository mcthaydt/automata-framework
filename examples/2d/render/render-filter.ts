// render-filter: two screen-space filters over the picture, and the quality tier that decides which run
//
// Shows: postFilter(name, { glsl, wgsl }) declares a filter over the whole picture, once for WebGL2 and once for
//   WebGPU, so both renderers look the same. `dusk` warms the picture and darkens its corners at every tier.
//   `scanlines` darkens every second row, runs after `dusk` (order) and only from the medium tier up (minTier),
//   so the HUD, which lists the filters running now, loses it at low and gets it back at medium.
// Controls: 1 low, 2 medium, 3 high
// Packages: @automataframework/automata
// Difficulty: ★★★☆
// Tier: core
import {
  defineComponent,
  defineGame,
  definePlugin,
  defineSystem,
  postFilter,
  rect,
} from '@automataframework/automata'

const Drift = defineComponent('drift', { x: 'f32', y: 'f32', vx: 'f32' })

const drift = defineSystem('drift', (ctx) => {
  for (const square of ctx.query(Drift)) {
    const { x, y, vx } = square.get(Drift)
    square.set(Drift, { x: x + vx > 324 ? -4 : x + vx, y, vx })
  }
})

const squares = definePlugin({ name: 'squares', defs: [Drift, drift] })

// A fragment shader reads the picture as `uTexture` at `vTextureCoord` (GLSL) or `input.uv` (WGSL), 0 to 1 across it.
const dusk = postFilter('dusk', {
  glsl: `in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
void main() {
  vec2 away = vTextureCoord - 0.5;
  finalColor = vec4(texture(uTexture, vTextureCoord).rgb * vec3(1.0, 0.85, 0.7) * (1.0 - dot(away, away) * 1.4), 1.0);
}`,
  wgsl: `@fragment fn mainFragment(input: VSOutput) -> @location(0) vec4<f32> {
  let away = input.uv - vec2<f32>(0.5);
  return vec4<f32>(textureSample(uTexture, uSampler, input.uv).rgb * vec3<f32>(1.0, 0.85, 0.7) * (1.0 - dot(away, away) * 1.4), 1.0);
}`,
})

// 180 is the playfield's height, so a row of the filter is a row of the game's pixels.
const scanlines = postFilter('scanlines', {
  glsl: `in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
void main() {
  float odd = mod(floor(vTextureCoord.y * 180.0), 2.0);
  finalColor = vec4(texture(uTexture, vTextureCoord).rgb * (1.0 - 0.3 * odd), 1.0);
}`,
  wgsl: `@fragment fn mainFragment(input: VSOutput) -> @location(0) vec4<f32> {
  let odd = floor(input.uv.y * 180.0) % 2.0;
  return vec4<f32>(textureSample(uTexture, uSampler, input.uv).rgb * (1.0 - 0.3 * odd), 1.0);
}`,
  order: 1,
  minTier: 'medium',
})

const TIER_KEYS = { Digit1: 'low', Digit2: 'medium', Digit3: 'high' } as const

// What the HUD reads from the stage that setup receives.
let stage: { readonly quality: string; readonly postFilters: { readonly ids: readonly string[] } } | undefined

export default defineGame({
  id: 'render-filter',
  size: { width: 320, height: 180 },
  sim: {
    plugins: [squares],
    seed: 1,
    setup: (sim) => {
      for (let row = 0; row < 5; row += 1)
        sim.spawn([[Drift, { x: row * 60, y: 50 + row * 24, vx: 0.5 + row * 0.25 }]])
    },
  },
  views: { [Drift.id]: rect({ w: 12, h: 12, color: 0xf9c22b }) },
  renderer: {
    postFilters: [dusk, scanlines],
    // The tier is presentation: it never reaches the sim, so the keys go straight to the stage.
    setup: (pixi) => {
      stage = pixi
      const pick = (event: KeyboardEvent): void => {
        // Pixi drops the renderer when the game is torn down; the listener then removes itself.
        if (!pixi.app.renderer) window.removeEventListener('keydown', pick)
        else if (event.code in TIER_KEYS) pixi.setQuality(TIER_KEYS[event.code as keyof typeof TIER_KEYS])
      }
      window.addEventListener('keydown', pick)
    },
  },
  draw: (ctx) => {
    if (stage === undefined) return
    ctx.rect(4, 40, 200, 14, 0x2e222f)
    ctx.text(`quality ${stage.quality}   filters ${stage.postFilters.ids.join(' ')}`, 8, 43, {
      color: 0xffffff,
      size: 8,
    })
  },
})
