import { classifyFormFactor, classifyHeightTier } from '@mcthaydt/automata-ui'
import { describe, expect, test } from 'vitest'
import {
  DETENTS,
  defaultDockOpen,
  detentHeight,
  dockPlacementOf,
  nextDetent,
  type ShellMode,
  shellModeOf,
} from './shell-mode'

/** What the shell does at a window size, decided the way the geometry owner decides it. */
function shellAt(width: number, height: number): { mode: ShellMode; dock: string; dockOpen: boolean } {
  const mode = shellModeOf(classifyFormFactor(width, height))
  const tier = classifyHeightTier(height)
  return { mode, dock: dockPlacementOf(mode, tier), dockOpen: defaultDockOpen(mode, tier) }
}

describe('shellModeOf', () => {
  test('desktop is wide, tablet portrait is medium, both phones are compact', () => {
    expect(shellModeOf('desktop')).toBe('wide')
    expect(shellModeOf('tablet-portrait')).toBe('medium')
    expect(shellModeOf('phone-portrait')).toBe('compact')
    expect(shellModeOf('phone-landscape')).toBe('compact')
  })
})

describe('the shell at the sizes in the kit spec §7', () => {
  test.each([
    ['iPad Pro 11 landscape', 1194, 834, { mode: 'wide', dock: 'inline', dockOpen: true }],
    ['iPad Pro 13 landscape', 1366, 1024, { mode: 'wide', dock: 'inline', dockOpen: true }],
    [
      'iPad mini landscape (a 744 px tall window is not short)',
      1133,
      744,
      { mode: 'wide', dock: 'inline', dockOpen: true },
    ],
    [
      'a 900 × 600 window is short: the dock waits behind its handle',
      900,
      600,
      { mode: 'wide', dock: 'sheet', dockOpen: false },
    ],
    ['iPad Pro 11 portrait', 834, 1194, { mode: 'medium', dock: 'sheet', dockOpen: true }],
    ['iPad mini portrait', 744, 1133, { mode: 'medium', dock: 'sheet', dockOpen: true }],
    ['phone portrait', 390, 844, { mode: 'compact', dock: 'sheet', dockOpen: false }],
    ['phone landscape', 844, 390, { mode: 'compact', dock: 'sheet', dockOpen: false }],
  ] as const)('%s (%d × %d)', (_name, width, height, expected) => {
    expect(shellAt(width, height)).toEqual(expected)
  })
})

describe('dockPlacementOf', () => {
  test('is inline only when wide and the height tier is neither short nor compact', () => {
    expect(dockPlacementOf('wide', undefined)).toBe('inline')
    expect(dockPlacementOf('wide', 'short')).toBe('sheet')
    expect(dockPlacementOf('wide', 'compact')).toBe('sheet')
    expect(dockPlacementOf('medium', undefined)).toBe('sheet')
    expect(dockPlacementOf('compact', undefined)).toBe('sheet')
  })
})

describe('detents', () => {
  test('are peek, half and full, in that order', () => {
    expect(DETENTS).toEqual(['peek', 'half', 'full'])
  })

  test('nextDetent steps peek → half → full and wraps to peek', () => {
    expect(nextDetent('peek')).toBe('half')
    expect(nextDetent('half')).toBe('full')
    expect(nextDetent('full')).toBe('peek')
  })

  test('peek is the region strip: 96 for a panel or inspector, 148 plus a 20 px handle for the dock', () => {
    expect(detentHeight('panel', 'peek', 1000)).toBe(96)
    expect(detentHeight('inspector', 'peek', 1000)).toBe(96)
    expect(detentHeight('dock', 'peek', 1000)).toBe(168)
  })

  test('half is 50% and full is 92% of the available height, in whole px', () => {
    expect(detentHeight('panel', 'half', 1000)).toBe(500)
    expect(detentHeight('panel', 'full', 1000)).toBe(920)
    expect(detentHeight('dock', 'full', 751)).toBe(691)
    expect(detentHeight('dock', 'half', 751)).toBe(376)
  })

  test('a sheet is never taller than the space there is', () => {
    expect(detentHeight('dock', 'peek', 120)).toBe(120)
    expect(detentHeight('panel', 'full', 0)).toBe(0)
  })
})
