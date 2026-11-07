// The feel extension (M6.1a): the content kind only, and no sim plugin (presentation never changes the sim, law 1).
import { expect, it } from 'vitest'
import { feelExtension } from './index'

it('registers the feel content kind and no sim plugin', () => {
  expect(feelExtension.name).toBe('feel')
  expect(feelExtension.content?.map((k) => k.kind)).toEqual(['feel'])
  expect(feelExtension.sim ?? []).toEqual([])
})
