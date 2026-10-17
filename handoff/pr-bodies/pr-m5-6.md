## Summary

M5.6 atlas packing and the palette check ([plan](docs/superpowers/plans/2026-10-17-m5-6-atlases.md); M5 spec §4.7 Atlases, §6, M5-D8; acceptance G-c, G-d). Branched from `main`; the first commit is the TDD plan, with the M5.1–M5.8 rows in 02 and two follow-up rows.

- **Packer (`content/src/assets/atlas-pack.ts`):** a deterministic shelf packer. Inputs are sorted, padding is fixed, and pages are power-of-two, at most 2048. A frame too large for a page is `AtlasFrameTooLarge`.
- **Pages (`atlas-image.ts`):**
  - page composition with edge extrusion;
  - PNG decode and encode through `pngjs`, with fixed options, so the same pixels give the same bytes (G-c);
  - Pixi `Spritesheet` JSON.
- **Palette check (`palette-pixels.ts`):** FloorFifty's `offPalettePixels` rule at `ac72660`: alpha 0 is not checked. AF also names the first stray pixel's position and colour (G-d).
- **Build (`build-atlases.ts`):**
  - reads `content/atlases.toml`;
  - each atlas's folder of PNG frames is packed into `<atlas>-<page>.png` and `.json`;
  - every problem is a diagnostic: `invalidAsset`, `offPalette` (only when the game declares `content/palette.toml`) and `missingAsset`.
- **CLI:** `automata-content assets` writes the atlases to `<outDir>/atlases`.
- **Render:** `sprite(url, { frame })` in render-pixi shows one named frame of a packed atlas. A missing frame, or `frame` combined with `frames`, is a reported error.
- **Example:** `textures/textures-atlas.ts` draws two Wick frames from a committed atlas. Its frames were cut from `wick-run.png`, with provenance. A test in `packages/content` checks that a fresh build matches the committed atlas. A new golden, `textures-atlas.replay`, is recorded.
- **Exports:**
  - the `@mcthaydt/automata-content/assets` subpath, kept out of the root entry so `pngjs` stays out of browser graphs;
  - the publish exports and the tsdown entry;
  - the reports, cheatsheet, API index and skill `api.md`.
- **Changeset:** content patch.
- **Pins:** `pngjs` 7.0.0 and `@types/pngjs` 6.0.5, FloorFifty's versions, recorded in `docs/versions.md`.

**For review (deviations in the plan):**
- the example's atlas outputs live in `examples/public/textures/atlas/`, not `resources/atlases`: Vite would inline and hash a JSON referenced by URL;
- the freshness test is in `packages/content`, since the catalog treats every `.ts` in an example folder as an example;
- the palette check applies only when `palette.toml` is declared: Endesga 64 is the renderer's default, not an authoring rule.

Follow-ups added to 02: atlases in the content Vite plugin's build hook, and atlas outputs in the generated preload list.

## Gates (local, `TURBO_FORCE=true`)

| Gate | Result |
|---|---|
| `pnpm format` | clean |
| `pnpm check` | first attempt failed: `tooling/versions` found the `pngjs` pins unrecorded. Fixed in `0ef65f1`, then 30 of 30. |
| CI extras (`pnpm build`, `api-index`, `build:examples`, changesets) | 11 of 11, first attempt |
| `pnpm test:parity` | 11 of 11, first attempt. The new golden replays in Chromium, WebKit and Firefox; no existing golden changed. |
| `CI=1 pnpm test:e2e` (selected: render-pixi and an example changed) | 74 passed, 2 skipped |
| `prepare-ruken` (placeholder, Emberwick) | passed |

Omitted: none. Pending: hosted CI on this head.

**Owner acceptance:** how the example looks.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01QQDa25MEpciFkK7k5UV2dC
