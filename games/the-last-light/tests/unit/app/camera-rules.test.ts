import { fovOf, LENS_MM } from '@automata/3d/camera-view'
import { describe, expect, it } from 'vitest'
import { FIELD_CAP } from '#src/app/field.ts'
import { LEVEL } from '#src/features/room/room.ts'

// Ada's size on the screen is the old game's because the camera is: a 50 mm lens (27 degrees of the picture's height), 30 degrees
// down, the zones' own distances. The old game measured about 53 lines to a metre at 480 lines, so a standing figure 1.7 m tall at the
// camera's focus stands about 90 lines tall. These pin the numbers; the first-draw audit measured the stand-in on the screen.

const TILT = 30
const lens = fovOf(LENS_MM)

/** Lines a metre of standing height takes at the focus, for a picture `lines` tall and a camera `distance` metres from it. */
const linesPerMetre = (lines: number, distance: number): number =>
  (lines / (2 * distance * Math.tan((lens * Math.PI) / 360))) * Math.cos((TILT * Math.PI) / 180)

describe('the play camera', () => {
  it('has the old game’s lens, a 50 mm through a 24 mm gate', () => {
    expect(LENS_MM).toBe(50)
    expect(lens).toBeCloseTo(26.99, 2)
  })

  it('has the old game’s zone distances: 16.6 m in the hall, 16 in the corridor, 15 in the closet', () => {
    const distance = (id: string) => (LEVEL.views as Record<string, { distance: number }>)[id]?.distance
    expect([distance('hall'), distance('corridor'), distance('closet')]).toEqual([16.6, 16, 15])
  })

  it('gives about 53 lines to a metre in the hall at 480 lines, so Ada 1.7 m tall stands about 90 lines tall', () => {
    const perMetre = linesPerMetre(FIELD_CAP.height, 16.6)
    expect(perMetre).toBeGreaterThan(51.5)
    expect(perMetre).toBeLessThan(53.5)
    expect(perMetre * 1.7).toBeGreaterThan(87)
    expect(perMetre * 1.7).toBeLessThan(92)
  })
})
