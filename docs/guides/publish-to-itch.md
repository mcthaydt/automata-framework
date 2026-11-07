# Publish to itch.io

itch.io runs the web build in its HTML5 player, so a game built for `itch` uses the web host adapter. ship packages
the build as the zip itch.io accepts and pushes it with butler.

## Set up once

1. Create the game's page on itch.io, with "Kind of project" set to HTML.
2. In `ship.config.ts`, set the project butler names (`user/game`, lower case). `create-game` writes a placeholder
   that you replace:

   ```ts
   itch: { project: 'your-itch-user/my-game', channel: 'html5' },
   ```

3. Install [butler](https://itch.io/docs/butler/), run `butler login` once, and keep the key it stores as the
   `BUTLER_API_KEY` secret wherever you publish from.

## Build and package

```sh
pnpm build:itch && pnpm prepare:itch
```

`prepare --target itch` checks the build against itch.io's limits (at most 1,000 files, file sizes, path length, file-name case) and writes
`<id>-<version>-itch.zip` beside `dist/`.

## Publish

```sh
BUTLER_API_KEY=… pnpm exec automata ship publish --target itch
```

This runs the itch packaging again, then `butler push` to the `html5` channel (or `itch.channel`).

## Publish from GitHub

A game made with `create-game` for itch.io has `.github/workflows/release.yml`. Add the key as a repository secret
named `BUTLER_API_KEY`, set `version` in `package.json`, and push a tag:

```sh
git tag v0.2.0 && git push origin v0.2.0
```

The workflow checks the game (`pnpm check`), builds it and pushes it to itch.io. Until the secret is there, it builds
and says that nothing was published. The part that publishes:

```yaml
- name: Publish to itch.io
  if: steps.key.outputs.present == 'true'
  env:
    BUTLER_API_KEY: ${{ secrets.BUTLER_API_KEY }}
    TAG: ${{ github.ref_name }}
  run: pnpm exec automata ship publish --target itch --tag "$TAG"
```

To push the desktop bundles to itch.io's downloads as well, see [Publish to desktop](publish-to-desktop.md).
