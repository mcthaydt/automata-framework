---
'@automata/framework': patch
---
The first run asks which language to use: a game that ships more than one language shows one screen before its title, every language in its own script with the one the device suggested focused, and one press goes on. It is skipped under a host that supplies the language (Ruken), when the player has already chosen, and once it has been shown on the device; `defineGame({ firstRunLanguage: false })` never shows it. The words are in `ScreensCopy.firstRun`, in all six languages.
