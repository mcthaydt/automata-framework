import { expect, test } from 'vitest'
import * as ui from './index'

test('the package exports the geometry owner', () => {
  expect(typeof ui.measureGeometry).toBe('function')
})
