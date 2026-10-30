// D3-i across engines: the stick mapper's sweep (every 64th heading against a grid of sticks, on `dmath`) hashes the
// same in Chromium, WebKit and Firefox as in Node (`sim/stick-mapper.test.ts`). A mismatch is a determinism bug in
// the mapper or `dmath`, never a golden to update per engine.
import { describe, expect, it } from 'vitest'
import { STICK_SWEEP_HASH, stickSweepHash } from '../testing/stick-sweep.js'

describe('the stick mapper in this engine', () => {
  it('gives the Node golden for the whole sweep', () => {
    expect(stickSweepHash()).toBe(STICK_SWEEP_HASH)
  })
})
