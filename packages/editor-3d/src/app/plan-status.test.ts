import { describe, expect, it } from 'vitest'
import { checksWords, modeOptions, planStatus } from './plan-status'

// The words of the Plan view's status line, checks pill and mode switch (plan ED3D.5d step 6): plain words for someone
// who is not a developer, the minus sign a real one, and every unbuilt mode saying why it cannot be chosen.

describe('planStatus', () => {
  it('says where the pointer is, the zoom and what is selected', () => {
    expect(planStatus({ pointer: { x: 3.25, z: -1.5 }, pxPerMetre: 48, selection: ['sector:hall'] })).toBe(
      'x 3.25 m · z −1.50 m · 48 px per metre · Room hall selected',
    )
  })

  it('leaves out the pointer once it is off the plan, and counts a bigger selection', () => {
    expect(planStatus({ pointer: undefined, pxPerMetre: 32.4, selection: [] })).toBe(
      '32 px per metre · Nothing selected',
    )
    expect(planStatus({ pointer: undefined, pxPerMetre: 32, selection: ['sector:a', 'wall:a/1'] })).toBe(
      '32 px per metre · 2 things selected',
    )
  })

  it('keeps to the selection on a phone, where the line is short', () => {
    expect(
      planStatus({ pointer: { x: 1, z: 2 }, pxPerMetre: 24, selection: ['sector:hall'], brief: true }),
    ).toBe('Room hall selected')
  })

  it('names a wall and a thing in words', () => {
    expect(planStatus({ pointer: undefined, pxPerMetre: 32, selection: ['wall:hall/2'] })).toBe(
      '32 px per metre · Wall 3 of hall selected',
    )
    expect(planStatus({ pointer: undefined, pxPerMetre: 32, selection: ['entity:lamp/l1'] })).toBe(
      '32 px per metre · lamp l1 selected',
    )
  })
})

describe('checksWords', () => {
  it('reads the counts with the pill’s tone', () => {
    expect(checksWords({ errors: 0, warnings: 0, pending: false })).toEqual({
      text: 'No problems',
      tone: 'ok',
    })
    expect(checksWords({ errors: 0, warnings: 2, pending: false })).toEqual({
      text: '2 warnings',
      tone: 'warn',
    })
    expect(checksWords({ errors: 1, warnings: 3, pending: false })).toEqual({
      text: '1 problem · 3 warnings',
      tone: 'bad',
    })
    expect(checksWords({ errors: 2, warnings: 0, pending: true })).toEqual({
      text: 'Checking…',
      tone: 'neutral',
    })
  })
})

describe('modeOptions', () => {
  it('offers Plan, 3D and Walk only below wide (ED3D.5f, ED3D.8b)', () => {
    expect(modeOptions({ narrow: true }).map((option) => option.label)).toEqual(['Plan', '3D', 'Walk'])
  })

  it('offers Plan, Split, 3D and Walk, and lists World as coming, saying why (ED3D.5e, ED3D.8b)', () => {
    const options = modeOptions()
    expect(options.map((option) => option.label)).toEqual(['Plan', 'Split', '3D', 'Walk', 'World'])
    for (const option of options.slice(0, 4)) expect(option.disabled).toBeFalsy()
    const world = options[4]
    expect(world?.disabled).toBe(true)
    expect(world?.reason).toMatch(/^Not ready yet: /)
  })
})
