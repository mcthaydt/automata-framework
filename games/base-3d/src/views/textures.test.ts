// The scene's procedural textures (art direction spec §3.4, §4.4): painted into pixel buffers so they are checked here
// without a canvas. The pixel-art ones use only palette colours (or are transparent); the soft ones are white with
// alpha, tinted per card. Every painter gives the same bytes on every run.
import { DEFAULT_PALETTE } from '@mcthaydt/automata-content/palette'
import { describe, expect, it } from 'vitest'
import {
  type Pixels,
  paintGlow,
  paintGrass,
  paintMoon,
  paintShaft,
  paintSilhouette,
  paintStone,
  paintVine,
} from './textures.ts'

const PALETTE = new Set(DEFAULT_PALETTE.colors)

const colours = (pixels: Pixels): Set<string> => {
  const seen = new Set<string>()
  for (let i = 0; i < pixels.data.length; i += 4) {
    if (pixels.data[i + 3] === 0) continue
    expect(pixels.data[i + 3]).toBe(255)
    const hex = [0, 1, 2].map((k) => (pixels.data[i + k] as number).toString(16).padStart(2, '0')).join('')
    seen.add(`#${hex}`)
  }
  return seen
}

const PIXEL_ART: Record<string, () => Pixels> = {
  floor: () => paintStone('floor'),
  wall: () => paintStone('wall'),
  side: () => paintStone('side'),
  grass: paintGrass,
  vine: paintVine,
  pine: () => paintSilhouette('pine'),
  tower: () => paintSilhouette('tower'),
  moon: paintMoon,
}

describe('the pixel-art textures', () => {
  for (const [name, paint] of Object.entries(PIXEL_ART))
    it(`${name}: the same bytes every time, sized, palette colours or transparent`, () => {
      const a = paint()
      expect(a.data.length).toBe(a.width * a.height * 4)
      expect(Array.from(paint().data)).toEqual(Array.from(a.data))
      const used = colours(a)
      expect(used.size).toBeGreaterThan(0)
      for (const hex of used) expect(PALETTE.has(hex), `${name} ${hex}`).toBe(true)
    })

  it('covers the floor with stone and clumps of moss, and the walls with stone only', () => {
    const moss = ['#1e6f50', '#33984b', '#5ac54f']
    const share = (pixels: Pixels, set: string[]) => {
      let n = 0
      for (let i = 0; i < pixels.data.length; i += 4) {
        const hex = `#${[0, 1, 2].map((k) => (pixels.data[i + k] as number).toString(16).padStart(2, '0')).join('')}`
        if (set.includes(hex)) n++
      }
      return n / (pixels.width * pixels.height)
    }
    expect(share(paintStone('floor'), moss)).toBeGreaterThan(0.08)
    expect(share(paintStone('floor'), moss)).toBeLessThan(0.4)
    expect(share(paintStone('side'), moss)).toBe(0)
  })

  it('leaves the cut-out shapes transparent round their edges', () => {
    for (const pixels of [paintGrass(), paintSilhouette('pine'), paintMoon()]) expect(pixels.data[3]).toBe(0)
  })
})

describe('the soft textures', () => {
  it('are white, brightest in the middle, clear at the corners', () => {
    for (const pixels of [paintGlow(), paintShaft()]) {
      const alpha = (x: number, y: number) => pixels.data[(y * pixels.width + x) * 4 + 3] as number
      expect(alpha(0, 0)).toBe(0)
      expect(alpha(pixels.width / 2, pixels.height / 2)).toBeGreaterThan(150)
      for (let i = 0; i < pixels.data.length; i += 4)
        if ((pixels.data[i + 3] as number) > 0)
          expect([pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]]).toEqual([255, 255, 255])
    }
  })
})
