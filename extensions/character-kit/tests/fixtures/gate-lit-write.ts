// The lit gate's pictures, written through the `gateWrite` command into the folder `scripts/gate.ts lit` names (C7_GATE_OUT):
// for each room (the base interior at `lampLit`, the exterior by day) the frame unlit (today) and lit, side by side, a close-up of
// each figure before and after, and the walker's strip (four consecutive walk frames, before and after), with the light each figure
// took, as the kit read it, and the parity of a lit frame with the builder's compose. Nothing here is typed in by hand.
import { sceneLightingSchema } from '@automata/3d'
import { commands } from 'vitest/browser'
import { BASE } from '#src/shared/figure-builder/door.ts'
import { drawRoom, GATE_SIZE, type Rect, type RoomFrame, type RoomName } from './gate-lit.ts'
import { buildScene, differing, expectedPixels } from './stage-scene.ts'

const write = commands as unknown as { gateWrite(name: string, base64: string): Promise<void> }
type Pixels = ArrayLike<number>

const canvasOf = (width: number, height: number) => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}
const png = (canvas: HTMLCanvasElement) => canvas.toDataURL('image/png').split(',')[1] ?? ''
const text = (value: unknown) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`)))

/** A `width × height` RGBA buffer as a canvas. */
function canvasFrom(pixels: Pixels, width: number, height: number): HTMLCanvasElement {
  const canvas = canvasOf(width, height)
  canvas
    .getContext('2d')
    ?.putImageData(new ImageData(new Uint8ClampedArray(Array.from(pixels)), width, height), 0, 0)
  return canvas
}

/** Tiles laid left to right on a grey ground, scaled by whole pixels, nearest, with `gap` between. */
function sheet(rows: readonly (readonly HTMLCanvasElement[])[], scale: number, gap = 6): string {
  const width = Math.max(...rows.map((row) => row.reduce((sum, tile) => sum + tile.width * scale + gap, gap)))
  const height = rows.reduce(
    (sum, row) => sum + Math.max(...row.map((tile) => tile.height * scale)) + gap,
    gap,
  )
  const out = canvasOf(width, height)
  const draw = out.getContext('2d') as CanvasRenderingContext2D
  draw.fillStyle = '#808080'
  draw.fillRect(0, 0, width, height)
  draw.imageSmoothingEnabled = false
  let y = gap
  for (const row of rows) {
    let x = gap
    for (const tile of row) {
      draw.drawImage(tile, x, y, tile.width * scale, tile.height * scale)
      x += tile.width * scale + gap
    }
    y += Math.max(...row.map((tile) => tile.height * scale)) + gap
  }
  return png(out)
}

/** A crop of a frame round a rect, a margin of a few pixels each side. */
function crop(pixels: Pixels, rect: Rect, margin = 4): HTMLCanvasElement {
  const x = Math.max(0, Math.floor(rect.x) - margin)
  const y = Math.max(0, Math.floor(rect.y) - margin)
  const w = Math.min(GATE_SIZE[0] - x, rect.w + 2 * margin)
  const h = Math.min(GATE_SIZE[1] - y, rect.h + 2 * margin)
  const source = canvasFrom(pixels, GATE_SIZE[0], GATE_SIZE[1])
  const out = canvasOf(w, h)
  out.getContext('2d')?.drawImage(source, x, y, w, h, 0, 0, w, h)
  return out
}

/** The walk: four poses a pose-step apart (an eighth of the gait's cycle), the walker going a step along its line each. */
const WALK = [0, 1, 2, 3].map((i) => ({ t: 0.5 + i * 0.07, at: -0.9 + i * 0.12 }))

async function room(name: RoomName, suffix: string, preference: 'webgpu' | undefined) {
  const base = { room: name, sequence: WALK, ...(preference ? { preference } : {}) } as const
  const before = await drawRoom({ ...base, lit: false })
  const after = await drawRoom({ ...base, lit: true })
  const full = (frame: RoomFrame) => canvasFrom(frame.rgba, frame.width, frame.height)
  await write.gateWrite(`${name}-before${suffix}.png`, png(full(before)))
  await write.gateWrite(`${name}-after${suffix}.png`, png(full(after)))
  await write.gateWrite(`${name}${suffix}.png`, sheet([[full(before), full(after)]], 1))
  const last = (frame: RoomFrame) => frame.rects[frame.rects.length - 1] ?? []
  const closeups = last(after).map((rect) => {
    const mate = last(before).find((r) => r.name === rect.name) ?? rect
    return [crop(before.rgba, mate), crop(after.rgba, rect)]
  })
  await write.gateWrite(`${name}-crops${suffix}.png`, sheet(closeups, 4))
  // The walker's strip: the woman in each of the four frames, before above and after below.
  const strip = (frame: RoomFrame, dark: boolean) =>
    [...frame.earlier, frame.rgba].map((pixels, i) => {
      const rect = frame.rects[i]?.find((r) => r.name === BASE[1]?.def.id)
      return rect ? crop(pixels, rect) : canvasOf(1, 1)
    }, dark)
  await write.gateWrite(`${name}-walk${suffix}.png`, sheet([strip(before, false), strip(after, true)], 3))
  return { before: before.lights, after: after.lights, drawnBy: after.drawnBy }
}

/** The lit two-figure frame against the builder's compose, as `painted-lit.test.ts` counts it. */
async function parity(preference: 'webgpu' | undefined) {
  const scene = await buildScene({
    size: [640, 360],
    camera: 'ortho',
    figures: [
      { def: BASE[0]?.def as never, at: [-0.5, 0] },
      { def: BASE[1]?.def as never, at: [0.5, 0.3] },
    ],
    lighting: sceneLightingSchema.parse({
      ambient: 0.3,
      lamps: [{ id: 'lamp', x: -1.2, y: 2.2, z: 1.4, color: 0xffbc4e, strength: 2.4, range: 8, level: 1 }],
    }),
    ...(preference ? { preference } : {}),
  })
  try {
    for (let i = 0; i < 6; i++) {
      scene.draw()
      await new Promise((resolve) => requestAnimationFrame(resolve))
    }
    const got = scene.draw()
    const frame = scene.frame()
    const lit = frame.sprites.filter((sprite) => sprite.cell.rgba !== sprite.cell.painted).length
    const { wrong } = differing(got, expectedPixels(frame), 640)
    return { compared: 640 * 360, differing: wrong, litCells: lit }
  } finally {
    scene.dispose()
  }
}

/** Writes every picture and number of one renderer's side of the gate; returns the renderer that drew them. */
export async function writeGateLit(suffix: '' | '-webgpu', preference?: 'webgpu'): Promise<string> {
  const interior = await room('interior', suffix, preference)
  const exterior = await room('exterior', suffix, preference)
  const counts = await parity(preference)
  await write.gateWrite(`lights${suffix}.json`, text({ interior, exterior, parityWithCompose: counts }))
  return interior.drawnBy
}
