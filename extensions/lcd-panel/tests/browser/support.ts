// What the pass tests need to draw 3D on a real WebGL2 context: a render target with a fixed rectangle, the canvas's pixels,
// and the DUEL colours to compare them with.

import type { Pixi3dRenderer } from '@automataframework/3d'
import { DEFAULT_PALETTE } from '@automataframework/content/palette'
import type { RenderTarget } from '@automataframework/framework'

export const SIZE = { width: 160, height: 90 }

/** The picture sizes of the old game: 640 x 360 in a 16:9 window and 640 x 480 in a 4:3 one. */
export const OLD_GAME_FIELDS: readonly { readonly width: number; readonly height: number }[] = [
  { width: 640, height: 360 },
  { width: 640, height: 480 },
]

/** A target with the usable rectangle `size` (`SIZE` by default), no assets, and a bus that listens to nothing. */
export function target(
  host: HTMLElement,
  size: { readonly width: number; readonly height: number } = SIZE,
): RenderTarget {
  const usable = { x: 0, y: 0, ...size }
  return {
    host,
    geometry: {
      geometry: {
        current: {
          usable,
          formFactor: 'desktop',
          layout: { ...size },
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

export const DUEL = new Set(DEFAULT_PALETTE.colors.map((hex) => Number.parseInt(hex.slice(1), 16)))

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

/** The colour most pixels of the frame have, empty sky left out, and how many have it. */
export function dominant(px: ArrayLike<number>): { colour: number; count: number } {
  const counts = new Map<number, number>()
  for (let i = 0; i < px.length / 4; i++) {
    const c = colourAt(px, i)
    if (!bareSky(c)) counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  const [colour, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [0, 0]
  return { colour, count }
}
