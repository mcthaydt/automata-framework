---
'@mcthaydt/automata-content': patch
---

The `paraglide` option compiles a game's catalogs when the game builds with `vite build --configLoader runner`: Paraglide is loaded with Node's own `require` instead of `import()`, which Vite's module runner rewrites and has closed by the time the content compiles ("Vite module runner has been closed").
