// The coloured outline on a real WebGL2 context: a pixel beside a nearer shape takes that shape's own colour, two steps down
// its ramp on the key's side and three off it, and it stays a DUEL colour. WebGPU and WebGL2 parity is the GPU runner's.
import '#src/entries/no-eval.ts'
import { DEFAULT_PALETTE } from '@automataframework/content/palette'
import { CubeGeometry, FlatMaterial, Mesh3D } from '@pixi/3d'
import { afterEach, describe, expect, it } from 'vitest'
import { createPixi3dRenderer, type Pixi3dRenderer } from '#src/app/create-renderer.ts'
import { parseLook } from '#src/features/look/look.ts'
import { OutlineEffect } from '#src/features/look/outline-filter.ts'
import { builtRenderer } from '#src/testing/built-renderer.ts'
import { snapshot } from '#src/testing/snapshot.ts'
import { testTarget } from '#src/testing/test-target.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const frame = { alpha: 1, frameMs: 16, paused: false }
const WIDTH = 160
const HEIGHT = 90
const PALETTE = DEFAULT_PALETTE.colors.map((hex) => Number.parseInt(hex.slice(1), 16))
const SKY = 0x2e222f

let scope: { dispose(): void } | undefined
afterEach(() => {
  scope?.dispose()
  scope = undefined
  document.body.replaceChildren()
})

/** A bright box in front of a wall, drawn with the outline's pass in the list. */
async function start(): Promise<{ renderer: Pixi3dRenderer; outline: OutlineEffect }> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const factory = createPixi3dRenderer({
    logicalWidth: WIDTH,
    logicalHeight: HEIGHT,
    backgroundColor: SKY,
    views: {},
    look: parseLook({ dither: { strength: 0 }, switches: { outline: true, haze: false } }),
    scene: (view) => {
      view.camera.position.set(0, 0, 5)
      view.camera.lookAt({ x: 0, y: 0, z: 0 })
      const box = new Mesh3D({
        geometry: new CubeGeometry(),
        material: new FlatMaterial({ baseColor: 0xffffff }),
      })
      view.root.addChild(box)
      const wall = new Mesh3D({
        geometry: new CubeGeometry(),
        material: new FlatMaterial({ baseColor: 0x4a5280 }),
      })
      wall.position.set(0, 0, -3)
      wall.scale.set(40, 20, 0.1)
      view.root.addChild(wall)
      return undefined
    },
  })
  const renderer = await builtRenderer(factory(testTarget(host, {})))
  scope = renderer
  const outline = renderer.view.passes.find((p): p is OutlineEffect => p instanceof OutlineEffect)
  if (outline === undefined) throw new Error('no outline pass')
  return { renderer, outline }
}

const colourAt = (px: ArrayLike<number>, x: number, y: number): number => {
  const i = (y * WIDTH + x) * 4
  return ((px[i] ?? 0) << 16) | ((px[i + 1] ?? 0) << 8) | (px[i + 2] ?? 0)
}
const indexOf = (colour: number): number => PALETTE.indexOf(colour)

function shot(renderer: Pixi3dRenderer): ArrayLike<number> {
  renderer.draw(frame)
  renderer.draw(frame)
  return snapshot(renderer)
}

describe.runIf(hasWebGL2)('the coloured outline on WebGL2', () => {
  it('changes only the pixels beside the box, to DUEL colours on the box’s own ramp, darker than it', async () => {
    const { renderer, outline } = await start()
    outline.enabled = false
    const plain = shot(renderer)
    outline.enabled = true
    const lined = shot(renderer)
    const owner = indexOf(colourAt(lined, WIDTH / 2, HEIGHT / 2))
    expect(owner).toBeGreaterThanOrEqual(0)
    const changed: number[] = []
    for (let y = 0; y < HEIGHT; y++)
      for (let x = 0; x < WIDTH; x++)
        if (colourAt(plain, x, y) !== colourAt(lined, x, y)) changed.push(colourAt(lined, x, y))
    expect(changed.length).toBeGreaterThan(40)
    for (const colour of changed) {
      const at = indexOf(colour)
      expect(at).toBeGreaterThanOrEqual(0)
      expect(Math.floor(at / 8)).toBe(Math.floor(owner / 8))
      expect(at % 8).toBeLessThan(owner % 8)
    }
  })

  it('takes two steps down on the key’s side and three off it, whichever way the key comes', async () => {
    const { renderer, outline } = await start()
    outline.enabled = false
    const plain = shot(renderer)
    outline.enabled = true
    const sides = (key: [number, number]) => {
      outline.key(...key)
      const lined = shot(renderer)
      const owner = indexOf(colourAt(lined, WIDTH / 2, HEIGHT / 2))
      const row: number[] = []
      for (let x = 0; x < WIDTH; x++) {
        const y = HEIGHT / 2
        if (colourAt(plain, x, y) !== colourAt(lined, x, y)) row.push(x)
      }
      const column: number[] = []
      for (let y = 0; y < HEIGHT; y++) {
        const x = WIDTH / 2
        if (colourAt(plain, x, y) !== colourAt(lined, x, y)) column.push(y)
      }
      const step = (x: number, y: number) => (indexOf(colourAt(lined, x, y)) % 8) - (owner % 8)
      return {
        left: step(row[0] as number, HEIGHT / 2),
        right: step(row.at(-1) as number, HEIGHT / 2),
        top: step(WIDTH / 2, column[0] as number),
        bottom: step(WIDTH / 2, column.at(-1) as number),
      }
    }
    expect(sides([-1, 0])).toMatchObject({ left: -2, right: -3 })
    expect(sides([1, 0])).toMatchObject({ left: -3, right: -2 })
    expect(sides([0, -1])).toMatchObject({ top: -2, bottom: -3 })
    expect(sides([0, 1])).toMatchObject({ top: -3, bottom: -2 })
  })
})
