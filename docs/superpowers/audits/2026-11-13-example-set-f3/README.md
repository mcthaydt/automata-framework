# F3: the site can show a 3D example (execution note)

Branch `claude/example-set-f3`, from `claude/example-set-f1` at `ea167e283`. Task F3 of
[the plan](../../plans/2026-11-13-one-example-set.md), plus the one small addition (`pnpm style` scans `examples/set-3d`).
No other task was started. **No page was added to the real site** (`sceneExamples()` is empty on `examples/3d` today):
the page list is the same before and after, see "Page counts". No golden, hash or recorded picture moved, and no
changeset was needed (no published package changed; `@automata/examples-runner` and the site are private).

## What landed

| Part | Where |
|---|---|
| `pnpm style` scans `examples/set-3d` (size and kind rules, plan comments, test imports); the scan found nothing to fix | `package.json`, `tooling/check-style/tests/unit/style-scope.test.ts` |
| `sceneExamples(root, dir?)`: the `scene` module of `examples/3d`, valid, with no unpublished import; `id`, `title`, `shows`, `controls`, `source`, `frameUrl`, an approved `still` | `site/src/shared/framework/examples.ts` |
| The group "One small world, in 3D" (last on the index), `getScenes`/`getScene`, the page route for them, Home's strip, the search menu and the examples count read it | `example-catalog.ts`, `routes/examples/[id]/`, `ExamplesIndex.svelte`, `HomeExamples.svelte`, `CommandMenu.svelte`, `facts.ts`, `virtual:framework/scenes` |
| `SceneFrame.svelte`: a stage, one 48 px **Play**, the frame loads only when it is pressed, one line of what to press under it, difficulty and packages, then the code read-only | `site/src/features/examples/` |
| `buildScenes()` (one `vite build` of the examples folder for the web adapter, copied to `static/scenes/`, pruned to the examples the site shows and the chunks they load) | `site/scripts/build-demos.ts`, `site/scripts/scenes.ts` |
| `/scenes/` gets the demos' whole policy (`DEMO_POLICY`), its own `_headers` rule, and is not counted as a site page | `security-headers.ts`, `write-headers.ts`, `site-checks/pages.ts` |
| A `target: 'web'` option on the examples runner (the default, `ruken`, is unchanged) | `tooling/examples-runner/src/vite-plugin.ts`; `examples/3d/vite.config.ts` reads `AF_EXAMPLES_TARGET` |
| Fixtures: two tiny `scene` files (one public, one importing `@automata/lcd-panel`), a fixture runner config, a stand-in for the private package | `site/tests/fixtures/scene-examples/`, `scene-stand-ins/` |
| The e2e, on a site built from the fixtures: `pnpm --filter @automata/site test:e2e:scenes` (builds `build-scenes/`, then runs `playwright.scenes.config.ts`) | `site/tests/e2e/scene-examples.e2e.ts`, `site/scripts/build-scene-fixture.ts` |

## Rulings

1. **`frameUrl` is `/scenes/scene/<name>/index.html`, not `/scenes/<name>/index.html`.** The runner writes each page at
   `<module>/<name>/` and names its files relative to the page; its plugin's own `base` and `outDir` also win over the
   command line, so the build cannot be moved or re-based, and lifting the folder up one level breaks every asset path.
   Costs, if wrong: one string and the folder's move in `scenes.ts`.
2. **The frame is a web build (`target: 'web'`).** A Ruken build inside a frame waits ten seconds for a handshake the
   site never answers (the reason Emberwick has `WEB_BUILDS`). The plan's "fake host" row reused the demos' way of
   showing a game whole; the way a demo that is a Ruken build avoids that wait is the web adapter. Costs, if wrong: a
   host-shaped frame later (the option stays).
3. **`static/scenes/` is the runner's `dist/`, copied and pruned.** The runner builds every example in the folder, so the
   output also holds the examples the site does not show (the ones importing unpublished packages). `arrangeScenes`
   removes their pages and the chunks only they load, so what is public is what the reader chose. Costs, if wrong: F4
   would serve built code of an example whose imports are private.
4. **Escape hands the keys back to Stop; it does not unload the frame.** Escape is read inside the (same-origin) frame
   and focuses the Stop button; Stop drops the frame and focuses Play. Costs, if wrong: a visitor who wanted the game
   gone presses Stop too.
5. **The e2e has its own config and script.** It needs a second site build (the fixture folder, into `build-scenes/`),
   so the main suite ignores the file and `playwright.scenes.config.ts` runs it. The two names only that build reads are
   `AF_SITE_SCENES_DIR` and `AF_SITE_OUT`. It needs `pnpm build` and the site's build first (the pages link to the
   demos in `static/`).
6. **Difficulty and Packages sit under the frame on a 3D page, and the landscape reorder is off for it.** The pictures
   showed Play below the fold on a phone with five rows above it. Costs, if wrong: the 3D page differs from the 2D ones.
7. **A press on Play before the page is hydrated is kept** (`data-play`, the site's first-press script), found by the e2e
   failing: the page is prerendered, so the button is there before its handler. Unit test and e2e cover it.
8. **`SceneFrame` writes the highlighted line's type itself** because a feature may not import another (`pnpm boundaries`
   caught it); it is the playground's `HighlightedLine` shape.

## What the plan got wrong or left out

- `pnpm build` does not build the site (it is 16 packages, no `site`); the site is `pnpm --filter @automata/site build`,
  and `check:site` reads `site/build`, so "pnpm build && pnpm check:site" checks a missing or stale folder.
- The file list leaves out what a new static folder needs: `security-headers.ts` (without it the frame has the page's
  policy and cannot run), `write-headers.ts`, `site-checks/pages.ts` (or its pages count as site pages), `.gitignore`,
  `biome.json`, `svelte.config.js` (the output folder for the fixture build), `tooling/examples-runner` and
  `examples/3d/vite.config.ts` (the web target), `knip.jsonc`, the new Playwright config.
- "An env var names the fixture folder" is two, because the second build must not write over `build/`.
- The table's branch for F3 (`claude/example-set-site`) is the branch F4 also uses; this one is `claude/example-set-f3`.
- The default shell here has Node 22; the repository needs 24 (`/opt/node24/bin`).

## What the pictures show

Taken by Chromium against the fixture build, `scene-lamp` (a flat 2D stand-in for the room): phone portrait 390 × 844 at
3×, phone landscape 844 × 390 at 3×, desktop 1280 × 800; before Play and after. Files in this folder:
`phone-portrait-*`, `phone-landscape-*`, `desktop-*` with `-before-play.png` and `-after-play.png`. I looked at each.

- **Phone portrait, before:** reads in order: title, the words, the stage with the title and one lime Play (48 px or
  more, in the viewport), the line of what to press, difficulty and packages, then the code. Clean after the fix; the
  first take had the title text behind the button, which the e2e now checks.
- **Phone portrait, after Play:** the stage holds the frame; the frame's own page shows the *game's* title screen with a
  second yellow Play button. **Weak:** two presses to play. The fixture is a plain `defineGame`; a real `scene()` example
  (F4, F5) must start at play, as the playground's `startAtPlay` does, or the page's Play is a decoy.
- **Phone landscape, before:** the header, the title and the words fill the 390 px, so the stage and its Play are below
  the fold: one scroll. **Weak**, and it follows the brief's rule (words above the frame); the 2D pages put the game
  first in this shape. Worth the Owner's eye.
- **Desktop:** the 21 2D examples in the left list push the one 3D example below the fold of the list; the stage is
  16:9 and sits under the words. After Play the frame fills it. No still was tested (the fixtures have none); the still's
  copy into `static/scenes/stills/` has a unit test only.
- Not shown by a picture, so proved by tests instead: focus into the frame and back out, the 48 px box, no sideways scroll.

## Page counts

The real site, before this branch (F1 head, `ea167e283`) and after (this branch's head): **52 HTML files and 51 in the sitemap both times**, and the two lists of built pages (every `.html` outside
`demos/`, `playground/` and `editor/app/`, sorted) are identical (`diff` printed nothing). `build-demos` said `0 3D
examples in static/scenes` after, and has no such field before. The baseline was built in a separate worktree at
`ea167e283` (`pnpm build`, then `pnpm --filter @automata/site build`).

## Gates, as run

| Gate | Result |
|---|---|
| `pnpm format` | ran (Biome; the pre-commit hook ran it and the affected unit tests on each commit) |
| `TURBO_FORCE=true pnpm check` | exit 0: 67 turbo tasks, `boundaries` 0 findings, `style` 0 findings (now with `examples/set-3d`), `knip`, unit tests (the site: 88 files, 533 tests; `@af-examples/set-3d`: 14), `changeset status`, `check-changesets` 0 problems. The first run failed `boundaries` (`SceneFrame` imported from the playground feature); fixed in `b2b52d0f5`, then the whole run again |
| `pnpm build` | exit 0 (16 tasks) |
| the site's build, `pnpm --filter @automata/site build` | exit 0; 52 HTML files, sitemap 51 pages; `0 3D examples in static/scenes` |
| `pnpm --filter @automata/site check:site` | exit 0: "Verified 51 built pages" |
| the site's unit suite | 88 files, 533 passed (inside `pnpm check`, and alone: `pnpm --filter @automata/site test -- scene-examples` runs the whole suite, the filter is not passed through) |
| the site's Chromium e2e, `playwright test --project chromium` against the real build | 509 passed, 13.7 min (the one `✘` is `editor-try.e2e.ts`'s expected failure, marked `fail` in the file) |
| the 3D page's e2e, `scene-examples.e2e.ts`, Chromium, against the fixture build | 8 passed (two sizes, three behaviours each, the copy check, the private example's 404); run again on the final code |
| tests that failed first | `style-scope` (script lacks the folder), `scene-examples` (`sceneExamples` not exported), the catalog and page tests (404, and `ui` sorted after the 3D group), `vite-plugin` (`target` ignored), headers (frame had the page's policy), `scene-build` (module missing), the press-before-hydration pair, `scene-card` (Home throws "the catalogue does not have"); the e2e's two focus tests failed on the lost early press before it was fixed, and its overlap check failed against the first layout |

Left out: the WebKit project of the new e2e (`--project webkit` exists, not run), the site's WebKit project and the
Firefox engine, the 3D browser suites and journeys, the 2D browser suites and parity (nothing in F3 touches a sim, a
package's published code or a picture; they run in the pull request's CI). No pull request was opened. `git status`
shows no recorded file (golden, hash, `screenshots-approved.json`) changed. Not done: a real 3D frame (the fixture is a
2D stand-in); a still (none approved); the 3D page at Lighthouse's budgets.

## For the tracker

Rows for `docs/superpowers/progress.md` and `docs/refactor/progress.md` (neither was edited here):

| Task | State | Evidence |
|---|---|---|
| F3 The site can show a 3D example (mechanism, on fixtures) | done on `claude/example-set-f3`, no pull request; 0 pages added to the real site | commits `02c34bf7a` (reader), `39489a2b1` (runner web target), `ad1011b92` (the page, the build step, headers, e2e), `b2b52d0f5` (boundaries fix); page lists identical at 52 files / 51 sitemap pages; gates above |
| `pnpm style` scans `examples/set-3d` | done on `claude/example-set-f3` | `08396e393`; `style-scope.test.ts` red then green; the scan found nothing to fix |
| Open for F4 | `scene()` examples must start at play (the frame showed the game's own title screen behind the page's Play), and the Owner should look at the phone-landscape picture (Play below the fold) | pictures in this folder |
