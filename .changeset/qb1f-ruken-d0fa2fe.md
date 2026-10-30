---
'@mcthaydt/automata-content': patch
'@mcthaydt/automata-host': patch
'@mcthaydt/automata-ship': patch
'@mcthaydt/automata-testing': patch
'@mcthaydt/automata-ui': patch
---

Bundle Ruken's packages from RukenApp `d0fa2fe` instead of `b30d31b` (`VENDORED.md` names the commit and hashes). Every bundled Ruken package now declares `zod` 4.6.6, so nothing in AF installs 4.6.5 (GHSA-mrhx-c7xc-m3w5). The SDK also trusts Ruken's private beta sites as hosts, and Ruken's host now answers `Hosting.leaderboards.get` with the player's own entry only; the call is unchanged.
