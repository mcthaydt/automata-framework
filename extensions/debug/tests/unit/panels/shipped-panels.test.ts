import { expect, it } from 'vitest'
import { feelBoard, shippedPanels } from '#src/entries/index.ts'

it('ships the sim, bus, feel, audio and net panels in that order', () => {
  expect(shippedPanels.map((p) => p.id)).toEqual(['sim', 'bus', 'feel', 'audio', 'net'])
  expect(typeof feelBoard).toBe('function')
})
