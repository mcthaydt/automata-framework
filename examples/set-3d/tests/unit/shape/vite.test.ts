import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { setContentRootOf, setLevelAliasesOf } from '#src/entries/vite.ts'

const here = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..')

// The page and the tests compile the set's content; an editor journey names a copy it saved into, and the page then
// plays the copy while the committed files stay untouched.
describe('where the set content is read from', () => {
  it("is the set's own folder, whichever package's Vite config asks", () => {
    expect(setContentRootOf({})).toBe(here)
  })

  it("is the editor journey's copy when it names one", () => {
    expect(setContentRootOf({ AF_E2E_CONTENT_ROOT: '/tmp/copy' })).toBe('/tmp/copy')
  })

  it('leaves the level file where it is when no copy is named', () => {
    expect(setLevelAliasesOf({})).toEqual([])
  })

  it("sends the level file the code imports to the copy's, so the page draws what the editor saved", () => {
    const [alias] = setLevelAliasesOf({ AF_E2E_CONTENT_ROOT: '/tmp/copy' })
    const find = alias?.find as RegExp
    expect(find.test('../../content/levels/station.af-sector.json')).toBe(true)
    expect('../../content/levels/station.af-sector.json'.replace(find, alias?.replacement ?? '')).toBe(
      '/tmp/copy/content/levels/station.af-sector.json',
    )
  })
})
