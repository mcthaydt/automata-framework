// The nav extension: the plugin for the sim and the `nav-graph` content kind, registered together.
import { expect, it } from 'vitest'
import { navExtension, navGraphContent, navPlugin } from '#src/entries/index.ts'

it('registers the nav plugin and the nav-graph content kind', () => {
  expect(navExtension.name).toBe('nav')
  expect(navExtension.requires).toEqual(['sectors'])
  expect(navExtension.sim?.map((plugin) => plugin.name)).toEqual([navPlugin.name])
  expect(navExtension.content).toEqual([navGraphContent])
})
