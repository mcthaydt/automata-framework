// Must be a game's first import: PixiJS's no-eval shims, so nothing reaches for `eval` under Ruken's CSP
// (AGENTS.md, ADR 0002). The game package's entry, unchanged.
import '@mcthaydt/automata-game/no-eval'
