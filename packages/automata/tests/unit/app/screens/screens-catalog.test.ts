import { DEFAULT_LOCALES } from '@automata/content/locale'
import { describe, expect, it, test } from 'vitest'
import {
  CATALOG_SCHEMA,
  displayCopyFor,
  englishCatalog,
  flattenScreensCopy,
  runtimeCopyFor,
  screensCopyFrom,
} from '#src/app/screens/screens-catalog.ts'
import { DEFAULT_SCREENS_COPY, resolveScreensCopy } from '#src/app/screens/screens-copy.ts'
import en from '#src/app/screens/words/en.json' with { type: 'json' }
import es419 from '#src/app/screens/words/es-419.json' with { type: 'json' }
import ja from '#src/app/screens/words/ja.json' with { type: 'json' }
import ko from '#src/app/screens/words/ko.json' with { type: 'json' }
import ptBR from '#src/app/screens/words/pt-BR.json' with { type: 'json' }
import zhHans from '#src/app/screens/words/zh-Hans.json' with { type: 'json' }

const catalogs: Record<string, Record<string, string>> = {
  en,
  ja,
  ko,
  'es-419': es419,
  'pt-BR': ptBR,
  'zh-Hans': zhHans,
}
const keysOf = (catalog: Record<string, string>): string[] =>
  Object.keys(catalog).filter((k) => k !== '$schema')
const placeholdersOf = (text: string): string[] =>
  [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '').sort()

describe('the default screens catalogs', () => {
  test('en.json is every English word core owns, flattened', () => {
    expect(en).toEqual({ $schema: CATALOG_SCHEMA, ...englishCatalog(DEFAULT_SCREENS_COPY) })
  })

  test('a round trip keeps every leaf', () => {
    const back = screensCopyFrom(flattenScreensCopy(DEFAULT_SCREENS_COPY), DEFAULT_SCREENS_COPY)
    expect(back.paused.resume).toBe('Resume')
    expect(back.board.more(3)).toBe(DEFAULT_SCREENS_COPY.board.more(3))
    expect(back.settings.display.reducedMotion(true)).toBe(
      DEFAULT_SCREENS_COPY.settings.display.reducedMotion(true),
    )
    expect(back.settings.display.reducedMotion(false)).toBe(
      DEFAULT_SCREENS_COPY.settings.display.reducedMotion(false),
    )
    expect(back.settings.controls.rebind('Jump', 'Keyboard')).toBe(
      DEFAULT_SCREENS_COPY.settings.controls.rebind('Jump', 'Keyboard'),
    )
    expect(back.saves.slots.deleteBody('Slot 2')).toBe(DEFAULT_SCREENS_COPY.saves.slots.deleteBody('Slot 2'))
  })

  test('a computed word reads as the English function does', () => {
    const back = screensCopyFrom(en, DEFAULT_SCREENS_COPY)
    for (const value of [0.5, 0.07]) {
      expect(back.settings.audio.percent(value)).toBe(DEFAULT_SCREENS_COPY.settings.audio.percent(value))
    }
    for (const slot of [0, 2]) {
      expect(back.saves.slots.slot(slot)).toBe(DEFAULT_SCREENS_COPY.saves.slots.slot(slot))
    }
    for (const [action, device, seconds] of [
      ['Jump', 'Keyboard', 5],
      ['Dash', 'Controller', 1],
    ] as const) {
      expect(back.settings.controls.capturing(action, device, seconds)).toBe(
        DEFAULT_SCREENS_COPY.settings.controls.capturing(action, device, seconds),
      )
    }
  })

  test.each(DEFAULT_LOCALES.filter((lang) => lang !== 'en'))(
    '%s has exactly the English keys and placeholders',
    (lang) => {
      const catalog = catalogs[lang] ?? {}
      expect(keysOf(catalog).sort()).toEqual(keysOf(en).sort())
      for (const key of keysOf(en)) {
        const text = catalog[key] ?? ''
        expect(text.trim(), `${lang} ${key} is empty`).not.toBe('')
        expect(placeholdersOf(text), `${lang} ${key} placeholders`).toEqual(
          placeholdersOf(en[key as keyof typeof en]),
        )
      }
    },
  )

  test.each(DEFAULT_LOCALES.filter((lang) => lang !== 'en'))(
    '%s names the same action with the same word',
    (lang) => {
      // One word for Back and one for Settings, wherever they show.
      const catalog = catalogs[lang] ?? {}
      expect(catalog.paused_back).toBe(catalog.settings_screen_back)
      expect(catalog.paused_settings).toBe(catalog.settings_screen_title)
    },
  )
})

describe('resolveScreensCopy', () => {
  it('gives a game with no words of its own translated menus', () => {
    expect(resolveScreensCopy(undefined, 'ja').paused.resume).toBe(ja.paused_resume)
    expect(ja.paused_resume).not.toBe(en.paused_resume)
    expect(resolveScreensCopy(undefined, 'pt-PT').title.play).toBe(ptBR.title_play)
    expect(resolveScreensCopy(undefined, 'fr')).toEqual(DEFAULT_SCREENS_COPY)
  })

  it('still lets copy.screens override', () => {
    expect(resolveScreensCopy({ title: { play: 'Go' } }, 'ja').title.play).toBe('Go')
  })
})

describe('the runtime and display words', () => {
  it('follow the locale', () => {
    expect(runtimeCopyFor('ja').retry).toBe(ja.runtime_retry)
    expect(displayCopyFor('ko').toast.ok).toBe(ko.display_toast_ok)
  })

  it('keep the English for a language outside the six', () => {
    expect(runtimeCopyFor('fr').retry).toBe('Try again')
    expect(runtimeCopyFor('fr').loading).toBe('Loading…')
    expect(displayCopyFor('fr').toast.ok).toBe('OK')
  })

  it('carry the loading, slow and context-lost words too', () => {
    const words = runtimeCopyFor('es-419')
    expect(words.loading).toBe(es419.runtime_loading)
    expect(words.slow).toBe(es419.runtime_slow)
    expect(words.contextLost).toBe(es419.runtime_context_lost)
  })

  it('keep the {host} and {file} slots the boot panel fills', () => {
    for (const lang of DEFAULT_LOCALES) {
      expect(runtimeCopyFor(lang).exit).toContain('{host}')
      expect(runtimeCopyFor(lang)['model-invalid']).toContain('{file}')
    }
  })
})
