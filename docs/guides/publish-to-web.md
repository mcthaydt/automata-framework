# Publish to the web

Run `pnpm build:web && pnpm prepare:web`, then upload everything in the `dist` folder to any web host. That's it.

A game built for `web` is a plain website: the `dist` folder holds all of it. Saves stay in the player's browser;
when the browser blocks storage, the game still runs and its paused screen says progress won't be kept.

## Build

```sh
pnpm build:web && pnpm prepare:web
```

`vite build --mode web` bundles the web host adapter and no other (no Ruken or Tauri code). The build uses relative
paths (`base: './'`), so `dist/` works from any folder of a site. `prepare:web` checks the build for what no public
host accepts: secrets, assets inlined as `data:` URLs, code that needs `eval`, the private Pixi 3D beta and paths that
start with `/`. It changes nothing in `dist/`.

## Publish

When `prepare:web` passes, upload the contents of `dist/` to your host. A game made with `create-game` also builds
itself on GitHub when you push a version tag (`git tag v0.2.0 && git push origin v0.2.0`): its
`.github/workflows/release.yml` runs `pnpm check` and `pnpm build:web`, and keeps `dist/` with the run as the `web`
download. Serve it over HTTPS with a Content-Security-Policy that allows no
`eval` (the game needs none). Nothing else is required: the web target has no account, key or manifest.

## Check before you publish

- `pnpm exec vite preview --mode web` serves the build locally.
- `automata check` runs the game's checks, including the no-eval scan of the bundle.
