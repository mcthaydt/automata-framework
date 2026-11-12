// The nine ward props drawn in the base interior on a real WebGL2 context. Two things come of it: each prop puts pixels on the
// screen where it stands (a frame of the empty room differs from a frame with the prop in it), and a contact sheet of the nine,
// one close shot each, is written to `test-results/ward-props.png` for a person to look at. A picture is evidence of shape
// only: it says what a prop looks like, not that it is right (the unit test holds its size and its parameters).
import '@automataframework/3d/no-eval'
import {
  buildWorld,
  createPixi3dRenderer,
  drawWorld,
  levelTime,
  type Pixi3dRenderer,
  swatchColour,
  worldLighting,
} from '@automataframework/3d'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { commands } from 'vitest/browser'
import { worldKitLibrary } from '#src/app/world-kit-library.ts'
import '#src/features/props/register-props.ts'
import { KINDS, ON_WALL, PLACES, wardRoom } from '../../fixtures/ward-room.ts'
import { pixels, target } from '../sky/support.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const CELL = { width: 320, height: 240 }
const frame = { alpha: 1, frameMs: 16, paused: false }

/** How high the middle of each kind is, which is where the camera looks. */
const MIDDLE: Readonly<Record<string, number>> = {
  sink: 0.6,
  trolley: 0.5,
  wheelchair: 0.5,
  gurney: 0.55,
  monitorCart: 0.8,
  wallClock: 2.2,
  keyCabinet: 1.65,
  locker: 0.9,
  dripStand: 1,
}

type Camera = {
  position: { set(x: number, y: number, z: number): void }
  lookAt(p: { x: number; y: number; z: number }): void
}
/** What the sheet shows: each kind as its preset has it, then the three that have another state, in it. */
const SHOTS: readonly { kind: string; label: string; with?: Record<string, unknown> }[] = [
  ...KINDS.map((kind) => ({ kind, label: kind })),
  { kind: 'keyCabinet', label: 'keyCabinet open', with: { open: true } },
  { kind: 'locker', label: 'locker open', with: { open: true } },
  { kind: 'monitorCart', label: 'monitorCart off', with: { on: false } },
]
const COLUMNS = 4

interface Room {
  renderer: Pixi3dRenderer
  camera: Camera
  /** Frees the renderer's GL context and takes its canvas off the page. */
  close(): void
}

/** A renderer with the room of `kinds` drawn, and the camera to move between shots. The caller closes it. */
async function open(
  kinds: readonly string[],
  params: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {},
): Promise<Room> {
  const level = wardRoom(kinds, params)
  const time = levelTime(level.time)
  const world = buildWorld(level, worldKitLibrary, { night: time.name !== 'day' })
  const host = document.createElement('div')
  document.body.appendChild(host)
  let camera: Camera | undefined
  const made = await createPixi3dRenderer({
    logicalWidth: CELL.width,
    logicalHeight: CELL.height,
    backgroundColor: 0x000000,
    views: {},
    time,
    lighting: worldLighting(world, time),
    scene: (view, _stage, _occluders, light) => {
      view.camera.fov = 45
      camera = view.camera as unknown as Camera
      drawWorld(
        { parent: view.root, colourOf: (swatch) => swatchColour(worldKitLibrary, swatch), light },
        world.pieces,
      )
      return undefined
    },
  })(target(host, CELL))
  if (!made.ok) throw made.reason
  if (camera === undefined) throw new Error('the scene hook did not run')
  return {
    renderer: made.value,
    camera,
    close() {
      made.value.dispose()
      host.remove()
    },
  }
}

/** Looks at `kind` from the front, a little to the right and above, as far back as its size asks. */
function lookAt(camera: Camera, kind: string): void {
  const [x, z] = PLACES[kind] as readonly [number, number]
  const y = MIDDLE[kind] as number
  const wall = ON_WALL.has(kind)
  const back = wall ? 1.3 : kind === 'gurney' ? 2.7 : 2.4
  // The gurney stands by the east wall, so it is seen from the west.
  const side = wall ? 0.25 : kind === 'gurney' ? -1.4 : 1.1
  camera.position.set(x + side, wall ? y : y + 0.9, z + back)
  camera.lookAt({ x, y, z })
}

/** A shot of the room as the camera sees it now. */
function shot(renderer: Pixi3dRenderer): Uint8Array {
  renderer.draw(frame)
  renderer.draw(frame)
  return pixels(renderer)
}

/** The pixel count where two frames differ at all. */
function differing(a: Uint8Array, b: Uint8Array): number {
  let count = 0
  for (let i = 0; i < a.length; i += 4)
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) count++
  return count
}

describe.runIf(hasWebGL2)('the ward props on WebGL2, in the base interior', () => {
  // One empty room for every shot, and one renderer at a time for the prop: a renderer per shot, all kept to the end,
  // was thirteen GL contexts built inside one test, so a cold or busy machine ran out of its time on the loading alone.
  let empty: Room
  const sheet = document.createElement('canvas')
  sheet.width = CELL.width * COLUMNS
  sheet.height = CELL.height * Math.ceil(SHOTS.length / COLUMNS)
  const paper = sheet.getContext('2d') as CanvasRenderingContext2D

  beforeAll(async () => {
    empty = await open([])
  })
  afterAll(async () => {
    empty.close()
    const png = sheet.toDataURL('image/png').split(',')[1] as string
    await commands.writeFile('test-results/ward-props.png', png, 'base64')
  })

  it.each(SHOTS.map((shot, index) => ({ ...shot, index })))(
    '$label puts pixels on the screen where it stands',
    async ({ kind, label, with: params, index }) => {
      const room = await open([kind], params === undefined ? {} : { [kind]: params })
      try {
        lookAt(empty.camera, kind)
        lookAt(room.camera, kind)
        const without = shot(empty.renderer)
        const withProp = shot(room.renderer)
        // A prop is a good share of its own close shot: at least 3% of the frame's pixels changed.
        expect(differing(without, withProp), label).toBeGreaterThan(CELL.width * CELL.height * 0.03)
        const cell = new ImageData(new Uint8ClampedArray(withProp), CELL.width, CELL.height)
        paper.putImageData(cell, (index % COLUMNS) * CELL.width, Math.floor(index / COLUMNS) * CELL.height)
        paper.fillStyle = '#ffffff'
        paper.font = '14px sans-serif'
        paper.fillText(
          label,
          (index % COLUMNS) * CELL.width + 6,
          Math.floor(index / COLUMNS) * CELL.height + 16,
        )
      } finally {
        room.close()
      }
    },
  )
})
