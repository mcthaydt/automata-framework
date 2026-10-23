// The shape every check answers in: what Last Light's `result` helper builds (an id, ok, a detail sentence), plus
// the severity and, for each problem, where it is, as a selection id the editor can frame.
import { describe, expect, it } from 'vitest'
import {
  checkResult,
  entitySelection,
  formatPoint,
  locators,
  place,
  sectorSelection,
  wallSelection,
} from './check'

describe('checkResult', () => {
  it('is ok with the text `ok` and an error severity when nothing is wrong', () => {
    expect(checkResult('ids', [])).toEqual({
      id: 'ids',
      ok: true,
      severity: 'error',
      detail: 'ok',
      problems: [],
    })
  })

  it('is not ok when a problem is listed, and says them all in order, joined by "; "', () => {
    const problems = [
      { message: 'room hall twice' },
      { message: 'box desk: role door goes with kind door', locator: { selection: 'entity:box/desk' } },
    ]
    const result = checkResult('ids', problems)
    expect(result.ok).toBe(false)
    expect(result.detail).toBe('room hall twice; box desk: role door goes with kind door')
    expect(result.problems).toEqual(problems)
  })

  it('does not merge problems that read the same: Last Light only does that in `ids`', () => {
    const twice = [{ message: 'same' }, { message: 'same' }]
    expect(checkResult('openings', twice).detail).toBe('same; same')
  })

  it('takes the text to show when ok, as `nav` does, and a severity', () => {
    const result = checkResult('nav', [], {
      ok: '4 nodes, 3 edges clear; 2 hotspots reachable',
      severity: 'warning',
    })
    expect(result.detail).toBe('4 nodes, 3 edges clear; 2 hotspots reachable')
    expect(result.severity).toBe('warning')
  })

  it('keeps the ok text out of a failing result', () => {
    expect(checkResult('nav', [{ message: 'node a is outside every room' }], { ok: 'fine' }).detail).toBe(
      'node a is outside every room',
    )
  })

  it('does not share the problems array with the caller', () => {
    const problems = [{ message: 'x' }]
    const result = checkResult('rooms', problems)
    problems.push({ message: 'y' })
    expect(result.problems).toHaveLength(1)
  })
})

describe('selection ids', () => {
  it("writes the spec's three kinds: sector:<id>, wall:<sector>/<corner> and entity:<definition>/<id>", () => {
    expect(sectorSelection('hall')).toBe('sector:hall')
    expect(wallSelection('hall', 4)).toBe('wall:hall/4')
    expect(entitySelection('box', 'desk')).toBe('entity:box/desk')
  })

  it('refuses an id that would not parse back: one with a "/" or a ":" or nothing at all', () => {
    expect(() => sectorSelection('a/b')).toThrow(/sector id/)
    expect(() => sectorSelection('a:b')).toThrow(/sector id/)
    expect(() => sectorSelection('')).toThrow(/sector id/)
    expect(() => wallSelection('a/b', 0)).toThrow(/sector id/)
    expect(() => entitySelection('box', 'a/b')).toThrow(/entity id/)
    expect(() => entitySelection('bo:x', 'a')).toThrow(/definition/)
  })

  it('refuses a corner index that is not a whole number from 0', () => {
    expect(() => wallSelection('hall', -1)).toThrow(/corner/)
    expect(() => wallSelection('hall', 1.5)).toThrow(/corner/)
    expect(() => wallSelection('hall', Number.NaN)).toThrow(/corner/)
  })
})

describe('formatPoint', () => {
  it('writes a point as Last Light writes one in a sentence: x, z, each to at most 3 decimals', () => {
    expect(formatPoint({ x: -1.475, z: 0 })).toBe('-1.475, 0')
    expect(formatPoint({ x: 1 / 3, z: 2 })).toBe('0.333, 2')
    expect(formatPoint({ x: 1.0004, z: -0.0004 })).toBe('1, 0')
  })
})

describe('place', () => {
  it('is the locator a selection builder gives, with the point', () => {
    expect(place(() => sectorSelection('hall'), { x: 1, z: 2 })).toEqual({
      selection: 'sector:hall',
      at: { x: 1, z: 2 },
    })
    expect(place(() => sectorSelection('hall'))).toEqual({ selection: 'sector:hall', at: undefined })
  })

  it('is nothing for an id that cannot be a selection id, so a check never fails on a strange name', () => {
    expect(place(() => entitySelection('box', 'a/b'))).toBeUndefined()
    expect(place(() => wallSelection('a:b', 0), { x: 0, z: 0 })).toBeUndefined()
  })

  it('does not hide another kind of error', () => {
    expect(() =>
      place(() => {
        throw new TypeError('not mine')
      }),
    ).toThrow(TypeError)
  })
})

describe('locators', () => {
  it('keeps the places that exist, in order', () => {
    const a = { selection: 'sector:a' }
    const b = { selection: 'sector:b' }
    expect(locators(a, undefined, b)).toEqual([a, b])
    expect(locators(undefined)).toEqual([])
  })
})
