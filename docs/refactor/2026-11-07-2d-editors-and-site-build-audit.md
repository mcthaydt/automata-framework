# 2D editors and website refactor: build audit (stage 5)

- **Stage:** 5 of 6 of the "2D editors and website" slice. Stage 6 (fixes, Sonnet high) closes every finding below, in
  section 5's order.
- **Date:** 2026-11-07, on `claude/project-thread-l36s66`, stacked on the build's head: PR #438
  (`claude/refactor-scope`, head `c35a9c06`), itself on #437 and the stack below it.
- **Audited:** the build (65 of 68 tasks) against the [spec](2026-11-06-2d-editors-and-site-spec.md), the
  [plan](2026-11-06-2d-editors-and-site-plan.md) and its execution log, the [plan audit](2026-11-06-2d-editors-and-site-plan-audit.md),
  the approved mockups (shared folder `refactor/2026-11-06-redesign-mockups/`, approved by the Owner 2026-11-06 20:31Z),
  the [visual direction](2026-11-06-editor-visual-direction.md), [progress.md](progress.md) and the code. The Owner's
  rules for this slice were checked one by one: editors keep essential features only, Add tiles works, the Tuner is a
  live split view, slightly rounded corners and no pill buttons (taste-skill), a YC-level site, and the drunk grandma
  test on every editor and site screen.
- **How:** every claim below was checked at `c35a9c06` with the command or the screen named beside it, not taken from
  the log. Screens were taken of the real built editor (`automata editor` from `packages/tools/dist`) on a copy of
  Emberwick, the 2D suite, the Tuner beside Emberwick's running dev server, and the built site. Evidence pictures are in
  the shared folder `refactor/2026-11-07-build-audit-screens/`.
- **Out of scope** (the coordinator's brief): 3D, the red 3D parity job, and the suite's phone layout.

## 1. Verdict

Most of the slice is built and holds up. The editor is one package by feature; Save writes the game files, the drift
check catches hand edits, and the editor ships inside `-tools` and opens a new game. The site lives in `site/`, builds
from the current code, and passes its own visual audit again (no sideways scroll, no page errors, no text under 12 px,
no link or button under 44 px). The Level view follows the approved mockup closely, and the Tuner is a real live split
view: a change to a setting restarts the running game beside it.

It is **not done**, and three things the tracking calls done are not:

- **Add tiles fails on every game folder** (B1). On Emberwick and on a new game it says "Couldn't add the picture:
  assets/my-tiles.png is not one the editor may write". It works only in browser storage (the site's try-it).
- **`pnpm check` is red at the head** (B2): the scope guard fails on the scope changeset that the same commit added.
  #438 says it is green.
- **Task 14.2 is agent work, filed as the Owner's** (B3). Without it nothing can be published and the site's first
  command (`npx @automata/tools create-game`) points at a package that does not exist.

The editors pass the grandma test on Home, the Level view and the leave dialog, and fail it on the Tiles view's
auto-tile rules, the Characters view and the suite's Home (G1 to G6). The site has pill buttons and 18 px panels left
on the Examples pages, because the site's radius tokens were never moved to the 4/6/8 scale (V1).

Findings are ranked by severity: **high** (a promise of the spec or an Owner rule is broken, or something a person runs
fails), **medium** (the spec, the mockup and the code disagree, or tracking is wrong), **low** (tidiness).

## 2. What was run (2026-11-07, Node 24.22.1, Chromium only)

| Gate | Result |
|---|---|
| `pnpm install --frozen-lockfile`, then `node site/scripts/build-demos.ts` | pass |
| `pnpm check` (no cache) | **fails** at `test:unit:2d`: `tooling/release/tests/unit/scope.test.ts` (B2). Lint (453 warnings, all in `docs/archive/design/*.mjs`), typecheck (29 tasks), boundaries, style, source-names and knip pass before it |
| The unit tests with `turbo --continue` (same filters) | 26 of 27 tasks pass; only `@automata/release` fails, on the same test |
| `pnpm check:changesets` | passes (35 pending changesets) |
| `--features packages/editor --shared-island kit --components` | **11 findings** (C3); the gate runs it without `--components` |
| `pnpm build` of the site (`site/`) | passes; "No Pixi 3D closed beta in the build." |
| The editor's journeys, `editor-ipad-chromium` and `editor-phone-chromium` | first attempt **10 pass, 1 fail, 1 skip**: the iPad "save reaches the game" waited 5 s for "Saved" (T1). The same test alone: passes |
| The stranger's journey (`pnpm test:e2e --filter @automata/consumer-smoke`) | **1 of 1 passes** (Chromium, 42 s): make, install, check, test, play, the itch.io zip |
| The site visual audit (`run.cjs` from the 2026-11-06 audit), 35 sitemap pages, the 404 and `/editor/app/`, six sizes, 222 pairs | sideways scroll 0; page errors only the 404's own (expected); text under 12 px 0; targets under 44 px: Start's three 20 px checkboxes at six sizes and the try-it Home's four 32 px controls at the two desktop sizes (the fine-pointer size), both as section 7 of the site audit left them |
| The built editor by hand, at 390 × 844, 1194 × 834 and 1440 × 900 | screens in the shared folder; findings B1, C2, C5, C6, G1 to G8 |
| WebKit, Firefox, parity in three engines, `actionlint`, hosted CI, a real iPad | **not run**: not installable in a cloud session, or the Owner's |

## 3. Findings

### B. Broken (high)

**B1. Add tiles cannot write its picture into a game folder.** The Owner named it essential (2026-11-06: "Add tiles ...
IS essential; build it"). On Emberwick (`automata editor` on a copy), Tiles → Add tiles → Choose a picture → Add
tiles shows "Couldn't add the picture: assets/my-tiles.png is not one the editor may write" and the dialog stays open
(`addtiles-done.png`). `features/tiles/add-tiles.ts:88` writes `assets/<name>.<ext>` at the game's root, but the policy
(`packages/tools/src/features/editor/editor-policy.ts`) lets a browser write only what `content/editors.toml` lists, and
neither Emberwick's list nor `create-game`'s template has a row that covers `assets/`. Without a list, only
`*.af2d.json` is writable. So it fails on every game folder, including a stranger's new game. In browser storage
(`/editor/app/`) it works (`tryit-tiles.png`). The task's tests used the memory store, and no journey adds tiles.
*Fix:* decide where tile pictures live for a game (a folder beside the level project, such as `content/tiles/`), let
the row that names `exports` also allow pictures there (the policy, `fileAccess`, and both lists), make the level
project reference that path so the game can load it, and add an editor journey: add tiles on a temp copy of a game,
Save, see the picture on disk and `automata check --only levels` pass. The refusal's words are G1.

**B2. `pnpm check` is red at the head.** `tooling/release/tests/unit/scope.test.ts` ("no tracked file outside the
history names a package in the old scope") fails with `expected [ '.changeset/scope-automata.md' ] to deeply equal []`.
Commit `e6c44fba` added both the guard and the changeset, whose text names the old names on purpose ("`@mcthaydt/automata`
is now `@automata/framework`"). #438's body says `pnpm check` is green; it cannot have been run after the changeset was
committed. **Fixed on #438 after this audit** (`f88f77ef`: the guard and the codemod allow the rename's own changeset); `scope.test.ts` passes after merging it here. Left for stage 6: run `pnpm check` with no cache and correct #438's body. *Original fix:* exempt `.changeset/` from the guard (the changelog it becomes is exempt already), or word the
changeset without the old names; run `pnpm check` with no cache; correct #438's body.

**B3. Task 14.2 is the agent's, and it is filed as the Owner's.** `progress.md` says "what is left (14.2, 21.0's DNS,
21.2) is the Owner's". Spec 16.3 says the opposite: "Everything up to `changeset publish` against a local Verdaccio,
with the stranger's journey run against it, is done in this slice", and plan 14.2's four steps (registry
`https://registry.npmjs.org`, `access: public`, the one-time `minor` in `check-changesets`, the Verdaccio dry run, the
fourteen refactor changesets folded into one 0.1.0 entry, the runbook) need nothing from the Owner. Only the real
publish, `NPM_TOKEN` and the organisation are the Owner's (21.2). Until it lands: `release-packages.yml` cannot publish
(GitHub Packages takes only `@mcthaydt`), spec criterion 10 is unmet, and the site's headline command
`npx @automata/tools create-game my-game` (Home and Start) fetches nothing. *Fix:* do 14.2 in the fix stage; add the
published-packages check to `check:launch`, so the site cannot deploy while its first command does not install. Whether
the Owner holds the `@automata` organisation on npmjs.org could not be checked from here (npmjs.com answers 403); it is
one line in 21.2.

### C. The spec, the Owner's rules and the code disagree (medium)

**C1. The Tuner does not ship.** The Tuner lives only in the suite, and the suite is not in `-tools`
(`scripts/copy-editor.ts` scans `2d` and `suite` but copies only `2d`). Outside this repository `automata editor --app
suite` says "The editor suite is not in this release yet." (`editor-command.ts:89`). So AF shipped "with 2D alone" has
no Tuner, although the Owner asked for it and the published `automata editor --help` describes it ("The Tuner shows your
game beside its settings: start it with pnpm dev"), and lists `--app 2d|3d|suite` that a stranger cannot use. That
follows D3 (the suite ships with 3D), but D3 was taken before the Owner added the Tuner's redesign to this slice.
*Fix, recommended:* ship the suite's 2D page in `-tools` too (it is 2D only and already scanned for the beta), so
`--app suite` works for a stranger; or, if the suite keeps waiting for 3D, drop the Tuner and `--app` lines from the
published help. Under the Owner's standing rule the recommendation stands unless the Owner says otherwise.

**C2. The Tuner's split view works, but the game is the smallest thing on the screen.** Checked with Emberwick's dev
server on `localhost:5173` and the suite on Emberwick: the frame shows the game, and pressing + on Jump strength wrote
`tuning.toml`, the content plugin rebuilt and the game restarted on the new value (`tuner-live-3.png`; the file was
restored after). That meets the Owner's "split view showing the live effect of each change". What does not meet the
approved look: the screen has five regions (rail, settings list, game, settings cards, an inspector that only says
"Tap a setting to see more."); the game pane is about 400 px wide on a 1440 px screen and 280 px on an iPad, narrower
than the settings column; every setting is listed twice (the list and a card), its value is shown twice (the slider's
read-out and the number box) and it has two controls (a slider and a stepper); + moves one raw sim step, so a press on
Jump strength changes it by 0.23 px/s, which no one can feel; and the frame says "Start your game with pnpm dev"
rather than starting it. *Fix:* one settings list (a card per setting, chosen inline), no inspector, the game the larger
pane; one control and one read-out per value; a step in the unit shown (1 px/s, 0.01 s); keep "Start your game" as the
empty state.

**C3. The editor's views cross features in 11 places, and the gate does not look.** `pnpm boundaries` runs
`--features packages/editor --shared-island kit` without `--components`, so Svelte files are not checked; the site's
line has `--components`. With it: 11 findings, for example `features/level/LevelView.svelte:15` imports
`features/document/view-props`, `features/map/WorldInspector.svelte:25` imports `features/level/inspector-model`. Spec
3.3 rule 1 forbids both. Session 21's note named them for this audit. *Fix:* move `view-props` and `inspector-model`
into `shared/` (or pass them from `app/editor-2d/`), then add `--components` to the editor's line.

**C4. The Level view differs from the approved mockup in what it can do.** Compared with `editor-level.html`'s
1440 px shot (`shots/editor-d1440.jpg`) and the built editor at the same size (`ed-level-desk.png`):
- no zoom control: the mockup has −, 200 % and + beside Fit; the build has Fit only, so a mouse user zooms only by the
  wheel and a touch user only by pinching, with no way to read or reset the zoom;
- brush size is a bare "1" box (a popover); the mockup has − 1 +;
- in browser storage the lime primary is Save and Share is an unlabelled icon; the approved mockups put Share as the
  primary there (Save primary only on a game folder);
- the Level inspector shows a read-only "512 × 288 px" and, in the platformer template, a bare text box called Music;
  the mockup has the size in tiles (wide, high) and Music as a choice, with "Sizes are in tiles of 16 px.";
- the palette has no number shortcuts (1 to 6 in the mockup), and the entities layer is "Characters" where spec 11.5
  and the mockup say "Characters and items";
- the grid lines are bright white over every cell; the mockup's are faint, so the level reads first.
*Fix:* each item, or a line in the plan's log saying why the mockup was not followed (the Owner approved the mockup).

**C5. The phone Level view still has a white band above the canvas.** At 390 × 844 a 54 px white strip sits between the
top bar and the canvas, holding only the Fit and Details buttons (`ed-level-phone.png`); session 20 saw it and left it
for this audit. The title truncates to "Emberwi… / Roo…", so neither the game nor the level can be read. *Fix:* float
Fit and Details over the canvas as the wide layout does; on a phone show the level's name only.

**C6. Home promises agent skills that a stranger cannot get.** Home: "Agent skills teach your coding agent where
gameplay lives, which rules it must keep and how to test a change." Start's "Set up your coding agent"
(`site/src/features/start/agent-setup.ts`) installs only Superpowers and the PixiJS skills; AF's own skills
(`agents/automata`) reach `mcthaydt/automata-skills` only once the Owner's `SKILLS_TOKEN` exists (16.4), and
`create-game` writes no `AGENTS.md`. *Fix:* until AF's skills are public, Home says what Start gives today, or
`create-game` writes a short `AGENTS.md` with the laws and the layout (the skill's own text), which needs no token.

**C7. The spec still describes the look the Owner rejected.** Spec 11.2 and 11.3 say frosted pill buttons, a chartreuse
glow on Save, 26 px sheets and glass controls; the Owner rejected that on 2026-11-06 ("I HATE rounded buttons", option
C, then the approved mockups), and the build rightly follows the visual direction. The spec's status line still says
"Nothing here is built." *Fix:* spec 11.2 and 11.3 point at the visual direction and the mockups and drop the old
table; the status line says what stage 4 built.

### V. Visual standard (medium)

**V1. The site still has pill buttons and 18 px corners.** `packages/editor/src/shared/kit/tokens.css` still defines
`--radius: 18px`, `--radius-lg: 26px`, `--radius-sm: 12px` and `--pill: 999px`; the visual direction said phase 18.0
would move them to the 4/6/8 scale ("`--pill` 4px"). Most of the site uses `--edge-*` now, but the playground's Run and
Play buttons are pills (`site/src/features/playground/PreviewPanel.svelte:61` and `:78`), and the Examples cards, the
code panel and the preview are 18 px (`ExamplesIndex.svelte:30`, `CodePanel.svelte:113`, `PreviewPanel.svelte:58`).
Nothing guards the site the way `editor-corners.test.ts` guards the editor. *Fix:* move the four tokens to the scale
(and the site fixture `tests/fixtures/tokens/site-root.css`), use `--edge-*` in the three files, and extend the
corners test to `site/src`.

**V2. The Examples pages were not rebuilt in the new look.** `/examples` has a display-size H1 unlike every other page,
package-style ids as card titles (`core-basic-window`), descriptions in API words ("defineGame() needs only an id ...
draw() paints over the playfield", "deadzone", "interpolated"), and a star rating per card (★☆☆☆) that nothing
explains. Next to Home and Start it does not read as the same product. *Fix:* Home's type scale; the plain title first
and the id small under it; one plain sentence per card; say what the stars mean ("Difficulty") or drop them.

### G. Copy and UX: the drunk grandma test (medium)

| # | Where | What a person sees | After |
|---|---|---|---|
| G1 | Add tiles, and every refused write | "Couldn't add the picture: assets/my-tiles.png is not one the editor may write" | "This game doesn't let the editor save pictures here yet." with what to do (after B1, it should not happen) |
| G2 | Tiles, auto-tile rules (`tryit-tiles.png`) | rule names `ground-n-e`, "No. 1 in this group", 1×1 / 3×3 / 5×5, ≠ and = cells, "Tap a cell to cycle any, empty, filled, is and not", Outputs, Break on match, Flip X, "Outside the level: Same as the centre", Chance 100 %; an inspector with Rule and Group tabs and "Choose a rule, or add one to this group." when the game has no tiles at all (`ed-tiles-ipad.png`) | The Owner keeps core authoring, so the rules stay; their words change: the inspector appears only once a rule exists; the template names rules in words ("Ground, top edge"); the pattern's cells say "anything / empty / ground / not ground" |
| G3 | Level canvas, platformer template | the Ground layer draws tile numbers (30, 46) on every cell (`tryit-level.png`) | draw the placeholder's colour, never its index |
| G4 | Characters (`ed-characters-desk.png`) | mono chips "1 placed in 1 level", "Circle, 8 × 8 px"; the colour as `#f97316`; "Settings for every level / Every level / None yet"; "Only one per level" drawn as a selected button; icon-only + buttons; "8 px" labels over the preview | body type for words (mono for numbers only, spec 11.2); a swatch without the hex; "Settings every level has"; a switch for one-per-level; "Add a character", "Add a setting" |
| G5 | Map (`ed-map-desk.png`) | "Arrange levels: Anywhere / In a grid / In a row / In a column" with no word on what it does; the inspector's X, Y and depth; Fit at the top centre here and the bottom right in Level; level labels huge here and tiny in Level | one line under the choice ("How levels sit on the map"); depth as "Layer" or gone; one place for Fit; one label size |
| G6 | Suite Home (`suite-home-desk.png`) | under Levels 2D: "Room 1, Project, Room 1, World" (the project and the three game files Save writes, two called Room 1); "Levels 2D" as a name; Export and Import with no word on what they move; the rail says Tuner, Levels 2D and Home says the reverse | list the level once ("Room 1") and leave out the files Save writes; "Levels"; "Export changes", "Import changes"; one order |
| G7 | Add tiles dialog | the tile size twice: a stepper and an 8 / 16 / 32 / 48 px choice | one control |
| G8 | Tuner | "Keep" on every card, with nothing saying it locks the value | "Lock" with the lock icon, as the layers do |
| G9 | Site, Start step 1 | "A folder called my-game with a small working platformer in it" | the template is a square that walks around a level, with no jump (`template-game.ts`): "a small working game: a square you move around a level, and its tests" |

### T. Tests (medium)

**T1. The save journey's first attempt failed on the iPad.** `save-reaches-the-game.test.ts:32` waits 5 s for "Saved";
with two workers and other servers running it timed out once (the test alone then passed in 6 s). A save writes four
files in order, so 5 s is tight on a loaded runner. Kept as first-attempt evidence, per AGENTS.md. *Fix:* wait on the
save state (`data-save="saved"`) with the journey's default timeout, not a 5 s one.

**T2. No journey covers Add tiles, the Tuner's live pane or the Share menu.** B1 shipped because the only tests use the
memory store. *Fix:* one journey each, on a temp copy of a game (Add tiles with B1; the Tuner with a fake dev page).

### D. Tracking (medium)

**D1. `progress.md` holds the slice twice, and the first copy is wrong.** The section "2D editors and website: 50%"
appears at line 188 and again at line 445. The first copy's task table is the core slice's 30 rows (1.1 "Per-area
Playwright configs" to 9.2) under this slice's heading; this slice's 68 rows live only in the second copy, under a
session-12 resume note that is long out of date. Both say stage 5 "Not started". *Fix:* one section: the stage table,
one current resume note, the 68 rows; the old resume notes to the plan's log.

**D2. The plan's boxes lag the build.** 65 step boxes are unticked in tasks `progress.md` calls done (phases 1 to 3,
11, 12.1 to 12.4, 12.6, 12.7, 17.1 and 17.2). The plan's Tracking section still counts `/ 63` (it has 68 tasks since
12.3b, 12.6, 12.7, 18.0 and 21.0), and its header says each PR opens as a draft, which the Owner changed on 2026-11-06
(ready, not draft). *Fix:* tick each box whose check the log records as passed; leave the rest open with the reason.

**D3. Small stale lines.** #438's body says `pnpm check` is green (B2). `games/emberwick/content/editors.toml` says
"Its tuning ... has no editor yet" above the Tuner's row.

### E. Unverified here

- WebKit and Firefox (editor layout and journeys, the site, parity), `actionlint`, hosted CI: not installable in a cloud
  session; the Owner's `pnpm ci:local` or the runner.
- A real iPad (the editor and the site): the Owner's.
- Home's editor picture: it loads when the reader scrolls near (NearView), so the full-page screenshots show an empty
  frame; it was not scrolled into view here.
- Whether the Owner holds the `@automata` organisation on npmjs.org (B3).

### L. Tidy (low)

- **L1.** Plan citations are left in comments: 93 in `site/` (`spec §5.2`, `task 18.4`, `QB-D3`, `spec F-4`) and 7 in
  `packages/` (`(spec 11.4)` in `StagePill.svelte`, `LevelToolbar.svelte`, `LevelStage.svelte`, `LevelPicker.svelte`,
  `LayersPanel.svelte`). `pnpm style --plan-comments` does not cover `site/` and misses the `spec 11.4` form. Widen the
  rule and rewrite them.
- **L2.** `shared/kit/shell/EditorShell.svelte` is 632 lines (spec 17.2: under 300 where it can be, 600 the hard rule).
  Split it by layout mode.
- **L3.** Lint prints 453 warnings, all in `docs/archive/design/*.mjs`; exclude the archive from Biome so a real warning
  shows.
- **L4.** The empty Tiles view has two Add tiles buttons (panel and stage) and the empty try-it Home two New level
  buttons; one each is enough.

## 4. Checked and found right

- **Essential features only.** The 2D editor's top bar is Back, the name, the four views, Undo, Redo, the save status
  and Save; Problems and Share show only when they apply; no status bar; on a game folder Home has no New level and no
  templates (the Owner's rule). The plan's log names each cut. The Tiles view's rule editor (G2) and the Map's arrange
  choice are core authoring and stay; their words are the finding, not their presence.
- **The leave dialog** passes the grandma test: "Save your changes to Emberwick room? If you don't save, your changes
  since the last save are lost." with Cancel, Don't save and Save.
- **Corners in the editor:** every `border-radius` in `packages/editor/src` is `--edge-sm/md/lg`, `0`, or a 50 % status
  dot; `editor-corners.test.ts` guards it. One lime primary per editor screen. No glass, glow or flutes.
- **The site's look:** Home, Start, Editor, Docs and API follow `site-home.html`: one claim, the game, real code, the
  editor, the targets; flat lime primary, slightly rounded corners. Its audit numbers match section 7 of the site audit.
- **Save writes the game; drift is caught; a new game opens in the editor; the suite opens the checkout:** the editor's
  journeys pass in Chromium (iPad and phone).
- **The closed beta:** the site build ends with "No Pixi 3D closed beta in the build.", and `--forbid` keeps
  `@pixi/3d` and the 3D packages out of `packages/editor` (0 findings).
- **The scope:** no tracked file outside the history, `docs/archive/`, `docs/refactor/` and the codemod names
  `@mcthaydt/automata` except `.changeset/scope-automata.md` (B2).
- **`automata --help`** is five commands and one line; `editor --help` and `ship --help` are in plain words.

## 5. Order for stage 6

1. B2 (`pnpm check` green first, so every later fix is checked).
2. B1 with T2's Add tiles journey, and G1.
3. B3 (task 14.2 up to the Verdaccio dry run) and the `check:launch` line.
4. C1 (the Owner's default stands unless they say otherwise: ship the suite's 2D page), then C2 and G8.
5. C3, C4, C5, V1, V2.
6. G2 to G7, G9, each row into `copy.md`.
7. C6, C7, T1, D1 to D3, L1 to L4.
8. Rerun: `pnpm check` (no cache), the editor's journeys, the stranger's journey, the site's Chromium suite and the site
   visual audit; open every changed screen at phone, iPad and desktop.

## Appendix: how it was checked

- Branch `claude/project-thread-l36s66` from `origin/claude/refactor-scope` at `c35a9c06`; Node 24.22.1
  (`/opt/node24/bin`), pnpm 10.34.6.
- The editor: `node packages/tools/dist/bin.js editor <copy of games/emberwick> --port 5301` (and `--app suite`), driven
  with Playwright (Chromium) at 390 × 844 (touch), 1194 × 834 (touch) and 1440 × 900. Add tiles with a generated
  64 × 32 PNG of eight 16 px tiles. The Tuner on `games/emberwick` itself with `vite --configLoader runner` on port
  5173; `content/` was restored with `git checkout` after.
- The try-it editor and the site: `site/` built with `pnpm build`, served with `node scripts/serve-static.ts build 4417`;
  the site audit's `run.cjs` over the sitemap's 35 pages, the 404 and `/editor/app/` (metrics in the shared folder,
  `refactor/2026-11-07-build-audit-screens/site-metrics.json`).
- Grep and file reads for every path and line named above.
- The stranger's journey: `pnpm test:e2e --filter @automata/consumer-smoke` (Chromium, from packs): 1 of 1 passes in 42 s.
