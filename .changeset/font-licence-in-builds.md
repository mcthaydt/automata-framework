---
'@automata/tools': patch
---
`automata ship prepare` puts the Geist font's full licence (`licenses/geist-OFL.txt`, from the game's installed `@automata/framework`) into the build when the game carries the font, so the itch.io zip and the folder butler pushes both hold it, as the SIL Open Font License asks. It stops, and says what to install, if the licence file cannot be found.
