// Lighting and fog on a real context (M3.4d): D3-e end to end, through the render rows. Headless Firefox in this
// container has no WebGL, so these skip there and the GPU runner runs them (M3.1b).
import '#src/entries/no-eval.ts'
import type { RenderRow, StepResult } from '@automata/sim'
import { FlatMaterial, Mesh3D, PlaneGeometry } from '@pixi/3d'
import { afterEach, describe, expect, it } from 'vitest'
import { createPixi3dRenderer, type Pixi3dRenderer } from '#src/app/create-renderer.ts'
import { sceneLightingSchema } from '#src/shared/render/light/scene-lighting.schema.ts'
import { box } from '#src/shared/render/views/box-view.ts'
import { builtRenderer } from '#src/testing/built-renderer.ts'
import { snapshot } from '#src/testing/snapshot.ts'
import { testTarget } from '#src/testing/test-target.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const WIDTH = 160
const frame = { alpha: 1, frameMs: 16, paused: false }
const step = (render: StepResult['render']): StepResult => ({ tick: 0, events: [], render, rejected: [] })

// Two lamps 6 m apart over a floor, each reaching only its own half; a lit box stands under each.
const lighting = sceneLightingSchema.parse({
  ambient: 0.2,
  lamps: [
    { id: 'west', x: -3, y: 1.5, z: 0, color: 0xffcc80, strength: 2, range: 2.8 },
    { id: 'east', x: 3, y: 1.5, z: 0, color: 0x80c0ff, strength: 2, range: 2.8 },
  ],
})
const characters: RenderRow[] = [
  { sid: 1, components: { walker: { x: -3, y: 0, z: 1 } } },
  { sid: 2, components: { walker: { x: 3, y: 0, z: 1 } } },
]

/** The renderer the test built, disposed after it. */
let scope: { dispose(): void } | undefined
afterEach(async () => {
  scope?.dispose()
  scope = undefined
  document.body.replaceChildren()
})

async function start(
  fog?: { near: number; far: number; color: number },
  floors = true,
): Promise<Pixi3dRenderer> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const factory = createPixi3dRenderer({
    logicalWidth: WIDTH,
    logicalHeight: 90,
    backgroundColor: 0x000000,
    views: { walker: box({ width: 0.6, height: 1, depth: 0.6 }, { color: 0xffffff, lit: 'moving' }) },
    lighting,
    lamps: 'lamp',
    fog,
    scene: (view, _stage, _occluders, light) => {
      view.camera.position.set(0, 5, 7)
      view.camera.lookAt({ x: 0, y: 0, z: 0 })
      for (const x of floors ? [-3, 3] : []) {
        const floor = new Mesh3D({
          geometry: new PlaneGeometry({ width: 5.8, height: 6, widthSegments: 12, heightSegments: 12 }),
          material: new FlatMaterial({ baseColor: 0xffffff }),
        })
        floor.position.set(x, 0, 0)
        floor.rotation.set(-Math.PI / 2, 0, 0)
        view.root.addChild(floor)
        light?.bake(floor)
      }
      return undefined
    },
  })
  const renderer = await builtRenderer(factory(testTarget(host)))
  scope = renderer
  return renderer
}

/** Pixels in columns [from, to) that got darker / changed at all between two snapshots, by more than a rounding step. */
function compare(a: ArrayLike<number>, b: ArrayLike<number>, from: number, to: number) {
  let darker = 0
  let changed = 0
  for (let i = 0; i < a.length; i += 4) {
    const column = (i / 4) % WIDTH
    if (column < from || column >= to) continue
    const before = (a[i] ?? 0) + (a[i + 1] ?? 0) + (a[i + 2] ?? 0)
    const after = (b[i] ?? 0) + (b[i + 1] ?? 0) + (b[i + 2] ?? 0)
    if (Math.abs(before - after) > 6) changed++
    if (before - after > 6) darker++
  }
  return { darker, changed }
}

describe.runIf(hasWebGL2)('lighting and fog on WebGL2', () => {
  it('D3-e: a lamp switched off by a sim entity darkens its side, and only its side', async () => {
    const renderer = await start()
    renderer.apply(step({ resync: true, added: characters, changed: [], removed: [] }))
    renderer.draw(frame)
    const on = snapshot(renderer)

    renderer.apply(
      step({
        resync: false,
        added: [{ sid: 9, components: { lamp: { lamp: 'west', level: 0 } } }],
        changed: [],
        removed: [],
      }),
    )
    renderer.draw(frame)
    const off = snapshot(renderer)

    // The west lamp lit the left of the frame: hundreds of its pixels darken. The east half is untouched.
    expect(compare(on, off, 0, WIDTH / 2 - 8).darker).toBeGreaterThan(300)
    expect(compare(on, off, WIDTH / 2 + 8, WIDTH).changed).toBe(0)

    // Removing the switch hands the lamp back to its content level: the frame is as before.
    renderer.apply(step({ resync: false, added: [], changed: [], removed: [9] }))
    renderer.draw(frame)
    expect(compare(on, snapshot(renderer), 0, WIDTH).changed).toBe(0)
  })

  it('D3-e, the characters: the lit walker under the switched-off lamp darkens, the other does not', async () => {
    // No floors: only the two walkers draw, so every changed pixel is a character's.
    const renderer = await start(undefined, false)
    renderer.apply(step({ resync: true, added: characters, changed: [], removed: [] }))
    renderer.draw(frame)
    const on = snapshot(renderer)
    renderer.apply(
      step({
        resync: false,
        added: [{ sid: 9, components: { lamp: { lamp: 'west', level: 0 } } }],
        changed: [],
        removed: [],
      }),
    )
    renderer.draw(frame)
    const off = snapshot(renderer)
    expect(compare(on, off, 0, WIDTH / 2).darker).toBeGreaterThan(30)
    expect(compare(on, off, WIDTH / 2, WIDTH).changed).toBe(0)
  })

  it('fog from the options turns the floor toward the fog colour', async () => {
    const FOG = 0x3e3546
    const clear = await start()
    clear.draw(frame)
    const without = snapshot(clear)
    scope?.dispose()
    document.body.replaceChildren()
    const foggy = await start({ near: 4, far: 10, color: FOG })
    expect(foggy.view.fog).toMatchObject({ type: 'linear', near: 4, far: 10 })
    foggy.draw(frame)
    const withFog = snapshot(foggy)
    expect(compare(without, withFog, 0, WIDTH).changed).toBeGreaterThan(300)
    // Over the pixels fog changed, each is nearer the fully fogged colour than it was. Finding (0.1.0-beta.2): that
    // colour is the fog colour's linear value (0x3e3546 draws as 0x0c0910), as if the mix ran after the display
    // encode, though the fog bit's own comment says it runs before it. Reported to the Owner with M3.4d.
    const linear = (c: number) => Math.round(255 * ((c / 255 + 0.055) / 1.055) ** 2.4)
    const target = [linear((FOG >> 16) & 255), linear((FOG >> 8) & 255), linear(FOG & 255)]
    const away = (pixels: ArrayLike<number>, i: number) =>
      Math.abs((pixels[i] ?? 0) - (target[0] ?? 0)) +
      Math.abs((pixels[i + 1] ?? 0) - (target[1] ?? 0)) +
      Math.abs((pixels[i + 2] ?? 0) - (target[2] ?? 0))
    let nearer = 0
    let farther = 0
    for (let i = 0; i < without.length; i += 4) {
      const before = away(without, i)
      const after = away(withFog, i)
      if (before - after > 6) nearer++
      if (after - before > 6) farther++
    }
    expect(nearer).toBeGreaterThan(300)
    expect(farther).toBe(0)
  })

  // The sky behind fog (Owner, 2026-10-30; spec §4.2, S7-Q10: fog closes every view's far side). With fog, the sky is
  // the colour fog reaches, so a wall fades into it with no edge. Here fog is full from 2 m and the camera stands
  // about 8 m from the floor, so floor and sky alike must be that one colour. The options' backgroundColor (black)
  // gives way to it.
  // 0x193c3e is render3d-lighting-fog's dark fog: its fully fogged colour is 0x020c0c, which @pixi/3d's hemisphere
  // background drew lifted (0x091414); the sky is a 2D fill now and meets it exactly.
  it.each([
    ['a light fog', 0x8b9bb4],
    ['a dark fog', 0x193c3e],
  ])(
    'draws the sky in the fully fogged colour, so fogged floors meet it with no edge (%s)',
    async (_, color) => {
      const renderer = await start({ near: 0.5, far: 2, color })
      renderer.draw(frame)
      const pixels = snapshot(renderer)
      const rows = pixels.length / 4 / WIDTH
      // The field without the bars (5% of the 90 rows each side) and a row of margin.
      const field: number[][] = []
      for (let y = 6; y < rows - 6; y++)
        for (let x = 0; x < WIDTH; x++) {
          const i = (y * WIDTH + x) * 4
          field.push([pixels[i] ?? 0, pixels[i + 1] ?? 0, pixels[i + 2] ?? 0])
        }
      const first = field[0] ?? [0, 0, 0]
      const off = field.filter((p) => p.some((c, k) => Math.abs(c - (first[k] ?? 0)) > 2))
      expect(off.length, `first ${first}, an outlier ${off[0]}`).toBe(0)
      expect(
        first.some((c) => c > 0),
        `first ${first}`,
      ).toBe(true)
    },
  )
})
