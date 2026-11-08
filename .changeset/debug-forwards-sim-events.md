---
'@automata/debug': patch
---
`forwardEvents` lets an editor that frames the game hear its sim events (Schematic's Watch shows which mode each character is in). The game posts only the events the editor's address names, only to the origin it names, and only when framed; the overlay turns it on when the game gave `installDebug` a bus. `installDebug` takes an optional `tickHz` for the times it posts.
