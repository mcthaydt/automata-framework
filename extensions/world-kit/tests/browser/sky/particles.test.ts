// Particles on a real WebGL2 context: a flame's sprites are laid over the frame in their own DUEL colours, a few pixels
// across, and a shape in front of them hides them (they are depth-tested). WebGPU and WebGL2 parity is the GPU runner's.
import '@automata/3d/no-eval'
import { createPixi3dRenderer, DEFAULT_LOOK, type Pixi3dRenderer, timeOfDay } from '@automata/3d'
import { CubeGeometry, FlatMaterial, Mesh3D } from '@pixi/3d'
import { afterEach, describe, expect, it } from 'vitest'
import { ParticlesEffect } from '#src/features/sky/particles-effect.ts'
import { colourAt, DUEL, drawn, pixels, SIZE, SKY, target } from './support.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const frame = { alpha: 1, frameMs: 16, paused: false }

let open: { dispose(): void } | undefined
afterEach(() => {
  open?.dispose()
  open = undefined
  document.body.replaceChildren()
})

async function start(blocked: boolean): Promise<{ renderer: Pixi3dRenderer; particles: ParticlesEffect }> {
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
      view.camera.lookAt({ x: 0, y: 1, z: -3 })
      const wall = new Mesh3D({
        geometry: new CubeGeometry(),
        material: new FlatMaterial({ baseColor: 0x4a5280 }),
      })
      wall.position.set(0, 1, -3)
      wall.scale.set(40, 20, 0.1)
      view.root.addChild(wall)
      if (blocked) {
        const screen = new Mesh3D({
          geometry: new CubeGeometry(),
          material: new FlatMaterial({ baseColor: 0x7a7799 }),
        })
        screen.position.set(0, 1, 2)
        screen.scale.set(4, 4, 0.1)
        view.root.addChild(screen)
      }
      return undefined
    },
  })(target(host))
  if (!made.ok) throw made.reason
  open = made.value
  const particles = new ParticlesEffect([{ kind: 'flame', at: [0, 1, 0] }])
  made.value.view.passes = [...made.value.view.passes, particles]
  made.value.draw(frame)
  particles.track(made.value.view.camera)
  return { renderer: made.value, particles }
}

function shot(renderer: Pixi3dRenderer): Uint8Array {
  for (let i = 0; i < 4; i++) renderer.draw(frame)
  return pixels(renderer)
}

describe.runIf(hasWebGL2)('particles on WebGL2', () => {
  it('lays a flame’s three sprites on the middle of the frame in their own colours, a few pixels across', async () => {
    const { renderer, particles } = await start(false)
    particles.enabled = false
    const bare = shot(renderer)
    particles.enabled = true
    const lit = shot(renderer)
    const moved = drawn(bare, lit)
    expect(moved.length).toBeGreaterThan(6)
    expect(moved.length).toBeLessThan(80)
    expect(moved.every((i) => DUEL.has(colourAt(lit, i)))).toBe(true)
    const colours = new Set(moved.map((i) => colourAt(lit, i)))
    expect(colours).toContain(0xffe949)
    expect(colours).toContain(0xf99b4e)
    expect(moved.every((i) => Math.abs((i % SIZE.width) - SIZE.width / 2) < 12)).toBe(true)
  })

  it('hides them behind a shape in front of them', async () => {
    const { renderer, particles } = await start(true)
    particles.enabled = false
    const bare = shot(renderer)
    particles.enabled = true
    expect(drawn(bare, shot(renderer))).toEqual([])
  })
})
