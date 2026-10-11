import { expect, test } from 'vitest'
import * as testing from './index'

test('the package exports the viewport fixtures', () => {
  expect(typeof testing.fakeViewportWindow).toBe('function')
})
