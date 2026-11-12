// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until the strict flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) replace each with a check
import { describe, expect, it } from 'vitest'
import { compose, gameplay, type StageFrame } from '#src/entries/index.ts'
import { coloursOf } from '../../fixtures/stage'
import { CASES, wallBackdrop } from '../../fixtures/view-cases.ts'

/**
 * The per-texel depth cases the browser suite draws on the GPU (tests/fixtures/view-cases.ts), asked of the CPU reference: that each really
 * exercises what it is named for, so a GPU that merely matched `compose` on an empty frame could not pass them.
 */
/** The old rule: each sprite wholly over the earlier, in the frame's order. */
const painters = (fr: StageFrame) => {
  const out = new Uint8ClampedArray(fr.camera.size[0] * fr.camera.size[1] * 4)
  for (const s of fr.sprites) {
    const one = compose({ ...fr, sprites: [s] })
    for (let i = 0; i < one.length; i += 4) if (one[i + 3]) out.set(one.subarray(i, i + 4), i)
  }
  return out
}
const differing = (a: Uint8ClampedArray, b: Uint8ClampedArray) => {
  let n = 0
  for (let i = 0; i < a.length; i += 4)
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) n++
  return n
}

describe('the depth cases', () => {
  it("overlap: the walking woman's nearer arm shows in front of the standing man, texel by texel, not quad by quad", () => {
    const fr = CASES.overlap.frame()
    expect(fr.sprites.map((s) => s.name)).toEqual(['base-f', 'base-m']) // she is the farther: drawn first
    expect(differing(compose(fr), painters(fr))).toBeGreaterThan(100)
  })
  it('tie/same: two cells tied at every texel resolve to the later sprite', () => {
    const fr = CASES['tie/same'].frame(),
      out = compose(fr),
      [first, later] = fr.sprites
    expect(differing(out, compose({ ...fr, sprites: [later] }))).toBe(0)
    expect(differing(out, compose({ ...fr, sprites: [first] }))).toBeGreaterThan(1000)
  })
  for (const name of ['wall', 'gameplay/wall/0'])
    it(`${name}: a wall quad cuts through the legs: hidden behind it, shown in front, the wall itself where nothing is nearer`, () => {
      const c = CASES[name],
        fr = c.frame(),
        wall = c.wall!,
        back = wallBackdrop(fr.camera, wall)
      const withWall = compose(fr, back),
        without = compose(fr),
        alone = compose({ ...fr, sprites: [] }, back)
      const wallColour = (wall.rgba[0] << 16) | (wall.rgba[1] << 8) | wall.rgba[2]
      expect(coloursOf(alone)).toEqual(new Set([wallColour])) // the wall is one colour
      let hidden = 0,
        shown = 0
      for (let i = 0; i < without.length; i += 4)
        if (alone[i + 3] && without[i + 3]) {
          if (differing(withWall.subarray(i, i + 4), without.subarray(i, i + 4))) hidden++
          else shown++
        }
      expect(hidden).toBeGreaterThan(30) // figure texels the wall hides
      expect(shown).toBeGreaterThan(30) // figure texels in front of the wall, where the legs pass through it
    })
  it("range/later and range/earlier: a twin half a step behind shows over the figure, one a step and a half behind shows under it (the metre rule, at a host's range)", () => {
    /** Of the pixels both sprites cover, how many show the figure (the first) and how many its twin. */
    const top = (name: string) => {
      const fr = CASES[name].frame(),
        out = compose(fr),
        one = compose({ ...fr, sprites: [fr.sprites[0]] }),
        two = compose({ ...fr, sprites: [fr.sprites[1]] })
      let mine = 0,
        twin = 0
      for (let i = 0; i < out.length; i += 4)
        if (one[i + 3] && two[i + 3]) {
          if (out[i] === one[i] && out[i + 1] === one[i + 1] && out[i + 2] === one[i + 2]) mine++
          else twin++
        }
      return { mine, twin }
    }
    const later = top('range/later'),
      earlier = top('range/earlier')
    expect(later.twin).toBeGreaterThan(1000)
    expect(later.mine).toBe(0) // the twin wins everywhere it overlaps
    expect(earlier.mine).toBeGreaterThan(1000)
    expect(earlier.twin).toBe(0) // the figure wins everywhere
  })
  it("the wall backdrop honours the pose's principal point: the principal ray hits the plane at the fwd depth", () => {
    const wall = CASES.wall.wall!,
      base = gameplay([0, 0.6, 0]),
      off = { ...base, cx: base.size[0] / 2 + 40, cy: base.size[1] / 2 - 25 }
    const wide = {
      z: 0.043,
      x: [-50, 50] as [number, number],
      y: [-50, 50] as [number, number],
      rgba: wall.rgba,
    }
    // the centre pixel's ray is `fwd` itself: t = (z − eye.z) / fwd.z
    const t = (wide.z - off.eye[2]) / off.fwd[2]
    expect(wallBackdrop(off, wide)(off.cx, off.cy)!.depth).toBeCloseTo(t, 9)
    expect(wallBackdrop(base, wide)(base.size[0] / 2, base.size[1] / 2)!.depth).toBeCloseTo(t, 9)
  })
})
