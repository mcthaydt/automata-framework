// A painted figure in a lit room is the builder's own frame of lit cells: what the GPU draws is `compose` of the cells the stage
// placed, pixel for pixel, as it is unlit (painted-depth.test.ts), and the haze, a pass over the scene's depth, veils a far
// figure and leaves a near one. Headless Firefox here has no WebGL; the GPU runner runs it there.
import { DEFAULT_LOOK, type Look, sceneLightingSchema } from '@automataframework/3d'
import { afterEach, describe, expect, it } from 'vitest'
import { BASE, type CharacterDef } from '#src/shared/figures/door.ts'
import {
  buildScene,
  crossings,
  differing,
  expectedPixels,
  planeBackdrop,
  type StageScene,
} from '../../fixtures/stage-scene.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const DEFS: readonly CharacterDef[] = BASE.map((base) => base.def)
const MAN = DEFS[0] as CharacterDef
const WOMAN = DEFS[1] as CharacterDef
const SIZE = [640, 360] as const
/** A warm lamp to the figures' left and in front, over a dim room. */
const WARM = sceneLightingSchema.parse({
  ambient: 0.3,
  lamps: [{ id: 'lamp', x: -1.2, y: 2.2, z: 1.4, color: 0xffbc4e, strength: 2.4, range: 8, level: 1 }],
})
/** Whether two byte arrays are equal (a browser has no `Buffer`). */
const sameBytes = (a: ArrayLike<number>, b: ArrayLike<number>) =>
  a.length === b.length && Array.prototype.every.call(a, (v, i) => v === b[i])
let scene: StageScene | undefined
afterEach(() => {
  scene?.dispose()
  scene = undefined
})

/** The sprites whose lit colours differ from their painted cell: the frame under test is a lit one. */
const litSprites = (drawn: StageScene) =>
  drawn.frame().sprites.filter((sprite) => sprite.cell.rgba !== sprite.cell.painted)

describe.runIf(hasWebGL2)('painted figures in a lit 3D room', () => {
  it('lit: two figures under a warm lamp equal compose of their lit cells', async () => {
    scene = await buildScene({
      size: SIZE,
      camera: 'ortho',
      figures: [
        { def: MAN, at: [-0.5, 0] },
        { def: WOMAN, at: [0.5, 0.3] },
      ],
      lighting: WARM,
    })
    const got = scene.draw()
    const frame = scene.frame()
    expect(litSprites(scene)).toHaveLength(2)
    // A cell the room lit is not the painter's: some texel's colour moved.
    for (const { cell } of frame.sprites) expect(sameBytes(cell.rgba, cell.painted)).toBe(false)
    const { skip, count } = crossings(frame)
    expect(count).toBeLessThan(500)
    const { wrong, first } = differing(got, expectedPixels(frame), SIZE[0], skip)
    expect(wrong, first).toBe(0)
  })

  it('lit behind a wall: the wall case of painted-depth, in a lit room', async () => {
    const box = { size: [60, 0.9, 0.02] as const, at: [0, 0, 0.04] as const, color: 0x3060c0 }
    scene = await buildScene({
      size: SIZE,
      camera: 'ortho',
      figures: [{ def: MAN, at: [0, 0] }],
      boxes: [box],
      lighting: WARM,
    })
    const got = scene.draw()
    const pixel = (x: number, y: number) => [...got.slice((y * 640 + x) * 4, (y * 640 + x) * 4 + 3)]
    let cut = -1
    for (let y = 0; y < 360 && cut < 0; y++) if (pixel(10, y).some((v) => v !== 255)) cut = y
    expect(cut).toBeGreaterThan(0)
    const face = [...pixel(10, cut + 5), 255] as [number, number, number, number]
    const frame = scene.frame()
    expect(litSprites(scene)).toHaveLength(1)
    const backdrop = planeBackdrop(frame.camera, 0.05, { x0: -30, x1: 30, y0: 0, y1: 0.9 }, face)
    const { wrong, first } = differing(
      got,
      expectedPixels(frame, backdrop),
      640,
      (_x, y) => Math.abs(y - cut) <= 1,
    )
    expect(wrong, first).toBe(0)
  })

  it('lit: false in a lit room is the unlit frame', async () => {
    const figures = [
      { def: MAN, at: [-0.5, 0] as const },
      { def: WOMAN, at: [0.5, 0.3] as const },
    ]
    scene = await buildScene({
      size: SIZE,
      camera: 'ortho',
      figures: figures.map((figure) => ({ ...figure, options: { lit: false } })),
      lighting: WARM,
    })
    const inLitRoom = Uint8ClampedArray.from(scene.draw())
    expect(litSprites(scene)).toHaveLength(0)
    scene.dispose()
    scene = await buildScene({ size: SIZE, camera: 'ortho', figures })
    expect(sameBytes(inLitRoom, scene.draw())).toBe(true)
  })

  it('no lighting: the cells are the painter’s own', async () => {
    scene = await buildScene({ size: SIZE, camera: 'ortho', figures: [{ def: MAN, at: [0, 0] }] })
    scene.draw()
    expect(litSprites(scene)).toHaveLength(0)
  })

  it('the haze veils a far figure and leaves a near one', async () => {
    // The haze starts 8 m behind the focus, so the near figure (5 m from the camera) is clear and the far one (about 17 m) is veiled.
    const look: Look = {
      ...DEFAULT_LOOK,
      switches: { outline: false, grade: false, dither: false, haze: true, shadow: false },
      haze: { ...DEFAULT_LOOK.haze, near: 8, far: 20 },
    }
    scene = await buildScene({
      size: SIZE,
      camera: 'follow',
      figures: [
        { def: MAN, at: [0, 0] },
        { def: WOMAN, at: [7, -12] },
      ],
      lighting: WARM,
      passes: look,
    })
    const got = scene.draw()
    const frame = scene.frame()
    const veil = [0x47, 0x65, 0x5a]
    const mean = (name: string, from: 'drawn' | 'cell') => {
      const sprite = frame.sprites.find((s) => s.name === name)
      if (!sprite) throw new Error(`no ${name} placed`)
      expect(sprite.scale).toBe(1)
      const [w, h] = sprite.cell.size
      const sum = [0, 0, 0]
      let n = 0
      for (let v = 0; v < h; v++) {
        for (let u = 0; u < w; u++) {
          if (!sprite.cell.rgba[(v * w + u) * 4 + 3]) continue
          const x = sprite.screen[0] + u
          const y = sprite.screen[1] + v
          if (x < 0 || y < 0 || x >= SIZE[0] || y >= SIZE[1]) continue
          for (let c = 0; c < 3; c++)
            sum[c] =
              (sum[c] ?? 0) +
              ((from === 'drawn' ? got[(y * SIZE[0] + x) * 4 + c] : sprite.cell.rgba[(v * w + u) * 4 + c]) ??
                0)
          n++
        }
      }
      expect(n).toBeGreaterThan(500)
      return sum.map((total) => total / n)
    }
    const away = (m: readonly number[]) => Math.hypot(...m.map((value, c) => value - (veil[c] ?? 0)))
    // The far figure: its pixels are nearer the veil than its cell is.
    expect(away(mean(WOMAN.id, 'drawn'))).toBeLessThan(away(mean(WOMAN.id, 'cell')) - 5)
    // The near one: its pixels are its cell's.
    expect(mean(MAN.id, 'drawn')).toEqual(mean(MAN.id, 'cell'))
  })
})
