// @vitest-environment node
// Node, not jsdom: the inlang SDK behind Paraglide's compiler rejects jsdom's Uint8Array (another realm).
import { beforeAll, describe, expect, it } from 'vitest'
import { bindParaglide, createT, type MessageFunction, type ParaglideRuntime } from './paraglide.js'
import { type CompiledFixture, compileFixture } from './testing/compile-fixture.js'

let fixture: CompiledFixture

beforeAll(async () => {
  fixture = await compileFixture()
}, 60_000)

describe('bindParaglide (PRODUCT spec §4 item 1)', () => {
  it('makes the generated messages answer in the locale the getter gives, with no reload', () => {
    let current = 'fr'
    bindParaglide(fixture.runtime as unknown as ParaglideRuntime, {
      current: () => current,
      set: (locale) => {
        current = locale
      },
    })
    const play = fixture.messages['play'] as () => string
    expect(play()).toBe('Jouer')
    current = 'en'
    expect(play()).toBe('Play')
  })

  it("routes Paraglide's setLocale to the service instead of its own strategies", () => {
    let current = 'en'
    bindParaglide(fixture.runtime as unknown as ParaglideRuntime, {
      current: () => current,
      set: (locale) => {
        current = locale
      },
    })
    const setLocale = fixture.runtime['setLocale'] as (locale: string) => void
    setLocale('fr')
    expect(current).toBe('fr')
    expect((fixture.messages['play'] as () => string)()).toBe('Jouer')
  })
})

describe('createT', () => {
  it('looks a message up by key, with its inputs, in the current locale', () => {
    let current = 'fr'
    bindParaglide(fixture.runtime as unknown as ParaglideRuntime, { current: () => current, set: () => {} })
    const t = createT(fixture.messages as Record<string, MessageFunction>)
    expect(t('hello', { name: 'Ada' })).toBe('Bonjour Ada')
    current = 'en'
    expect(t('hello', { name: 'Ada' })).toBe('Hello Ada')
    expect(t('play')).toBe('Play')
  })

  it('is typed by the messages module', () => {
    const messages = {
      hello: (inputs: { name: string }) => `Hello ${inputs.name}`,
      play: () => 'Play',
    }
    const t = createT(messages)
    expect(t('hello', { name: 'Ada' })).toBe('Hello Ada')
    // @ts-expect-error a key the catalog does not have
    expect(() => t('nope')).toThrow(/nope/)
    // Never called: only the type is under test.
    // @ts-expect-error a message that needs inputs
    const withoutInputs = () => t('hello')
    expect(withoutInputs).toBeTypeOf('function')
  })
})
