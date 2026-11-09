// @automata/content/locale: the browser-safe part of content localization and the `xx-long`
// pseudo-locale, for a game's run time and its test builds. The root entry is the compiler,
// which uses Node's file system; nothing reachable from here does.

export { type ContentText, type ContentTextOptions, createContentText } from './content-text'
export { endonymOf } from './endonyms'
export { ALWAYS_CHARACTERS, catalogCharacters, localeCharacters } from './glyphs'
export { type MessageCatalog, messageKey, snakeKey } from './messages'
export {
  hasRawText,
  type MessageValue,
  PSEUDO_LOCALE,
  pseudoLocalize,
  pseudoMessages,
} from './pseudo-locale'
