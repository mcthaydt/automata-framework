// What a tap on a hotspot sends in one tick: the walk to it and the use of it.
import { describe, expect, it } from 'vitest'
import { type Hotspot, useCommands } from '#src/entries/index.ts'

const jar: Hotspot = { id: 'jar', x: 3, z: 1, reach: 1.2, name: 'name.jar' }

describe('useCommands', () => {
  it('walks to the hotspot and uses it', () => {
    expect(useCommands(7, jar)).toEqual([{ entity: 7, to: { x: 3, z: 1 } }, { at: 'jar' }])
  })

  it('carries the held item into the use', () => {
    expect(useCommands(7, jar, 'spoon')[1]).toEqual({ at: 'jar', held: 'spoon' })
  })
})
