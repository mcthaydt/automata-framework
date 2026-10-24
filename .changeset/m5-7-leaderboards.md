---
'@mcthaydt/automata-ui': patch
'@mcthaydt/automata-ship': patch
---

M5.7 leaderboard flow. ui: `LeaderboardPanel` (loading, entries with the player's row marked, empty, unavailable, offline) and its `LeaderboardView`, `LeaderboardEntryView` and `LeaderboardCopy` types. ship: `prepareBuild` refuses a game that names a leaderboard its ship config does not declare (`UndeclaredBoard`, with the call site), and exports the scan (`findUndeclaredBoards`, `boardNamesIn`, `declaredBoardsIn`, `isBoardSource`). (The cli's new `automata check` step `boards`, rule `undeclared-board`, needs no changeset: the cli is private.) Additive for every caller.
