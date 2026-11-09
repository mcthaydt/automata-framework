// The id a new sector is given when nobody chose one (ED3D.6a, ED3D.6f): `sector-N`, the lowest N that the level has not
// taken, so a sector deleted from the middle gives its number to the next one drawn.
import { describe, expect, it } from 'vitest'
import { lowestFreeId } from '#src/features/levels-3d/plan/sector-id.ts'

describe('lowestFreeId', () => {
  it('is sector-1 in a level with no sector-N', () => {
    expect(lowestFreeId([])).toBe('sector-1')
    expect(lowestFreeId(['hall', 'dock'])).toBe('sector-1')
  })

  it('is the lowest number that is free', () => {
    expect(lowestFreeId(['sector-1', 'sector-2'])).toBe('sector-3')
    expect(lowestFreeId(['sector-1', 'sector-3'])).toBe('sector-2')
    expect(lowestFreeId(['sector-2', 'hall'])).toBe('sector-1')
  })

  it('takes another prefix: a thing of a definition is named <def>N', () => {
    expect(lowestFreeId(['spawn', 'crate1'], 'crate')).toBe('crate2')
    expect(lowestFreeId([], 'lamp')).toBe('lamp1')
  })
})
