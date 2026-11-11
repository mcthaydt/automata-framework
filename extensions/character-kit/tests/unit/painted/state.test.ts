import { describe, expect, it } from 'vitest'
import { checkState } from '#src/features/painted/state.ts'
import { BASE, POSES } from '#src/shared/figure-builder/door.ts'

const def = BASE[0]?.def
const known = Object.keys(POSES)[0] ?? ''

describe("a painted figure's state, checked against its character", () => {
  it('passes the names the character and the builder know, and leaves out the optional ones', () => {
    if (!def) throw new Error('no base figure')
    expect(() => checkState(def, { moving: false })).not.toThrow()
    expect(() => checkState(def, { moving: true, pose: known, outfit: def.default })).not.toThrow()
  })

  it('names an unknown pose and the character it was asked of', () => {
    if (!def) throw new Error('no base figure')
    expect(() => checkState(def, { moving: false, pose: 'nope' })).toThrow(/No pose called "nope"/)
    expect(() => checkState(def, { moving: false, pose: 'nope' })).toThrow(new RegExp(def.id))
  })

  it('names an unknown outfit, the character, and the outfits it has', () => {
    if (!def) throw new Error('no base figure')
    expect(() => checkState(def, { moving: false, outfit: 'nope' })).toThrow(/has no outfit called "nope"/)
    expect(() => checkState(def, { moving: false, outfit: 'nope' })).toThrow(new RegExp(def.id))
    expect(() => checkState(def, { moving: false, outfit: 'nope' })).toThrow(
      new RegExp(Object.keys(def.outfits)[0] ?? ''),
    )
  })
})
