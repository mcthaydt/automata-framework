import { expect, it } from 'vitest'
import { feelBoard, shippedPanels } from './index'

it('ships the sim, bus and feel panels in that order', () => {
  expect(shippedPanels.map((p) => p.id)).toEqual(['sim', 'bus', 'feel'])
  expect(typeof feelBoard).toBe('function')
})
