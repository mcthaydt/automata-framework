import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { contentRootOf, roomAliasesOf } from '../../vite.config.ts'

const OWN = fileURLToPath(new URL('../../', import.meta.url))

// The editor journeys point the game's dev server at a copy of its content (AF_E2E_CONTENT_ROOT), so what the editor
// saved is what the page plays: the content plugin's root and the room file the code imports both follow it.
describe('the content root', () => {
  it('is the game’s own folder unless a journey names a copy', () => {
    expect(contentRootOf({})).toBe(OWN)
    expect(contentRootOf({ AF_E2E_CONTENT_ROOT: '/tmp/copy' })).toBe('/tmp/copy')
  })

  it('sends the room file to the copy’s, and changes nothing without one', () => {
    expect(roomAliasesOf({})).toEqual([])
    const [alias] = roomAliasesOf({ AF_E2E_CONTENT_ROOT: '/tmp/copy' })
    expect(alias?.replacement).toBe('/tmp/copy/content/levels/room.af-sector.json')
    expect(alias?.find.test('/x/games/base-3d/content/levels/room.af-sector.json')).toBe(true)
    expect(alias?.find.test('/x/games/base-3d/content/levels/other.json')).toBe(false)
  })
})
