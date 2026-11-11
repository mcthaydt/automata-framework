---
'@automata/framework': patch
'@automata/tools': patch
---
`Hosting` gains `openLink(url)`: a game opens a web page the way its host wants it done. Ruken asks the player first (the game adds `'links'` to `hosting.wants`), the web and itch targets open a new tab, and the desktop opens the player's own browser. Only `https:` addresses are opened, a host or player that says no is an answer (`opened: false`) and not an error, and the game is never navigated away. The web, itch and desktop targets grant `links` themselves. `@automata/framework/testing`'s `describeHostingContract` takes an optional `LinksProbe` to run the same link cases on an adapter, and `fakeHosting` records links and answers them. The generated desktop project registers Tauri's opener plugin and allows `https:` addresses only; `@tauri-apps/plugin-opener` is a new optional peer of `@automata/framework`, and `create-game` adds it for a game that builds for `tauri`.
