import { describe, expect, it } from 'vitest'
import { INPUT_MATRIX } from '#src/e2e/input-matrix.ts'

// M4 spec §9.1: the input × form-factor matrix as data, so the matrix spec and a game's own journeys share it.
describe('INPUT_MATRIX', () => {
  it('is exactly the spec’s cells: form factor × device × engine', () => {
    const cells = INPUT_MATRIX.map((cell) => `${cell.formFactor} ${cell.device} ${cell.engine}`).sort()
    expect(cells).toEqual(
      [
        'phone-portrait gamepad chromium',
        'phone-portrait touch chromium',
        'phone-portrait touch webkit',
        'phone-landscape gamepad chromium',
        'phone-landscape touch chromium',
        'phone-landscape touch webkit',
        'compact gamepad chromium',
        'compact touch chromium',
        'tablet-portrait keyboard chromium',
        'tablet-portrait gamepad chromium',
        'tablet-portrait touch chromium',
        'tablet-portrait touch webkit',
        'desktop keyboard chromium',
        'desktop keyboard webkit',
        'desktop keyboard firefox',
        'desktop gamepad chromium',
        'desktop gamepad webkit',
      ].sort(),
    )
  })

  it('runs every desktop cell under the fake host and standalone, the rest under the fake host: 22 journeys', () => {
    for (const cell of INPUT_MATRIX)
      expect(cell.hosts).toEqual(
        cell.formFactor === 'desktop' ? ['fake-ruken', 'standalone'] : ['fake-ruken'],
      )
    expect(INPUT_MATRIX.reduce((journeys, cell) => journeys + cell.hosts.length, 0)).toBe(22)
  })

  it('gives each form factor its viewport', () => {
    const viewports = Object.fromEntries(INPUT_MATRIX.map((cell) => [cell.formFactor, cell.viewport]))
    expect(viewports).toEqual({
      'phone-portrait': { width: 390, height: 844 },
      'phone-landscape': { width: 844, height: 390 },
      compact: { width: 780, height: 270 },
      'tablet-portrait': { width: 820, height: 1180 },
      desktop: { width: 1280, height: 720 },
    })
  })

  it('names each cell uniquely, and marks local only the desktop and phone-portrait Chromium cells (M4-D11)', () => {
    expect(new Set(INPUT_MATRIX.map((cell) => cell.id)).size).toBe(INPUT_MATRIX.length)
    expect(INPUT_MATRIX.find((cell) => cell.id === 'phone-portrait-touch-webkit')).toBeDefined()
    for (const cell of INPUT_MATRIX)
      expect(cell.local).toBe(
        cell.engine === 'chromium' && (cell.formFactor === 'desktop' || cell.formFactor === 'phone-portrait'),
      )
  })
})
