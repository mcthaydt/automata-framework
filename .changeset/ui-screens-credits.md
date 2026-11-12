---
'@automataframework/ui-screens': patch
---
`@automataframework/ui-screens/credits` adds a credits panel drawn from a content file: `creditsContent` is the `credits` content kind (`content/credits/credits.toml`: sections of names, a name with an optional role and an `https:` link; titles and roles are translated by `automata words`), and `CreditsPanel` shows it in core's `Modal` with the links opened through the host (`Hosting.openLink`). A name's link is a button only where the host grants `links`; a link the host refuses is said politely under the list. The panel's words are in the six languages (`screensWords(locale).credits`). `zod` is a dependency and `@automataframework/content` a peer.
