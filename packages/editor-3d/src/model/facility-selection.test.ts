// The ids the World view selects by (ED3D.9a): `wing:bay`, `join:exit`, `lock:p0.cabinet`, `phase:P2`.
import { describe, expect, it } from 'vitest'
import { facilitySelection, SelectionIdError } from '../checks/check'
import { parseFacilitySelection } from './facility-selection'

describe('facilitySelection', () => {
  it('writes kind:id for each of the four kinds', () => {
    expect(facilitySelection('wing', 'bay')).toBe('wing:bay')
    expect(facilitySelection('join', 'exit')).toBe('join:exit')
    expect(facilitySelection('lock', 'p0.cabinet')).toBe('lock:p0.cabinet')
    expect(facilitySelection('phase', 'P2')).toBe('phase:P2')
  })

  it('refuses an id that would not parse back', () => {
    for (const id of ['', 'a:b', 'a/b'])
      expect(() => facilitySelection('wing', id), JSON.stringify(id)).toThrow(SelectionIdError)
  })
})

describe('parseFacilitySelection', () => {
  it('reads what facilitySelection writes', () => {
    for (const kind of ['wing', 'join', 'lock', 'phase'] as const)
      expect(parseFacilitySelection(facilitySelection(kind, 'x.y-1'))).toEqual({ kind, id: 'x.y-1' })
  })

  it('reads nothing else', () => {
    for (const id of [
      'bay',
      'wing:',
      ':bay',
      'wing:a:b',
      'wing:a/b',
      'sector:hall',
      'wall:hall/1',
      'entity:crate/crate1',
      'level:clinic',
      '',
    ])
      expect(parseFacilitySelection(id), JSON.stringify(id)).toBeUndefined()
  })
})
