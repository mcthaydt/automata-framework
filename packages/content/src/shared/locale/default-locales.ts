// The six languages every game on the framework ships, and each one's name for itself. Pure data with no imports, so
// the browser, the font build and the tools all read one list.

/** The default languages in the order the language picker lists them. The first is the source of every catalog. */
export const DEFAULT_LOCALES = ['en', 'ja', 'ko', 'es-419', 'pt-BR', 'zh-Hans'] as const

/** One of the six default languages. */
export type DefaultLocale = (typeof DEFAULT_LOCALES)[number]

/**
 * Each default language's name in itself. Written out rather than asked of `Intl.DisplayNames`, because engines
 * disagree about some of them (`es-419` is "Español (Latinoamérica)" in one and "Español" in another), and the font
 * build must cut exactly the characters the picker will draw.
 */
export const ENDONYMS: Readonly<Record<DefaultLocale, string>> = {
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  'es-419': 'Español',
  'pt-BR': 'Português (Brasil)',
  'zh-Hans': '简体中文',
}
