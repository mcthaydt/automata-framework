// The systems extension: the plugin and the `systems` content kind, built from the game's options, so
// the hooks content may name are the hooks the plugin runs.

import { sectorsPlaces } from '@automata/sectors/sim'
import { expect, it } from 'vitest'
import { systemsExtension } from '#src/entries/index.ts'
import { alarmToy } from '#src/testing/toy.ts'

it('registers the systems plugin and the systems content kind, after sectors, nav and puzzle', () => {
  const { extension, plugin } = systemsExtension()
  expect(extension.name).toBe('systems')
  expect(extension.requires).toEqual(['sectors', 'nav', 'puzzle'])
  expect(extension.sim).toEqual([plugin])
  expect(extension.content?.map((kind) => kind.kind)).toEqual(['systems'])
})

it('lets content name exactly the hooks the plugin was given', () => {
  const accepts = (hooks: Record<string, () => void>) =>
    systemsExtension({ hooks }).extension.content?.[0]?.schema.safeParse(alarmToy()).success
  expect(accepts({ woke: () => {} })).toBe(true)
  expect(accepts({})).toBe(false)
})

it('follows the game’s places: a 2D game requires its provider, not sectors', () => {
  const places = { ...sectorsPlaces, provider: 'level-2d' }
  const { extension, plugin } = systemsExtension({ places })
  expect(extension.requires).toEqual(['level-2d', 'nav', 'puzzle'])
  expect(plugin.dependsOn).toEqual(['level-2d', 'nav', 'puzzle'])
})
