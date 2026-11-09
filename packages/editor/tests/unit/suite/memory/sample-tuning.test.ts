import { describe, expect, it } from 'vitest'
import { SAMPLE_GAME, SAMPLE_TUNING } from '#src/features/suite/memory/sample-ports.ts'
import { readTuning } from '#src/features/suite/tuner/tuner-content.ts'

// The try-it page is the only place many people meet the Tuner. A sample whose settings sit in a table gives them a screen of
// "change it in the file", so every setting the sample ships is a slider or a switch the Tuner can move.
describe('the sample game’s tuning', () => {
  it('is the file the sample game holds', () => {
    expect(SAMPLE_GAME['content/tuning.toml']).toBe(SAMPLE_TUNING)
  })

  it('holds at least two settings, and the Tuner can change every one', () => {
    const read = readTuning(SAMPLE_TUNING)
    if ('problem' in read) throw new Error(read.problem)
    expect(read.tunables.length).toBeGreaterThanOrEqual(2)
    expect(read.tunables.filter((tunable) => !tunable.editable).map((tunable) => tunable.name)).toEqual([])
  })

  it('gives each setting a name a person can read and a range to move in', () => {
    const read = readTuning(SAMPLE_TUNING)
    if ('problem' in read) throw new Error(read.problem)
    for (const tunable of read.tunables) {
      expect(tunable.label, tunable.name).toBeDefined()
      expect(tunable.min, tunable.name).toBeDefined()
      expect(tunable.max, tunable.name).toBeDefined()
    }
  })
})
