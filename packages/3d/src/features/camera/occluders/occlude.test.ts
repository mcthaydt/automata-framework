// The `occlude` content shape (M3 spec §4.2): how the angled camera treats a static mesh or a wall. Its one owner is
// the sector format (M6-D17), whose own tests pin the values; the pure `./camera-view` entry re-exports it, not a copy.

import { describe, expect, it } from 'vitest'
import * as entry from '../../../entries/camera-view.ts'
import * as format from '../../../shared/level/occlude.ts'

describe('occlude', () => {
  it('is the sector format’s, by identity', () => {
    expect(entry.OCCLUDES).toBe(format.OCCLUDES)
    expect(entry.occludeSchema).toBe(format.occludeSchema)
  })
})
