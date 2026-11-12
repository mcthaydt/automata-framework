import { describe, expect, it } from 'vitest'
import { photoToTile, tileColours, unpack } from '#src/features/textures/tile.ts'
import { JOINT_SLOT } from '#src/features/textures/tile-colours.ts'
import { ladderOf, type TexturedSwatch } from '#src/features/textures/tile-read.ts'
import { makePng } from '../../fixtures/png.ts'

// A swatch's `texture.joint` names the swatch its joint (grout) is drawn in. Without it a tile is what it always was; with it,
// the texels that are well under the surface's own light are labelled apart, so another hue taken for the accent can never
// take the joint with it (the ward's warm floor tiles made their grout vanish).

const COOL = 0x58595a
const WARM = 0xa5703a
const GROUT = 0x1a2a3a
/** 32 pixels a side: 8-pixel cells with a one-pixel joint along the top and left of each, a quarter of the cells warm, the rest cool. */
const grid = (x: number, y: number): number =>
  x % 8 === 0 || y % 8 === 0 ? GROUT : (Math.floor(x / 8) + 2 * Math.floor(y / 8)) % 4 === 0 ? WARM : COOL
const isJointTexel = (i: number, width: number): boolean =>
  (i % width) % 8 === 0 || Math.floor(i / width) % 8 === 0
const KNOBS = {
  size: [1, 1] as const,
  texels: [32, 32] as const,
  wear: 0,
  facet: 0,
  flatten: 0,
  cluster: 2,
  accent: 0.03,
}
const jointsIn = (labels: Uint16Array): number =>
  [...labels].filter((l) => unpack(l).slot === JOINT_SLOT).length

describe('a swatch’s joint colour', () => {
  it('labels the joint texels apart, and only those, even where the surface has an accent', () => {
    const tile = photoToTile(makePng(32, 32, grid), { ...KNOBS, joint: 'grout' })
    expect(tile.width).toBe(32)
    tile.labels.forEach((label, i) => {
      expect(unpack(label).slot === JOINT_SLOT, `texel ${i}`).toBe(isJointTexel(i, tile.width))
    })
  })

  it('leaves the cells their own light on the surface’s ladder and its accent’s', () => {
    const tile = photoToTile(makePng(32, 32, grid), { ...KNOBS, joint: 'grout' })
    const slots = new Set([...tile.labels].map((label) => unpack(label).slot))
    expect([...slots].sort((a, b) => a - b)).toEqual([0, 1, JOINT_SLOT])
  })

  it('makes the tile it made before when no joint is named', () => {
    const before = photoToTile(makePng(32, 32, grid), KNOBS)
    expect(jointsIn(before.labels)).toBe(0)
    // ...which is how the accent took the joint: some of its texels are on the accent's ladder, a warm swatch's.
    const onAccent = [...before.labels].filter(
      (l, i) => isJointTexel(i, before.width) && unpack(l).slot === 1,
    )
    expect(onAccent.length).toBeGreaterThan(0)
    const jointless = photoToTile(makePng(32, 32, grid), { ...KNOBS, joint: undefined, jointDepth: 1 })
    expect(jointless.labels).toEqual(before.labels)
  })

  it('takes a texel as joint when it is `jointDepth` steps under the surface’s light', () => {
    const shallow = photoToTile(makePng(32, 32, grid), { ...KNOBS, joint: 'grout', jointDepth: 1 })
    const deep = photoToTile(makePng(32, 32, grid), { ...KNOBS, joint: 'grout', jointDepth: 99 })
    expect(jointsIn(shallow.labels)).toBeGreaterThan(0)
    expect(jointsIn(deep.labels)).toBe(0)
  })

  it('is read against the joint swatch’s ramp and step, a texel being its offset from that step', () => {
    const ladder = { base: { ramp: 4, step: 3 }, joint: { ramp: 9, step: 2 } }
    const labels = Uint16Array.of(JOINT_SLOT * 16 + 8, JOINT_SLOT * 16 + 7, JOINT_SLOT * 16 + 12, 8)
    const colours = tileColours({ width: 4, height: 1, labels }, ladder)
    expect([...colours]).toEqual([9 * 8 + 2, 9 * 8 + 1, 9 * 8 + 6, 4 * 8 + 3])
  })

  it('is read against the swatch itself when the joint swatch is not there', () => {
    const labels = Uint16Array.of(JOINT_SLOT * 16 + 8)
    const colours = tileColours({ width: 1, height: 1, labels }, { base: { ramp: 4, step: 3 } })
    expect([...colours]).toEqual([4 * 8 + 3])
  })

  it('finds the joint swatch by the name the texture gives', () => {
    const swatches: Record<string, TexturedSwatch> = {
      floor: { ramp: 'slate', step: 2, texture: { photo: 'floorTiles', joint: 'grout' } },
      grout: { ramp: 'grey', step: 1 },
    }
    const ladder = ladderOf(swatches.floor as TexturedSwatch, swatches)
    expect(ladder.joint).toEqual({ ramp: 0, step: 1 })
    expect(ladderOf(swatches.grout as TexturedSwatch, swatches).joint).toBeUndefined()
  })
})
