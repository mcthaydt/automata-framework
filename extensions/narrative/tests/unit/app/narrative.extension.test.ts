// The narrative extension: the plugin and the six content kinds (canon, lines, dialogue, storylets, beats, help).

import { sectorsPlaces } from '@automata/sectors/sim'
import { expect, it } from 'vitest'
import { narrativeExtension } from '#src/entries/index.ts'

it('registers the narrative plugin and its six content kinds, after sectors and puzzle', () => {
  const { extension, plugin } = narrativeExtension()
  expect(extension.name).toBe('narrative')
  expect(extension.requires).toEqual(['sectors', 'puzzle'])
  expect(extension.sim).toEqual([plugin])
  expect(extension.content?.map((k) => k.kind)).toEqual([
    'canon',
    'lines',
    'dialogue',
    'storylets',
    'beats',
    'help',
  ])
})

it('follows the game’s places: a 2D game requires its provider, not sectors', () => {
  const places = { ...sectorsPlaces, provider: 'level-2d' }
  const { extension, plugin } = narrativeExtension({ places })
  expect(extension.requires).toEqual(['level-2d', 'puzzle'])
  expect(plugin.dependsOn).toEqual(['level-2d', 'puzzle'])
})
