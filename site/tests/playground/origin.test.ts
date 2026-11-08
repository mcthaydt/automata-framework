// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { atOrigin } from '../../src/lib/playground/origin'
import { SITE_ORIGIN } from '../../src/lib/site.js'

// The precompiled originals (static/playground/compiled/) are compiled for the site's origin, so an example's
// `import.meta.url` is a literal naming it. A local server runs them at its own origin, or the frame's CSP blocks the
// texture or sound the example asks for (and the e2e third-party gate fails).

describe('atOrigin', () => {
  const code = `// see https://automata.ruken.com/playground/ for more\nconst chime = new URL('../resources/sounds/chime.wav', "https://automata.ruken.com/playground/examples/audio/audio-sound.ts").href\nconst other = "https://example.com/playground/x"`

  it('moves the quoted playground literal to the other origin and leaves everything else', () => {
    const moved = atOrigin(code, 'https://automata.ruken.com', 'http://127.0.0.1:4650')
    expect(moved).toBe(code.replace('"https://automata.ruken.com/playground/examples', '"http://127.0.0.1:4650/playground/examples'))
  })

  it('is the identity at the same origin, and refuses what is not an origin', () => {
    expect(atOrigin(code, 'https://automata.ruken.com', 'https://automata.ruken.com')).toBe(code)
    expect(() => atOrigin(code, 'https://automata.ruken.com', 'http://127.0.0.1:4650/path')).toThrow(/not an origin/)
  })

  it('moves the literal in a real precompiled original', () => {
    const original = readFileSync(resolve(import.meta.dirname, '../../static/playground/compiled/audio-sound.js'), 'utf8')
    const moved = atOrigin(original, SITE_ORIGIN, 'http://localhost:5173')
    expect(moved).toContain('"http://localhost:5173/playground/examples/audio/audio-sound.ts"')
    expect(moved).not.toContain(SITE_ORIGIN)
  })
})
