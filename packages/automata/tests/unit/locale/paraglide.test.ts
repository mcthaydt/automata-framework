import { beforeAll, describe, expect, it } from 'vitest'
import { bindParaglide, createT } from '#src/features/locale/paraglide.ts'
import { loadParaglideFixture, type ParaglideFixture } from '#src/features/locale/testing/load-fixture.ts'

let fixture: ParaglideFixture

beforeAll(async () => {
  fixture = await loadParaglideFixture()
})

describe('bindParaglide (PRODUCT spec §4 item 1)', () => {
  it('makes the generated messages answer in the locale the getter gives, with no reload', () => {
    let current = 'fr'
    bindParaglide(fixture.runtime, { current: () => current, set: () => {} })
    expect(fixture.messages.play?.()).toBe('Jouer')
    current = 'en'
    expect(fixture.messages.play?.()).toBe('Play')
  })

  it("routes Paraglide's setLocale to the service instead of its own strategies", () => {
    let current = 'en'
    bindParaglide(fixture.runtime, {
      current: () => current,
      set: (locale) => {
        current = locale
      },
    })
    fixture.runtime.setLocale('fr')
    expect(current).toBe('fr')
    expect(fixture.messages.play?.()).toBe('Jouer')
  })
})

describe('createT', () => {
  it('looks a message up by key, with its inputs, in the current locale', () => {
    let current = 'fr'
    bindParaglide(fixture.runtime, { current: () => current, set: () => {} })
    const t = createT(fixture.messages)
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
