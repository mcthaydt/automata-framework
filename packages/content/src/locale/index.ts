// @mcthaydt/automata-content/locale: the browser-safe part of content localization (PRODUCT.L2), for a game's
// run time. The root entry is the compiler, which uses Node's file system; nothing reachable from here does.

export { type ContentText, type ContentTextOptions, createContentText } from './content-text'
export { endonymOf } from './endonyms'
export { ALWAYS_CHARACTERS, catalogCharacters, localeCharacters } from './glyphs'
export { type MessageCatalog, messageKey, snakeKey } from './messages'
