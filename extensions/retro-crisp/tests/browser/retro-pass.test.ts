// The retro pass on a real WebGL2 context. The pass is added once, after the test that shows a frame without it (the look's
// registry is the page's, so order within this file is the point). WebGPU and WebGL2 parity is the GPU runner's.
import '@automata/3d/no-eval'
import { createPixi3dRenderer, DEFAULT_LOOK, type Pixi3dRenderer } from '@automata/3d'
import { DEFAULT_PALETTE } from '@automata/content/palette'
import { CubeGeometry, FlatMaterial, Mesh3D } from '@pixi/3d'
import { afterEach, describe, expect, it } from 'vitest'
import { addRetroPass } from '#src/app/add-retro.ts'
import { RetroEffect } from '#src/features/retro/retro-effect.ts'
import { RETRO_NEUTRAL } from '#src/features/retro/retro-profile.schema.ts'
import { colourAt, DUEL, dominant, drawn, pixels, SIZE, SKY, target } from './support.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const frame = { alpha: 1, frameMs: 16, paused: false }
/** A DUEL colour: the snap leaves it as it is, so what the frame holds is the palette's own. */
const PLAIN = Number.parseInt((DEFAULT_PALETTE.colors[20] as string).slice(1), 16)

let open: { dispose(): void } | undefined
afterEach(() => {
  open?.dispose()
  open = undefined
  document.body.replaceChildren()
})

/** A big cube of one exact DUEL colour, unlit, filling the middle of the frame. */
async function start(): Promise<Pixi3dRenderer> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const made = await createPixi3dRenderer({
    logicalWidth: SIZE.width,
    logicalHeight: SIZE.height,
    backgroundColor: SKY,
    views: {},
    look: DEFAULT_LOOK,
    scene: (view) => {
      view.camera.position.set(0, 1, 5)
      view.camera.lookAt({ x: 0, y: 1, z: 0 })
      const cube = new Mesh3D({
        geometry: new CubeGeometry(),
        material: new FlatMaterial({ baseColor: PLAIN }),
      })
      cube.position.set(0, 1, 0)
      cube.scale.set(1.5, 1.5, 1.5)
      view.root.addChild(cube)
      return undefined
    },
  })(target(host))
  if (!made.ok) throw made.reason
  open = made.value
  return made.value
}

const retroOf = (renderer: Pixi3dRenderer): RetroEffect => {
  const found = renderer.view.passes.find((p) => p instanceof RetroEffect)
  if (found === undefined) throw new Error("no RetroEffect among the view's passes")
  return found as RetroEffect
}

/** Draws twice (the first frame builds the graph) and returns the canvas. */
function shot(renderer: Pixi3dRenderer): Uint8Array {
  renderer.draw(frame)
  renderer.draw(frame)
  return pixels(renderer)
}

describe.runIf(hasWebGL2)('the retro pass on WebGL2', () => {
  let bare: Uint8Array
  let passes: ReturnType<typeof addRetroPass>

  it('a frame without the pass is the cube in one DUEL colour', async () => {
    bare = shot(await start())
    const cube = dominant(bare)
    expect(cube.count).toBeGreaterThan(200)
    expect(DUEL.has(cube.colour)).toBe(true)
  })

  it('goes before core’s snap, and a taken name is refused', async () => {
    passes = addRetroPass({ profile: RETRO_NEUTRAL })
    expect(() => addRetroPass()).toThrow()
    const renderer = await start()
    expect(renderer.view.passes.map((p) => p.constructor.name)).toEqual(['RetroEffect', 'DuelSnapEffect'])
    expect(passes.passes).toHaveLength(1)
  })

  it('the neutral profile lets an exact DUEL colour through unchanged, every pixel of the frame', async () => {
    const renderer = await start()
    const neutral = shot(renderer)
    const diff = drawn(bare, neutral)
    expect(diff).toEqual([])
  })

  it('the clinic profile grades the frame and the snap puts every colour back on the palette; off puts the frame back', async () => {
    const renderer = await start()
    const retro = retroOf(renderer)
    retro.profile = {}
    const graded = shot(renderer)
    const moved = drawn(bare, graded)
    expect(moved.length).toBeGreaterThan(200)
    // What the scene drew is on the palette again. (The empty sky shows the page's fill, which this test does not judge.)
    const content = moved.filter((i) => colourAt(bare, i) !== 0 && colourAt(bare, i) !== SKY)
    expect(content.length).toBeGreaterThan(100)
    expect(content.every((i) => DUEL.has(colourAt(graded, i)))).toBe(true)
    retro.enabled = false
    expect(drawn(bare, shot(renderer))).toEqual([])
  })

  it('the film moves with the clock: grain at 12 frames a second', async () => {
    const renderer = await start()
    const retro = retroOf(renderer)
    retro.profile = {}
    retro.clock = 0
    const a = shot(renderer)
    retro.clock = 0.5
    expect(drawn(a, shot(renderer)).length).toBeGreaterThan(100)
  })

  it('a bad profile is refused, and the pass keeps the one it had', async () => {
    const retro = retroOf(await start())
    expect(() => {
      retro.profile = { fade: { colour: 'green' } }
    }).toThrow()
    expect(retro.profile.fade.colour).toBe('#4b5a56')
  })
})
