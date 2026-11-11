// Painted figures under Pixi's WebGPU renderer hide behind AF's geometry and each other texel by texel, as they do under WebGL
// (painted-depth.test.ts): what the GPU draws is `compose` of what the stage placed. Chromium is launched with WebGPU on
// (vitest.config.ts); a machine with no adapter skips, in words.

import { sceneLightingSchema } from '@automata/3d'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BASE, type CharacterDef } from '#src/shared/figure-builder/door.ts'
import {
  buildScene,
  crossings,
  differing,
  expectedPixels,
  planeBackdrop,
  type StageScene,
} from '../../fixtures/stage-scene.ts'

const DEFS: readonly CharacterDef[] = BASE.map((base) => base.def)
const MAN = DEFS[0] as CharacterDef
const WOMAN = DEFS[1] as CharacterDef
const SIZE = [640, 360] as const
const WARM = sceneLightingSchema.parse({
  ambient: 0.3,
  lamps: [{ id: 'lamp', x: -1.2, y: 2.2, z: 1.4, color: 0xffbc4e, strength: 2.4, range: 8, level: 1 }],
})
let scene: StageScene | undefined
afterEach(() => {
  scene?.dispose()
  scene = undefined
  vi.restoreAllMocks()
})

const NO_ADAPTER = 'This browser grants no WebGPU adapter, so the renderer fell back to WebGL.'
/** A scene under WebGPU, or `undefined` (after skipping) where the browser granted no adapter. */
async function gpuScene(
  options: Omit<Parameters<typeof buildScene>[0], 'preference'>,
  skip: (note: string) => void,
): Promise<StageScene | undefined> {
  const built = await buildScene({ ...options, preference: 'webgpu' })
  if (built.renderer.stage.app.renderer.name !== 'webgpu') {
    built.dispose()
    skip(NO_ADAPTER)
    return undefined
  }
  // The swap chain presents from the second frame or so, and the GPU reports a device error a few frames late: draw some first, as
  // `packages/3d`'s WebGPU tests do, so the frame a test reads is a presented one.
  for (let frame = 0; frame < 6; frame++) {
    built.draw()
    await new Promise((resolve) => requestAnimationFrame(resolve))
  }
  return built
}

describe('painted figures in the 3D renderer under WebGPU, per texel', () => {
  it('under WebGPU a figure is cut by a wall as compose cuts it', async (context) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const box = { size: [60, 0.9, 0.02] as const, at: [0, 0, 0.04] as const, color: 0x3060c0 }
    scene = await gpuScene(
      { size: SIZE, camera: 'ortho', figures: [{ def: MAN, at: [0, 0] }], boxes: [box] },
      context.skip,
    )
    if (!scene) return
    const got = scene.draw()
    const pixel = (x: number, y: number) => [...got.slice((y * 640 + x) * 4, (y * 640 + x) * 4 + 3)]
    let cut = -1
    for (let y = 0; y < 360 && cut < 0; y++) if (pixel(10, y).some((v) => v !== 255)) cut = y
    expect(cut).toBeGreaterThan(0)
    const face = [...pixel(10, cut + 5), 255] as [number, number, number, number]
    const frame = scene.frame()
    const backdrop = planeBackdrop(frame.camera, 0.05, { x0: -30, x1: 30, y0: 0, y1: 0.9 }, face)
    const { wrong, first } = differing(
      got,
      expectedPixels(frame, backdrop),
      640,
      (_x, y) => Math.abs(y - cut) <= 1,
    )
    expect(wrong, first).toBe(0)
    // The figure really is cut by texel: some of its texels are behind the wall's face.
    const cell = frame.sprites[0]?.cell
    const [sx, sy] = frame.sprites[0]?.screen ?? [0, 0]
    let behind = 0
    for (let y = cut + 2; y < sy + (cell?.size[1] ?? 0); y++)
      for (let x = sx; x < sx + (cell?.size[0] ?? 0); x++)
        if (
          (cell?.rgba[((y - sy) * (cell?.size[0] ?? 0) + (x - sx)) * 4 + 3] ?? 0) > 0 &&
          pixel(x, y).every((v, c) => v === face[c])
        )
          behind++
    expect(behind).toBeGreaterThan(0)
    expect(warn.mock.calls).toEqual([])
  })

  it('under WebGPU two figures overlap as compose overlaps them', async (context) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    scene = await gpuScene(
      {
        size: SIZE,
        camera: 'ortho',
        figures: [
          { def: WOMAN, at: [0.3, 0.6] },
          { def: MAN, at: [0, 0] },
        ],
      },
      context.skip,
    )
    if (!scene) return
    const got = scene.draw()
    const frame = scene.frame()
    const { skip, count } = crossings(frame)
    expect(count).toBeLessThan(500)
    const { wrong, first } = differing(got, expectedPixels(frame), 640, skip)
    expect(wrong, first).toBe(0)
    expect(warn.mock.calls).toEqual([])
  })

  it('under WebGPU a lit figure equals compose of its lit cell', async (context) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    scene = await gpuScene(
      {
        size: SIZE,
        camera: 'ortho',
        figures: [
          { def: MAN, at: [-0.5, 0] },
          { def: WOMAN, at: [0.5, 0.3] },
        ],
        lighting: WARM,
      },
      context.skip,
    )
    if (!scene) return
    const got = scene.draw()
    const frame = scene.frame()
    expect(frame.sprites.every((sprite) => sprite.cell.rgba !== sprite.cell.painted)).toBe(true)
    const { skip, count } = crossings(frame)
    expect(count).toBeLessThan(500)
    const { wrong, first } = differing(got, expectedPixels(frame), 640, skip)
    expect(wrong, first).toBe(0)
    expect(warn.mock.calls).toEqual([])
  })
})
