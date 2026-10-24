import { describe, expect, it } from 'vitest'
import { entitySelection, sectorSelection, wallSelection } from '../checks/check'
import { parseSelection } from './selection-ref'

describe('parseSelection', () => {
  it('reads a sector, a wall and an entity back into what they name', () => {
    expect(parseSelection('sector:hall')).toEqual({ kind: 'sector', sector: 'hall' })
    expect(parseSelection('wall:hall/4')).toEqual({ kind: 'wall', sector: 'hall', corner: 4 })
    expect(parseSelection('wall:hall/0')).toEqual({ kind: 'wall', sector: 'hall', corner: 0 })
    expect(parseSelection('entity:crate/crate1')).toEqual({
      kind: 'entity',
      definition: 'crate',
      id: 'crate1',
    })
  })

  it('is the inverse of the three writers the checks use', () => {
    expect(parseSelection(sectorSelection('dock-2'))).toEqual({ kind: 'sector', sector: 'dock-2' })
    expect(parseSelection(wallSelection('dock-2', 12))).toEqual({
      kind: 'wall',
      sector: 'dock-2',
      corner: 12,
    })
    expect(parseSelection(entitySelection('hotspot', 'monitor'))).toEqual({
      kind: 'entity',
      definition: 'hotspot',
      id: 'monitor',
    })
  })

  it.each([
    ['a wall with no corner', 'wall:hall'],
    ['a wall whose corner is not a number', 'wall:hall/x'],
    ['a negative corner', 'wall:hall/-1'],
    ['a fractional corner', 'wall:hall/1.5'],
    ['a corner with a leading zero', 'wall:hall/01'],
    ['a corner with an exponent', 'wall:hall/1e2'],
    ['an entity with no id', 'entity:crate'],
    ['an entity with an empty id', 'entity:crate/'],
    ['an entity with an empty definition', 'entity:/crate1'],
    ['an empty sector', 'sector:'],
    ['a sector with a slash', 'sector:hall/1'],
    ['a wall with an empty sector', 'wall:/1'],
    ['a kind it does not know', 'room:hall'],
    ['no kind at all', 'hall'],
    ['an empty string', ''],
    ['a wall with a third part', 'wall:hall/1/2'],
    ['an entity with a third part', 'entity:crate/crate1/x'],
    ['a sector with a colon in its id', 'sector:a:b'],
  ])('answers nothing for %s', (_what, text) => {
    expect(parseSelection(text)).toBeUndefined()
  })
})
