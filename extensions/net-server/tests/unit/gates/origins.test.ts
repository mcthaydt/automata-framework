import { describe, expect, it } from 'vitest'
import { originPolicy, originsFromGameOrigin } from '#src/features/gates/origins.ts'

// Which pages may use the server. The list is required: an empty or missing one is a refusal, never "allow
// everything".

const RUKEN = 'https://g-abc.rukengames.com'

describe('the origin policy', () => {
  it('refuses an empty list, as a server without one refuses to start', () => {
    expect(() => originPolicy([])).toThrow(/allowedOrigins/)
  })

  it('refuses a blank entry, or one that is not an exact origin', () => {
    expect(() => originPolicy(['  '])).toThrow(/allowedOrigins/)
    expect(() => originPolicy([RUKEN, 'https://g-abc.rukengames.com/'])).toThrow(/not an origin/)
    expect(() => originPolicy(['https://example.test/play'])).toThrow(/not an origin/)
    expect(() => originPolicy(['g-abc.rukengames.com'])).toThrow(/not an origin/)
    expect(() => originPolicy(['*'])).toThrow(/not an origin/)
  })

  it('allows only a listed origin, exactly', () => {
    const policy = originPolicy(['https://staging.example.test', RUKEN])
    expect(policy.allows(RUKEN)).toBe(true)
    expect(policy.allows('https://staging.example.test')).toBe(true)
    expect(policy.allows('https://g-abc.rukengames.com.evil.test')).toBe(false)
    expect(policy.allows('http://g-abc.rukengames.com')).toBe(false)
    expect(policy.allows(undefined)).toBe(false)
    expect(policy.origins).toEqual(['https://staging.example.test', RUKEN])
  })

  it('echoes a listed origin, and sends no allow header for another', () => {
    const policy = originPolicy([RUKEN])
    expect(policy.corsHeaders(RUKEN)).toEqual({ 'access-control-allow-origin': RUKEN, vary: 'Origin' })
    expect(policy.corsHeaders('https://other.test')).toEqual({ vary: 'Origin' })
    expect(policy.corsHeaders(undefined)).toEqual({ vary: 'Origin' })
  })

  // Ruken's local stack serves a game from http://g-<publicId>.localhost:8787 (Ruken P6 §5).
  it('allows a local Ruken game origin, port and all, and nothing near it', () => {
    const policy = originPolicy(['http://g-ab12cd34.localhost:8787'])
    expect(policy.allows('http://g-ab12cd34.localhost:8787')).toBe(true)
    expect(policy.allows('http://g-ab12cd34.localhost')).toBe(false)
    expect(policy.allows('http://g-other.localhost:8787')).toBe(false)
    expect(policy.allows('https://g-ab12cd34.localhost:8787')).toBe(false)
  })
})

describe("the seam for Ruken's gameOrigin", () => {
  it('lists an origin gameOrigin already computed, and refuses anything that is not one', () => {
    expect(originsFromGameOrigin(RUKEN)).toEqual([RUKEN])
    expect(originPolicy(originsFromGameOrigin(RUKEN)).allows(RUKEN)).toBe(true)
    expect(() => originsFromGameOrigin(`${RUKEN}/`)).toThrow(/not an origin/)
    expect(() => originsFromGameOrigin(`${RUKEN}/play?x=1`)).toThrow(/not an origin/)
  })
})
