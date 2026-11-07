// The sectors extension: the plugin for the sim and the `sector-map` content kind, registered together.
import { expect, it } from 'vitest'
import { sectorMapContent, sectorsExtension, sectorsPlugin } from '#src/entries/index.ts'

it('registers the sectors plugin and the sector-map content kind', () => {
  expect(sectorsExtension.name).toBe('sectors')
  expect(sectorsExtension.sim).toEqual([sectorsPlugin])
  expect(sectorsExtension.content).toEqual([sectorMapContent])
})
