// The narrative extension (M6 spec §4.7): the plugin and the four content kinds (canon, lines, dialogue, storylets).
import { expect, it } from 'vitest'
import { narrativeExtension } from './index'

it('registers the narrative plugin and its four content kinds, after sectors and puzzle', () => {
  const { extension, plugin } = narrativeExtension()
  expect(extension.name).toBe('narrative')
  expect(extension.requires).toEqual(['sectors', 'puzzle'])
  expect(extension.sim).toEqual([plugin])
  expect(extension.content?.map((k) => k.kind)).toEqual(['canon', 'lines', 'dialogue', 'storylets'])
})
