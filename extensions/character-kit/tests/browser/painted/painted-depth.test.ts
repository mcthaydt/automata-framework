// Painted figures in the 3D renderer hide behind AF's geometry and each other texel by texel, and are the builder's own
// frame: what the GPU draws is `compose(frame, backdrop)` of what the stage placed, pixel for pixel. Headless Firefox here
// has no WebGL; the GPU runner runs it there.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BASE, type CharacterDef } from '#src/shared/figures/door.ts'
import {
  buildScene,
  crossings,
  differing,
  expectedPixels,
  type FigureAt,
  planeBackdrop,
  type StageScene,
  step,
} from '../../fixtures/stage-scene.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const DEFS: readonly CharacterDef[] = BASE.map((base) => base.def)
const MAN = DEFS[0] as CharacterDef
const WOMAN = DEFS[1] as CharacterDef
const SIZE = [640, 360] as const
let scene: StageScene | undefined
afterEach(() => {
  scene?.dispose()
  scene = undefined
  vi.restoreAllMocks()
})

/** Every pixel the GPU drew equals the builder's reference, or says which first. */
function expectEqual(
  drawn: StageScene,
  skip?: (x: number, y: number) => boolean,
  backdrop?: Parameters<typeof expectedPixels>[1],
) {
  const got = drawn.draw()
  const { wrong, first } = differing(got, expectedPixels(drawn.frame(), backdrop), drawn.size[0], skip)
  expect(wrong, first).toBe(0)
}

/** Two figures' surfaces cross where an arm passes through a body: the pixels on that line can differ by one between GPUs (the
 * builder's contract, docs/contract.md section 4b: "the pixels within the GPU's depth step of the crossing can differ by a pixel").
 * Only those pixels are skipped (two sprites' test depths within the depth step), and every other pixel must be equal, in every
 * engine: WebKit differs from Chromium at 2 of 230,400 here, both on such a crossing. */
function expectEqualButCrossings(drawn: StageScene) {
  drawn.draw() // the stage places its figures when it draws, and the frame is what it placed
  const { skip, count } = crossings(drawn.frame())
  // The allowance stays local: a handful of pixels on a line, never a region.
  expect(count).toBeLessThan(500)
  expectEqual(drawn, skip)
}

describe.runIf(hasWebGL2)('painted figures in the 3D renderer, per texel', () => {
  it('1. one figure under the painter’s own orthographic camera: every pixel is the reference’s', async () => {
    scene = await buildScene({ size: SIZE, camera: 'ortho', figures: [{ def: MAN, at: [0, 0] }] })
    expect(scene.draw().length).toBe(640 * 360 * 4)
    expectEqual(scene)
    expect(scene.stage.placed).toHaveLength(1)
  })

  it('2. one figure under perspective at 640 × 360: every pixel is the reference’s, a texel a pixel', async () => {
    scene = await buildScene({ size: SIZE, camera: 'follow', figures: [{ def: MAN, at: [0, 0] }] })
    const got = scene.draw()
    const placed = scene.stage.placed[0]
    expect(placed?.sprite.scale).toBe(1)
    expectEqual(scene)
    // The figure's height in pixels is `scale ×` the rows the cell paints.
    const cell = placed?.sprite.cell
    const [w, h] = cell?.size ?? [0, 0]
    let rows = 0
    for (let y = 0; y < h; y++) {
      if ([...Array(w).keys()].some((x) => (cell?.rgba[(y * w + x) * 4 + 3] ?? 0) > 0)) rows++
    }
    let drawnRows = 0
    for (let y = 0; y < 360; y++) {
      if (
        [...Array(640).keys()].some(
          (x) => got[(y * 640 + x) * 4] !== 255 || got[(y * 640 + x) * 4 + 1] !== 255,
        )
      )
        drawnRows++
    }
    expect(drawnRows).toBe(rows * (placed?.sprite.scale ?? 0))
  })

  it('3. two overlapping figures: the nearer in front, swapped by distance, and a tie to the later-made', async () => {
    const pairs: readonly (readonly [FigureAt, FigureAt])[] = [
      [
        { def: WOMAN, at: [0.3, 0.6] },
        { def: MAN, at: [0, 0] },
      ],
      [
        { def: MAN, at: [0.3, 0.6] },
        { def: WOMAN, at: [0, 0] },
      ],
    ]
    for (const [near, far] of pairs) {
      scene = await buildScene({ size: SIZE, camera: 'ortho', figures: [near, far] })
      expectEqualButCrossings(scene)
      expect(scene.stage.placed).toHaveLength(2)
      expect(scene.stage.placed.map((placed) => placed.sprite.name)).toEqual([far.def.id, near.def.id])
      scene.dispose()
    }
    // An exact tie in depth goes to the later-made.
    scene = await buildScene({
      size: SIZE,
      camera: 'ortho',
      figures: [
        { def: MAN, at: [0, 0] },
        { def: WOMAN, at: [0, 0] },
      ],
    })
    expectEqualButCrossings(scene)
    expect(scene.stage.placed.map((placed) => placed.sprite.name)).toEqual([MAN.id, WOMAN.id])
  })

  it('4. a figure cut at the knees by a box of the scene: equal but a pixel either side of the cut', async () => {
    // A wide, thin box 0.9 m tall whose front face is 5 cm in front of the figure's root plane: the parts of the figure that
    // stand nearer the camera than that show in front of it, the rest of the legs go behind it, and the cut is by texel, not
    // by the figure's root. Its edges but the top are off screen; its top face is a fraction of a pixel deep.
    const box = { size: [60, 0.9, 0.02] as const, at: [0, 0, 0.04] as const, color: 0x3060c0 }
    scene = await buildScene({
      size: SIZE,
      camera: 'ortho',
      figures: [{ def: MAN, at: [0, 0] }],
      boxes: [box],
    })
    const got = scene.draw()
    const pixel = (x: number, y: number) => [...got.slice((y * 640 + x) * 4, (y * 640 + x) * 4 + 3)]
    // The cut line: the first row below the background in a column the figure does not reach, and the face's colour there.
    let cut = -1
    for (let y = 0; y < 360 && cut < 0; y++) if (pixel(10, y).some((v) => v !== 255)) cut = y
    expect(cut).toBeGreaterThan(0)
    const face = [...pixel(10, cut + 5), 255] as [number, number, number, number]
    expect(pixel(10, cut + 12)).toEqual(face.slice(0, 3))
    const frame = scene.frame()
    const backdrop = planeBackdrop(frame.camera, 0.05, { x0: -30, x1: 30, y0: 0, y1: 0.9 }, face)
    const { wrong, first } = differing(
      got,
      expectedPixels(frame, backdrop),
      640,
      (_x, y) => Math.abs(y - cut) <= 1,
    )
    expect(wrong, first).toBe(0)
    // The figure really is cut by texel: some of it shows over the face, some of it is behind.
    let over = 0
    let behind = 0
    const cell = frame.sprites[0]?.cell
    const [sx, sy] = frame.sprites[0]?.screen ?? [0, 0]
    for (let y = cut + 2; y < sy + (cell?.size[1] ?? 0); y++) {
      for (let x = sx; x < sx + (cell?.size[0] ?? 0); x++) {
        const texel = ((y - sy) * (cell?.size[0] ?? 0) + (x - sx)) * 4 + 3
        if ((cell?.rgba[texel] ?? 0) === 0) continue
        if (pixel(x, y).every((v, c) => v === face[c])) behind++
        else over++
      }
    }
    expect(over).toBeGreaterThan(0)
    expect(behind).toBeGreaterThan(0)
  })

  it('5. this frame’s camera: a camera moved 1 m sideways is the one the figure is placed by', async () => {
    scene = await buildScene({ size: SIZE, camera: 'follow', figures: [{ def: MAN, at: [0, 0] }] })
    expectEqual(scene)
    const before = scene.stage.placed[0]?.sprite.screen
    scene.view.camera.position.x += 1
    expectEqual(scene)
    expect(scene.stage.placed[0]?.sprite.screen).not.toEqual(before)
  })

  it('6. a figure removed mid-show leaves the stage: its quad is destroyed and the ranks close up', async () => {
    scene = await buildScene({
      size: SIZE,
      camera: 'ortho',
      figures: [
        { def: MAN, at: [0, -1] },
        { def: WOMAN, at: [0.4, 0] },
        { def: MAN, at: [-0.4, 1] },
      ],
    })
    scene.draw()
    const first = scene.stage.sprites[0]
    expect(scene.stage.placed).toHaveLength(3)
    scene.renderer.apply(step({ resync: false, added: [], changed: [], removed: [1] }))
    expectEqual(scene)
    expect(scene.stage.placed).toHaveLength(2)
    expect(scene.stage.sprites).toHaveLength(2)
    expect(first?.sprite.destroyed).toBe(true)
  })

  it('7. asked for WebGPU, given WebGL: the same frame as compose, and no warning', async (context) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    scene = await buildScene({
      size: SIZE,
      camera: 'ortho',
      figures: [{ def: MAN, at: [0, 0] }],
      preference: 'webgpu',
    })
    // Where the browser grants an adapter this is the WebGPU renderer, whose cases are `tests/browser/webgpu`'s.
    if (scene.renderer.stage.app.renderer.name === 'webgpu') {
      context.skip('This browser drew with WebGPU; the fallback case runs where it grants no adapter.')
    }
    expectEqual(scene)
    expect(scene.stage.placed).toHaveLength(1)
    expect(warn.mock.calls).toEqual([])
  })

  it('8. a pose that does not exist is an error in words at the first frame, not a standing figure', async () => {
    await expect(
      buildScene({
        size: SIZE,
        camera: 'ortho',
        figures: [{ def: MAN, at: [0, 0], options: { state: () => ({ moving: false, pose: 'nope' }) } }],
      }),
    ).rejects.toThrow(/No pose called "nope"/)
  })

  it('9. a figure whose own node is hidden is not drawn, and the rest are', async () => {
    scene = await buildScene({
      size: SIZE,
      camera: 'ortho',
      figures: [
        { def: MAN, at: [-0.8, 0] },
        { def: WOMAN, at: [0.8, 0] },
      ],
    })
    scene.draw()
    const hidden = scene.stage.sprites[0]?.sprite.parent
    if (!hidden) throw new Error('a quad has the entity’s node as its parent')
    hidden.visible = false
    expectEqual(scene)
    expect(scene.stage.placed.map((placed) => placed.sprite.name)).toEqual([WOMAN.id])
  })
})
