import type { RenderDelta, RenderRow } from '@mcthaydt/automata-sim'
import { describe, expect, it } from 'vitest'
import { lampSwitches } from './lamp-switches.js'

const row = (sid: number, lamp: string, level: number): RenderRow => ({
  sid,
  components: { lamp: { lamp, level } },
})
const delta = (part: Partial<RenderDelta>): RenderDelta => ({
  resync: false,
  added: [],
  changed: [],
  removed: [],
  ...part,
})

describe('lampSwitches', () => {
  it('reads each lamp entity’s level, and reports only when a level changed', () => {
    const switches = lampSwitches('lamp')
    expect(switches.apply(delta({ added: [row(1, 'desk', 1), row(2, 'hall', 0.5)] }))).toEqual({
      desk: 1,
      hall: 0.5,
    })
    expect(switches.apply(delta({ changed: [row(1, 'desk', 1)] }))).toBeUndefined()
    expect(switches.apply(delta({ changed: [row(1, 'desk', 0)] }))).toEqual({ desk: 0, hall: 0.5 })
  })

  it('lets a removed lamp entity return its lamp to the content level', () => {
    const switches = lampSwitches('lamp')
    switches.apply(delta({ added: [row(1, 'desk', 0)] }))
    expect(switches.apply(delta({ removed: [1] }))).toEqual({})
  })

  it('starts again from a resync', () => {
    const switches = lampSwitches('lamp')
    switches.apply(delta({ added: [row(1, 'desk', 0), row(2, 'hall', 0)] }))
    expect(switches.apply(delta({ resync: true, added: [row(3, 'hall', 0)] }))).toEqual({ hall: 0 })
  })

  it('ignores rows without the component, and a row that lost it lets its lamp go', () => {
    const switches = lampSwitches('lamp')
    expect(switches.apply(delta({ added: [{ sid: 1, components: { crate: { x: 1 } } }] }))).toBeUndefined()
    switches.apply(delta({ added: [row(2, 'desk', 0)] }))
    expect(switches.apply(delta({ changed: [{ sid: 2, components: {} }] }))).toEqual({})
  })
})
