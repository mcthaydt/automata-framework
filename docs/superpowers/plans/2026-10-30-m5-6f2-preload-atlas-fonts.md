# M5.6F.2 Atlas pages and font subsets in the generated preload list: TDD plan

- **Task:** M5.6F.2 in [02](../../02-master-delivery-plan.md) (lane content, size S), found in M5.6. M5 spec [§4.7](../specs/2026-10-16-m5-saves-audio-design.md): "Atlas and font outputs join the generated preload list when their screen is preloaded."
- **Depends on:** M5.6 ([plan](2026-10-17-m5-6-atlases.md): `<atlas>-<page>.png` and `.json`, `content/atlases.toml`) and M5.5 ([plan](2026-10-18-m5-5-fonts.md): `<font>-<locale>-<hash8>.woff2`, `fonts.json`, `content/fonts.toml`), both merged. Not M5.6F.1 (the Vite build hook), which this task does not touch.
- **Status:** drafted 2026-10-30 from `main` `30e9606c`.
- **Progress:** 2 of 5 steps.

## What exists

- `packages/content/src/preload/preload-list.ts` (106 lines): `preloadList({ options, distDir })` compiles the content, takes `game.toml`'s `preload_screens` (default the flow's entry) and lists each screen's `files` from `assets.toml` in order, each once. Every file must be in `distDir` (a `dir/*` entry needs its folder); each missing one is a `missingAsset` diagnostic at its `screens.<screen>.files.<i>` key, all at once.
- `assets.toml` (`assetsSchema` in `game/game-facts.ts`) holds only `files` per screen, a strict object. So today a game lists an atlas's JSON and each subset `fonts.json` names in its screen's `files` by hand.
- `automata-content assets` (`cli/run-cli.ts` `writeAssets`) writes `buildAtlases`' files to `<outDir>/atlases/` and `buildFonts`' to `<outDir>/fonts/`, with the folder names written out as literals. `buildAtlases` names a page `<atlas>-<page>.png` and `<atlas>-<page>.json` (`packAtlas`). `buildFonts` writes `fonts.json` as `{ "<font>": { "<locale>": "<file>" } }` with canonical text; nothing reads it back yet, so it has no schema.
- `atlasesSchema` (`assets/atlases.schema.ts`) and `fontsSchema` (`assets/fonts.schema.ts`) parse `content/atlases.toml` and `content/fonts.toml`.

## Decisions (each open to the Owner's veto)

- **A screen names the atlases and fonts it uses in `assets.toml`**, by their names in `atlases.toml` and `fonts.toml`:

  ```toml
  [screens.Splash]
  files = ["art/splash.png"]
  atlases = ["wick"]     # optional: atlases from content/atlases.toml
  fonts = ["pixel"]      # optional: fonts from content/fonts.toml
  ```

  Both keys are optional, so every existing `assets.toml` compiles to the same bytes and the same content hash. The runtime's `Assets.load(screen)` still fetches `files` only (see Follow-ups).
- **Where the outputs are in the build:** at `atlases/<file>` and `fonts/<file>`, the same folders `automata-content assets` writes under `outDir`. M5.6F.1's build hook is to put them there. The folder names, the page file names and the `fonts.json` name get one owner, `assets/asset-outputs.ts`, which the CLI, the atlas build, the font build and the preload list all use.
- **What joins the list:** for each atlas, page by page, its Spritesheet JSON and then its image (Pixi loads the JSON, then the image it names). For each font, every language's subset `fonts.json` names, in code-unit order of the language: the preload list is fixed, so it cannot know the player's language. The order within a screen is its `files`, then its atlases, then its fonts, in the order written; a file listed twice keeps its first place, as before.
- **What the list is built from:** the asset build's committed outputs in `<root>/<outDir>/atlases/` and `<root>/<outDir>/fonts/fonts.json` say which files exist; each must then be in `distDir`. Reading the outputs, rather than running the atlas and font builds again, keeps the preload list as cheap as it is; M5.6F.1 makes stale outputs fail `check --verify-artifact`.
- **Diagnostics,** in the content package's style, all at once and each at the screen's `screens.<screen>.atlases.<i>` or `fonts.<i>` key in `content/assets.toml`:
  - a name not in `atlases.toml` or `fonts.toml`: `unknownReference` (`wick is not an atlas in content/atlases.toml`);
  - a named atlas with no pages in `<outDir>/atlases`, or a font `fonts.json` does not list: `missingAsset` (`… run automata-content assets`);
  - a page or subset missing from the build: `missingAsset` (`atlases/wick-0.png is not in the build`), as for `files`;
  - a broken `atlases.toml` or `fonts.toml`: its own parse diagnostics; a `fonts.json` that is not the asset build's shape: `invalidAsset` at that file.

  Nothing is read for atlases or fonts unless a preloaded screen names one, so a game that names none behaves exactly as before.
- **`fonts.json`'s schema** (`fontFilesSchema`, type `FontFiles`) goes beside `fontsSchema` in `assets/fonts.schema.ts`, the reader of the shape `buildFonts` writes; an end-to-end test reads the real build's output with it. `build-fonts.ts` changes only to take the file name from `asset-outputs.ts` (M5.5F's lane works in the same file on the subset's characters; the change is one line).
- **Changeset:** a patch for `@mcthaydt/automata-content` (published). `AssetsSource` gains two optional fields (additive).

## Files

- **Create:** `packages/content/src/assets/asset-outputs.ts`; `packages/content/src/preload/asset-build-files.ts` (reads `atlases.toml`, `fonts.toml` and the outputs, and resolves a screen's names to build paths; keeps `preload-list.ts` small); `.changeset/m5-6f2-preload-atlas-fonts.md`; this plan.
- **Modify:** `packages/content/src/game/game-facts.ts` (`assetsSchema`, `AssetsSource`), `game/game-facts.test.ts`; `packages/content/src/assets/fonts.schema.ts` (`fontFilesSchema`, `FontFiles`), `assets/fonts.schema.test.ts`; `packages/content/src/assets/build-atlases.ts`, `assets/build-fonts.ts`, `cli/run-cli.ts` (the names from `asset-outputs.ts`; behaviour unchanged, their tests unchanged); `packages/content/src/preload/preload-list.ts`, `preload/preload-list.test.ts`; the M5 spec §4.7 (one bullet saying how a screen names them); the regenerated `tooling/api-report/reports/content.api.md`, `docs/cheatsheet.md`, `agents/automata/skills/automata-api/reference/api.md` as the tools write them.
- **Not touched:** `packages/content/src/vite/` (M5.6F.1); `packages/runtime`; 00 to 04 and AGENTS.md (the integration owner's).

## Interfaces

- **Consumed:** `atlasesSchema`, `fontsSchema`, `parseDocument`, `locateKeys`/`positionOf`, `listFiles`, `readTextIfPresent`, `pathKind`, `outDirOf`, `compileContent`; in tests, `buildAtlases`, `buildFonts`, `encodePng`, `parseManifest` (`@ruken/manifest`).
- **Produced:**
  - `AssetsSource.screens[screen].atlases?: readonly string[]` and `.fonts?: readonly string[]` (public, additive);
  - `assets/asset-outputs.ts` (internal): `ATLASES_FOLDER = 'atlases'`, `FONTS_FOLDER = 'fonts'`, `FONT_FILES = 'fonts.json'`, `atlasPageFiles(atlas, page): { json, image }`;
  - `assets/fonts.schema.ts` (internal): `FontFiles`, `fontFilesSchema`;
  - `preloadList`: same signature; its list and diagnostics now include atlases and fonts.

## Steps

Each step starts with its test, run red, with the failure reason recorded. The pre-commit hook runs the affected tests, so each red test is committed with its fix.

- [x] **1. This plan.** *Verify:* `pnpm format`.
- [x] **2. `assets.toml` names a screen's atlases and fonts** (`game-facts.test.ts`; `game-facts.ts`).
  - *Red:* `assetsSchema` accepts a screen with `atlases = ["wick"]` and `fonts = ["pixel"]`; one without them parses to the same value as before (no new keys); a non-list `atlases` is refused.
  - *Expected failure:* the strict object refuses the unknown keys `atlases` and `fonts`.
  - *Verify:* `pnpm --filter @mcthaydt/automata-content exec vitest run --project node src/game`.
- [ ] **3. One owner for the output layout and the `fonts.json` schema** (`fonts.schema.test.ts`; `asset-outputs.ts`, `fonts.schema.ts`, `build-atlases.ts`, `build-fonts.ts`, `run-cli.ts`).
  - *Red:* `fontFilesSchema` accepts `{ "pixel": { "en": "pixel-en-0123abcd.woff2" } }` and refuses a file that is not a string.
  - *Expected failure:* `fontFilesSchema` is not exported.
  - *Then:* the CLI, `buildAtlases` and `buildFonts` take their names from `asset-outputs.ts`; their existing tests pass unchanged.
  - *Verify:* `pnpm --filter @mcthaydt/automata-content exec vitest run --project node src/assets src/cli`.
- [ ] **4. The preload list adds a preloaded screen's atlas pages and font subsets** (`preload-list.test.ts`; `asset-build-files.ts`, `preload-list.ts`).
  - *Red, by case:*
    - a preloaded screen naming a two-page atlas gets `atlases/wick-0.json`, `atlases/wick-0.png`, `atlases/wick-1.json`, `atlases/wick-1.png` after its files, and a second screen naming the same atlas adds nothing;
    - a preloaded screen naming a font gets `fonts/<file>` for each language `fonts.json` lists, in language order;
    - a screen that is not preloaded adds nothing, and nothing is read for it;
    - every page and subset missing from the build is reported at once, at its screen's `atlases.<i>` or `fonts.<i>` key;
    - an atlas or font not declared is `unknownReference`; one declared but not built is `missingAsset` saying to run `automata-content assets`;
    - a broken `fonts.toml` reports its own diagnostics; a `fonts.json` of the wrong shape is `invalidAsset`;
    - **end to end:** the real `buildAtlases` and `buildFonts` outputs, written where `automata-content assets` writes them and copied into a build, are all listed, and Ruken's `parseManifest` accepts the list as `[loading] preload`.
  - *Expected failure:* the list holds only the screens' `files`.
  - *Verify:* `pnpm --filter @mcthaydt/automata-content exec vitest run --project node src/preload`.
- [ ] **5. Spec note, reports, changeset, gates and records.**
  - *Spec:* M5 spec §4.7 says how a screen names its atlases and fonts and where the outputs sit in the build.
  - *Regenerate,* in order: `pnpm build`, `pnpm api-report --update`, `pnpm api-index` (`pnpm cheatsheet` when it says stale), `pnpm agent-skills --write`.
  - *Changeset:* a content patch; `pnpm changeset status --since=origin/main`, `node tooling/release/src/check-changesets.ts`.
  - *Gates:* `pnpm format`, `TURBO_FORCE=true pnpm check`.
  - *Records:* this plan's progress and log. 02 and 03 are the integration owner's.

## Gates

- **Selected:** focused content tests while iterating; `pnpm format`; `TURBO_FORCE=true pnpm check`; `pnpm build`, `pnpm api-report`, `pnpm api-index`, `pnpm agent-skills`; `changeset status`, `check-changesets`.
- **Omitted:** parity (no sim, renderer, ui or golden change, and the content hash of every existing `assets.toml` is unchanged: step 2's "same value" case), e2e, examples and demo builds, consumer smoke (no build-config change).
- **Pending:** the Mac's CI.

## Follow-ups (for 02, by the integration owner)

- **Runtime:** `Assets.load(screen)` fetches only `files`, so outside Ruken a screen's atlases and fonts load when the game asks for them, not behind the loader. The runtime spec (§3.4) says boot loads "the same list content generates as `[loading] preload`"; with this change that holds for `files` only. Closing it needs the resolved names at run time (for example in the compiled `assets.json`), a runtime-lane change.
- **Check time:** an unknown atlas or font name in `assets.toml` is reported by the preload list (ship time), not by `automata-content check`; the compile does not read `atlases.toml` or `fonts.toml`. M5.6F.1 brings the asset build into the compile's build hook, where the reference check can move.
- **M5.6F.1** must serve the outputs at `atlases/` and `fonts/` in the build (the layout `asset-outputs.ts` names).

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-30 | 1 | `656ceeba` | Plan, from `main` `30e9606c`. |
| 2026-10-30 | 2 | this commit | Red as expected: 1 of 12 in `game-facts.test.ts`, `unrecognized_keys` `atlases`, `fonts` at `screens.Splash` (the refusal case already passed, then for the unknown keys; it passes after the change for the list type). Green: `atlases` and `fonts` are `z.optional` lists, 17 of 17 in `src/game`; a screen without them parses with the single key `files`. `tsc -p .` clean. |
