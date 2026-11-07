import { expect, it } from 'vitest'
import { feelBoard, shippedPanels } from './index'

it('ships the sim, bus, feel, audio and net panels in that order', () => {
  expect(shippedPanels.map((p) => p.id)).toEqual(['sim', 'bus', 'feel', 'audio', 'net'])
  expect(typeof feelBoard).toBe('function')
})
