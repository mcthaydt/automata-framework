---
'@automata/content': patch
'@automata/ui-screens': patch
---

A credits name is held to every language's font. `@automata/content/schema` gains `verbatim()`, beside `localized()`: text drawn as written in every language, with no message key. The font build cuts every face to it and refuses a build in which a language's faces lack one of its characters, naming the file, the key and the characters. The credits kind marks a name with it, and `creditsSchemaWith` takes the name's schema as an optional second argument.
