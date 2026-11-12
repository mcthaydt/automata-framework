import { describe, expect, it } from 'vitest'
import { runtimeCopyIn } from '#src/app/boot/runtime-copy.ts'
import ja from '#src/app/screens/words/ja.json' with { type: 'json' }

// The runtime's words in a language: the bundled words, with the game's own over them, word by word. Which language is
// the runtime language's (runtime-language.test.ts).

describe('runtimeCopyIn', () => {
  it('reads in the language asked for', () => {
    const copy = runtimeCopyIn(undefined, 'ja')
    expect(copy.retry).toBe(ja.runtime_retry)
    expect(copy.loading).toBe(ja.runtime_loading)
  })

  it('reads English for a language core has no words in', () => {
    expect(runtimeCopyIn(undefined, 'fr').retry).toBe('Try again')
  })

  it("lets the game's own words win, word by word", () => {
    const copy = runtimeCopyIn({ retry: 'Again' }, 'ja')
    expect(copy.retry).toBe('Again')
    expect(copy.loading).toBe(ja.runtime_loading)
  })

  it("takes the game's words as a function of the language", () => {
    expect(runtimeCopyIn((locale) => ({ retry: `again ${locale}` }), 'ja').retry).toBe('again ja')
  })
})
