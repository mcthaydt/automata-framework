# Fixes: every editor free on the web (#532 build audit)

Done 2026-11-09 on a branch stacked on #545, which holds the build audit
(`2026-11-08-every-editor-free-build-audit.md`). Each finding below says what was done and what proves it.

| Finding | Done | Proof |
| --- | --- | --- |
| H1 guide, `--app` message, changesets | `docs/guides/editor.md` says every game gets one page with every editor; `--app` says "automata editor opens every editor."; `one-editor-page.md` is deleted and `every-editor-page.md` lost its stale first sentence. A new changeset covers the rest. | `editor-args` and `editor-command` tests |
| H2 FigureBuilder in shipped samples | The 15 provenance comments and the internal spec and path notes are gone from `packages/editor-3d/src/app/suite/sample-3d/**`; five source comments and one test name in editor-3d lost their source names. `pnpm source-names` now reads `packages/editor`, `packages/editor-3d` and `extensions/editors` too, so the names cannot return there. | `source-names: 0 findings`; the built page (`extensions/editors/dist`) has neither name |
| H3 "Preview unavailable" after both 3D editors | Root cause: the Pixi 3D beta checks, as it loads, that its own textures took the third texture id on the page. It loaded when the Studio first opened, so after Levels 3D had drawn it threw, and the Studio ("needs WebGL2") or the next 2D level failed. The suite pages now load it before anything draws (`pixi-3d-first.ts`). | `tests/browser/canvas/app/pixi-3d-first.test.ts` (fails without the call, with "NORMAL_MAP.source.uid is not 2"); Levels 3D, Characters 3D, Levels 2D in Chromium |
| H4 Characters 3D freezes the tab | Root cause: the Studio's renderer effect read its factory and colour from props the suite re-derives as editors open, so it re-ran, destroyed the renderer (which loses the canvas's WebGL context for good) and made a second one on the same canvas. Pixi 8.22's `checkMaxIfStatementsInShader` loops forever on a lost context. The factory and colour are read untracked, and Try again now draws on a new canvas. | `studio-ui.test.ts` ("keeps its renderer…"); Characters 3D and the Tuner six times over, no hang |
| M1 Characters 2D asks for a level | With no level it says "Make a level first. Characters live in a level. Pick a starting point and its characters show up here." above the same starting points. The words on the dark canvas now use the stage ink (they were dark grey on dark). | `Suite-levels.test.ts`; screenshot |
| M2 two "Characters …" buttons | In the column a long name goes onto a second line ("Characters" over "2D") instead of being cut. | `rail-phone.test.ts` (fails with 73 px of text in a 67 px box before) |
| M3 Tuner has nothing to try | The sample's tuning is two sliders, "Walking speed" and "Jump height", in one `SAMPLE_TUNING` all three sample pages share. The Tuner's "your game shows here" note is readable. | `sample-tuning.test.ts`; screenshot |

## Stage 2: the rest of the audit

| Finding | Done | Proof |
| --- | --- | --- |
| M4 the site says "level editor" | The Editor page now shows five real pictures: the home with a card for every editor, and Characters 3D, besides the three of the level editor. Home, Start and the page's words are left to the site rewrite (#542), so the two do not collide. | `editor-page.test.ts` (five figures, each a real file) |
| M5 two journeys read the wrong build | `suite-runs-where-the-site-puts-it` and `share-leaves-the-browser` serve `extensions/editors/dist/suite`, the page the site and `automata editor` serve. The `vite.config.ts` comments of `editor` and `editor-3d` now say their pages are for developing those editors. | both journeys pass against the full page (iPad, Chromium) |
| M6 nothing blocks publishing | `pnpm release` runs `tooling/release/src/check-pixi3d-public.ts` first. While `@automata/tools` is published and any package takes `@pixi/3d` from `vendor/pixi-3d`, it exits 1 and names those packages. Moving them to the registry's release lifts it; there is no flag. | `pixi3d-publish-block.test.ts`; run on the repository today it refuses and lists `3d`, `editor-3d`, `world-kit`, `base-3d`. The site deploy (`site.yml`, once its host token is set) runs the same check before it installs or builds, so it is blocked too (the Owner, 2026-11-09: "block deploy until pixi3D is live"). |
| L1 two Writer files, one name | A card lists files by title, and two files with the same title show their folder in brackets ("Shop (dialogue)", "Shop (lines)"). | `home-model.test.ts` (`fileTitles`); screenshot of the home |
| L2 Levels 3D cuts "Thing" | The tool rail kept sharing the top bar's free space with the spacer, so at 1180 px it had 360 px of the 453 it needs. A horizontal rail now keeps its width. | `suite-tools.test.ts` (fails at 1133, 1194 and 1366 before, passes after) |
| L3 Characters 2D "+" wraps | Under touch the stepper (label, minus, number, plus) was 5 px wider than the inspector, so "+" dropped to a second line. The number box is 4 rem, not 5. | `suite-levels.test.ts` and `entities-view.test.ts`, touch project (failed with a 48 px drop before) |
| L4 | Not fixed, see below. | |

`extensions/character-kit` and `extensions/world-kit` no longer name FigureBuilder or EnvironmentBuilder in any source
comment or README line, and `pnpm source-names --code` now reads `extensions` and `games/base-3d` too.

## Not changed

L4: the try-it page's "ping" probe asks the site for `/api/ping`, which only exists when the editor is served by
`automata editor`; on the static site it falls through to a 404 the page then reads as "no game". Fixing it needs a
static `/api/ping` file at the root of the site host, which is the deploy's, not this repository's. `check-changesets` still fails on `stage-characters-3d.md` (#522's file). The flaky
`serve-editor` mtime test fails here on the base branch too.

## What was run

Unit: `-tools` 840 of 841 (the flaky test), `editor` 3229, `editor-3d` 2236, `editors` 644, `repo-hygiene` 119. Chromium
layout for the editor suite shell, and canvas and layout for `editor-3d`. `lint`, `typecheck`, `boundaries`, `style`,
`source-names`, `knip` green. The complete-game 2D and 3D journeys at iPad size, Chromium: 11 pass (the floor material
and 3D Publish fail as marked). Hands-on, the try-it page in a persistent Chromium profile: a new Platformer level and a
changed walking speed, then a reload, then the browser closed and opened again; both edits were there each time. Hands-on,
`automata editor` on `examples/2d-story`: a Writer edit reached the file on disk and the game's generated content, and
was there after a reload and a new browser. Stage 2: the same edit, then the game's page, ArrowRight to the keeper, and his box read 'Welcome, traveller, mind the gate.' in place of the old line. Not run: WebKit, Firefox, the GPU
runner, hosted CI. H3 and H4 were reproduced and fixed with Chromium's software GL here; a real GPU may behave differently.
