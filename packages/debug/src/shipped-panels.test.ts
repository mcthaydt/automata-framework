import { expect, it } from 'vitest'
import { feelBoard, shippedPanels } from './index'

it('ships the sim, bus, feel and audio panels in that order', () => {
  expect(shippedPanels.map((p) => p.id)).toEqual(['sim', 'bus', 'feel', 'audio'])
  expect(typeof feelBoard).toBe('function')
})
