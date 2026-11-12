import { describe, expect, it } from 'vitest'
import { runtimeCopyBeforeLocale } from '#src/app/boot/runtime-copy.ts'
import ja from '#src/app/screens/words/ja.json' with { type: 'json' }

// A failure can come before the locale service exists, so the words for it are chosen from the browser's languages
// the same way the service will choose the locale.

const def = { locales: ['en', 'ja'], baseLocale: 'en' }

describe('runtimeCopyBeforeLocale', () => {
  it("reads in the browser's language when the game ships it", () => {
    const copy = runtimeCopyBeforeLocale({ def, browser: ['ja-JP'], copy: undefined })
    expect(copy.retry).toBe(ja.runtime_retry)
    expect(copy.loading).toBe(ja.runtime_loading)
  })

  it('reads English when the game does not ship the browser language', () => {
    expect(runtimeCopyBeforeLocale({ def, browser: ['ko'], copy: undefined }).retry).toBe('Try again')
  })

  it("lets the game's own words win, word by word", () => {
    const copy = runtimeCopyBeforeLocale({ def, browser: ['ja'], copy: { retry: 'Again' } })
    expect(copy.retry).toBe('Again')
    expect(copy.loading).toBe(ja.runtime_loading)
  })
})
