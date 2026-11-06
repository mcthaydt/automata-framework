import { describe, expect, it } from 'vitest'
import { shellModeOf } from '#src/shared/kit/shell/shell-mode.ts'
import { REST, SIZES, stubGeometry } from '#src/testing/kit/index.ts'

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

describe('the layout sizes', () => {
  it('are the eight window sizes the editors are laid out at, each in the shell mode it names', () => {
    expect(SIZES.map((size) => `${size.name} ${size.width}x${size.height}`)).toEqual([
      'ipad-pro-11-landscape 1194x834',
      'ipad-pro-13-landscape 1366x1024',
      'ipad-mini-landscape 1133x744',
      'window-900x600 900x600',
      'ipad-pro-11-portrait 834x1194',
      'ipad-mini-portrait 744x1133',
      'phone-portrait 390x844',
      'phone-landscape 844x390',
    ])
    for (const size of SIZES) {
      expect(shellModeOf(stubGeometry(size.width, size.height).current.formFactor), size.name).toBe(size.mode)
    }
    expect(REST.name).toBe('rest')
  })
})
