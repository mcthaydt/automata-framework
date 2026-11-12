// Placement takes the cell's density and a `crisp` choice, as FigureBuilder's stage does. The defaults (density 2, whole pixels)
// are the placement the kit always made; density 1 with `crisp: false` is a figure at its true height, in texels of uneven width.
import { fovOf } from '@automataframework/3d/camera-view'
import { describe, expect, it } from 'vitest'
import { place } from '#src/features/painted/place.ts'
import { poseOf } from '#src/features/painted/pose.ts'
import { BASE, type CharacterDef, type V3, zoomOf } from '#src/shared/figures/door.ts'
import { perspectiveCamera } from '../../fixtures/cameras.ts'
import { painted } from '../../fixtures/painted-cell.ts'

const MAN = BASE[0]?.def as CharacterDef
/** The Last Light's lens: 50 mm, 16 m from the man, a 640 × 360 picture. */
const pose = poseOf(perspectiveCamera([0, 0, 16], 0, 0, fovOf(50)), [640, 360])
/** The same lens on 480 lines, 62.5 px a metre: a density-1 texel is 1.69 pixels there, which whole pixels round to 2 (not to 1). */
const tall = poseOf(perspectiveCamera([0, 0, 16], 0, 0, fovOf(50)), [640, 480])
const at: V3 = [0, 0, 0]
/** Rows of the cell that hold the figure: its height in texels. */
const rowsOf = (cell: { size: readonly [number, number]; rgba: ArrayLike<number> }): number => {
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

describe('placement by the cell’s density', () => {
  it('is exactly as before with no options: whole pixels, a density-2 texel', () => {
    const cell = painted(MAN, pose, at)
    const before = place(pose, at, cell, 'a')
    expect(place(pose, at, cell, 'a', { density: 2, crisp: true })).toEqual(before)
    expect(before?.sprite.scale).toBe(Math.max(1, Math.round(zoomOf(pose, at) / 2)))
  })

  it('draws a density-1 figure at true size, a texel zoom pixels wide, when it asks for crisp: false', () => {
    const cell = painted(MAN, pose, at, 1)
    const placed = place(pose, at, cell, 'a', { density: 1, crisp: false })
    expect(placed?.sprite.scale).toBeCloseTo(zoomOf(pose, at), 9)
    // 50 mm at 16 m on 360 lines is 46.9 px a metre: the figure is its rows over 36.9 texels a metre tall, within 2%.
    const height = rowsOf(cell) * (placed?.sprite.scale ?? 0)
    const metres = rowsOf(cell) / (96 / 2.6)
    expect(height / ((metres * (360 / 2 / Math.tan(fovOf(50) * (Math.PI / 360)))) / 16)).toBeGreaterThan(0.98)
    expect(height / ((metres * (360 / 2 / Math.tan(fovOf(50) * (Math.PI / 360)))) / 16)).toBeLessThan(1.02)
  })

  it('rounds a density-1 figure to whole pixels a texel by default, as it rounds a density-2 one', () => {
    const cell = painted(MAN, tall, at, 1)
    expect(place(tall, at, cell, 'a', { density: 1 })?.sprite.scale).toBe(2)
  })

  it('keeps the whole-pixel rule when crisp is true at density 4', () => {
    const cell = painted(MAN, pose, at, 4)
    expect(place(pose, at, cell, 'a', { density: 4, crisp: true })?.sprite.scale).toBe(
      Math.max(1, Math.round(zoomOf(pose, at) / 4)),
    )
  })
})
