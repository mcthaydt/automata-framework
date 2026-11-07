// The cutscenes extension (M6.9a): the plugin and its content kind, after sectors, nav and narrative.
import { expect, it } from 'vitest'
import { cutscenesExtension } from './index'

it('registers the cutscenes plugin and the cutscene content kind, after sectors, nav and narrative', () => {
  const { extension, plugin } = cutscenesExtension()
  expect(extension.name).toBe('cutscenes')
  expect(extension.requires).toEqual(['sectors', 'nav', 'narrative'])
  expect(extension.sim).toEqual([plugin])
  expect(extension.content?.map((k) => k.kind)).toEqual(['cutscene'])
})
