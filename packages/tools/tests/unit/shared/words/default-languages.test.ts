import { DEFAULT_LOCALES } from '@automataframework/content/locale'
import { describe, expect, it } from 'vitest'
import { DEFAULT_LANGUAGES } from '#src/shared/words/default-languages.ts'

// The tools run from source under plain Node, which cannot load `@automataframework/content/locale` (its modules import each
// other without an extension), so the six languages are written here too. This keeps the two lists one.

describe('DEFAULT_LANGUAGES', () => {
  it('is the same six languages, in the same order, as @automataframework/content/locale', () => {
    expect([...DEFAULT_LANGUAGES]).toEqual([...DEFAULT_LOCALES])
  })
})
