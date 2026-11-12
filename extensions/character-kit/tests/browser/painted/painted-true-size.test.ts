// A painted figure that asks for density 1 and `crisp: false` (The Last Light's own setting) stands at its true height on the
// screen: its texels are `zoom / density` pixels wide, of uneven width, and the figure is as tall as its metres are at its depth.
// The default stays whole pixels. Headless Firefox here has no WebGL; the GPU runner runs it there.
import { afterEach, describe, expect, it } from 'vitest'
import { BASE, type CharacterDef } from '#src/shared/figures/door.ts'
import { buildScene, type StageScene } from '../../fixtures/stage-scene.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const MAN = (BASE[0] as { def: CharacterDef }).def
const SIZE = [640, 360] as const

let scene: StageScene | undefined
afterEach(() => {
  scene?.dispose()
  scene = undefined
})

/** The rows of the frame the figure covers (anything not the white background), counted from the first to the last. */
function drawnRows(pixels: ArrayLike<number>): number {
  let first = -1
  let last = -1
  for (let y = 0; y < SIZE[1]; y++)
    for (let x = 0; x < SIZE[0]; x++) {
      const p = (y * SIZE[0] + x) * 4
      if ((pixels[p] ?? 255) < 250 || (pixels[p + 1] ?? 255) < 250 || (pixels[p + 2] ?? 255) < 250) {
        if (first < 0) first = y
        last = y
        break
      }
    }
  return last - first + 1
}

/** Rows of the cell that hold the figure: its height in texels. */
function rowsOf(cell: { size: readonly [number, number]; rgba: ArrayLike<number> }): number {
  let first = -1
  let last = -1
  for (let y = 0; y < cell.size[1]; y++)
    for (let x = 0; x < cell.size[0]; x++)
      if ((cell.rgba[(y * cell.size[0] + x) * 4 + 3] ?? 0) >= 128) {
        if (first < 0) first = y
        last = y
        break
      }
  return last - first + 1
}

/** The man under the follow rig (a perspective lens, a depth that is not a whole zoom), drawn with the options given. */
async function drawnWith(options: { density: 1 | 2; crisp?: boolean }) {
  scene = await buildScene({
    size: SIZE,
    camera: 'follow',
    figures: [{ def: MAN, at: [0, 0], options }],
  })
  const pixels = scene.draw()
  const placed = scene.stage.placed[0]
  const f = scene.frame().camera.f
  if (placed === undefined || f === undefined)
    throw new Error('the man was not placed under a perspective camera')
  return { rows: drawnRows(pixels), sprite: placed.sprite, f }
}

describe.runIf(hasWebGL2)('a painted figure at its true size', () => {
  it('density 1, not crisp: the frame holds the figure as tall as its metres are at its depth, in texels of uneven width', async () => {
    const { rows, sprite, f } = await drawnWith({ density: 1, crisp: false })
    // A pixel covers depth / f metres, so the figure's metres (its texel rows times the cell's metres a texel) are this many pixels.
    const pixelsAMetre = f / sprite.depth
    const truePixels = rowsOf(sprite.cell) * sprite.cell.metresPerTexel * pixelsAMetre
    expect(sprite.scale).toBeCloseTo(sprite.cell.metresPerTexel * pixelsAMetre, 9)
    expect(Number.isInteger(sprite.scale), 'a true-size texel is not a whole number of pixels').toBe(false)
    expect(truePixels).toBeGreaterThan(40)
    expect(
      Math.abs(rows - truePixels) / truePixels,
      `drawn ${rows} rows, true ${truePixels.toFixed(1)}`,
    ).toBeLessThan(0.03)
  })

  it('the default stays whole pixels a texel: a density-2 figure is not at its true size', async () => {
    const { sprite } = await drawnWith({ density: 2 })
    expect(Number.isInteger(sprite.scale)).toBe(true)
  })
})
