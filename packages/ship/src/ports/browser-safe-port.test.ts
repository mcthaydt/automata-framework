import { describe, expect, it } from 'vitest'
import { browserSafePort } from './browser-safe-port.ts'

describe('browserSafePort', () => {
  it('keeps a port the browsers load', () => {
    expect(browserSafePort(4700)).toBe(4700)
    expect(browserSafePort(5900)).toBe(5900)
  })

  it('moves the examples fixtures off 6000 (X11), where CI’s fixed ports put them', () => {
    expect(browserSafePort(6000)).toBe(6001)
  })

  it('steps past a run of blocked ports (5060 and 5061 are both SIP)', () => {
    expect(browserSafePort(5060)).toBe(5062)
    expect(browserSafePort(6665)).toBe(6670)
  })
})
