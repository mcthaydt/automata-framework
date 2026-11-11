// The whole pass list once extensions add passes after the snap: [haze?, grade?, snap, outline?, ...extras, present?], and
// the present pass ends it whenever any pass but the snap is in it. The registry is the module's, so each test loads a
// fresh copy.
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

describe('the look pass list with every core pass and an extension pass', () => {
  it('is haze, grade, the snap, the outline, the extension passes, then one present pass', () => {
    const rain = stub()
    passes.addLookPass({ name: 'spec-rain', make: () => rain })
    const made = passes.createLookPasses(look.parseLook({ switches: { outline: true } }), timeOfDay('day'))
    expect(made.list).toEqual([made.haze, made.grade, made.snap, made.outline, rain, made.present])
    expect(made.list.filter((pass) => pass instanceof present.PresentEffect)).toHaveLength(1)
  })

  it('ends in a present pass for an extension pass alone, with the haze and the grade off', () => {
    const rain = stub()
    passes.addLookPass({ name: 'spec-rain', make: () => rain })
    const made = passes.createLookPasses(
      look.parseLook({ switches: { haze: false, grade: false } }),
      timeOfDay('day'),
    )
    expect(made.list).toEqual([made.snap, rain, made.present])
  })

  it('has no present pass when the snap is the only pass', () => {
    const made = passes.createLookPasses(
      look.parseLook({ switches: { haze: false, grade: false } }),
      timeOfDay('day'),
    )
    expect(made.list).toEqual([made.snap])
    expect(made.present).toBeUndefined()
  })
})
