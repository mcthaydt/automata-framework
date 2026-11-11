// Light shafts on a real WebGL2 context: the air in a spot lamp's cone catches light, a pixel the view ray crosses it for
// steps up its own ramp toward the lamp's colour, and nothing else moves. WebGPU and WebGL2 parity is the GPU runner's.
import '@automata/3d/no-eval'
import { createPixi3dRenderer, DEFAULT_LOOK, type Pixi3dRenderer, timeOfDay } from '@automata/3d'
import { CubeGeometry, FlatMaterial, Mesh3D } from '@pixi/3d'
import { afterEach, describe, expect, it } from 'vitest'
import { type ShaftLamp, ShaftsEffect, shaftLamps } from '#src/features/sky/shafts-effect.ts'
import { changed, colourAt, DUEL, drawn, pixels, SIZE, SKY, target } from './support.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const frame = { alpha: 1, frameMs: 16, paused: false }

let open: { dispose(): void } | undefined
afterEach(() => {
  open?.dispose()
  open = undefined
  document.body.replaceChildren()
})

const LAMP: ShaftLamp = {
  at: [0, 3, -1],
  aim: [0, -1, 0],
  cone: 70,
  range: 6,
  colour: 0xffd59b,
  level: 1,
}

async function start(): Promise<{ renderer: Pixi3dRenderer; shafts: ShaftsEffect }> {
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
        material: new FlatMaterial({ baseColor: 0x7a7799 }),
      })
      wall.position.set(0, 1, -3)
      wall.scale.set(40, 20, 0.1)
      view.root.addChild(wall)
      return undefined
    },
  })(target(host))
  if (!made.ok) throw made.reason
  open = made.value
  const shafts = new ShaftsEffect()
  made.value.view.passes = [...made.value.view.passes, shafts]
  // The view builds the camera's matrices as it draws, so the pass is told of the camera after a frame.
  made.value.draw(frame)
  return { renderer: made.value, shafts }
}

function shot(renderer: Pixi3dRenderer): Uint8Array {
  for (let i = 0; i < 4; i++) renderer.draw(frame)
  return pixels(renderer)
}

describe.runIf(hasWebGL2)('light shafts on WebGL2', () => {
  it('steps up the pixels the lamp’s cone lights, to DUEL colours, and leaves the sides of the frame alone', async () => {
    const { renderer, shafts } = await start()
    const bare = shot(renderer)
    shafts.setLamps([LAMP])
    shafts.track(renderer.view.camera)
    const lit = shot(renderer)
    const moved = drawn(bare, lit)
    expect(moved.length).toBeGreaterThan(30)
    expect(moved.every((i) => DUEL.has(colourAt(lit, i)))).toBe(true)
    // The cone is over the middle: nothing in the outer fifth of the frame.
    const x = (i: number): number => i % SIZE.width
    expect(moved.every((i) => x(i) > SIZE.width * 0.2 && x(i) < SIZE.width * 0.8)).toBe(true)
  })

  it('does nothing with the lamp out, and the shafts follow the lamp’s level', async () => {
    const { renderer, shafts } = await start()
    const bare = shot(renderer)
    shafts.setLamps([{ ...LAMP, level: 0 }])
    shafts.track(renderer.view.camera)
    expect(changed(bare, shot(renderer))).toEqual([])
    shafts.setLevel(0, 1)
    const full = drawn(bare, shot(renderer)).length
    expect(full).toBeGreaterThan(30)
    shafts.setLevel(0, 0.3)
    expect(drawn(bare, shot(renderer)).length).toBeLessThan(full)
  })

  it('keeps the shaft on the lamp when the camera moves and the pass tracks it', async () => {
    const { renderer, shafts } = await start()
    shafts.setLamps([LAMP])
    shafts.track(renderer.view.camera)
    const bare = shot(renderer)
    renderer.view.camera.position.set(2, 1, 5)
    renderer.view.camera.lookAt({ x: 2, y: 1, z: -3 })
    shafts.enabled = false
    const moved = shot(renderer)
    shafts.enabled = true
    shafts.track(renderer.view.camera)
    const lit = shot(renderer)
    void bare
    // The camera slid right by 2 m, so the cone is left of the middle now: its pixels sit in the left half.
    const left = drawn(moved, lit).filter((i) => i % SIZE.width < SIZE.width / 2).length
    const right = drawn(moved, lit).filter((i) => i % SIZE.width >= SIZE.width / 2).length
    expect(left + right).toBeGreaterThan(30)
    expect(left).toBeGreaterThan(right)
  })
})

describe.runIf(hasWebGL2)('light shafts: which way is up', () => {
  it('puts the shaft of a high lamp in the upper rows of the frame and a low lamp’s in the lower', async () => {
    const meanRow = async (y: number): Promise<number> => {
      const { renderer, shafts } = await start()
      const bare = shot(renderer)
      shafts.setLamps([{ ...LAMP, at: [0, y, -1] }])
      shafts.track(renderer.view.camera)
      const moved = drawn(bare, shot(renderer))
      expect(moved.length).toBeGreaterThan(10)
      const mean = moved.reduce((sum, i) => sum + Math.floor(i / SIZE.width), 0) / moved.length
      open?.dispose()
      open = undefined
      document.body.replaceChildren()
      return mean
    }
    const high = await meanRow(2)
    const low = await meanRow(0)
    expect(high).toBeLessThan(low - 3)
  })
})

describe('shaftLamps', () => {
  const lamp = (over: object) => ({
    id: 'a',
    kind: 'sodium',
    at: [1, 4, 2] as [number, number, number],
    color: 0xffbc4e,
    range: 8,
    level: 1,
    peak: 1.25,
    dusk: true,
    aim: [0, -1, 0.15] as [number, number, number],
    cone: 72,
    shaft: true,
    ...over,
  })

  it('takes the lamps that throw a shaft and aim: a street lamp, not a pendant or a lamp with no cone', () => {
    const lamps = [
      lamp({}),
      lamp({ id: 'b', shaft: undefined }),
      lamp({ id: 'c', aim: undefined, cone: undefined }),
    ]
    expect(shaftLamps(lamps)).toEqual([
      { at: [1, 4, 2], aim: [0, -1, 0.15], cone: 72, range: 8, colour: 0xffbc4e, level: 1 },
    ])
  })
})
