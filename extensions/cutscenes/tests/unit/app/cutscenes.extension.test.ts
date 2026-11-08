// The cutscenes extension: the plugin and its content kind, after sectors, nav and narrative.
import { expect, it } from 'vitest'
import { cutscenesExtension } from '#src/entries/index.ts'

it('registers the cutscenes plugin and the cutscene content kind, after sectors, nav and narrative', () => {
  const { extension, plugin } = cutscenesExtension()
  expect(extension.name).toBe('cutscenes')
  expect(extension.requires).toEqual(['sectors', 'nav', 'narrative'])
  expect(extension.sim).toEqual([plugin])
  expect(extension.content?.map((k) => k.kind)).toEqual(['cutscene'])
})

it('follows the game’s places: a 2D game requires its provider, not sectors', () => {
  expect(cutscenesExtension({ places: { provider: 'level-2d' } }).extension.requires).toEqual([
    'level-2d',
    'nav',
    'narrative',
  ])
})
