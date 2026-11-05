/**
 * The landscape gate: a phone held sideways plays fullscreen, or is told how.
 */

import { describe, expect, it } from 'vitest'
import { type GateInputs, landscapeGate } from '#src/browser/landscape-gate.ts'

const phone: GateInputs = {
  formFactor: 'phone-landscape',
  coarse: true,
  support: 'element',
  fullscreen: false,
  installed: false,
}

describe('landscapeGate', () => {
  it('asks a sideways phone to go fullscreen', () => {
    expect(landscapeGate(phone)).toBe('fullscreen')
  })

  it('opens once fullscreen', () => {
    expect(landscapeGate({ ...phone, fullscreen: true })).toBe('none')
  })

  it('sends a sideways iPhone in Safari upright or to the Home Screen', () => {
    expect(landscapeGate({ ...phone, support: 'ios-home-screen' })).toBe('rotate-or-install')
  })

  it('leaves an installed app alone', () => {
    expect(landscapeGate({ ...phone, installed: true })).toBe('none')
    expect(landscapeGate({ ...phone, support: 'none' })).toBe('none')
  })

  it('leaves a short desktop window alone', () => {
    expect(landscapeGate({ ...phone, coarse: false })).toBe('none')
  })

  it('leaves every other form factor alone', () => {
    for (const other of ['phone-portrait', 'tablet-portrait', 'desktop'] as const) {
      expect(landscapeGate({ ...phone, formFactor: other })).toBe('none')
    }
  })
})
