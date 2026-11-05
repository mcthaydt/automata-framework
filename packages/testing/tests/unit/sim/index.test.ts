// @vitest-environment node
import { expect, test } from 'vitest'
import * as sim from '#src/sim/index.ts'

test('the ./sim API is exactly this list', () => {
  expect(Object.getOwnPropertyNames(sim).sort()).toEqual([
    'GOLDEN_MAX_PACKED_BYTES',
    'diffSnapshotViews',
    'expectGolden',
    'formatGoldenReport',
    'goldenCommands',
    'nodeCompression',
    'replayGolden',
    'simGolden',
    'snapshotRoundTripProperty',
    'streamCompression',
  ])
})
