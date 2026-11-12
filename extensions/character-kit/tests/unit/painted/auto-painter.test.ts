// A painted figure that is painted at the density its camera needs: one painter for each density it has been seen at, so a level
// that comes back is not painted again, and a cut to a close shot is sharp on its first frame. The gait goes on across a change.
import { describe, expect, it } from 'vitest'
import { AutoPainter } from '#src/features/painted/auto-painter.ts'
import { Painter } from '#src/features/painted/painter.ts'
import { BASE, type CharacterDef } from '#src/shared/figures/door.ts'

const MAN = BASE[0]?.def as CharacterDef
const VIEW = { azimuth: 0, pitch: (18 * Math.PI) / 180 }
const input = (t: number, moving = false) => ({
  t,
  dt: 1 / 30,
  facing: Math.PI,
  state: { moving },
  view: VIEW,
})

describe('a figure painted at the density its camera needs', () => {
  it('paints a far camera at 1 and a pulled-in camera at 4', () => {
    const painter = new AutoPainter(MAN)
    expect(painter.paint(input(0), 1.43).size).toEqual([64, 96])
    expect(painter.paint(input(1 / 30), 4).size).toEqual([256, 384])
    expect(painter.paint(input(2 / 30), 4).density).toBe(4)
  })

  it('paints the first frame of a close shot at the close shot’s density, with no frame at the old one', () => {
    const painter = new AutoPainter(MAN)
    painter.paint(input(0), 1.43)
    // The cut: the camera is at zoom 4 on the next frame, and that frame is the sharp one.
    expect(painter.paint(input(1 / 30), 4).density).toBe(4)
  })

  it('pins a density that is asked for, whatever the zoom', () => {
    const painter = new AutoPainter(MAN, { density: 2 })
    for (const zoom of [1, 4, 9]) expect(painter.paint(input(0), zoom).density).toBe(2)
  })

  it('stops at the cap a game sets, and at 8 when it lifts it', () => {
    expect(new AutoPainter(MAN, { maxDensity: 2 }).paint(input(0), 8).density).toBe(2)
    expect(new AutoPainter(MAN).paint(input(0), 8).density).toBe(4)
    expect(new AutoPainter(MAN, { maxDensity: 8 }).paint(input(0), 8).density).toBe(8)
  })

  it('is the plain painter’s cell at the density it picked, texel for texel', () => {
    const auto = new AutoPainter(MAN, { density: 'auto' })
    const plain = new Painter(MAN, 4)
    const mine = auto.paint(input(0.2), 4)
    const theirs = plain.paint(input(0.2))
    expect(mine.key).toBe(theirs.key)
    expect(Buffer.from(mine.rgba).equals(Buffer.from(theirs.rgba))).toBe(true)
  })

  it('keeps a painter for each density it has been seen at, and does not paint a level again when it comes back', () => {
    const painter = new AutoPainter(MAN)
    // Two seconds of walking at 30 frames a second, drawn at `zoom`; a walk repeats its few poses, so the second visit has them kept.
    const walk = (zoom: number, from: number) => {
      const start = performance.now()
      for (let i = 0; i < 60; i++) painter.paint(input(from + i / 30, true), zoom)
      return performance.now() - start
    }
    const first = walk(4, 0)
    walk(1.43, 2)
    expect(painter.densities).toEqual([1, 4])
    const again = walk(4, 4)
    expect(painter.densities).toEqual([1, 4])
    expect(again, `first ${first.toFixed(0)} ms, again ${again.toFixed(0)} ms`).toBeLessThan(first / 3)
  }, 60_000)

  it('lets a density go that has not been drawn for a while, and keeps the one in use', () => {
    const painter = new AutoPainter(MAN)
    painter.paint(input(0), 4)
    painter.paint(input(1), 1.43)
    expect(painter.densities).toEqual([1, 4])
    painter.paint(input(30), 1.43)
    expect(painter.densities).toEqual([1])
  })

  it('walks on through a change of density: the gait does not start over', () => {
    const steady = new Painter(MAN, 4)
    const changing = new AutoPainter(MAN)
    let t = 0
    // Walks half a second drawn at density 1, and the next half second at density 4; the steady painter walked at 4 all along.
    for (; t < 0.46; t += 1 / 30) {
      steady.paint(input(t, true))
      changing.paint(input(t, true), 1.43)
    }
    const after = changing.paint(input(t, true), 4)
    const should = steady.paint(input(t, true))
    expect(after.key).toBe(should.key)
  })

  it('paints with the character a density names, when a game says a figure dresses differently where its texels can hold more', () => {
    const other = BASE[1]?.def as CharacterDef
    const painter = new AutoPainter(MAN, { defFor: (density) => (density >= 2 ? other : MAN) })
    expect(painter.paint(input(0), 1.43).key).toBe(new Painter(MAN, 1).paint(input(0)).key)
    expect(painter.paint(input(1 / 30), 4).key).toBe(new Painter(other, 4).paint(input(1 / 30)).key)
  })
})
