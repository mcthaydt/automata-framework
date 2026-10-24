import { HostError, type HostingSaves } from '@mcthaydt/automata-host'
import { Effect, Logger, type Scope, Stream } from 'effect'
import { describe, expect, it } from 'vitest'
import { makePresentationBus, type RuntimeFacts } from '../presentation/presentation-bus.manager.js'
import { LOCALE_SAVE_KEY, type Locale, type LocaleDef, makeLocale } from './locale.manager.js'

const def: LocaleDef = { locales: ['en', 'fr', 'ar'], baseLocale: 'en' }

interface FakeSaves extends HostingSaves {
  readonly values: Map<string, string>
}

function fakeSaves(initial: Record<string, string> = {}, refuse = false): FakeSaves {
  const values = new Map(Object.entries(initial))
  const refused = (operation: string) => new HostError({ code: 'DENIED', retryable: false, operation })
  return {
    values,
    get: (key) => Effect.succeed(values.get(key) ?? null),
    set: (key, value) =>
      refuse ? Effect.fail(refused('saves.set')) : Effect.sync(() => void values.set(key, value)),
    remove: (key) =>
      refuse ? Effect.fail(refused('saves.remove')) : Effect.sync(() => void values.delete(key)),
    flush: Effect.succeed({ persisted: 'host-outbox' }),
    keys: Effect.sync(() => [...values.keys()].sort()),
    changed: Stream.empty,
  }
}

interface Setup {
  readonly kind?: 'ruken' | 'standalone'
  readonly hostLocale?: string
  readonly saves?: FakeSaves
  readonly browser?: readonly string[]
}

function withLocale<A>(
  setup: Setup,
  test: (locale: Locale, facts: RuntimeFacts['locale.changed'][], element: HTMLElement) => Effect.Effect<A>,
): Promise<{ result: A; logs: string[] }> {
  const logs: string[] = []
  const logger = Logger.make(({ message }) => logs.push(String(message)))
  const program: Effect.Effect<A, never, Scope.Scope> = Effect.gen(function* () {
    const bus = yield* makePresentationBus()
    const facts: RuntimeFacts['locale.changed'][] = []
    bus.subscribe('locale.changed', (fact) => facts.push(fact))
    const element = document.createElement('html')
    const locale = yield* makeLocale({
      def,
      hosting: {
        kind: setup.kind ?? 'ruken',
        locale: setup.hostLocale ?? 'en-US',
        saves: setup.saves ?? fakeSaves(),
      },
      browser: setup.browser ?? [],
      bus,
      element,
    })
    return yield* test(locale, facts, element)
  })
  return Effect.runPromise(
    Effect.scoped(program).pipe(
      Effect.provide(Logger.replace(Logger.defaultLogger, logger)),
      Effect.map((result) => ({ result, logs })),
    ),
  )
}

/** Lets the forked saves write run. */
const settle = Effect.yieldNow().pipe(Effect.repeatN(5))

describe('makeLocale (PRODUCT spec §4 items 2 and 4)', () => {
  it('starts in the negotiated locale and sets lang and dir before it returns', async () => {
    const { result } = await withLocale({ hostLocale: 'ar-EG' }, (locale, _facts, element) =>
      Effect.succeed({
        current: locale.current,
        lang: element.lang,
        dir: element.dir,
        direction: locale.direction,
      }),
    )
    expect(result).toEqual({ current: 'ar', lang: 'ar', dir: 'rtl', direction: 'rtl' })
  })

  it('reads the saved choice through Hosting.saves when the hosted locale is not offered', async () => {
    const saves = fakeSaves({ [LOCALE_SAVE_KEY]: 'fr' })
    const { result } = await withLocale({ hostLocale: 'de', saves }, (locale) =>
      Effect.succeed(locale.current),
    )
    expect(result).toBe('fr')
  })

  it('ignores the session locale standalone, where the SDK reports the browser language', async () => {
    const { result } = await withLocale(
      { kind: 'standalone', hostLocale: 'ar', browser: ['fr-FR'] },
      (locale) => Effect.succeed(locale.current),
    )
    expect(result).toBe('fr')
  })

  it('switches on set: current, lang, subscribers, one presentation fact and the saved key', async () => {
    const saves = fakeSaves()
    const { result } = await withLocale({ saves }, (locale, facts, element) =>
      Effect.gen(function* () {
        const heard: string[] = []
        locale.subscribe((value) => heard.push(value))
        locale.set('fr')
        yield* settle
        return { current: locale.current, lang: element.lang, heard, facts: [...facts] }
      }),
    )
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
    const { result } = await withLocale({ saves }, (locale, facts) =>
      Effect.gen(function* () {
        locale.set('en')
        yield* settle
        return facts.length
      }),
    )
    expect(result).toBe(0)
    expect(saves.values.get(LOCALE_SAVE_KEY)).toBe('en')
  })

  it('goes back to negotiation without the saved step on set(null)', async () => {
    const saves = fakeSaves({ [LOCALE_SAVE_KEY]: 'fr' })
    const { result } = await withLocale({ hostLocale: 'de', saves, browser: ['ar'] }, (locale) =>
      Effect.gen(function* () {
        const before = locale.current
        locale.set(null)
        yield* settle
        return { before, after: locale.current }
      }),
    )
    expect(result).toEqual({ before: 'fr', after: 'ar' })
    expect(saves.values.has(LOCALE_SAVE_KEY)).toBe(false)
  })

  // The Settings Language group's selected option (redo step 9): a saved pick, or null for Automatic.
  it('says the player’s choice: the saved locale, a new pick, or null for Automatic', async () => {
    await withLocale({ saves: fakeSaves({ [LOCALE_SAVE_KEY]: 'fr' }) }, (locale) =>
      Effect.sync(() => {
        expect(locale.choice).toBe('fr')
        locale.set('ar')
        expect(locale.choice).toBe('ar')
        locale.set(null)
        expect(locale.choice).toBeNull()
      }),
    )
    await withLocale({}, (locale) => Effect.sync(() => expect(locale.choice).toBeNull()))
  })

  it('refuses a locale the game does not ship, naming it', async () => {
    await withLocale({}, (locale) =>
      Effect.sync(() => {
        expect(() => locale.set('de')).toThrow(/'de'/)
        expect(locale.current).toBe('en')
      }),
    )
  })

  it('logs a refused write and keeps the new locale in memory, with no device-storage fallback', async () => {
    const saves = fakeSaves({}, true)
    const { result, logs } = await withLocale({ saves }, (locale) =>
      Effect.gen(function* () {
        locale.set('fr')
        yield* settle
        return locale.current
      }),
    )
    expect(result).toBe('fr')
    expect(logs.some((line) => line.includes(LOCALE_SAVE_KEY))).toBe(true)
    expect(saves.values.size).toBe(0)
  })
})
