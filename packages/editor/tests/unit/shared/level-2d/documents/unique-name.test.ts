import { describe, expect, it } from 'vitest'
import { splitName, uniqueName } from '#src/shared/level-2d/documents/unique-name.ts'

describe('splitName', () => {
  it('keeps every part of a double extension together', () => {
    expect(splitName('levels/a.af2d.json')).toEqual({ stem: 'levels/a', extension: '.af2d.json' })
  })

  it('gives a name with no dot no extension, and a leading dot is part of the stem', () => {
    expect(splitName('notes')).toEqual({ stem: 'notes', extension: '' })
    expect(splitName('dir.d/.hidden')).toEqual({ stem: 'dir.d/.hidden', extension: '' })
  })
})

describe('uniqueName', () => {
  it('returns the path itself when nothing has it', () => {
    expect(uniqueName('a.af2d.json', new Set())).toBe('a.af2d.json')
  })

  it('numbers from 2 past the names taken', () => {
    const taken = new Set(['a.af2d.json', 'a 2.af2d.json'])
    expect(uniqueName('a.af2d.json', taken)).toBe('a 3.af2d.json')
  })

  it('names a copy, then numbers the copies', () => {
    expect(uniqueName('a.af2d.json', new Set(), ' copy')).toBe('a copy.af2d.json')
    expect(uniqueName('a.af2d.json', new Set(['a copy.af2d.json']), ' copy')).toBe('a copy 2.af2d.json')
  })
})
