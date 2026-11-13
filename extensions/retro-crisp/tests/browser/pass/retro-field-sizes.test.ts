// The retro pass at the old game's picture sizes (640 x 360 in 16:9, 640 x 480 in 4:3), on a real WebGL2 context: the grade moves the
// picture and the snap puts it back on the palette at each size, and the neutral profile leaves it alone. The pass is added once,
// after the frames without it (the look's registry is the page's).
import '@automata/3d/no-eval'
import { createPixi3dRenderer, DEFAULT_LOOK, type Pixi3dRenderer } from '@automata/3d'
import { DEFAULT_PALETTE } from '@automata/content/palette'
import { CubeGeometry, FlatMaterial, Mesh3D } from '@pixi/3d'
import { afterEach, describe, expect, it } from 'vitest'
import { addRetroPass } from '#src/app/add-retro.ts'
import { RetroEffect } from '#src/features/retro/retro-effect.ts'
import { RETRO_NEUTRAL } from '#src/features/retro/retro-profile.schema.ts'
import { colourAt, DUEL, drawn, OLD_GAME_FIELDS, pixels, SKY, target } from './support.ts'

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

describe.runIf(hasWebGL2)('the retro pass at the old game’s picture sizes', () => {
  const bare = new Map<string, Uint8Array>()
  const key = (field: Field): string => `${field.width}x${field.height}`

  it('a frame without the pass is the field’s size', async () => {
    for (const field of OLD_GAME_FIELDS) {
      const px = shot(await start(field))
      expect(px.length, key(field)).toBe(field.width * field.height * 4)
      bare.set(key(field), px)
      open?.dispose()
      open = undefined
    }
  })

  it('the neutral profile leaves the picture alone at each size, every pixel', async () => {
    addRetroPass({ profile: RETRO_NEUTRAL })
    for (const field of OLD_GAME_FIELDS) {
      expect(drawn(bare.get(key(field)) as Uint8Array, shot(await start(field))), key(field)).toEqual([])
      open?.dispose()
      open = undefined
    }
  })

  it('the clinic’s grade moves the picture at each size, and every colour it draws is on the palette again', async () => {
    for (const field of OLD_GAME_FIELDS) {
      const renderer = await start(field)
      const retro = renderer.view.passes.find((p): p is RetroEffect => p instanceof RetroEffect)
      if (retro === undefined) throw new Error('no RetroEffect')
      retro.profile = {}
      const graded = shot(renderer)
      const was = bare.get(key(field)) as Uint8Array
      const moved = drawn(was, graded)
      expect(moved.length, key(field)).toBeGreaterThan(1000)
      const content = moved.filter((i) => colourAt(was, i) !== 0 && colourAt(was, i) !== SKY)
      expect(content.length, key(field)).toBeGreaterThan(500)
      expect(
        content.every((i) => DUEL.has(colourAt(graded, i))),
        key(field),
      ).toBe(true)
      open?.dispose()
      open = undefined
    }
  })
})
