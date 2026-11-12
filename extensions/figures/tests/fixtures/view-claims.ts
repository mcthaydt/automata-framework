/**
 * What each check case claims of the GPU's frame, asked of a readback: shared by the WebGL and the WebGPU suites, so both
 * hold the renderer to the same words. `bytes`: every byte of the readback is `compose(frame)`'s. `palette`: alpha is 0 or
 * 255 only and every opaque pixel is a colour some sprite's cell holds (a perspective quad is resampled, so no byte claim).
 */
import { expect } from 'vitest'
import { compose } from '#src/entries/index.ts'
import { CASES, wallBackdrop } from './view-cases.ts'
import { drawCase, type Renderer } from './view-draw.ts'

const at = (i: number, w: number) => `(${(i >> 2) % w}, ${Math.floor((i >> 2) / w)})`

/** Draws the case under `renderer` and asserts the case's claim of the readback. */
export async function expectCase(name: string, renderer: Renderer): Promise<void> {
  const c = CASES[name]
  const frame = c.frame(),
    want = compose(frame, c.wall && wallBackdrop(frame.camera, c.wall)),
    [W, H] = frame.camera.size,
    got = await drawCase(name, renderer)
  expect(got.renderer, `asked for ${renderer}, the page drew with ${got.renderer}`).toBe(renderer)
  expect(
    got.perTexelDepth,
    'StageView found no per-texel depth under this renderer (it depth-tests per texel only under WebGL or WebGPU)',
  ).toBe(true)
  expect([got.w, got.h], 'the canvas is the frame').toEqual([W, H])
  if (c.claim === 'bytes') {
    let wrong = 0,
      first = -1
    for (let i = 0; i < want.length; i += 4)
      if (
        want[i] !== got.rgba[i] ||
        want[i + 1] !== got.rgba[i + 1] ||
        want[i + 2] !== got.rgba[i + 2] ||
        want[i + 3] !== got.rgba[i + 3]
      ) {
        wrong++
        if (first < 0) first = i
      }
    expect(
      wrong,
      `${wrong} pixels differ, first ${at(first, W)} cpu ${Array.from(want.slice(first, first + 4))} gpu ${Array.from(got.rgba.subarray(first, first + 4))}`,
    ).toBe(0)
    return
  }
  const held = new Set<number>()
  for (const s of frame.sprites)
    for (let i = 0; i < s.cell.rgba.length; i += 4)
      if (s.cell.rgba[i + 3])
        held.add((s.cell.rgba[i] << 16) | (s.cell.rgba[i + 1] << 8) | s.cell.rgba[i + 2])
  let bad = ''
  for (let i = 0; i < got.rgba.length && !bad; i += 4) {
    const a = got.rgba[i + 3],
      rgb = (got.rgba[i] << 16) | (got.rgba[i + 1] << 8) | got.rgba[i + 2]
    if (a !== 0 && a !== 255) bad = `alpha ${a} at ${at(i, W)}`
    else if (a === 255 && !held.has(rgb))
      bad = `new colour #${rgb.toString(16).padStart(6, '0')} at ${at(i, W)}`
  }
  expect(bad, 'the palette holds').toBe('')
}
