---
'@automata/content': patch
---
`@automata/content/locale` now names the six default languages (`DEFAULT_LOCALES`: en, ja, ko, es-419, pt-BR, zh-Hans) and each one's own name for itself (`ENDONYMS`), and `endonymOf` answers from them before asking `Intl.DisplayNames`, so every engine and the font build spell a name the same way.
