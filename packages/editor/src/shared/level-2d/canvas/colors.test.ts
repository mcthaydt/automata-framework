import { describe, expect, it } from 'vitest'
import { createColorResolver, NEUTRAL } from './colors'

// Colours as the project holds them (`#rrggbb` or a kit token name) turned into numbers for Pixi (ED2D.4c3b).

const vars: Record<string, string> = { '--color-layer-entities': ' #e07a6a', '--color-state-ok': '#6fb' }
const resolve = createColorResolver((name) => vars[name] ?? '')

describe('createColorResolver', () => {
  it('reads #rrggbb and #rgb', () => {
    expect(resolve('#1b1b2f')).toBe(0x1b1b2f)
    expect(resolve('#ABC')).toBe(0xaabbcc)
  })

  it('reads a token name from its CSS custom property', () => {
    expect(resolve('layer/entities')).toBe(0xe07a6a)
    expect(resolve('state/ok')).toBe(0x66ffbb)
  })

  it('gives the neutral grey for an unknown token, a value it cannot read, or none', () => {
    expect(NEUTRAL).toBe(0x8e8c85)
    expect(resolve('layer/unknown')).toBe(NEUTRAL)
    expect(resolve('#12345')).toBe(NEUTRAL)
    expect(resolve('red')).toBe(NEUTRAL)
    expect(resolve(undefined)).toBe(NEUTRAL)
  })
})
