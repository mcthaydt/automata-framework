// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { compileExample } from '../../src/features/playground/compile'
import { atOrigin } from '../../src/features/playground/origin'
import { getExample } from '../../src/shared/framework/example-catalog'
import { SITE_ORIGIN } from '../../src/shared/site.js'

// The precompiled originals (static/playground/compiled/) are compiled for the site's origin, so an example's
// `import.meta.url` is a literal naming it. A local server runs them at its own origin, or the frame's CSP blocks the
// texture or sound the example asks for (and the e2e third-party gate fails).

describe('atOrigin', () => {
  const code = `// see https://automataframework.com/playground/ for more\nconst chime = new URL('../resources/sounds/chime.wav', "https://automataframework.com/playground/examples/audio/audio-sound.ts").href\nconst other = "https://example.com/playground/x"`

  it('moves the quoted playground literal to the other origin and leaves everything else', () => {
    const moved = atOrigin(code, 'https://automataframework.com', 'http://127.0.0.1:4650')
    expect(moved).toBe(
      code.replace(
        '"https://automataframework.com/playground/examples',
        '"http://127.0.0.1:4650/playground/examples',
      ),
    )
  })

  it('is the identity at the same origin, and refuses what is not an origin', () => {
    expect(atOrigin(code, 'https://automataframework.com', 'https://automataframework.com')).toBe(code)
    expect(() => atOrigin(code, 'https://automataframework.com', 'http://127.0.0.1:4650/path')).toThrow(
      /not an origin/,
    )
  })

  it('moves the literal in a real precompiled original', () => {
    // Compiled here the way build-demos.ts precompiles it: a unit test never reads build output, which a fresh
    // checkout does not have.
    const example = getExample('audio-sound')
    if (example === undefined) throw new Error('no audio-sound example')
    const compiled = compileExample(example.source, {
      id: example.id,
      moduleUrl: new URL(example.moduleUrl, SITE_ORIGIN).href,
    })
    if (!compiled.ok) throw new Error('audio-sound does not compile')
    const original = compiled.code
    const moved = atOrigin(original, SITE_ORIGIN, 'http://localhost:5173')
    expect(moved).toContain('"http://localhost:5173/playground/examples/audio/audio-sound.ts"')
    expect(moved).not.toContain(SITE_ORIGIN)
  })
})
