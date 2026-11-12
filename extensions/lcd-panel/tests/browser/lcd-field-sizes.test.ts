// The LCD panel at the old game's picture sizes (640 x 360 in 16:9, 640 x 480 in 4:3), on a real WebGL2 context: the panel's mesh
// and stripes are still drawn over a flat colour at the field the game has, with the clinic's profile, and an off panel leaves
// the picture alone. The pass is added once, after the frames without it (the look's registry is the page's).
import '@automataframework/3d/no-eval'
import { createPixi3dRenderer, DEFAULT_LOOK, type Pixi3dRenderer } from '@automataframework/3d'
import { DEFAULT_PALETTE } from '@automataframework/content/palette'
import { CubeGeometry, FlatMaterial, Mesh3D } from '@pixi/3d'
import { afterEach, describe, expect, it } from 'vitest'
import { addLcdPanelPass } from '#src/app/add-lcd-panel.ts'
import { LcdPanelEffect } from '#src/features/lcd-panel/lcd-effect.ts'
import { LCD_OFF } from '#src/features/lcd-panel/lcd-profile.schema.ts'
import { colourAt, drawn, OLD_GAME_FIELDS, pixels, SKY, target } from './support.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const frame = { alpha: 1, frameMs: 16, paused: false }
const PLAIN = Number.parseInt((DEFAULT_PALETTE.colors[20] as string).slice(1), 16)
type Field = (typeof OLD_GAME_FIELDS)[number]

let open: { dispose(): void } | undefined
afterEach(() => {
  open?.dispose()
  open = undefined
  document.body.replaceChildren()
})

/** A big cube of one exact DUEL colour, unlit, filling the middle of the frame, drawn at `field`. */
async function start(field: Field): Promise<Pixi3dRenderer> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const made = await createPixi3dRenderer({
    logicalWidth: field.width,
    logicalHeight: field.height,
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
  })(target(host, field))
  if (!made.ok) throw made.reason
  open = made.value
  return made.value
}

/** Draws twice (the first frame builds the graph) and returns the canvas. */
function shot(renderer: Pixi3dRenderer): Uint8Array {
  renderer.draw(frame)
  renderer.draw(frame)
  return pixels(renderer)
}

/** The distinct colours along the middle row of the cube: the cube is one colour in the bare frame. */
function rowColours(px: Uint8Array, field: Field): Set<number> {
  const y = Math.floor(field.height / 2)
  const seen = new Set<number>()
  for (let x = Math.floor(field.width * 0.45); x < Math.floor(field.width * 0.55); x++)
    seen.add(colourAt(px, y * field.width + x))
  return seen
}

describe.runIf(hasWebGL2)('the LCD panel at the old game’s picture sizes', () => {
  const bare = new Map<string, Uint8Array>()
  const key = (field: Field): string => `${field.width}x${field.height}`

  it('a frame without the pass is the field’s size, with the cube in one colour along its middle row', async () => {
    for (const field of OLD_GAME_FIELDS) {
      const px = shot(await start(field))
      expect(px.length, key(field)).toBe(field.width * field.height * 4)
      expect(rowColours(px, field).size, key(field)).toBe(1)
      bare.set(key(field), px)
      open?.dispose()
      open = undefined
    }
  })

  it('the clinic’s panel draws its mesh and stripes over the cube at each size: the middle row is no longer one colour', async () => {
    addLcdPanelPass()
    for (const field of OLD_GAME_FIELDS) {
      const px = shot(await start(field))
      expect(drawn(bare.get(key(field)) as Uint8Array, px).length, key(field)).toBeGreaterThan(1000)
      expect(rowColours(px, field).size, key(field)).toBeGreaterThanOrEqual(3)
      open?.dispose()
      open = undefined
    }
  })

  it('the panel zeroed, with no vignette, leaves the picture as it was, every pixel, at each size', async () => {
    for (const field of OLD_GAME_FIELDS) {
      const renderer = await start(field)
      const panel = renderer.view.passes.find((p): p is LcdPanelEffect => p instanceof LcdPanelEffect)
      if (panel === undefined) throw new Error('no LcdPanelEffect')
      panel.profile = { ...LCD_OFF, vignette: false }
      expect(drawn(bare.get(key(field)) as Uint8Array, shot(renderer)), key(field)).toEqual([])
      open?.dispose()
      open = undefined
    }
  })
})
