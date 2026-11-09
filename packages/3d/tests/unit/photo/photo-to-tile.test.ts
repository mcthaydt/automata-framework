import { DEFAULT_PALETTE } from '@automata/content/palette'
import { describe, expect, it } from 'vitest'
import { decodePng } from '#src/features/photo/png.ts'
import { photoToTile, tileColours, unpack } from '#src/features/photo/tile.ts'
import { checkerPng, makePng } from '../../fixtures/world/png.ts'

const KNOBS = { size: [1, 1] as const, texels: [16, 16] as const, wear: 0 }
const LADDER = { base: { ramp: 4, step: 3 } }

describe('photoToTile', () => {
  it('reads the bytes a PNG holds, pixel for pixel', async () => {
    const image = await decodePng(makePng(3, 2, (x, y) => (x + y * 3) * 0x101010))
    expect([image.width, image.height]).toEqual([3, 2])
    expect(image.rgba[4 * 4]).toBe(4 * 0x10)
  })

  it('refuses bytes that are not a PNG, and says so', async () => {
    await expect(decodePng(Uint8Array.of(1, 2, 3))).rejects.toThrow('not a PNG')
  })

  it('every texel of a tone tile is a DUEL colour on the swatch ladder', async () => {
    const tile = await photoToTile(checkerPng(32), KNOBS)
    const colours = tileColours(tile, LADDER)
    expect(colours.length).toBe(tile.width * tile.height)
    expect([...colours].every((i) => i < DEFAULT_PALETTE.colors.length)).toBe(true)
    // The ladder is ramp 4: every texel lies on that ramp.
    expect([...colours].every((i) => Math.floor(i / 8) === 4)).toBe(true)
  })

  it('every texel of a photo tile is a DUEL colour on its own ramp', async () => {
    const tile = await photoToTile(checkerPng(32), { ...KNOBS, colour: 'photo', colours: 3 })
    const colours = tileColours(tile, LADDER)
    expect([...colours].every((i) => i < DEFAULT_PALETTE.colors.length)).toBe(true)
    expect(new Set(tile.labels).size).toBeLessThanOrEqual(3)
    expect([...tile.labels].every((l) => unpack(l).slot >= 2)).toBe(true)
  })

  it('is as large as the surface it covers at the texel scale', async () => {
    const tile = await photoToTile(checkerPng(32), { ...KNOBS, size: [2, 1], texels: [16, 16] })
    // 16 texels a metre snaps to the nearest √2 step (16): a 2 m × 1 m photo is 32 × 16.
    expect([tile.width, tile.height]).toEqual([32, 16])
  })

  it('a quarter turn swaps the tile’s sides', async () => {
    const tile = await photoToTile(checkerPng(32), { ...KNOBS, size: [2, 1], turn: true })
    expect([tile.width, tile.height]).toEqual([16, 32])
  })

  it('the same bytes and knobs make the same tile, and another seed wears it differently', async () => {
    const worn = { ...KNOBS, wear: 1 }
    const a = await photoToTile(checkerPng(32), { ...worn, seed: 1 })
    const b = await photoToTile(checkerPng(32), { ...worn, seed: 1 })
    const c = await photoToTile(checkerPng(32), { ...worn, seed: 2 })
    expect(a.labels).toEqual(b.labels)
    expect(a.labels).not.toEqual(c.labels)
  })

  it('wear darkens patches by whole steps and never leaves the range', async () => {
    const fresh = await photoToTile(checkerPng(32), { ...KNOBS, wear: 0 })
    const worn = await photoToTile(checkerPng(32), { ...KNOBS, wear: 1, seed: 3 })
    expect(worn.labels).not.toEqual(fresh.labels)
    expect([...worn.labels].every((l) => unpack(l).value >= -2)).toBe(true)
  })

  it('the clean-up leaves no single orphan texel', async () => {
    const noisy = makePng(32, 32, (x, y) => (x === 10 && y === 10 ? 0xffffff : 0x7a6a55))
    const tile = await photoToTile(noisy, { ...KNOBS, facet: 0, flatten: 0, cluster: 4 })
    expect(new Set(tile.labels).size).toBe(1)
  })
})
