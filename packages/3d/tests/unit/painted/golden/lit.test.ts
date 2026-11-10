import { describe, expect, it, vi } from 'vitest'
import golden from '../../../fixtures/painted/golden/lit.json' with { type: 'json' }
import { litFrames } from './lit.ts'

// Each case paints whole figures in every view (and walks), seconds apiece with the suite's files side by side; the
// source's own suite allows 30 s, and so does this file.
vi.setConfig({ testTimeout: 30_000 })

/** The base pair lit must stay pixel-identical to its golden (recorded through the scene's composite before the cut):
 * every frame's md5. A failure names each frame that differs. */
describe('the lit base pair matches its golden', () => {
  it('every setup, facing and density', () => {
    const got = litFrames(),
      want = golden as Record<string, string>
    expect(Object.keys(got)).toEqual(Object.keys(want))
    const differ = Object.keys(want).filter((name) => got[name] !== want[name])
    expect(differ, `${differ.length} frames differ`).toEqual([])
  }, 120_000)
})
