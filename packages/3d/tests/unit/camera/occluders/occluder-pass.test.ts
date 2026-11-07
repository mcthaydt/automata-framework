// The occluder rule per frame (M3 spec §4.2, §8): which walls are cut and which props fade, and how far each has got.
// Walls cut at once when the eye goes outside them and come back only past 5° of camera turn; every change is a
// 150 ms fade (a cut wall to 0 with its trim shown, a `fade` one to 25%); reduced motion jumps.
import { describe, expect, it } from 'vitest'
import { eyeOf, type Vec3 } from '#src/features/camera/camera-pose.ts'
import { type OccluderFrame, occluderPass } from '#src/features/camera/occluders/occluder-pass.ts'
import type { WallSpan } from '#src/features/camera/occluders/occluder-rule.ts'

const SOUTH: WallSpan = { a: { x: 0, z: 0 }, b: { x: 4, z: 0 }, height: 2.5 }
const LOOK: Vec3 = { x: 2, y: 1, z: 2 }
const FEET: Vec3 = { x: 2, y: 0, z: 2 }
const HEAD: Vec3 = { x: 2, y: 1.62, z: 2 }
const BACK = 5 * Math.cos((25 * Math.PI) / 180)
/** The heading at which the default view's eye, looking at LOOK, stands exactly on SOUTH's line. */
const EDGE = (Math.acos(LOOK.z / BACK) * 180) / Math.PI

const frame = (headingDeg: number, seconds = 1, reduced = false): OccluderFrame => ({
  eye: eyeOf(LOOK, headingDeg, 25, 5),
  look: LOOK,
  feet: FEET,
  head: HEAD,
  seconds,
  reduced,
})

describe('walls', () => {
  it('cuts a wall the moment the eye is outside it and fades it out over 150 ms, the trim shown throughout', () => {
    const pass = occluderPass({ walls: [{ span: SOUTH, occlude: 'cut' }], props: [] })
    expect(pass.step(frame(90, 0)).walls[0]).toEqual({ occluded: false, opacity: 1, trim: false })
    const half = pass.step(frame(0, 0.075)).walls[0]
    expect(half?.occluded).toBe(true)
    expect(half?.opacity).toBeCloseTo(0.5, 9)
    expect(half?.trim).toBe(true)
    expect(pass.step(frame(0, 0.075)).walls[0]).toEqual({ occluded: true, opacity: 0, trim: true })
  })

  it('comes back only once 5° more of turn would not cut it again, then fades in over 150 ms', () => {
    const pass = occluderPass({ walls: [{ span: SOUTH, occlude: 'cut' }], props: [] })
    expect(pass.step(frame(EDGE - 3)).walls[0]?.occluded).toBe(true)
    // 4° past the edge the eye is inside, but a 5° turn back would put it outside: the wall stays cut.
    expect(pass.step(frame(EDGE + 4)).walls[0]?.occluded).toBe(true)
    expect(pass.step(frame(EDGE + 6, 0.075)).walls[0]).toEqual({ occluded: false, opacity: 0.5, trim: true })
    expect(pass.step(frame(EDGE + 6, 0.075)).walls[0]).toEqual({ occluded: false, opacity: 1, trim: false })
    // Standing, it cuts again the moment the eye crosses: no hysteresis toward standing.
    expect(pass.step(frame(EDGE - 0.5)).walls[0]?.occluded).toBe(true)
  })

  it('does not flicker while the camera turns back and forth across the edge by less than 5°', () => {
    const pass = occluderPass({ walls: [{ span: SOUTH, occlude: 'cut' }], props: [] })
    pass.step(frame(EDGE - 1))
    for (const turn of [1, 3, -2, 4, 0.5, 2, -1, 3.5])
      expect(pass.step(frame(EDGE + turn, 1 / 60)).walls[0]?.occluded).toBe(true)
  })

  it('stops a `fade` wall at 25% with no trim, and leaves a `never` wall alone', () => {
    const pass = occluderPass({
      walls: [
        { span: SOUTH, occlude: 'fade' },
        { span: SOUTH, occlude: 'never' },
      ],
      props: [],
    })
    const [faded, kept] = pass.step(frame(0)).walls
    expect(faded).toEqual({ occluded: true, opacity: 0.25, trim: false })
    expect(kept).toEqual({ occluded: false, opacity: 1, trim: false })
  })

  it('cuts a wall the eye faces but the line to the player crosses (the next room’s partition)', () => {
    // The player stands south of SOUTH, outside its room; the eye is in the room, north of the player.
    const pass = occluderPass({ walls: [{ span: SOUTH, occlude: 'cut' }], props: [] })
    const shown = pass.step({
      eye: { x: 2, y: 3, z: 3 },
      look: { x: 2, y: 1, z: -1.5 },
      feet: { x: 2, y: 0, z: -1.5 },
      head: { x: 2, y: 1.62, z: -1.5 },
      seconds: 1,
      reduced: false,
    }).walls[0]
    expect(shown?.occluded).toBe(true)
  })

  it('starts where it ends: the first step with the eye outside a wall has it gone, not fading (review of #249, 3)', () => {
    const pass = occluderPass({ walls: [{ span: SOUTH, occlude: 'cut' }], props: [] })
    expect(pass.step(frame(0, 1 / 60)).walls[0]).toEqual({ occluded: true, opacity: 0, trim: true })
  })

  it('snaps again on the step after reset (a resync, a rebuild, a camera cut)', () => {
    const pass = occluderPass({ walls: [{ span: SOUTH, occlude: 'cut' }], props: [] })
    pass.step(frame(90, 1 / 60))
    pass.reset()
    expect(pass.step(frame(0, 1 / 60)).walls[0]?.opacity).toBe(0)
    expect(pass.step(frame(90, 1 / 60)).walls[0]?.opacity).toBeLessThan(1)
  })

  it('jumps both ways under reduced motion', () => {
    const pass = occluderPass({ walls: [{ span: SOUTH, occlude: 'cut' }], props: [] })
    expect(pass.step(frame(0, 0, true)).walls[0]?.opacity).toBe(0)
    expect(pass.step(frame(90, 0, true)).walls[0]?.opacity).toBe(1)
  })
})

describe('props', () => {
  const PILLAR = { min: [1.8, 0, 0.8], max: [2.2, 2.4, 1.2] } as const

  it('fades a tall prop on the line to the head or the feet to 25% over 150 ms, and back when clear', () => {
    const pass = occluderPass({ walls: [], props: [{ bounds: PILLAR, occlude: 'fade' }] })
    expect(pass.step(frame(90, 1 / 60)).props[0]).toBe(1)
    expect(pass.step(frame(0, 0.075)).props[0]).toBeCloseTo(0.625, 9)
    expect(pass.step(frame(0, 0.075)).props[0]).toBe(0.25)
    // Turned a quarter, the pillar is beside the line.
    expect(pass.step(frame(90, 0.15)).props[0]).toBe(1)
  })

  it('cuts a `cut` prop to 0, leaves a `never` one, and jumps under reduced motion', () => {
    const pass = occluderPass({
      walls: [],
      props: [
        { bounds: PILLAR, occlude: 'cut' },
        { bounds: PILLAR, occlude: 'never' },
      ],
    })
    expect(pass.step(frame(0, 0, true)).props).toEqual([0, 1])
  })
})
