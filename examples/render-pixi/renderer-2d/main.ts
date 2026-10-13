// examples/render-pixi/renderer-2d: 2D PixiJS renderer with sub-tick interpolation and filter shader.
//
// Shows: WebGL2 default init with WebGPU fallback, sub-tick interpolation across ticks, and screen-space filter shader.
// Controls: automatic motion; moving entity updates across interpolated ticks.
// Base: none.
// Packages: @mcthaydt/automata-render-pixi, @mcthaydt/automata-sim, @mcthaydt/automata-ui, pixi.js, effect.
import '@mcthaydt/automata-render-pixi/no-eval'

import { createPixiRenderer, type EntityView, filterPrograms } from '@mcthaydt/automata-render-pixi'
import type { StepResult } from '@mcthaydt/automata-sim'
import { createGeometryOwner } from '@mcthaydt/automata-ui'
import { Effect, Scope } from 'effect'
import { Filter, Graphics } from 'pixi.js'

async function start() {
  const root = document.querySelector<HTMLElement>('#game')
  if (!root) throw new Error('#game not found')

  const geometryOwner = createGeometryOwner({
    window,
    root: document.documentElement,
  })

  // GLSL + WGSL vignette filter
  const glFragment = `precision highp float;
in vec2 vTextureCoord;
in vec2 vPixelCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
void main() {
  vec4 color = texture(uTexture, vTextureCoord);
  finalColor = color;
}`

  const wgslFragment = `
@fragment fn mainFragment(input: VSOutput) -> @location(0) vec4<f32> {
  return textureSample(uTexture, uSampler, input.uv);
}`

  const { glProgram, gpuProgram } = filterPrograms('vignette', glFragment, wgslFragment)
  const vignetteFilter = new Filter({ glProgram, gpuProgram })

  // Custom entity view for square (sid 1)
  const squareGraphics = new Graphics()
  squareGraphics.rect(-8, -8, 16, 16)
  squareGraphics.fill(0xff0055)

  const squareView: EntityView = {
    container: squareGraphics,
    update(curr, prev, alpha = 1) {
      const p = (prev?.transform ?? curr?.transform) as { x: number; y: number } | undefined
      const c = curr?.transform as { x: number; y: number } | undefined
      if (c && p) {
        const posX = p.x + (c.x - p.x) * alpha
        const posY = p.y + (c.y - p.y) * alpha
        squareGraphics.position.set(posX, posY)
      }
    },
  }

  const factory = createPixiRenderer({
    logicalWidth: 320,
    logicalHeight: 192,
    backgroundColor: 0x111122,
    entityViews: {
      transform: () => squareView,
    },
    setup(stage) {
      stage.filters = [vignetteFilter]
    },
  })

  const target = {
    host: root,
    geometry: geometryOwner,
    assets: { get: () => undefined },
  }

  const scope = Effect.runSync(Scope.make())
  const renderer = await Effect.runPromise(Scope.extend(factory(target), scope))

  // Sim state: bouncing square in 320x192
  let x = 160
  let y = 96
  let vx = 2
  let vy = 1.5
  let frameCount = 0

  // Initial added delta
  renderer.apply({
    tick: 0,
    render: {
      resync: false,
      added: [
        {
          sid: 1,
          components: {
            transform: { x, y },
          },
        },
      ],
      changed: [],
      removed: [],
    },
    events: [],
    rejected: [],
  })

  function loop() {
    frameCount++
    x += vx
    y += vy
    if (x <= 16 || x >= 320 - 16) vx = -vx
    if (y <= 16 || y >= 192 - 16) vy = -vy

    const result: StepResult = {
      tick: frameCount,
      render: {
        resync: false,
        added: [],
        changed: [
          {
            sid: 1,
            components: {
              transform: { x, y },
            },
          },
        ],
        removed: [],
      },
      events: [],
      rejected: [],
    }

    renderer.apply(result)
    renderer.draw({
      alpha: 1,
      frameMs: 16,
      paused: false,
    })

    const canvas = renderer.stage.app.canvas
    canvas.dataset.squareX = String(Math.round(x))
    canvas.dataset.squareY = String(Math.round(y))
    canvas.dataset.frames = String(frameCount)

    requestAnimationFrame(loop)
  }

  requestAnimationFrame(loop)

  // Announce ready
  document.documentElement.dataset.state = 'ready'
}

start().catch((err) => {
  console.error('Failed to start demo', err)
  document.documentElement.dataset.state = 'failed'
})
