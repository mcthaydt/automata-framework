import { describe, expect, it } from 'vitest'
import { compileContentResult } from '#src/shared/compile/compile-content.ts'
import { copyFixture, fixtureOptions, SONG } from '#src/testing/fixture-game.ts'

// `compileContentResult` is `compileContent` for a caller that does not use Effect (a package's tests, a script): the
// answer is a plain value, not an Effect to run, and a refusal is a value too.
describe('compileContentResult', () => {
  it('answers with the compiled content', async () => {
    const result = await compileContentResult(fixtureOptions(copyFixture('valid')))
    if (!result.ok) throw new Error(`expected the compile to pass: ${result.error.message}`)
    expect(Object.keys(result.content.data)).toContain('song')
  })

  it('answers with the compile error, not a rejection, when the options are refused', async () => {
    // A kind registered twice is refused before anything is read.
    const result = await compileContentResult({ root: '/nowhere/at/all', schemas: [SONG, SONG] })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error._tag).toBe('InvalidContentConfig')
    expect(result.error.message).toContain('kind "song" is registered twice')
  })
})
