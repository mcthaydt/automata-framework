import { describe, expect, it } from 'vitest'
import {
  createLocale,
  LOCALE_SAVE_KEY,
  type Locale,
  type LocaleDef,
  type LocaleSaves,
} from '#src/features/locale/locale.manager.ts'
import type { RuntimeFacts } from '#src/shared/runtime/presentation/presentation-bus.manager.ts'
import { refuse } from '../../../src/shared/host/plain-errors.ts'

const def: LocaleDef = { locales: ['en', 'fr', 'ar'], baseLocale: 'en' }

interface FakeSaves extends LocaleSaves {
  readonly values: Map<string, string>
}

function fakeSaves(initial: Record<string, string> = {}, refuseWrites = false): FakeSaves {
  const values = new Map(Object.entries(initial))
  const denied = (operation: string) => refuse('DENIED', false, operation)
  return {
    values,
    get: async (key) => ({ ok: true, value: values.get(key) ?? null }),
    set: async (key, value) =>
      refuseWrites ? denied('saves.set') : (values.set(key, value), { ok: true, value: undefined }),
    remove: async (key) =>
      refuseWrites ? denied('saves.remove') : (values.delete(key), { ok: true, value: undefined }),
  }
}

interface Setup {
  readonly kind?: 'ruken' | 'standalone'
  readonly hostLocale?: string
  readonly saves?: FakeSaves
  readonly browser?: readonly string[]
}

async function withLocale<A>(
  setup: Setup,
  test: (locale: Locale, facts: RuntimeFacts['locale.changed'][], element: HTMLElement) => A | Promise<A>,
): Promise<{ result: A; logs: string[] }> {
  const logs: string[] = []
  const facts: RuntimeFacts['locale.changed'][] = []
  const element = document.createElement('html')
  const locale = await createLocale({
    def,
    hosting: {
      kind: setup.kind ?? 'ruken',
      locale: setup.hostLocale ?? 'en-US',
      saves: setup.saves ?? fakeSaves(),
    },
    browser: setup.browser ?? [],
    bus: {
      publish: (name, fact) => {
        if (name === 'locale.changed') facts.push(fact as RuntimeFacts['locale.changed'])
      },
    },
    element,
    warn: (message) => logs.push(message),
  })
  return { result: await test(locale, facts, element), logs }
}

/** Lets the saves write that `set` starts finish. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('createLocale', () => {
  it('starts in the negotiated locale and sets lang and dir before it returns', async () => {
    const { result } = await withLocale({ hostLocale: 'ar-EG' }, (locale, _facts, element) => ({
      current: locale.current,
      lang: element.lang,
      dir: element.dir,
      direction: locale.direction,
    }))
    expect(result).toEqual({ current: 'ar', lang: 'ar', dir: 'rtl', direction: 'rtl' })
  })

  it('reads the saved choice through Hosting.saves when the hosted locale is not offered', async () => {
    const saves = fakeSaves({ [LOCALE_SAVE_KEY]: 'fr' })
    const { result } = await withLocale({ hostLocale: 'de', saves }, (locale) => locale.current)
    expect(result).toBe('fr')
  })

  it('ignores the session locale standalone, where the SDK reports the browser language', async () => {
    const { result } = await withLocale(
      { kind: 'standalone', hostLocale: 'ar', browser: ['fr-FR'] },
      (locale) => locale.current,
    )
    expect(result).toBe('fr')
  })

  it('switches on set: current, lang, subscribers, one presentation fact and the saved key', async () => {
    const saves = fakeSaves()
    const { result } = await withLocale({ saves }, async (locale, facts, element) => {
      const heard: string[] = []
      locale.subscribe((value) => heard.push(value))
      locale.set('fr')
      await settle()
      return { current: locale.current, lang: element.lang, heard, facts: [...facts] }
    })
    expect(result).toEqual({
      current: 'fr',
      lang: 'fr',
      heard: ['en', 'fr'],
      facts: [{ locale: 'fr', previous: 'en' }],
    })
    expect(saves.values.get(LOCALE_SAVE_KEY)).toBe('fr')
  })

  it('saves an explicit pick of the locale already shown, without a fact', async () => {
    const saves = fakeSaves()
    const { result } = await withLocale({ saves }, async (locale, facts) => {
      locale.set('en')
      await settle()
      return facts.length
    })
    expect(result).toBe(0)
    expect(saves.values.get(LOCALE_SAVE_KEY)).toBe('en')
  })

  it('goes back to negotiation without the saved step on set(null)', async () => {
    const saves = fakeSaves({ [LOCALE_SAVE_KEY]: 'fr' })
    const { result } = await withLocale({ hostLocale: 'de', saves, browser: ['ar'] }, async (locale) => {
      const before = locale.current
      locale.set(null)
      await settle()
      return { before, after: locale.current }
    })
    expect(result).toEqual({ before: 'fr', after: 'ar' })
    expect(saves.values.has(LOCALE_SAVE_KEY)).toBe(false)
  })

  // The Settings Language group's selected option (redo step 9): a saved pick, or null for Automatic.
  it('says the player’s choice: the saved locale, a new pick, or null for Automatic', async () => {
    await withLocale({ saves: fakeSaves({ [LOCALE_SAVE_KEY]: 'fr' }) }, (locale) => {
      expect(locale.choice).toBe('fr')
      locale.set('ar')
      expect(locale.choice).toBe('ar')
      locale.set(null)
      expect(locale.choice).toBeNull()
    })
    await withLocale({}, (locale) => expect(locale.choice).toBeNull())
  })

  it('refuses a locale the game does not ship, naming it', async () => {
    await withLocale({}, (locale) => {
      expect(() => locale.set('de')).toThrow(/'de'/)
      expect(locale.current).toBe('en')
    })
  })

  it('logs a refused write and keeps the new locale in memory, with no device-storage fallback', async () => {
    const saves = fakeSaves({}, true)
    const { result, logs } = await withLocale({ saves }, async (locale) => {
      locale.set('fr')
      await settle()
      return locale.current
    })
    expect(result).toBe('fr')
    expect(logs.some((line) => line.includes(LOCALE_SAVE_KEY))).toBe(true)
    expect(saves.values.size).toBe(0)
  })
})
