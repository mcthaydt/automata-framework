import { expect, test } from 'vitest'
import { COMPACT_MAX_HEIGHT, classifyHeightTier, SHORT_MAX_HEIGHT } from '#src/geometry/height-tier.ts'

test.each([
  [270, 'compact'],
  [339, 'compact'],
  [340, 'short'],
  [600, 'short'],
  [601, undefined],
  [900, undefined],
] as const)('a layout %d px tall is %s', (height, expected) => {
  expect(classifyHeightTier(height)).toBe(expected)
})

test('compact is below 340 px, short up to 600 px inclusive', () => {
  expect(COMPACT_MAX_HEIGHT).toBe(340)
  expect(SHORT_MAX_HEIGHT).toBe(600)
})
