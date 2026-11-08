// The sectors extension: the plugin for the sim. A level is the game's `af-sector/2` file, so there is no content kind.
import { expect, it } from 'vitest'
import { sectorsExtension, sectorsPlugin } from '#src/entries/index.ts'

it('registers the sectors plugin and no content kind of its own', () => {
  expect(sectorsExtension.name).toBe('sectors')
  expect(sectorsExtension.sim).toEqual([sectorsPlugin])
  expect(sectorsExtension.content ?? []).toEqual([])
})
