import { describe, expect, it } from 'vitest'
import { worldKitLibrary } from '#src/app/world-kit-library.ts'
import { type FigureRead, type Frame, figureReads } from '#src/features/reads/figure-reads.ts'
import { DEFAULT_READS, readsAgainst, waivedBy } from '#src/features/reads/reads-against.ts'
import { checkReads } from '#src/features/textures/check-reads.ts'
import { room } from '../../fixtures/level.ts'

/** A 40 × 30 frame of one grey, with a 6 × 6 figure of another at (10, 10); the figure is where the depth differs. */
type Drawn = Frame & { sceneDepth: Float32Array; frameDepth: Float32Array }
function frameOf(room: number, figure: number): Drawn {
  const width = 40
  const height = 30
  const rgba = new Uint8ClampedArray(width * height * 4)
  const sceneDepth = new Float32Array(width * height)
  const frameDepth = new Float32Array(width * height)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const inside = x >= 10 && x < 16 && y >= 10 && y < 16
      const v = inside ? figure : room
      rgba.set([v, v, v, 255], (y * width + x) * 4)
      if (inside) frameDepth[y * width + x] = 1
    }
  return { width, height, rgba, sceneDepth, frameDepth }
}

describe('figureReads', () => {
  it('finds the figure where the depth differs and measures it against its ring', () => {
    const [read] = figureReads(frameOf(100, 200))
    expect(read?.texels).toBe(36)
    expect(read?.ringTexels).toBeGreaterThan(0)
    expect(read?.figure).toBeGreaterThan(read?.around ?? 1)
    // 200/255 against 100/255, plus 0.01 each: about 1.9×.
    expect(read?.luma).toBeCloseTo((200 / 255 + 0.01) / (100 / 255 + 0.01), 3)
  })

  it('reads a dark figure on a light room as strongly as the other way round', () => {
    const a = figureReads(frameOf(100, 200))[0]
    const b = figureReads(frameOf(200, 100))[0]
    expect(b?.luma).toBeCloseTo(a?.luma ?? 0, 6)
  })

  it('ignores a speck smaller than twenty texels', () => {
    const frame = frameOf(100, 200)
    frame.frameDepth.fill(0)
    frame.frameDepth[0] = 1
    expect(figureReads(frame)).toEqual([])
  })

  it('a figure that fills the frame has no ring and reads 1', () => {
    const frame = frameOf(100, 200)
    frame.frameDepth.fill(1)
    expect(figureReads(frame)[0]).toMatchObject({ ringTexels: 0, read: 1 })
  })
})

describe('readsAgainst', () => {
  const [weak] = figureReads(frameOf(100, 102))
  const [hot] = figureReads(frameOf(100, 200))

  it('names the figure whose edge is under the level’s minEdge, to the limit it fails', () => {
    expect(weak).toBeDefined()
    expect(readsAgainst([weak as FigureRead], { minEdge: 5 })[0]).toMatch(/^figure 1: edge \d\.\d{2,3} < 5$/)
  })

  it('a figure much brighter than its room is hot, unless the level waives it', () => {
    expect(readsAgainst([hot as FigureRead], { minEdge: 0 })).toEqual([
      expect.stringMatching(/^figure 1: hot \d\.\d{2,3} > 1\.1$/),
    ])
    expect(readsAgainst([hot as FigureRead], { minEdge: 0, hot: true })).toEqual([])
    expect(waivedBy([hot as FigureRead], { hot: true })).toHaveLength(1)
    expect(waivedBy([hot as FigureRead], {})).toEqual([])
  })

  it('holds a level that declares nothing to the defaults', () => {
    expect(DEFAULT_READS).toEqual({ minEdge: 1.1, hot: false })
    expect(readsAgainst([])).toEqual([])
  })
})

describe('checkReads', () => {
  const level = (floor: string) => {
    const r = room('office', 1)
    ;(r.sectors[0] as { floor: unknown }).floor = { z: 0, surface: floor }
    ;(r.sectors[0] as { dress?: unknown }).dress = undefined
    return r
  }

  it('is empty for a level whose swatches keep the reads they declare', () => {
    expect(checkReads(level('oakFloor'), worldKitLibrary)).toEqual([])
  })

  it('reports a swatch whose tile fails what it declares, once, naming the room and the swatch', () => {
    const swatches = {
      ...worldKitLibrary.swatches,
      oakFloor: { ...(worldKitLibrary.swatches.oakFloor as object), reads: { maxDominant: 0.01 } },
    }
    const problems = checkReads(level('oakFloor'), { ...worldKitLibrary, swatches })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatchObject({
      code: 'swatch-reads',
      name: 'oakFloor',
      where: 'room',
      path: ['sectors', 0],
    })
    expect(problems[0]?.message).toMatch(
      /^The swatch "oakFloor" does not read as a planks at its scale: flat/,
    )
  })

  it('leaves a swatch that declares no reads, and a flat one, alone', () => {
    expect(checkReads(level('pineFloor'), worldKitLibrary)).toEqual([])
  })
})
