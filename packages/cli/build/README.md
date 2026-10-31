# Build

`pnpm dev` runs the game in the browser.

## Building

Each target builds on its own, with its own host adapter:

- The web: `pnpm build:web`
- itch.io: `pnpm build:itch && pnpm prepare:itch`
- Ruken: `pnpm build:ruken && pnpm prepare:ruken`
- Desktop (Tauri): `pnpm build:tauri && pnpm prepare:tauri`

Publishing to each target is described in the Automata Framework guides (`docs/guides/publish-to-*.md`).
