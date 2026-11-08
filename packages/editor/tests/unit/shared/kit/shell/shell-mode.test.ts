import { classifyFormFactor, classifyHeightTier } from '@mcthaydt/automata'
import { describe, expect, test } from 'vitest'
import {
  DETENTS,
  defaultDockOpen,
  detentLength,
  dockPlacementOf,
  nextDetent,
  type ShellMode,
  shellModeOf,
} from '#src/shared/kit/shell/shell-mode.ts'

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

  test('peek is the region strip, handle included: 96 for a panel or inspector, 148 plus the 44 px handle for the dock', () => {
    expect(detentLength('panel', 'peek')).toBe('min(96px, 100%)')
    expect(detentLength('inspector', 'peek')).toBe('min(96px, 100%)')
    expect(detentLength('dock', 'peek')).toBe('min(192px, 100%)')
  })

  test('half is 50% and full is 92% of the room the sheet has, whichever region it is', () => {
    expect(detentLength('panel', 'half')).toBe('50%')
    expect(detentLength('dock', 'half')).toBe('50%')
    expect(detentLength('panel', 'full')).toBe('92%')
    expect(detentLength('inspector', 'full')).toBe('92%')
  })
})
