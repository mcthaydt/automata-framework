// The `occlude` content shape (M3 spec §4.2): how the angled camera treats a static mesh or a wall. One owner: the
// pure `./camera-view` entry carries it, and the 3D level editor's sector format takes it from there.
import { describe, expect, it } from 'vitest'
import * as entry from '../camera-view.js'
import { OCCLUDES, occludeSchema } from './occlude.js'

describe('occlude', () => {
  it('is cut, fade or never, and nothing else', () => {
    expect(OCCLUDES).toEqual(['cut', 'fade', 'never'])
    for (const value of OCCLUDES) expect(occludeSchema.parse(value)).toBe(value)
    expect(occludeSchema.safeParse('hide').success).toBe(false)
  })

  it('is the pure entry’s, by identity', () => {
    expect(entry.OCCLUDES).toBe(OCCLUDES)
    expect(entry.occludeSchema).toBe(occludeSchema)
  })
})
