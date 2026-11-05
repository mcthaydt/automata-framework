// The font build cuts each language's name into every subset in Node (M5.5F), and the language picker shows the
// names the player's browser gives. Both call `endonymOf`, so they spell a name the same way only if every engine's
// `Intl.DisplayNames` does. This pins the names of the planned languages (EN/ES/ZH/KO/PT/JA, and the fixtures'
// FR), as Node 24 gives them, in Node, Chromium, WebKit and Firefox. A name an engine spells differently is a
// character the build may not have cut: change the build or the list here, never this check, to make it pass.
import { expect, test } from 'vitest'
import { endonymOf } from '#src/locale/endonyms.ts'

const NAMES: Readonly<Record<string, string>> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  ja: '日本語',
  ko: '한국어',
  'pt-BR': 'Português (Brasil)',
  'zh-Hans': '简体中文',
}

test('every engine names the planned languages as the font build does', () => {
  const names = Object.fromEntries(Object.keys(NAMES).map((tag) => [tag, endonymOf(tag)]))
  expect(names).toEqual(NAMES)
})
