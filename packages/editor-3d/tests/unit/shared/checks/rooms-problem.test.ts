// The `rooms` check's one problem: the engine's sentence for a level that does not resolve, at the sector it names.
import { describe, expect, it } from 'vitest'
import { roomsProblem } from '#src/shared/checks/rooms-problem.ts'

describe('roomsProblem', () => {
  it('says the engine’s sentence and locates the sector it is about', () => {
    expect(roomsProblem(new Error('hall: unknown portal target counter'))).toEqual({
      message: 'hall: unknown portal target counter',
      locator: { selection: 'sector:hall', at: undefined },
    })
  })

  it('takes the whole name before the sentence, colons and all, and gives a name that cannot be a selection no place', () => {
    expect(roomsProblem(new Error('a/b: unknown portal target c')).locator).toBeUndefined()
    expect(roomsProblem(new Error('a: b: unknown portal target c')).locator).toBeUndefined()
  })

  it('says any other error as it is, with no place', () => {
    expect(roomsProblem(new Error('something else'))).toEqual({
      message: 'something else',
      locator: undefined,
    })
    expect(roomsProblem('not an error')).toEqual({ message: 'not an error', locator: undefined })
  })

  it('does not find a sector in a sentence that only mentions a portal target later on', () => {
    expect(roomsProblem(new Error('see: unknown portal targets')).locator).toBeUndefined()
    expect(roomsProblem(new Error('x unknown portal target y')).locator).toBeUndefined()
  })
})
