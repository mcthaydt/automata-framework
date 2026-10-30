import { describe, expect, it } from 'vitest'
import { PLACEHOLDER_TUNING } from '../content/placeholder.content'
import { raceTuningSchema } from './tuning.schema'

describe('raceTuningSchema', () => {
  it('accepts the placeholder tuning', () => {
    expect(raceTuningSchema.parse(PLACEHOLDER_TUNING)).toEqual(PLACEHOLDER_TUNING)
  })

  it('refuses an unknown field, so a typo is not silently a default', () => {
    expect(() => raceTuningSchema.parse({ ...PLACEHOLDER_TUNING, gravty: -10 })).toThrow()
  })

  it('refuses gravity that does not pull down and a fast fall that does not fall', () => {
    expect(() => raceTuningSchema.parse({ ...PLACEHOLDER_TUNING, gravity: 1 })).toThrow()
    expect(() => raceTuningSchema.parse({ ...PLACEHOLDER_TUNING, fastFallVelocity: 2 })).toThrow()
  })

  it('refuses a course whose floor gap one bounce cannot clear', () => {
    // apex = v² / (2|g|): 3² / 24 = 0.375 m, under the 1.8 m gap.
    expect(() => raceTuningSchema.parse({ ...PLACEHOLDER_TUNING, bounceVelocity: 3 })).toThrow(/bounce/)
  })

  it('refuses a course whose moving floors cannot travel', () => {
    expect(() =>
      raceTuningSchema.parse({ ...PLACEHOLDER_TUNING, viewportWidth: PLACEHOLDER_TUNING.floorWidth * 2 }),
    ).toThrow(/viewport/)
  })
})
