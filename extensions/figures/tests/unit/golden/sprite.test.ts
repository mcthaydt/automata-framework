import { describe, expect, it } from 'vitest'
import golden from '../../fixtures/golden/sprite.json'
import { spriteLitFrames } from './sprite'

/** The base pair lit as a sprite must stay pixel-identical to its golden: every frame's md5. A failure names each frame
 * that differs. */
describe('the sprite-lit base pair matches its golden', () => {
  it('every light and facing', () => {
    const got = spriteLitFrames(),
      want = golden as Record<string, string>
    expect(Object.keys(got)).toEqual(Object.keys(want))
    const differ = Object.keys(want).filter((name) => got[name] !== want[name])
    expect(differ, `${differ.length} frames differ`).toEqual([])
  }, 120_000)
})
