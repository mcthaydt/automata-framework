// The screen filter's tests' scene (lcd-screen.test.ts, lcd-screen-webgpu.test.ts): a flat field 40 by 30 shown at a whole scale of 2 in a canvas
// with a margin (so the field's origin is not the canvas's), a 4-pixel cell, read back. Every line is a device pixel whose index
// from the field's origin is 3 mod 4: the last pixel of a two-field-pixel texel that starts on an even field pixel, never inside
// one. The two renderers are in two files: a WebGPU renderer made in a page where a WebGL one was torn down finds a shared Pixi
// texture destroyed.
import { createPixiRenderer, type PixiRenderer, type RenderTarget } from '@automata/framework'
import { Graphics } from 'pixi.js'
import { afterEach, expect } from 'vitest'
import { lcdPanelScreenFilter } from '#src/app/lcd-screen-filter.ts'
import { LCD_OFF } from '#src/features/lcd-panel/lcd-profile.schema.ts'
import { target } from './support.ts'

export const FIELD = { width: 40, height: 30 }
export const CANVAS = { width: 84, height: 64 }
/** Where the field starts in the canvas: centred, whole pixels. */
export const ORIGIN = { x: 2, y: 2 }
const FLAT = 0x80
const frame = { alpha: 1, frameMs: 16, paused: false }

let open: PixiRenderer | undefined
afterEach(() => {
  open?.dispose()
  open = undefined
  document.body.replaceChildren()
})

export async function start(preference: 'webgl' | 'webgpu'): Promise<PixiRenderer> {
  const host = document.body.appendChild(document.createElement('div'))
  const made = await createPixiRenderer({
    preference,
    logicalWidth: FIELD.width,
    logicalHeight: FIELD.height,
    scale: 'whole',
    // The mesh and scanlines at the clinic's full strength, no stripes, no gain: what is darker than the field is a line.
    postFilters: [
      lcdPanelScreenFilter({ ...LCD_OFF, grid: 0.3, scanlines: 0.3, subpixels: 0 }, { cellPixels: 4 }),
    ],
    setup: (stage) => {
      stage.world.addChild(new Graphics().rect(0, 0, FIELD.width, FIELD.height).fill(FLAT * 0x010101))
      return undefined
    },
  })(target(host, CANVAS) as RenderTarget)
  if (!made.ok) throw made.reason
  open = made.value
  return made.value
}

/** Draws and copies the canvas as it was presented, in the same task (a WebGPU canvas keeps nothing past it): RGBA, top row first. */
export function shot(renderer: PixiRenderer): Uint8ClampedArray {
  renderer.draw(frame)
  const canvas = renderer.stage.app.canvas as HTMLCanvasElement
  const copy = document.createElement('canvas')
  copy.width = canvas.width
  copy.height = canvas.height
  const context = copy.getContext('2d') as CanvasRenderingContext2D
  context.drawImage(canvas, 0, 0)
  return context.getImageData(0, 0, copy.width, copy.height).data
}

/**
 * Every field pixel's device pixels checked: lines only on index 3 mod 4 from the origin, the rest the plain field. The
 * letterbox's bar, drawn over the field's top edge, is not the field: a pixel of the bar's colour (the canvas's corner) is skipped.
 */
export function expectLinesOnTexelBorders(px: Uint8ClampedArray): void {
  const bar = [px[0], px[1], px[2]]
  let seen = 0
  const width = FIELD.width * 2
  const height = FIELD.height * 2
  const inside: string[] = []
  const missing: string[] = []
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = ((ORIGIN.y + y) * CANVAS.width + ORIGIN.x + x) * 4
      if (px[i] === bar[0] && px[i + 1] === bar[1] && px[i + 2] === bar[2]) continue
      seen++
      const dark = (px[i] ?? 0) < FLAT - 2
      const border = x % 4 === 3 || y % 4 === 3
      if (dark && !border) inside.push(`${x},${y}`)
      if (!dark && border) missing.push(`${x},${y}`)
      if (!dark) expect(Math.abs((px[i] ?? 0) - FLAT), `plain at ${x},${y}`).toBeLessThanOrEqual(2)
    }
  expect(seen, 'field pixels seen').toBeGreaterThan(width * (height - 8))
  expect(inside, 'lines inside a texel').toEqual([])
  expect(missing, 'texel borders with no line').toEqual([])
}
