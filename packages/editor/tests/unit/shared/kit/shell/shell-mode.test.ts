import { classifyHeightTier, measureGeometry } from '@automataframework/automata'
import { describe, expect, test } from 'vitest'
import {
  DETENTS,
  defaultDockOpen,
  detentLength,
  dockPlacementOf,
  nextDetent,
  type ShellMode,
  shellModeAt,
  shellModeOf,
} from '#src/shared/kit/shell/shell-mode.ts'

/** What the shell does at a window size, decided the way the geometry owner decides it. */
function shellAt(width: number, height: number): { mode: ShellMode; dock: string; dockOpen: boolean } {
  const mode = shellModeOf({ width, height })
  const tier = classifyHeightTier(height)
  return { mode, dock: dockPlacementOf(mode, tier), dockOpen: defaultDockOpen(mode, tier) }
}

describe('shellModeOf', () => {
  // The approved mockup's three layouts, chosen by the room the editor has and not by the device (AUDIT.md E1).
  test('wide is 1180 px and up, compact is 760 px and down or 520 px high and less, medium is between', () => {
    expect(shellModeOf({ width: 1180, height: 521 })).toBe('wide')
    expect(shellModeOf({ width: 1179, height: 800 })).toBe('medium')
    expect(shellModeOf({ width: 761, height: 800 })).toBe('medium')
    expect(shellModeOf({ width: 760, height: 1100 })).toBe('compact')
    expect(shellModeOf({ width: 1400, height: 520 })).toBe('compact')
  })

  test('shellModeAt reads the size before a keyboard shrank it, so typing never changes the layout', () => {
    const typing = measureGeometry({
      layout: { width: 1194, height: 400 },
      restingLayout: { width: 1194, height: 834 },
      envSafeArea: { top: 0, right: 0, bottom: 0, left: 0 },
    })
    expect(shellModeAt(typing)).toBe('wide')
  })
})

describe('the shell at the sizes in the kit spec §7', () => {
  test.each([
    ['iPad Pro 11 landscape', 1194, 834, { mode: 'wide', dock: 'inline', dockOpen: true }],
    ['iPad Pro 13 landscape', 1366, 1024, { mode: 'wide', dock: 'inline', dockOpen: true }],
    [
      'iPad mini landscape is under 1180 px wide: the layers beside the level, the dock a sheet',
      1133,
      744,
      { mode: 'medium', dock: 'sheet', dockOpen: true },
    ],
    ['a 900 × 600 window is medium', 900, 600, { mode: 'medium', dock: 'sheet', dockOpen: true }],
    [
      'a 1280 × 560 window is wide but short: the dock waits behind its handle',
      1280,
      560,
      { mode: 'wide', dock: 'sheet', dockOpen: false },
    ],
    ['iPad Pro 11 portrait', 834, 1194, { mode: 'medium', dock: 'sheet', dockOpen: true }],
    [
      'iPad mini portrait is 760 px and down: compact',
      744,
      1133,
      { mode: 'compact', dock: 'sheet', dockOpen: false },
    ],
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
