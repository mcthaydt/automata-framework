# EDS.2a The suite app: review images

Written by `packages/editor-suite/src/shell/suite.layout.test.ts` (`pnpm --filter @mcthaydt/automata-editor-suite
test:layout`, the Chromium instance) over the sample game: FloorFifty's editor list (677d456) with a tuning file and a
stage, held in memory. They are for review only: nothing compares against them. Everything here is new in EDS.2a.

No editor is registered in the free build yet (the Tuner lands in EDS.4a, the level editors in EDS.2d), so every card
truthfully says "Not in this build".

| Image | Size | What to look at | What changed |
|---|---|---|---|
| `suite-home-ipad-pro-11-landscape.png` | 1194×834, `wide` | The rail of nine (Tuner to Review) as a 56 px column with every label whole; Home and "Sample game" in the top bar; one card per editor the list names with its file, the "Not in this build" badge and the plain-words note naming the package. The empty columns either side of the cards are the shell's panel and inspector regions, which Home does not fill: they collapse once #267's shell change lands (see the PR) | New |
| `suite-home-ipad-mini-landscape.png` | 1133×744, `wide`, short | The same at the short height tier: the rail's nine still fit | New |
| `suite-home-ipad-pro-11-portrait.png` | 834×1194, `medium` | The rail becomes the 64 px tab bar along the foot with all nine; the cards in two columns | New |
| `suite-home-phone-portrait.png` | 390×844, `compact` | The tab bar keeps 44 px tabs with their words and scrolls sideways to Levels and Review (a declared scroll region) rather than shrinking them; the cards in one column | New |
| `suite-problem-ipad-pro-11-landscape.png` | 1194×834, `wide` | EDS-m: a `[[file]]` row without `gates`. The problem in red with its key path `file[0].gates`, "gates is missing", and that every editor is read only until it is fixed; no cards | New |
| `suite-problem-phone-portrait.png` | 390×844, `compact` | The same problem inside the phone's width | New |
