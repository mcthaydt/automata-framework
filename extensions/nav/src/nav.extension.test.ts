// The nav extension (M6 spec §4.4): the plugin for the sim and the `nav-graph` content kind, registered together.
import { expect, it } from 'vitest'
import { navExtension, navGraphContent, navPlugin } from './index'

it('registers the nav plugin and the nav-graph content kind', () => {
  expect(navExtension.name).toBe('nav')
  expect(navExtension.requires).toEqual(['sectors'])
  expect(navExtension.sim).toEqual([navPlugin])
  expect(navExtension.content).toEqual([navGraphContent])
})
