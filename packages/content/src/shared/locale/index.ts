// @automataframework/content/locale: the browser-safe part of content localization and the `xx-long`
// pseudo-locale, for a game's run time and its test builds. The root entry is the compiler,
// which uses Node's file system; nothing reachable from here does.

export { type ContentText, type ContentTextOptions, createContentText } from './content-text.ts'
export { DEFAULT_LOCALES, type DefaultLocale, ENDONYMS } from './default-locales.ts'
export { endonymOf } from './endonyms.ts'
export { ALWAYS_CHARACTERS, catalogCharacters, localeCharacters } from './glyphs.ts'
export { type MessageCatalog, messageKey, snakeKey } from './messages.ts'
export {
  hasRawText,
  type MessageValue,
  PSEUDO_LOCALE,
  pseudoLocalize,
  pseudoMessages,
} from './pseudo-locale.ts'
