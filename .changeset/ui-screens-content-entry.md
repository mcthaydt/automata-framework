---
'@automata/ui-screens': patch
---
`@automata/ui-screens/content` gives the `credits` content kind and its schema with no Svelte in it, so a game's Vite config (which runs under Node) can register the kind; before, `creditsContent` was exported only from `@automata/ui-screens/credits`, beside the panel, which Node cannot load. `@automata/ui-screens/credits` still exports it.
