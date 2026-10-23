import { describe, expect, test } from 'vitest'
import * as kit from './index'

describe('editor-kit entry', () => {
  test('exports the shell, its rules and the token renderer', () => {
    expect(kit.EditorShell).toBeTypeOf('function')
    expect(kit.shellModeOf).toBeTypeOf('function')
    expect(kit.reconcileOpen).toBeTypeOf('function')
    expect(kit.tokensToCss).toBeTypeOf('function')
  })
})
