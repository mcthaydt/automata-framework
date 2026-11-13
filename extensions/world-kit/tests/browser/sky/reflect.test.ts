// Wet-ground reflections on a real WebGL2 context: a ground pixel mirrors the frame about the ground plane, its reflected ray
// marched through the depth buffer, and takes the colour it meets a step down its own ramp (one in a puddle, two on wet
// ground, where only what glows reflects). WebGPU and WebGL2 parity is the GPU runner's.
import '@automata/3d/no-eval'
import { createPixi3dRenderer, DEFAULT_LOOK, type Pixi3dRenderer, timeOfDay } from '@automata/3d'
import { CubeGeometry, FlatMaterial, Mesh3D, SphereGeometry } from '@pixi/3d'
import { afterEach, describe, expect, it } from 'vitest'
import { ReflectEffect } from '#src/features/sky/reflect-effect.ts'
import { ballStepsDown, changed, colourAt, DUEL, drawn, pixels, SIZE, SKY, target } from './support.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const frame = { alpha: 1, frameMs: 16, paused: false }

let open: { dispose(): void } | undefined
afterEach(() => {
  open?.dispose()
  open = undefined
  document.body.replaceChildren()
})

/** A ball over a ground, seen from a little above. The ball is white, so it glows. */
async function start(): Promise<{ renderer: Pixi3dRenderer; reflect: ReflectEffect }> {
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
      view.camera.position.set(0, 1.5, 6)
      view.camera.lookAt({ x: 0, y: 0.4, z: 0 })
      const ground = new Mesh3D({
        geometry: new CubeGeometry(),
        material: new FlatMaterial({ baseColor: 0x3a4568 }),
      })
      ground.position.set(0, -0.05, 0)
      ground.scale.set(40, 0.1, 40)
      view.root.addChild(ground)
      const ball = new Mesh3D({
        geometry: new SphereGeometry(),
        material: new FlatMaterial({ baseColor: 0xffffff }),
      })
      ball.position.set(0, 1.2, 0)
      ball.scale.set(0.3, 0.3, 0.3)
      view.root.addChild(ball)
      return undefined
    },
  })(target(host))
  if (!made.ok) throw made.reason
  open = made.value
  const reflect = new ReflectEffect({ ground: 0, puddles: 1 })
  made.value.view.passes = [...made.value.view.passes, reflect]
  // The view builds the camera's matrices as it draws, so the pass is told of the camera after a frame.
  made.value.draw(frame)
  reflect.track(made.value.view.camera)
  return { renderer: made.value, reflect }
}

function shot(renderer: Pixi3dRenderer): Uint8Array {
  for (let i = 0; i < 4; i++) renderer.draw(frame)
  return pixels(renderer)
}

describe.runIf(hasWebGL2)('wet-ground reflections on WebGL2', () => {
  it('mirrors the ball in the puddle, a step down its ramp, in DUEL colours, below it and nowhere else', async () => {
    const { renderer, reflect } = await start()
    reflect.enabled = false
    const dry = shot(renderer)
    reflect.enabled = true
    const wet = shot(renderer)
    const moved = drawn(dry, wet)
    expect(moved.length).toBeGreaterThan(5)
    expect(moved.every((i) => DUEL.has(colourAt(wet, i)))).toBe(true)
    // The ball is white, the lightest step of its ramp; a puddle takes one step down. Its mirror is on the ground below it:
    // the lower half of the frame, round its middle. (The rest of the puddle mirrors the sky.)
    const mirrored = ballStepsDown(dry, 1)
    expect(mirrored).toBeDefined()
    const mirror = moved.filter((i) => colourAt(wet, i) === mirrored)
    expect(mirror.length).toBeGreaterThan(5)
    expect(mirror.every((i) => Math.floor(i / SIZE.width) > SIZE.height / 2)).toBe(true)
    expect(mirror.every((i) => Math.abs((i % SIZE.width) - SIZE.width / 2) < SIZE.width * 0.2)).toBe(true)
  })

  it('on wet ground outside puddles reflects only what glows, two steps down', async () => {
    const { renderer, reflect } = await start()
    reflect.enabled = false
    const dry = shot(renderer)
    reflect.enabled = true
    reflect.setPuddles(0)
    const wet = shot(renderer)
    const moved = drawn(dry, wet)
    expect(moved.length).toBeGreaterThan(5)
    // Only the glowing ball is mirrored (a handful of pixels, against a puddle's whole ground), two steps down.
    expect(moved.length).toBeLessThan(300)
    expect(moved.every((i) => DUEL.has(colourAt(wet, i)))).toBe(true)
    const mirrored = ballStepsDown(dry, 2)
    expect(mirrored).toBeDefined()
    const mirror = moved.filter((i) => colourAt(wet, i) === mirrored)
    expect(mirror.length).toBeGreaterThan(5)
    expect(mirror.every((i) => Math.abs((i % SIZE.width) - SIZE.width / 2) < SIZE.width * 0.2)).toBe(true)
  })

  it('does nothing when the ground is not under the view: a plane far below', async () => {
    const { renderer, reflect } = await start()
    reflect.enabled = false
    const dry = shot(renderer)
    reflect.enabled = true
    reflect.setGround(-50)
    expect(changed(dry, shot(renderer)).filter((i) => i >= 0).length).toBe(0)
  })
})
