# Build audit: every editor free on the web (#532)

Audited 2026-11-08 on `claude/project-thread-szjdbh` at `829039d5` (stacked on #522). The Owner's rules checked: every
editor is free on the web, nothing is marked "Not in this build", and the app never names FigureBuilder or
EnvironmentBuilder. Copy and UX were judged with the drunk grandma test. Pictures are in the project's shared folder,
`every-editor-free-audit/`.

## Verdict

The change does what it says. The try-it page shows all ten editors, keeps every edit through a reload and a closed and
reopened browser, and opens under the site's real security policy. `automata editor` serves the same page to every game.
A 2D and a 3D game made in the editors play with the changes in them. Merge it after H1 and H2 are fixed. H3 and H4 need
a check on a real GPU before anyone decides. The rest can follow.

## What was run

| Check | Result |
| --- | --- |
| Unit tests: `-tools`, `editors`, `editor`, `editor-3d`, `site` (after `pnpm build`) | 840, 644, 3225, 2235 and 341 pass |
| `pnpm lint`, `boundaries`, `style`, `knip`, `source-names` | green (lint: warnings only) |
| `complete-game-2d` and `complete-game-3d` at iPad size, Chromium | 11 pass; the floor material and 3D Publish fail as marked (`test.fail`) |
| Try-it page (the built page served alone, Chromium, 1180 x 820) | all 10 editors on the rail; no "Not in this build" |
| Try-it, an edit in each of Feel, Audio, Writer, Sequence, Schematic, Characters 3D and a new Levels 2D level, then reload | every edit there |
| Try-it, the same after the browser was closed and opened again (persistent profile) | every edit there |
| Try-it under the site's `DEMO_POLICY` header (no eval) | every editor opens; no policy error |
| Try-it at phone size (iPhone 13) | tab bar with More; no sideways scroll |
| Hands-on: `automata create-game` (2D), `automata editor` (the default page, no `--app-dir`), edit Writer, Feel and Audio, Play | the files change on disk; the keeper says the new words in play (`real-play.png`) |
| Hands-on: the same game reloaded, then the browser closed and opened again | Writer, Feel and Audio edits there |

Not run: WebKit, Firefox, the GPU runner, hosted CI, the phone-size journeys, `site/tests/e2e/editor-try.e2e.ts` (needs the
full site build) and `pnpm check:changesets` (red on #522's `stage-characters-3d.md`). Saving typed words is being fixed in
the "Build saving and GitHub sign-in" thread; the Writer edits here saved in Chromium.

## Findings

### High

**H1. The docs, the command and a changeset still say the opposite.** A person reading them is told a game gets only the
editors its list names, and a release gets 2D only.
- `docs/guides/editor.md:16,21-24`: "the editors your game needs", "`content/editors.toml` decides which editors open", and
  "a release of the tools has the 2D editors only and says so".
- `packages/tools/src/features/editor/editor-args.ts:6`: `--app`'s message says "automata editor picks the editors your
  game needs".
- `.changeset/one-editor-page.md` (from #522, not on `main`): "A 2D game opens Levels and the Tuner". It and
  `every-editor-everywhere.md` would both go into the 0.1.0 changelog.

Fix: rewrite the guide's "Open it" section, the `--app` message and its two tests. Delete `one-editor-page.md` or fold it
into the new changeset.

**H2. FigureBuilder is named in what the free page ships.** The sample now carries the 3D sample's files. Fifteen of them
start with a provenance comment such as `# bounce from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/library/gaits.json`
(`packages/editor-3d/src/app/suite/sample-3d/content/figure-{gaits,stands,swatches}/`). The words are in the public bundle
(`extensions/editors/dist/suite/assets/suite-*.js`), in every visitor's browser storage, and in `@automata/tools` once it
is published. No screen showed them in this audit (the Studio does not show comments), but view-source does, and they
name a private repository. Fix: keep provenance in a sources file that is not shipped, and strip the comments from the
copies the sample imports. A unit test can scan the built page for both names.

### Needs a real GPU (seen in Chromium with software WebGL)

**H3. After both 3D editors, a new 2D level does not draw.** On the try-it page, open Levels 3D, then Characters 3D, then
Levels 2D, then Platformer: the canvas says "Preview unavailable" (`data-state="unavailable"`), 3 runs in 3
(`l2d-a.png`). Levels 3D alone or Characters 3D alone before it is fine. This order is only possible on the page with
every editor, so it is new for visitors. If a GPU shows the same, the 3D editors are holding WebGL contexts after you
leave them.

**H4. Going back and forth to Characters 3D freezes the tab.** Characters 3D, then the Tuner, four times: the page stops
answering for longer than 60 s (3 runs in 3). The 3D-only page on #522 does the same (2 in 2), so this PR did not cause
it, but it is now on the free page. Once, after quick edits, the page also threw an uncaught `StorageError` (a read of a
file that was not there) as Characters 3D opened; it did not happen again.

### Medium

**M1. Characters 2D asks for a level.** On the try-it page with no 2D level yet, Characters 2D opens the "New level" picker
with no word of why ([tab-Characters-2D.png]). A grandma pressed Characters, not Levels. The picker's own heading
"New level" is dark grey on the dark stage and can hardly be read (in Levels 2D too). Fix: Characters 2D says "Make a level
first" with one button to Levels 2D, or the sample ships a small 2D level.

**M2. Two rail buttons both read "Characters …".** At tablet and desktop width the rail cuts "Characters 2D" and
"Characters 3D" to the same "Characters …" (`home.png`). Only the try-it page shows both, because only its sample names
both kinds. Fix: shorter labels (for example "People 2D"), or a rail wide enough for them. The phone's tab bar is fine.

**M3. The Tuner has nothing to try.** The sample's tuning is `[player] speed = 6.5`, a table, so the Tuner says "A table or
a list: change it in the file." ([tab-Tuner.png]). The sample text was already like this, but this is now the only free
try-it. Fix: a flat `speed = 6.5` and `jump = …` in the sample.

**M4. Elsewhere, the site still says it is a level editor.** `site/src/features/home/Home.svelte:92` ("The level editor
runs in the browser"), `site/src/features/start/start-content.ts:25`, and the Editor page's three pictures and their alt
text (`editor-content.ts`), which all show the 2D level editor. The Editor page links "Draw levels in the editor" for more.
The PR body already names the site stack (#517 and later) for the try-it words.

**M5. Two pages nothing serves any more.** `packages/editor` and `packages/editor-3d` still build their own suite pages, and
their `vite.config.ts` comments say `automata editor` serves them. Two journeys,
`suite-runs-where-the-site-puts-it` and `share-leaves-the-browser`, still test `packages/editor/dist/suite`, which is no
longer the page the site puts at `/editor/app/`. Fix: point those journeys at `extensions/editors/dist/suite`, and fix
the comments. Keeping or dropping the two pages is a separate decision.

**M6. Nothing but a note stops a publish.** `-tools` now packs a page that carries the `@pixi/3d` closed beta. Its terms
allow no public deployment, and the PR relies on "do not publish before `@pixi/3d` is public". Fix: have
`release-checks.yml` or `copy-editor.ts` refuse while `@pixi/3d` resolves to the vendored beta tarball. The same check
would guard the site deploy.

### Low

- **L1.** Home lists Writer's two files as "Shop" and "Shop" (`lines/shop.toml`, `dialogue/shop.toml`). A grandma cannot
  tell which is which.
- **L2.** At 1180 px the Levels 3D tool bar cuts its last tool to "Th…" (`levels3d-3d.png`).
- **L3.** Characters 2D's right panel wraps the Width and Height "+" buttons onto their own lines at 1180 px.
- **L4.** The try-it page asks for `/api/ping` and logs a 404 in the console on every open. It is expected (no server
  means the sample), but a visitor who opens the console sees an error.

## Checked and fine

- Every editor is on the try-it rail and on `automata editor`'s page for each kind of game (a 2D game: Tuner, Levels,
  Characters, Feel, Audio, Writer, Sequence, Schematic). Nothing says "Not in this build", "Plus" or "not in this release".
- No screen in the app names FigureBuilder or EnvironmentBuilder (H2 is about the shipped files, not the screens).
- `openSuitePorts`' `kept` flag: false only when the browser has no private storage, and the banner then says "Your
  changes are lost when you close this page." A visitor who kept the old 2D sample gets the new list and the missing
  files, and keeps their own files (`samplePorts`).
- `editor-command.ts` without `page-for.ts` is simpler, and a missing build says what to run, in and outside the repository.
