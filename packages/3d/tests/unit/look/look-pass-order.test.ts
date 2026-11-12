// The order of the whole list once extensions add passes on both sides of the snap: [haze?, ...early (beforeSnap), snap,
// outline?, ...after-snap extras, present?]. The present pass must end the list whenever any pass that samples the scene
// depth ran, and an early pass is one of those: it leaves its depth binding behind just as a pass after the snap does.
// The registry is the module's, so every test loads a fresh copy.
import type { Pass3D } from '@pixi/3d'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { timeOfDay } from '#src/shared/time-of-day/time-of-day.ts'

type LookPassModule = typeof import('#src/features/look/look-pass.ts')
type LookModule = typeof import('#src/features/look/look.ts')
type PresentModule = typeof import('#src/features/look/present-pass.ts')

let passes: LookPassModule
let look: LookModule
let present: PresentModule

beforeEach(async () => {
  vi.resetModules()
  passes = await import('#src/features/look/look-pass.ts')
  look = await import('#src/features/look/look.ts')
  present = await import('#src/features/look/present-pass.ts')
})

/** A stand-in pass: the list only orders what it is given. */
const stub = (): Pass3D => ({}) as Pass3D

describe('the look pass list with passes on both sides of the snap', () => {
  it('is haze, grade, early passes, the snap, the outline, the later passes, then one present pass', () => {
    const grade = stub()
    const rain = stub()
    passes.addLookPass({ name: 'spec-grade', beforeSnap: true, make: () => grade })
    passes.addLookPass({ name: 'spec-rain', make: () => rain })
    const made = passes.createLookPasses(
      look.parseLook({ switches: { haze: true, outline: true } }),
      timeOfDay('day'),
    )
    expect(made.list).toEqual([made.haze, made.grade, grade, made.snap, made.outline, rain, made.present])
    expect(made.early).toEqual([grade])
    expect(made.extra).toEqual([rain])
    expect(made.present).toBeInstanceOf(present.PresentEffect)
    expect(made.list.filter((pass) => pass instanceof present.PresentEffect)).toHaveLength(1)
  })

  it('keeps registration order inside each side of the snap', () => {
    const [a, b, c, d] = [stub(), stub(), stub(), stub()]
    passes.addLookPass({ name: 'spec-a', make: () => c })
    passes.addLookPass({ name: 'spec-b', beforeSnap: true, make: () => a })
    passes.addLookPass({ name: 'spec-c', make: () => d })
    passes.addLookPass({ name: 'spec-d', beforeSnap: true, make: () => b })
    const made = passes.createLookPasses(
      look.parseLook({ switches: { haze: false, grade: false } }),
      timeOfDay('day'),
    )
    expect(made.list.slice(0, -1)).toEqual([a, b, made.snap, c, d])
  })

  // The snap samples no depth, so a list of the snap alone needs no present pass; a pass before it does.
  it('ends in a present pass when only an early pass runs, haze off, no outline, nothing after the snap', () => {
    const grade = stub()
    passes.addLookPass({ name: 'spec-grade', beforeSnap: true, make: () => grade })
    const made = passes.createLookPasses(
      look.parseLook({ switches: { haze: false, grade: false } }),
      timeOfDay('day'),
    )
    expect(made.list).toEqual([grade, made.snap, made.present])
    expect(made.present).toBeInstanceOf(present.PresentEffect)
  })

  it('has no present pass when the snap is the only pass', () => {
    const made = passes.createLookPasses(
      look.parseLook({ switches: { haze: false, grade: false } }),
      timeOfDay('day'),
    )
    expect(made.list).toEqual([made.snap])
    expect(made.present).toBeUndefined()
  })

  it('has a present pass for a later pass alone, and for the haze alone', () => {
    const rain = stub()
    passes.addLookPass({ name: 'spec-rain', make: () => rain })
    const later = passes.createLookPasses(
      look.parseLook({ switches: { haze: false, grade: false } }),
      timeOfDay('day'),
    )
    expect(later.list).toEqual([later.snap, rain, later.present])
    const hazy = passes.createLookPasses(look.parseLook({ switches: { haze: true } }), timeOfDay('day'))
    expect(hazy.list.at(0)).toBe(hazy.haze)
    expect(hazy.list.at(-1)).toBe(hazy.present)
  })
})
