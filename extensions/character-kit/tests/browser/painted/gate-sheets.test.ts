// The depth sheet and parity counts of gate 1 (docs/refactor/c7/gate-1/): what the GPU draws beside the builder's own `compose`
// of the same frame, and where they differ. Written by `scripts/gate.ts` (which sets VITE_C7_GATE and C7_GATE_OUT); skipped in
// every other run. Numbers are counted here, never typed.

import { describe, expect, it } from 'vitest'
import { commands } from 'vitest/browser'
import { BASE, type CharacterDef } from '#src/shared/figure-builder/door.ts'
import {
  buildScene,
  differing,
  expectedPixels,
  type FigureAt,
  planeBackdrop,
} from '../../fixtures/stage-scene.ts'

const on = import.meta.env.VITE_C7_GATE === '1'
const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const MAN = BASE[0]?.def as CharacterDef
const WOMAN = BASE[1]?.def as CharacterDef
const SIZE = [640, 360] as const
const SCALE = 3
const write = commands as unknown as { gateWrite(name: string, base64: string): Promise<void> }

/** PNG (base64) of pixel rows laid side by side, scaled up by whole pixels, nearest. */
function sheet(tiles: readonly { pixels: ArrayLike<number>; width: number; height: number }[]): string {
  const gap = 6
  const width = tiles.reduce((sum, t) => sum + t.width * SCALE + gap, gap)
  const height = (tiles[0]?.height ?? 0) * SCALE + 2 * gap
  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  const draw = out.getContext('2d') as CanvasRenderingContext2D
  draw.fillStyle = '#808080'
  draw.fillRect(0, 0, width, height)
  draw.imageSmoothingEnabled = false
  let x = gap
  for (const t of tiles) {
    const source = document.createElement('canvas')
    source.width = t.width
    source.height = t.height
    source
      .getContext('2d')
      ?.putImageData(new ImageData(new Uint8ClampedArray(Array.from(t.pixels)), t.width, t.height), 0, 0)
    draw.drawImage(source, x, gap, t.width * SCALE, t.height * SCALE)
    x += t.width * SCALE + gap
  }
  return out.toDataURL('image/png').split(',')[1] ?? ''
}

/** Red where the GPU and the reference differ, the GPU's pixel elsewhere, dimmed. */
function mask(
  got: ArrayLike<number>,
  want: ArrayLike<number>,
  skip: (x: number, y: number) => boolean,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(want.length)
  for (let i = 0; i < want.length / 4; i++) {
    const [x, y] = [i % SIZE[0], Math.floor(i / SIZE[0])]
    const bad = !skip(x, y) && [0, 1, 2].some((c) => got[i * 4 + c] !== want[i * 4 + c])
    for (let c = 0; c < 3; c++) out[i * 4 + c] = bad ? ([255, 0, 0][c] ?? 0) : (got[i * 4 + c] ?? 0) >> 2
    out[i * 4 + 3] = 255
  }
  return out
}

describe.runIf(on && hasWebGL2)('gate 1: the depth sheet and parity with the builder’s compose', () => {
  it('draws each case, counts the pixels that differ from compose, and writes the sheet', async () => {
    const counts: Record<string, { compared: number; differing: number }> = {}
    const cases: { name: string; camera: 'ortho' | 'follow'; figures: readonly FigureAt[]; box?: boolean }[] =
      [
        { name: 'one figure, orthographic at 18°', camera: 'ortho', figures: [{ def: MAN, at: [0, 0] }] },
        {
          name: 'one figure, perspective (the follow view)',
          camera: 'follow',
          figures: [{ def: MAN, at: [0, 0] }],
        },
        {
          name: 'two overlapping figures',
          camera: 'ortho',
          figures: [
            { def: WOMAN, at: [0.3, 0.6] },
            { def: MAN, at: [0, 0] },
          ],
        },
        { name: 'a figure cut by a wall', camera: 'ortho', figures: [{ def: MAN, at: [0, 0] }], box: true },
      ]
    for (const [index, c] of cases.entries()) {
      const scene = await buildScene({
        size: SIZE,
        camera: c.camera,
        figures: c.figures,
        ...(c.box ? { boxes: [{ size: [60, 0.9, 0.02], at: [0, 0, 0.04], color: 0x3060c0 }] } : {}),
      })
      const got = scene.draw()
      const frame = scene.frame()
      let backdrop: ReturnType<typeof planeBackdrop> | undefined
      let cut = -100
      if (c.box) {
        for (let y = 0; y < SIZE[1] && cut < 0; y++)
          if ([0, 1, 2].some((k) => got[(y * SIZE[0] + 10) * 4 + k] !== 255)) cut = y
        const face = [0, 1, 2].map((k) => got[((cut + 5) * SIZE[0] + 10) * 4 + k] ?? 0)
        backdrop = planeBackdrop(frame.camera, 0.05, { x0: -30, x1: 30, y0: 0, y1: 0.9 }, [
          face[0] ?? 0,
          face[1] ?? 0,
          face[2] ?? 0,
          255,
        ])
      }
      const want = expectedPixels(frame, backdrop)
      const skip = (_x: number, y: number) => Math.abs(y - cut) <= 1
      const { wrong, first } = differing(got, want, SIZE[0], skip)
      let compared = 0
      for (let y = 0; y < SIZE[1]; y++) for (let x = 0; x < SIZE[0]; x++) if (!skip(x, y)) compared++
      counts[c.name] = { compared, differing: wrong }
      expect(wrong, `${c.name}: ${first}`).toBe(0)
      const tile = (pixels: ArrayLike<number>) => ({ pixels, width: SIZE[0], height: SIZE[1] })
      await write.gateWrite(
        `depth-${index + 1}.png`,
        sheet([tile(got), tile(want), tile(mask(got, want, skip))]),
      )
      scene.dispose()
    }
    const text = `${JSON.stringify({ against: 'FigureBuilder compose(frame, backdrop)', note: 'tiles are the GPU readback, compose, and red where they differ (a pixel either side of the wall’s cut line is not compared)', cases: counts }, null, 2)}\n`
    await write.gateWrite('parity.json', btoa(String.fromCharCode(...new TextEncoder().encode(text))))
  })
})
