// The lit room of the c8 gate (docs/refactor/c8/gate-lit/): AF's base interior at `lampLit` and its exterior by day, drawn by
// `drawWorld` with the room's own light and the look, the base man standing under the pendant (or in the street) and the base woman
// walking past. The same scene is drawn with the figures lit and unlit (`lit: false`, today's frame), on WebGL or WebGPU.
// The figures' clock is the test's own, so a frame is the same frame each run.
import '@automataframework/3d/no-eval'
import {
  buildWorld,
  createPixi3dRenderer,
  DEFAULT_LOOK,
  drawWorld,
  levelTime,
  type Pixi3dRenderer,
  type SceneLight,
  swatchColour,
  timeOfDay,
  worldLighting,
} from '@automataframework/3d'
import { BASE_SCENES, baseLibrary } from '@automataframework/3d/base'
import { builtRenderer, testTarget } from '@automataframework/3d/testing-checks'
import { stageFor } from '#src/features/painted/painted-stage.ts'
import { paintedFigure } from '#src/features/painted/painted-view.ts'
import { type RoomLight, roomLight } from '#src/features/painted/room-light.ts'
import { BASE, type CharacterDef } from '#src/shared/figures/door.ts'
import { aim, DEG, LENS_FOV, readFrame, step } from './stage-scene.ts'

/** Where a figure's cell landed on the screen: its top-left and its size in pixels. */
export interface Rect {
  readonly name: string
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export type RoomName = 'interior' | 'exterior'

export const GATE_SIZE = [720, 405] as const
const MAN = BASE[0]?.def as CharacterDef
const WOMAN = BASE[1]?.def as CharacterDef

/** Where the figures stand: the man at the room's centre (the pendant hangs over it), the woman walking a line a metre and a half in front. */
export const STANDER: readonly [number, number] = [0, 0]
const WALK_Z = 1.5

export interface RoomFrame {
  /** The frames before the last one, in order: the walker's strip. */
  readonly earlier: readonly (Uint8ClampedArray | Uint8Array)[]
  /** The figures' cells on the screen in each frame (the earlier ones, then the last). */
  readonly rects: readonly (readonly Rect[])[]
  readonly rgba: Uint8ClampedArray | Uint8Array
  readonly width: number
  readonly height: number
  /** The renderer that drew it (`webgl` or `webgpu`). */
  readonly drawnBy: string
  /** What the room's light was on each figure at the frame, as the kit read it. */
  readonly lights: Readonly<
    Record<
      string,
      {
        readonly key: string
        readonly flat: readonly number[]
        readonly lamps: readonly unknown[]
        readonly exposure: number
      }
    >
  >
}

export interface RoomOptions {
  readonly room: RoomName
  /** Figures take the room's light unless this is false. */
  readonly lit: boolean
  readonly preference?: 'webgpu'
  /**
   * The frames to draw, in order: the clock (seconds) the figures' poses read and the walker's place along its line (metres). One
   * renderer draws them all, so the walker's gait advances between frames as it would in play. The last is the frame returned.
   */
  readonly sequence?: readonly { readonly t: number; readonly at: number }[]
}

/** The camera: a perspective view 6.5 m back and 25° down, on the room's centre. */
function camera(view: Parameters<typeof aim>[0]) {
  aim(view, GATE_SIZE, 'follow', 0, 0)
  const cam = view.camera
  cam.position.set(0, 1 + 6.5 * Math.sin(25 * DEG), 6.5 * Math.cos(25 * DEG))
  cam.lookAt({ x: 0, y: 1, z: 0 })
  cam.fov = LENS_FOV
}

/** Draws the room once and reads the frame back. */
export async function drawRoom(options: RoomOptions): Promise<RoomFrame> {
  const level = BASE_SCENES[options.room === 'interior' ? 'base-interior' : 'base-exterior']
  // The interior at its own time (`lampLit`); the exterior by day, whatever time its level carries.
  const time = options.room === 'interior' ? levelTime(level.time) : timeOfDay('day')
  const world = buildWorld(level, baseLibrary, { night: time.name !== 'day' })
  const sequence = options.sequence ?? [{ t: 0, at: -0.9 }]
  const clock = { t: sequence[0]?.t ?? 0 }
  const figure = (def: CharacterDef, moving: boolean) =>
    paintedFigure(def, { now: () => clock.t, lit: options.lit, state: () => ({ moving }) })
  let seen: SceneLight | undefined
  let viewSeen: Parameters<typeof camera>[0] | undefined
  const host = document.createElement('div')
  document.body.appendChild(host)
  const factory = createPixi3dRenderer({
    logicalWidth: GATE_SIZE[0],
    logicalHeight: GATE_SIZE[1],
    backgroundColor: 0x2e222f,
    barFraction: 0,
    ...(options.preference ? { preference: options.preference } : {}),
    look: DEFAULT_LOOK,
    time,
    lighting: worldLighting(world, time),
    views: { stander: figure(MAN, false), walker: figure(WOMAN, true) },
    scene: (view, _stage, occluders, light) => {
      seen = light
      viewSeen = view
      camera(view)
      drawWorld(
        {
          parent: view.root,
          occluders,
          colourOf: (swatch) => swatchColour(baseLibrary, swatch),
          look: DEFAULT_LOOK,
          light,
        },
        world.pieces,
      )
      return undefined
    },
  })
  const renderer: Pixi3dRenderer = await builtRenderer(
    factory(testTarget(host, {}, { width: GATE_SIZE[0], height: GATE_SIZE[1] })),
  )
  try {
    const first = sequence[0] ?? { t: 0, at: -0.9 }
    renderer.apply(
      step({
        resync: true,
        added: [
          { sid: 1, components: { stander: { x: STANDER[0], y: 0, z: STANDER[1], yaw: Math.PI } } },
          { sid: 2, components: { walker: { x: first.at, y: 0, z: WALK_Z, yaw: -Math.PI / 2 } } },
        ],
        changed: [],
        removed: [],
      }),
    )
    // Frames until the swap chain presents (WebGPU) and the look's passes have run.
    for (let frame = 0; frame < 6; frame++) {
      renderer.draw({ alpha: 1, frameMs: 16, paused: false })
      await new Promise((resolve) => requestAnimationFrame(resolve))
    }
    const taken: (Uint8ClampedArray | Uint8Array)[] = []
    const rects: Rect[][] = []
    for (const moment of sequence) {
      clock.t = moment.t
      renderer.apply(
        step({
          resync: false,
          added: [],
          changed: [{ sid: 2, components: { walker: { x: moment.at, y: 0, z: WALK_Z, yaw: -Math.PI / 2 } } }],
          removed: [],
        }),
      )
      renderer.draw({ alpha: 1, frameMs: 16, paused: false })
      taken.push(Uint8ClampedArray.from(readFrame(renderer)))
      rects.push(
        viewSeen === undefined
          ? []
          : stageFor(viewSeen.camera).placed.map(({ sprite }) => ({
              name: sprite.name,
              x: sprite.screen[0],
              y: sprite.screen[1],
              w: sprite.cell.size[0] * sprite.scale,
              h: sprite.cell.size[1] * sprite.scale,
            })),
      )
    }
    const at = sequence[sequence.length - 1]?.at ?? first.at
    const light = seen
    const lights: Record<string, RoomLight['lighting'] & { key: string }> = {}
    const read = (name: string, x: number, z: number) => {
      if (light === undefined) return
      const room = roomLight(
        (px, py, pz, normal) => light.tint(px, py, pz, normal),
        light.lighting.sun,
        [x, 0, z],
        0,
      )
      lights[name] = { ...room.lighting, key: room.key }
    }
    read('stander', STANDER[0], STANDER[1])
    read('walker', at, WALK_Z)
    return {
      earlier: taken.slice(0, -1),
      rects,
      rgba: taken[taken.length - 1] ?? new Uint8Array(0),
      width: GATE_SIZE[0],
      height: GATE_SIZE[1],
      drawnBy: renderer.stage.app.renderer.name,
      lights: Object.fromEntries(
        Object.entries(lights).map(([name, l]) => [
          name,
          { key: l.key, flat: [...l.flat], lamps: l.lamps, exposure: l.exposure ?? 0 },
        ]),
      ),
    }
  } finally {
    renderer.dispose()
    document.body.replaceChildren()
  }
}
