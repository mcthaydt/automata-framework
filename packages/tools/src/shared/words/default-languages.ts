// The six languages every game on the framework ships, in the order the language picker lists them; the first is the
// source. The same list as `@automataframework/content/locale`'s `DEFAULT_LOCALES`, which plain Node cannot load from source,
// and a test keeps the two equal.

/** The default languages: English, Japanese, Korean, Latin American Spanish, Brazilian Portuguese, Simplified Chinese. */
export const DEFAULT_LANGUAGES: readonly string[] = ['en', 'ja', 'ko', 'es-419', 'pt-BR', 'zh-Hans']
