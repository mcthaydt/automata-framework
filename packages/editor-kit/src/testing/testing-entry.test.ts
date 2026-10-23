import { describe, expect, it } from 'vitest'
import { shellModeOf } from '../shell/shell-mode'
import { stubGeometry } from './index'

// `@mcthaydt/automata-editor-kit/testing` is what the editors' component tests build their geometry from, so there is
// one stand-in for the geometry owner and not a copy in every editor.

describe('the testing entry', () => {
  it('gives a geometry measured the way the owner measures, which a test can resize', () => {
    const geometry = stubGeometry(1194, 834)
    expect(geometry.current.layout).toEqual({ width: 1194, height: 834 })
    expect(shellModeOf(geometry.current.formFactor)).toBe('wide')
    geometry.resize(834, 1194)
    expect(shellModeOf(geometry.current.formFactor)).toBe('medium')
    geometry.resize(390, 844)
    expect(shellModeOf(geometry.current.formFactor)).toBe('compact')
  })
})
