---
"@automataframework/automata-content": patch
---

The Vite plugin watches the game's `content/` folder even when it is outside Vite's root, so a save there (a game
served from its checkout with its content in another folder) still rebuilds the content and updates the page.
