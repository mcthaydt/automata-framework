// The kit's look passes on a real WebGL2 context. Core's look is registered first and the kit's passes are added once,
// after the test that shows a frame without them (the registry is the page's, so order within this file is the point).
// WebGPU and WebGL2 parity is the GPU runner's: Chromium here has no WebGPU adapter.
import '@automata/3d/no-eval'
import { createPixi3dRenderer, DEFAULT_LOOK, type Pixi3dRenderer, timeOfDay } from '@automata/3d'
import { CubeGeometry, DirectionalLight, FlatMaterial, Mesh3D, SphereGeometry } from '@pixi/3d'
import { afterEach, describe, expect, it } from 'vitest'
import { GlowEffect } from '#src/features/sky/glow-effect.ts'
import { RainEffect } from '#src/features/sky/rain-effect.ts'
import { addSkyPasses } from '#src/features/sky/sky-passes.ts'
import { StarsEffect } from '#src/features/sky/stars-effect.ts'
import { colourAt, DUEL, drawn, pixels, SIZE, SKY, target } from './support.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const frame = { alpha: 1, frameMs: 16, paused: false }

let open: { dispose(): void } | undefined
afterEach(() => {
  open?.dispose()
  open = undefined
  document.body.replaceChildren()
})

/** A scene needs something drawn for the depth buffer to be cleared; `ball` is a small white ball low in the frame, or a big
 * one in the middle. */
async function start(big = false): Promise<Pixi3dRenderer> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const made = await createPixi3dRenderer({
    logicalWidth: SIZE.width,
    logicalHeight: SIZE.height,
    backgroundColor: SKY,
    views: {},
    look: DEFAULT_LOOK,
    time: timeOfDay('night'),
    scene: (view) => {
      view.camera.position.set(0, 1, 5)
      view.camera.lookAt({ x: 0, y: 1, z: 0 })
      const sun = new DirectionalLight({ intensity: 2 })
      view.root.addChild(sun)
      const ball = new Mesh3D({
        geometry: new SphereGeometry(),
        material: new FlatMaterial({ baseColor: 0xffffff }),
      })
      ball.position.set(big ? 0 : -1.5, big ? 1 : -1.2, 0)
      ball.scale.set(big ? 1 : 0.2, big ? 1 : 0.2, big ? 1 : 0.2)
      view.root.addChild(ball)
      if (big) {
        // A wall behind the ball for the glow to light.
        const wall = new Mesh3D({
          geometry: new CubeGeometry(),
          material: new FlatMaterial({ baseColor: 0x4a3f5c }),
        })
        wall.position.set(0, 1, -2)
        wall.scale.set(20, 12, 0.1)
        view.root.addChild(wall)
      }
      return undefined
    },
  })(target(host))
  if (!made.ok) throw made.reason
  open = made.value
  return made.value
}

const passOf = <T>(renderer: Pixi3dRenderer, type: new (...a: never[]) => T): T => {
  const found = renderer.view.passes.find((p) => p instanceof type)
  if (found === undefined) throw new Error(`no ${type.name} among the view's passes`)
  return found as T
}

/** Draws twice (the first frame builds the graph) and returns the canvas. */
function shot(renderer: Pixi3dRenderer): Uint8Array {
  renderer.draw(frame)
  renderer.draw(frame)
  return pixels(renderer)
}

describe.runIf(hasWebGL2)('the kit’s look passes on WebGL2', () => {
  let bare: Uint8Array

  it('a frame without the kit’s passes is the sky and the ball, with no stars, no rain and no glow', async () => {
    const renderer = await start()
    bare = shot(renderer)
    // The sky is whatever the canvas shows empty; only the small ball is drawn.
    expect(drawn(bare, new Uint8Array(bare.length)).length).toBeLessThan(200)
  })

  it('adding the passes puts them after core’s snap, and a taken name is refused', async () => {
    addSkyPasses({ rain: { density: 1 } })
    expect(() => addSkyPasses({ stars: true, glow: false })).toThrow()
    const renderer = await start()
    const names = renderer.view.passes.map((p) => p.constructor.name)
    expect(names).toEqual(['DuelSnapEffect', 'StarsEffect', 'GlowEffect', 'RainEffect'])
  })

  it('stars are DUEL colours in the sky above the horizon, and only there', async () => {
    const renderer = await start()
    passOf(renderer, GlowEffect).enabled = false
    passOf(renderer, RainEffect).enabled = false
    const stars = drawn(bare, shot(renderer))
    const frameNow = pixels(renderer)
    expect(stars.length).toBeGreaterThan(5)
    expect(stars.every((i) => DUEL.has(colourAt(frameNow, i)))).toBe(true)
    // The camera looks level, so the horizon is the middle row: no star below it.
    expect(stars.every((i) => Math.floor(i / SIZE.width) < SIZE.height / 2)).toBe(true)
  })

  it('stars hold their place in the sky as the camera turns', async () => {
    const renderer = await start()
    passOf(renderer, GlowEffect).enabled = false
    passOf(renderer, RainEffect).enabled = false
    const stars = passOf(renderer, StarsEffect)
    const before = shot(renderer)
    stars.aim(0.4, 0)
    const after = shot(renderer)
    expect(drawn(before, after).length).toBeGreaterThan(5)
  })

  it('rain falls in the open, a streak at a time, and moves with the clock', async () => {
    const renderer = await start()
    passOf(renderer, GlowEffect).enabled = false
    passOf(renderer, StarsEffect).enabled = false
    const rain = passOf(renderer, RainEffect)
    const a = shot(renderer)
    rain.clock = 0.4
    const b = shot(renderer)
    expect(drawn(bare, a).length).toBeGreaterThan(10)
    expect(drawn(a, b).length).toBeGreaterThan(10)
    expect(drawn(bare, b).every((i) => DUEL.has(colourAt(b, i)))).toBe(true)
  })

  it('a glow rings what is bright in whole steps, and nothing else changes', async () => {
    const renderer = await start(true)
    passOf(renderer, StarsEffect).enabled = false
    passOf(renderer, RainEffect).enabled = false
    const glow = passOf(renderer, GlowEffect)
    glow.enabled = false
    const without = shot(renderer)
    glow.enabled = true
    const withGlow = shot(renderer)
    const rings = drawn(without, withGlow)
    expect(rings.length).toBeGreaterThan(10)
    const luma = (px: Uint8Array, i: number): number =>
      (0.2126 * (px[i * 4] ?? 0) + 0.7152 * (px[i * 4 + 1] ?? 0) + 0.0722 * (px[i * 4 + 2] ?? 0)) / 255
    const bright = new Set<number>()
    for (let i = 0; i < without.length / 4; i++) if (luma(without, i) >= 0.85) bright.add(i)
    const near = (i: number): boolean => {
      const [x, y] = [i % SIZE.width, Math.floor(i / SIZE.width)]
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) if (bright.has((y + dy) * SIZE.width + x + dx)) return true
      return false
    }
    // Every pixel the glow changed is a DUEL colour, a step lighter than it was, within three pixels of something bright.
    expect(rings.filter((i) => !DUEL.has(colourAt(withGlow, i)))).toEqual([])
    expect(rings.filter((i) => luma(withGlow, i) < luma(without, i))).toEqual([])
    expect(rings.filter((i) => !near(i))).toEqual([])
  })
})
