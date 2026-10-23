import { describe, expect, test } from 'vitest'
import * as kit from './index'

describe('editor-kit entry', () => {
  test('exports the shell, its rules and the token renderer', () => {
    expect(kit.EditorShell).toBeTypeOf('function')
    expect(kit.shellModeOf).toBeTypeOf('function')
    expect(kit.reconcileOpen).toBeTypeOf('function')
    expect(kit.tokensToCss).toBeTypeOf('function')
  })

  test('exports history, selection, commands and the keymap', () => {
    expect(kit.createHistory).toBeTypeOf('function')
    expect(kit.HistoryError).toBeTypeOf('function')
    expect(kit.createSelection).toBeTypeOf('function')
    expect(kit.defineCommand).toBeTypeOf('function')
    expect(kit.createCommandRegistry).toBeTypeOf('function')
    expect(kit.createKeymap).toBeTypeOf('function')
    expect(kit.parseShortcut).toBeTypeOf('function')
  })
})
