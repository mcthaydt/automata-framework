import { describe, expect, it } from 'vitest'
import { LANGUAGE_TAG } from '#src/shared/game/game-facts.ts'

// The tags a game's languages may be: the shapes Ruken's store lists, and the framework's own default set (Latin American
// Spanish is `es-419`, a UN M.49 region, not two letters).

describe('LANGUAGE_TAG', () => {
  it.each(['en', 'fr', 'pt-BR', 'zh-Hant', 'zh-Hant-TW', 'es-419', 'zh-Hans', 'ja', 'ko'])(
    'accepts %s',
    (tag) => {
      expect(LANGUAGE_TAG.test(tag)).toBe(true)
    },
  )

  it.each(['FR_fr', 'notes', 'es-41', 'es-4190', 'es-abc', 'EN', 'e', 'pt-br'])('refuses %s', (tag) => {
    expect(LANGUAGE_TAG.test(tag)).toBe(false)
  })
})
