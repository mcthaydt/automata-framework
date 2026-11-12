// The LCD panel pass on a real WebGL2 context. The pass is added once, after the test that shows a frame without it (the
// look's registry is the page's, so order within this file is the point). WebGPU and WebGL2 parity is the GPU runner's.
import '@automataframework/3d/no-eval'
import { createPixi3dRenderer, DEFAULT_LOOK, type Pixi3dRenderer } from '@automataframework/3d'
import { DEFAULT_PALETTE } from '@automataframework/content/palette'
import { CubeGeometry, FlatMaterial, Mesh3D } from '@pixi/3d'
import { afterEach, describe, expect, it } from 'vitest'
import { addLcdPanelPass } from '#src/app/add-lcd-panel.ts'
import { LcdPanelEffect } from '#src/features/lcd-panel/lcd-effect.ts'
import { LCD_OFF } from '#src/features/lcd-panel/lcd-profile.schema.ts'
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

const panelOf = (renderer: Pixi3dRenderer): LcdPanelEffect => {
  const found = renderer.view.passes.find((p) => p instanceof LcdPanelEffect)
  if (found === undefined) throw new Error("no LcdPanelEffect among the view's passes")
  return found as LcdPanelEffect
}

/** Draws twice (the first frame builds the graph) and returns the canvas. */
function shot(renderer: Pixi3dRenderer): Uint8Array {
  renderer.draw(frame)
  renderer.draw(frame)
  return pixels(renderer)
}

describe.runIf(hasWebGL2)('the LCD panel pass on WebGL2', () => {
  let bare: Uint8Array

  it('a frame without the pass is the cube in one DUEL colour', async () => {
    bare = shot(await start())
    const cube = dominant(bare)
    expect(cube.count).toBeGreaterThan(200)
    expect(DUEL.has(cube.colour)).toBe(true)
  })

  it('goes after core’s snap, and a taken name is refused', async () => {
    addLcdPanelPass()
    expect(() => addLcdPanelPass()).toThrow()
    const renderer = await start()
    // Core's haze and mood grade (both on by default) are first and its present pass is last; the panel runs right after
    // the snap.
    expect(renderer.view.passes.map((p) => p.constructor.name)).toEqual([
      'HazeEffect',
      'GradeEffect',
      'DuelSnapEffect',
      'LcdPanelEffect',
      'PresentEffect',
    ])
  })

  it('draws the mesh, the stripes and the vignette over the cube, off the palette', async () => {
    const renderer = await start()
    const lcd = shot(renderer)
    const moved = drawn(bare, lcd)
    expect(moved.length).toBeGreaterThan(200)
    expect(moved.some((i) => !DUEL.has(colourAt(lcd, i)))).toBe(true)
  })

  it('with the panel zeroed and no vignette, an exact DUEL colour comes through unchanged, every pixel', async () => {
    const renderer = await start()
    panelOf(renderer).profile = { ...LCD_OFF, vignette: false }
    expect(drawn(bare, shot(renderer))).toEqual([])
  })

  it('the panel off leaves the middle of the frame alone (the vignette darkens only its edge), and the pass disabled puts the frame back', async () => {
    const renderer = await start()
    const panel = panelOf(renderer)
    panel.profile = LCD_OFF
    expect(drawn(bare, shot(renderer))).toEqual([])
    panel.enabled = false
    expect(drawn(bare, shot(renderer))).toEqual([])
  })

  it('a bad profile is refused, and the panel keeps the one it had', async () => {
    const panel = panelOf(await start())
    expect(() => {
      panel.profile = { grid: 5 }
    }).toThrow()
    expect(panel.profile.grid).toBe(0.3)
  })
})
