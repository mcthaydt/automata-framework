import { afterEach, describe, expect, it } from 'vitest'
import { dollhousePaint } from '#src/features/levels-3d/dollhouse/dollhouse-paint.ts'
import {
  createDollhouseRenderer,
  type DollhouseRenderer,
} from '#src/features/levels-3d/dollhouse/dollhouse-renderer.ts'
import { gameScene } from '#src/features/levels-3d/dollhouse/game-scene.ts'
import { frameMap } from '#src/features/levels-3d/frame-map.ts'
import { HALL_LIBRARY as library } from '#src/testing/hall-library.ts'
import { meshOf } from '#src/testing/room-mesh.ts'
import { toyAfSector } from '#src/testing/toy-af-sector.ts'

// The 3D view in the game's look (Levels 3D spec 10.3), on a real WebGL2 context: the room is core's world drawn with the
// game's materials and furniture, in DUEL colours at the game's field size, in the time of day the file names, with the
// level's things standing in it, and the selection drawn over all of it.

let renderer: DollhouseRenderer | undefined
let canvas: HTMLCanvasElement
afterEach(() => {
  renderer?.destroy()
  renderer = undefined
  canvas?.remove()
})

const W = 360
const H = 240

async function drawn(more = {}, selected: string[] = []): Promise<Uint8ClampedArray> {
  canvas = document.createElement('canvas')
  document.body.append(canvas)
  const created = await createDollhouseRenderer(canvas, { w: W, h: H, resolution: 1 })
  if (created === undefined) throw new Error('Chromium should have WebGL2')
  renderer = created
  const file = toyAfSector({
    props: [{ id: 'crate-1', use: 'crate', at: [3, 3] }],
    entities: [{ def: 'spawn', id: 'spawn', x: 5, z: 3 }],
    ...more,
  })
  const mesh = meshOf(file)
  const orbit = frameMap({ mesh }, 'diorama', { w: W, h: H })
  const scene = gameScene(file, library, () => 0)
  renderer.draw(dollhousePaint(mesh, orbit, { w: W, h: H }, new Set(selected), undefined, scene))
  const copy = new OffscreenCanvas(canvas.width, canvas.height)
  const context = copy.getContext('2d')
  if (context === null) throw new Error('no 2D context')
  context.drawImage(canvas, 0, 0)
  return context.getImageData(0, 0, canvas.width, canvas.height).data
}

const meanOf = (pixels: Uint8ClampedArray): [number, number, number] => {
  const sum = [0, 0, 0]
  for (let i = 0; i < pixels.length; i += 4)
    for (let c = 0; c < 3; c++) sum[c] = (sum[c] ?? 0) + (pixels[i + c] ?? 0)
  const n = pixels.length / 4
  return [(sum[0] ?? 0) / n, (sum[1] ?? 0) / n, (sum[2] ?? 0) / n]
}
const total = (pixels: Uint8ClampedArray): number => meanOf(pixels).reduce((a, b) => a + b, 0)

describe('the 3D view in the game’s look', () => {
  it('draws at the game’s field: a short side of 180 pixels, scaled up', async () => {
    await drawn()
    expect(Math.min(canvas.width, canvas.height)).toBe(180)
  })

  it('draws in a few palette colours, as the game does, and not in the gradients a lit surface would give', async () => {
    const pixels = await drawn()
    const colours = new Set<number>()
    for (let i = 0; i < pixels.length; i += 4)
      colours.add(((pixels[i] ?? 0) << 16) | ((pixels[i + 1] ?? 0) << 8) | (pixels[i + 2] ?? 0))
    // The DUEL snap puts every pixel on one of the palette's colours and the stepped light gives a few steps of each ramp.
    expect(colours.size).toBeLessThan(60)
  })

  it('shows the furniture: a room with a crate is not the room without one', async () => {
    const [withCrate, without] = [await drawn(), await drawn({ props: [] })]
    let different = 0
    for (let i = 0; i < withCrate.length; i += 4)
      if (withCrate[i] !== without[i] || withCrate[i + 1] !== without[i + 1]) different++
    expect(different).toBeGreaterThan(20)
  })

  it('shows the things that stand in it: the spawn point is drawn', async () => {
    const [withSpawn, without] = [await drawn(), await drawn({ entities: [] })]
    let different = 0
    for (let i = 0; i < withSpawn.length; i += 4)
      if (withSpawn[i] !== without[i] || withSpawn[i + 1] !== without[i + 1]) different++
    expect(different).toBeGreaterThan(10)
  })

  it('shows the time of day the file names: night is darker than the day, and golden hour is warmer', async () => {
    const [day, night, golden] = [
      await drawn(),
      await drawn({ time: 'night' }),
      await drawn({ time: 'golden' }),
    ]
    expect(total(night)).toBeLessThan(total(day) * 0.8)
    const [dr, , db] = meanOf(day)
    const [gr, , gb] = meanOf(golden)
    expect(gr / gb).toBeGreaterThan(dr / db)
  })

  it('draws a selected wall over the picture in the accent', async () => {
    const [plain, picked] = [await drawn(), await drawn({}, ['sector:hall'])]
    let different = 0
    for (let i = 0; i < plain.length; i += 4) if (plain[i + 2] !== picked[i + 2]) different++
    expect(different).toBeGreaterThan(50)
  })
})
