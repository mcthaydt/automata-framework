// @mcthaydt/automata-content/locale: the browser-safe part of content localization (PRODUCT.L2) and the `xx-long`
// pseudo-locale (PRODUCT.L3a), for a game's run time and its test builds. The root entry is the compiler,
// which uses Node's file system; nothing reachable from here does.

export { type ContentText, type ContentTextOptions, createContentText } from './content-text'
export { ALWAYS_CHARACTERS, catalogCharacters, localeCharacters } from './glyphs'
export { type MessageCatalog, messageKey, snakeKey } from './messages'
export {
  hasRawText,
  type MessageValue,
  PSEUDO_LOCALE,
  pseudoLocalize,
  pseudoMessages,
} from './pseudo-locale'
