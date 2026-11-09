// What the sky tests need to draw 3D on a real WebGL2 context: a render target with a fixed rectangle, the canvas's pixels,
// and the DUEL colours to compare them with.

import { DEFAULT_PALETTE } from '@automata/content/palette'
import type { RenderTarget } from '@automata/framework'
import { CubeGeometry, DirectionalLight, FlatMaterial, Mesh3D, SphereGeometry } from '@pixi/3d'
import { createPixi3dRenderer, type Pixi3dRenderer } from '#src/app/create-renderer.ts'
import type { Look } from '#src/features/look/look.schema.ts'
import { DEFAULT_LOOK } from '#src/features/look/look.ts'
import type { HorizonLayer } from '#src/features/look/passes/sky-effect.ts'
import { markFloor, TileMaterial } from '#src/features/look/tile-material.ts'
import { type TimeOfDay, timeOfDay } from '#src/shared/time-of-day/time-of-day.ts'

export const SIZE = { width: 160, height: 90 }

/** A target with the usable rectangle `SIZE`, no assets, and a bus that listens to nothing. */
export function target(host: HTMLElement): RenderTarget {
  const usable = { x: 0, y: 0, ...SIZE }
  return {
    host,
    geometry: {
      geometry: {
        current: {
          usable,
          formFactor: 'desktop',
          layout: { ...SIZE },
          heightTier: undefined,
          insets: { top: 0, right: 0, bottom: 0, left: 0 },
          hostReserved: { left: 0, right: 0 },
          visualInsetBottom: 0,
          hiddenBarBottom: 0,
          keyboardResize: 0,
          visible: usable,
          scale: 1,
        },
      },
      onChange: () => () => {},
      setHostDisplay: () => {},
      remeasure: () => {},
      dispose: () => {},
    } as unknown as RenderTarget['geometry'],
    assets: { get: () => undefined },
    bus: { publish: () => {}, subscribe: () => () => {} },
    reportLost: () => () => {},
  }
}

/** The canvas's pixels as the last `draw` left them, top row first. Call it in the task that drew. */
export function pixels(renderer: Pixi3dRenderer): Uint8Array {
  const gl = (renderer.stage.app.renderer as unknown as { gl: WebGL2RenderingContext }).gl
  const { drawingBufferWidth: width, drawingBufferHeight: height } = gl
  const bottomUp = new Uint8Array(width * height * 4)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, bottomUp)
  const out = new Uint8Array(bottomUp.length)
  for (let y = 0; y < height; y++)
    out.set(bottomUp.subarray((height - 1 - y) * width * 4, (height - y) * width * 4), y * width * 4)
  return out
}

export const DUEL: Set<number> = new Set(
  DEFAULT_PALETTE.colors.map((hex) => Number.parseInt(hex.slice(1), 16)),
)

/** The pixel at index `i` (a pixel number) as `0xRRGGBB`. */
export const colourAt = (px: ArrayLike<number>, i: number): number =>
  ((px[i * 4] ?? 0) << 16) | ((px[i * 4 + 1] ?? 0) << 8) | (px[i * 4 + 2] ?? 0)

/** The pixel numbers where `a` and `b` differ. */
export function changed(a: ArrayLike<number>, b: ArrayLike<number>): number[] {
  const out: number[] = []
  for (let i = 0; i < a.length / 4; i++) if (colourAt(a, i) !== colourAt(b, i)) out.push(i)
  return out
}

/** What the canvas shows where nothing is drawn: black, or the page's sky fill, depending on which pass presents. */
export const SKY = 0x2e222f
const bareSky = (c: number): boolean => c === 0 || c === SKY

/** The pixel numbers where `a` and `b` differ in more than how the empty sky is presented. */
export const drawn = (a: ArrayLike<number>, b: ArrayLike<number>): number[] =>
  changed(a, b).filter((i) => !(bareSky(colourAt(a, i)) && bareSky(colourAt(b, i))))

/** What a test sky scene may vary. */
export interface SkyScene {
  /** A big white ball with a wall behind it, for the glow, instead of a small ball low in the frame. */
  readonly big?: boolean
  /** The ball glows (it writes the glowing code), where a plain white one does not. */
  readonly glowing?: boolean
  /** A wet street seen from above: ground, a glowing box on the left and a plain white one on the right. */
  readonly ground?: boolean
  /** A wall covering the whole view, 2 m from the camera. */
  readonly near?: boolean
  readonly time?: TimeOfDay
  readonly horizon?: readonly HorizonLayer[]
  readonly look?: Look
}

/** The renderer over a scene of a small ball (or the `SkyScene`'s), seen by a level camera at 1 m. */
export async function startSky(
  host: HTMLElement,
  scene: SkyScene = {},
): Promise<{ renderer: Pixi3dRenderer; dispose(): void }> {
  const made = await createPixi3dRenderer({
    logicalWidth: SIZE.width,
    logicalHeight: SIZE.height,
    views: {},
    look: scene.look ?? DEFAULT_LOOK,
    time: scene.time ?? timeOfDay('night'),
    horizon: scene.horizon,
    scene: (view) => {
      view.camera.position.set(0, 1, 5)
      view.camera.lookAt({ x: 0, y: 1, z: 0 })
      view.root.addChild(new DirectionalLight({ intensity: 2 }))
      const big = scene.big === true
      const sphere = new SphereGeometry()
      if (scene.glowing === true) markFloor(sphere, new Array<number>(sphere.vertexCount).fill(0))
      const ball = new Mesh3D({
        geometry: sphere,
        material:
          scene.glowing === true
            ? new TileMaterial({ colour: 0xffffff, glowing: true, haze: DEFAULT_LOOK.haze, gain: 1 })
            : new FlatMaterial({ baseColor: 0xffffff }),
      })
      ball.position.set(big ? 0 : -1.5, big ? 1 : -1.2, 0)
      ball.scale.set(big ? 1 : 0.2, big ? 1 : 0.2, big ? 1 : 0.2)
      view.root.addChild(ball)
      const wall = (z: number, w: number, h: number, colour: number): void => {
        const mesh = new Mesh3D({
          geometry: new CubeGeometry(),
          material: new FlatMaterial({ baseColor: colour }),
        })
        mesh.position.set(0, 1, z)
        mesh.scale.set(w, h, 0.1)
        view.root.addChild(mesh)
      }
      if (scene.ground === true) {
        view.camera.position.set(0, 2.2, 6)
        view.camera.lookAt({ x: 0, y: 0.6, z: 0 })
        const floor = new Mesh3D({
          geometry: new CubeGeometry(),
          material: new FlatMaterial({ baseColor: 0x4a3f5c }),
        })
        floor.position.set(0, -0.05, 0)
        floor.scale.set(40, 0.1, 40)
        view.root.addChild(floor)
        const lit = new CubeGeometry()
        markFloor(lit, new Array<number>(lit.vertexCount).fill(0))
        const glowing = new Mesh3D({
          geometry: lit,
          material: new TileMaterial({ colour: 0xffd59b, glowing: true, haze: DEFAULT_LOOK.haze, gain: 1 }),
        })
        glowing.position.set(-1.5, 0.5, 0)
        view.root.addChild(glowing)
        const plain = new Mesh3D({
          geometry: new CubeGeometry(),
          material: new FlatMaterial({ baseColor: 0xffffff }),
        })
        plain.position.set(1.5, 0.5, 0)
        view.root.addChild(plain)
      }
      if (big) wall(-2, 20, 12, 0x4a3f5c)
      if (scene.near === true) wall(3, 40, 40, 0x4a3f5c)
      return undefined
    },
  })(target(host))
  if (!made.ok) throw made.reason
  return { renderer: made.value, dispose: () => made.value.dispose() }
}

/** The passes of a renderer's view, by type. */
export function passOf<T>(renderer: Pixi3dRenderer, type: new (...a: never[]) => T): T {
  const found = renderer.view.passes.find((p) => p instanceof type)
  if (found === undefined) throw new Error(`no ${type.name} among the view's passes`)
  return found as T
}

const frame = { alpha: 1, frameMs: 16, paused: false }

/** Draws twice (the first frame builds the graph) and returns the canvas. */
export function shot(renderer: Pixi3dRenderer): Uint8Array {
  renderer.draw(frame)
  renderer.draw(frame)
  return pixels(renderer)
}
