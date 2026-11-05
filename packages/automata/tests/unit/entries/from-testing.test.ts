import { expect, test } from 'vitest'
import * as testing from '#src/entries/from-testing.ts'

test('the package exports the viewport fixtures', () => {
  expect(typeof testing.fakeViewportWindow).toBe('function')
})
