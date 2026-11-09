import { describe, expect, it } from 'vitest'
import { paintCell } from '#src/features/figures/paint/paint-cell.ts'
import { figureBuilderFrames } from '#src/testing/oracles.ts'
import { eyesIn, f13Frames, inputOf, md5 } from './cell-input.ts'

const { frames } = figureBuilderFrames()
const f13 = f13Frames(frames)

describe('the painter against the cells FigureBuilder painted', () => {
  it.each(frames.filter((f) => !f13.has(f.id)))('paints $id as FigureBuilder does', (frame) => {
    expect(md5(paintCell(inputOf(frame)).colours)).toBe(frame.md5)
  })

  it.each(frames.filter((f) => f13.has(f.id)))(
    'draws both eyes in $id, which FigureBuilder dropped',
    (frame) => {
      const input = inputOf(frame)
      const painted = paintCell(input)
      expect(input.face).not.toBeNull()
      expect(eyesIn(painted.colours, painted.width, input.face as NonNullable<typeof input.face>)).toBe(2)
    },
  )
})
