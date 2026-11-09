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

## Not changed

M4 (the site still says "level editor"), M5 (two journeys still read `packages/editor/dist/suite`), M6 (nothing blocks
publishing `-tools` while `@pixi/3d` is the beta) and L1-L4 are not in this stage's brief. `check-changesets` still fails
on `stage-characters-3d.md` ("@automata/3d is not a published package"), which is #522's file. The flaky
`serve-editor` mtime test fails here on the base branch too. The extensions `character-kit` and `world-kit` still name the
two projects in source comments; they are not part of the page, but they publish, so they need the same pass.

## What was run

Unit: `-tools` 840 of 841 (the flaky test), `editor` 3229, `editor-3d` 2236, `editors` 644, `repo-hygiene` 119. Chromium
layout for the editor suite shell, and canvas and layout for `editor-3d`. `lint`, `typecheck`, `boundaries`, `style`,
`source-names`, `knip` green. The complete-game 2D and 3D journeys at iPad size, Chromium: 11 pass (the floor material
and 3D Publish fail as marked). Hands-on, the try-it page in a persistent Chromium profile: a new Platformer level and a
changed walking speed, then a reload, then the browser closed and opened again; both edits were there each time. Hands-on,
`automata editor` on `examples/2d-story`: a Writer edit reached the file on disk and the game's generated content, and
was there after a reload and a new browser (the keeper was not walked to this time). Not run: WebKit, Firefox, the GPU
runner, hosted CI. H3 and H4 were reproduced and fixed with Chromium's software GL here; a real GPU may behave differently.
