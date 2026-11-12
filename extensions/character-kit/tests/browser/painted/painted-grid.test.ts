// A painted figure placed on its texel lattice (`grid: true`) under a screen-pixel mesh, on a real WebGL2 renderer (the scene is
// tests/fixtures/grid-scene.ts's). Read back, every 4-by-4 block of device pixels holds one texel: its inner 3 by 3 are one colour,
// so no texel edge and no mesh line falls inside a texel. The same figure without `grid` at a place that rounds odd splits blocks,
// which is what the check would catch.
import { afterEach, describe, expect, it } from 'vitest'
import { closeGridScene, frameOf, splitBlocks } from '../../fixtures/grid-scene.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
afterEach(closeGridScene)

describe.skipIf(!hasWebGL2)('a painted figure on its texel lattice under a screen mesh', () => {
  // 0.0137 m puts the cell's top-left on an odd field pixel when it is rounded to the nearest pixel (the unit test sweeps every phase).
  it('keeps every texel whole between the lines: no line and no texel edge inside a 4-pixel cell', async () => {
    const { split, figure } = splitBlocks(await frameOf(0.0137, true))
    expect(figure, 'texels of the figure seen').toBeGreaterThan(300)
    expect(split).toEqual([])
  })

  it('splits cells without grid at the same place, so the check above can fail', async () => {
    expect(splitBlocks(await frameOf(0.0137, false)).split.length).toBeGreaterThan(0)
  })
})
