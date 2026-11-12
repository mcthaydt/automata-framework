# Dark mode for the editors: build audit

Part 2 (newest) comes first; part 1 follows below the rule.

## Part 2: the finished build, PR #504 (2026-11-08, 13:30Z)

Head audited: `54b80c93` on `claude/project-thread-1ot79o` (PR #504, base #502). Schematic (#497) and Audio's mix (#500)
are merged in; Levels 3D 16.3 (#499) is not.

### What I ran on #504

- Built the tools, `@automata/editor`, `@automata/editor-3d`, `@automata/editors` (pass).
- Unit: the token, theme and colour-scan tests, 9 files, 97 tests, pass. Layout (Chromium): `theme.test.ts`, 8 tests, pass.
- Playwright: `packages/editor/tests/e2e/theme.test.ts` on the phone and desktop projects, 10 tests, pass.
- The dark journey `dark-game-loop.test.ts`, iPad and phone, pass (11 s each).
- Make and play in dark, beyond the journey: I ran the Writer, Sequence and Feel journeys again with the device set to dark
  (a copy of each file with `colorScheme: 'dark'`, deleted afterwards). All pass on the phone: the keeper says the words
  written in Writer, the cutscene shows the caption, the cutscene changed in Sequence plays, and Feel's word, flash and
  shake show in the played game. One Feel run failed once under parallel load and passed on retry, the same as in light.
  With part 1's hand-played wall (painted tiles seen in play) and Publish zip, content made in the dark editors shows in play.
- Looked at the build's 88 shots in `/mnt/project-files/dark-mode/`, among them Schematic, Writer, Sequence and Publish at
  five sizes.
- Not run: WebKit, Firefox, the GPU runner, parity, the 3D suites (as the build's log says).

### Part 1 findings on #504

| Finding | Now |
| --- | --- |
| H1 tasks 5 to 9 not built | Fixed: all built and logged. |
| H2 #499 and Schematic missing | Half fixed: Schematic merged, scanned and shot in dark (reads well). #499 still missing: see N1. |
| M1 no record | Fixed: plan log, ticks and `progress.md`. The light before/after shots were replaced by a unit test (see N4). |
| M2 scan gaps | Fixed: the scan now reads Svelte markup and every `.ts` in the three roots. |
| M3 canvas element shot | Fixed in approach (the canvas's own pixels), but the new test does not wait for a redraw (N2). |
| L1 spec contradiction | Fixed. |
| L2 control edges under 3:1 | Unchanged by design; still for the Owner to know. |
| L3 cabinet vs field | No change needed: the shots show the stage framed by the panels. |
| L4 `stage-warn` not in spec | Fixed. |

### New findings: 1 high, 2 medium, 3 low

**N1 (high). Levels 3D, the Studio and the 3D light change are still unaudited in dark.** #499 conflicts with this stack
in 30 files, so on #504 the 3D suite cannot open `base-3d`. Plan, 3D and Walk (with the HUD and sticks), the Studio, a
moved wall played in dark, the 3D Plan canvas's two-look comparison, and the light before/after of the 3D suite are not
done. The log says so plainly and gives the steps. This is an ordering problem, not a code fault: what is on the branch for
3D reads only tokens and passes the scan. Fix: once #499 and #504 are on one branch, do the log's hand-off steps and
add a short part 3 to this audit. #504 must not be called done for 3D until then.

**N2 (medium). The dark journey checks the served content, not the played screen.** `dark-game-loop.test.ts` paints a wall
and changes Feel's word, then checks the game page's canvas exists and that the content module Vite serves holds the wall
and the word. It never presses Play and looks at the game, which is the audit rule ("play it, and confirm what was made
shows up in play"). Its opening comment also says Tuner and Audio "are each used", but Tuner is only opened and Audio is not
opened at all. Fix: press Play and check the painted wall on screen (a screenshot or pixel probe of the played canvas), the
way `writer-words-show-in-game` checks words; correct the comment to what the journey does.

**N3 (medium). The canvas comparison in `theme.test.ts` compares one frame with itself.** It switches `data-theme` and
reads the canvas again in the same task, with no frame in between, so the level is never redrawn under the dark look. The
pixels are real (I checked: 596×768, every pixel drawn, not a blank read), and a fresh load in each look gives the same
picture (part 1), so the product is right; the test just cannot catch a regression. Fix: after switching, force a redraw
(or wait two `requestAnimationFrame`s with the view dirtied), and assert the picture is not blank.

**N4 (low). The light before/after shots were replaced by a token test.** Task 2 Step 4 asked for pictures of the one
intended light change (the 3D suite, the content editors' suite and Feel now draw the tool chrome in light). The log
substitutes "the light values are today's", which proves the tokens, not the pages that changed. Fix: take them with N1.

**N5 (low). The colour scan's allow-list exempts whole files that are mostly chrome.** `SequencePreview.svelte` is listed
for its letterbox (`fill: black`), but the rest of the file is the plan diagram, which is chrome and follows the look
(the shots show it does). Any new literal in that file, or in `Palette.svelte`, `TilesetSheet.svelte` or the 3D canvases, would
pass. Fix: allow by line or by rule (the selector and the property), not by file.

**N6 (low). One line in the log is wrong.** Task 7's verdict says Sequence's "2D stage is black (game picture,
unchanged)". The shot shows a dark grey plan with the accent's camera and a light keeper label: it is chrome and follows the
look. That is correct behaviour; fix the log line so the next reader does not think it is a game picture.

### Grandma test on the finished build

Passed. The Editor colours control reads on every Home in both looks, its chosen option is clear, and tapping Light turns
everything light at once and is remembered. Every editor I looked at in dark (Home, Tuner, Levels, Feel, Audio, Writer,
Sequence, Schematic, Review, Publish) has readable words, visible edges, one clear action per area and no light box left
behind.

---

# Dark mode for the editors: build audit (part 1, plan tasks 1 to 4)

Date: 2026-11-08. Branch audited: `claude/project-thread-1ot79o` at `9362792c` (no PR yet). Spec and plan:
`docs/refactor/2026-11-08-dark-mode-{spec,plan}.md` (from PR #502). Screenshots: `refactor/dark-mode-build-audit/`.

## Status

The build is not finished. Tasks 1 to 4 are committed (the dark tokens and contrast test, every page on the tokens, the
remembered choice with `theme-boot.js`, and the Editor colours control). Tasks 5 to 9 (design board in both looks,
real-browser tests, the dark screenshots of every editor, the dark make-and-play journey, docs) are not built yet. This
part audits tasks 1 to 4. A second part will audit tasks 5 to 9 when they land.

Counts: 2 high, 3 medium, 4 low. Plus out-of-scope observations at the end.

## What I ran

- Unit: `tests/unit/shared/kit/{tokens,theme}` and `editor-colours.test.ts` in `packages/editor`: 9 files, 97 tests, pass.
- Built the tools, `@automata/editor`, `@automata/editor-3d` and `@automata/editors` (turbo, 11 tasks, pass).
- Every token pair computed again from `tool-theme.json` (WCAG 2.x), both looks.
- Chromium (Playwright), device emulated dark, at 390×844 and 1180×820, with `automata editor` and the content editors'
  suite on a game made with `automata create-game`: Home, Tuner, Levels, Feel, Audio, Writer, Sequence, Publish.
- The 2D editor's own build (the site's try-it) in dark, and the 3D suite on a copy of `base-3d`.
- Make and play in dark (below). Not run: WebKit, Firefox (not in cloud sessions), real touch devices.

## Make and play in dark (the audit rule)

With the device dark, on a new game (`automata create-game dark-game`) in the content editors' suite:

1. The page opened dark on the first frame (`--paper` `#1b1c20`, body `rgb(19 20 23)`); no `data-theme` set (Match device).
2. Levels: picked the Ground layer and painted a row of 10 tiles in the empty sky. The level file was saved.
3. Feel: changed the word shown on a bump from "Bump!" to "Boom!". Saved to `content/feel/feel.toml` and compiled into
   `content/generated/*.json`.
4. Played the game the editor started: the painted row is there (`play-2.png`). The game's page has no `data-theme` and
   keeps its own background (`rgb(24 31 47)`, `color-scheme: normal`): the theme does not reach the game.
5. Publish in dark on a phone: built, "Download the zip" gave `dark-game-0.1.0-itch.zip` (15 files), whose script holds "Boom!".

Also checked: a stored `dark` on a light device is dark in the first animation frame; a stored `light` on a dark device
is light, with `--primary-ink` still `#11151c`; the level canvas's own pixels are identical in light and dark (read with
`drawImage`/`getImageData`), and the cabinet round it is `rgb(14 16 20)` in both.

Not done: Levels 3D and Writer/Sequence content in dark (see H2; a new game has nothing in Writer or Sequence).

## High

**H1. Tasks 5 to 9 are not built.** No design board in dark, no real-browser tests (first frame, device switching, game
unchanged), no screenshots of every editor in dark, no dark make-and-play journey, no docs. The build thread must finish
them before this audit can close. Fix: finish the plan; part 2 of this audit checks them.

**H2. The build branch does not hold Levels 3D's 16.3 work (#499) or Schematic (#486/#497), so neither is covered.**
The plan's base was meant to include them. On this branch the 3D suite cannot open `base-3d` at all ("af-sector/2 is not a
version this editor reads (af-sector/1)", `3d-Levels_3D.png`), so Plan, 3D and Walk cannot be looked at in dark, and the
colour scan has never seen Schematic's 22 components or #499's view changes. Fix: merge #499 and the Schematic branch into
the build branch before Tasks 7 and 8, rerun `editor-colours.test.ts` on the merged tree, and include Levels 3D (Plan, 3D,
Walk with its HUD and sticks), the Studio and Schematic (diagram, inspectors, watch pane) in the dark screenshots and the
hand-played check.

## Medium

**M1. Tasks 1 to 4 left no record.** The plan's log has no entry for any of them, no step is ticked, and
`docs/refactor/progress.md` still says stage 2. Task 2 Step 4 asks for before and after shots of the one intended light
change (the 3D suite, the content editors' suite and Feel now draw the tool chrome in light) and a log line; neither
exists. AGENTS.md: update `progress.md` and the plan's log in the same session as the work. Fix: write the log for Tasks
1 to 4 (what changed, the gates that ran), tick the steps whose checks passed, take and log the light before/after shots.

**M2. The no-stray-colours scan misses two places a literal can hide.** `editor-colours.test.ts` reads Svelte `<style>`
blocks, `.css` files, and only those lines of `extensions/editors/**/*.ts` that mention style, fill or stroke. It never
reads Svelte markup (`style="…"`, `style:color={…}`, an SVG `fill="#…"`), and never reads `.ts` in `packages/editor` or
`packages/editor-3d` (inline style strings, chrome drawn on a canvas). I grepped all three by hand and found no chrome
literal today (only game colours: level templates, entity defaults), so nothing is wrong yet, but the guard the spec
promises (§5.2) is not complete. Fix: scan markup attributes in every `.svelte`, and style/fill/stroke lines of every
`.ts` in the three roots, with the game-picture allow-list extended to the level templates and entity default colours.

**M3. Task 6's "the level canvas is identical in both looks" will fail if written as an element screenshot.** The floating
zoom bar and the tool bar sit over the canvas's box and follow the theme: an element screenshot of the canvas differed in
36,871 pixels between light and dark, all inside those two bars, while the canvas's own pixels were byte-identical. A
failing test here invites loosening the check. Fix: compare the canvas's own pixels (draw it to a 2D canvas and compare
`getImageData`), or hide the overlays before the shot; do the same for the 3D Plan canvas.

## Low

**L1. The spec contradicts itself.** §3.2 says `generate-tokens.ts` writes `tool-theme.json` "as `light-dark()` pairs";
§3.1, the plan and the code use plain values under `prefers-color-scheme` and `[data-theme]`. Fix the §3.2 sentence.

**L2. Fields and control edges are below WCAG 1.4.11 (3:1 for a control's boundary) in both looks.** `--tool-line-strong`
on `--tool-panel` is 1.53:1 in dark and 1.48:1 in light; in dark a text field and the panel it sits on are the same
`#1b1c20`, so the 1 px edge is the only sign it is a field. The spec chose this on purpose (light must not move, dark at
least as visible as light), and the words and focus ring pass. Recorded so the Owner knows; no fix unless the Owner wants a
stronger edge. Text contrast passes everywhere: the lowest pair is `--tool-faint` on `--tool-selected`, 4.73:1 dark,
4.55:1 light.

**L3. In dark the cabinet and the app field are almost the same colour.** `--tool-stage` `#0e1014` on `--tool-bg`
`#131417` is 1.03:1. Where the level's cabinet meets the rail or the field there is no visible edge; on Levels it meets the
panels (`#1b1c20`), which is visible, so this is minor. Fix only if Task 7's screenshots show a stage with no frame.

**L4. `tool-theme.json` has keys the spec's table does not list** (`stage-warn`), and repeats the fixed values
(`tool-stage`, `stage-warn`, `on-lime`) in the dark block. Harmless; add `stage-warn` to the spec's table.

## What passed

- Token values match the spec's table; light values are today's (the light look does not move on pages that already had
  the tool chrome).
- Contrast, recomputed for every word token on bg, panel, hover, selected and a refused row, in both looks: all at least
  4.5:1. `--on-lime` on lime 14.3:1, `--on-accent` on cobalt 8.0:1 in dark, focus ring 7.5:1 on the dark panel, stage words
  on the cabinet pass.
- Cascade: every editor entry imports `tokens.css`, then `tool-chrome.css`; the dark blocks' selectors outrank
  `tokens.css`'s `:root`, so order cannot flip them; the `--color-*` aliases resolve at `:root` and follow the look.
- No `light-dark()`; the canvas palette (`--color-layer-*`) is plain hex and not themed.
- Every editor HTML page says `light dark` and loads `./theme-boot.js` first; each package's `public/theme-boot.js` equals
  `THEME_BOOT`; the 2D build carries it into `dist/2d`, which the site copies to `/editor/app/` (same origin, so the site's
  `script-src 'self'` allows it). The site's own pages are untouched.
- The control: "Editor colours" visible above Light · Dark · Match device on every Home (suite, 2D, 3D through the kit's
  `HomeScreen`); choosing applies at once, keeps focus, arrow keys move the choice, Match device clears the key and the
  attribute, a refused store is guarded.
- Drunk grandma test on the control in dark (`2d-ipad-home.png`, `phone-home.png`): the words say whose colours they are and
  what you get; the chosen option is the outlined tile. Passes.
- No colour literal or `var(--x, #…)` fallback in any editor `<style>` outside the allow-list; Walk's HUD and sticks, the
  Studio stage and Feel's square read only the fixed stage colours.

## Out of scope (seen while auditing, the same in light)

- On a phone with touch (390×844), Levels' top bar overlaps: the Panel button covers most of Publish, and the tool bar's
  last control is cut off (`touch-dark-panel.png`; identical boxes in light).
- The Studio's canvas stops on the `base-3d` copy ("no gait bounce"), and the 3D suite on this branch cannot read
  `af-sector/2` (H2).
- Tuner and Feel show two or three lime buttons on one screen (Publish plus Make one / Add a feel / Add an effect), against
  the one-lime-button rule.

## Part 3: fixes (Sonnet, same session as the merge of #499 and #503)

| Finding | State |
| --- | --- |
| N1 Levels 3D, Walk and the Studio in dark | Fixed. #499/#503 merged in (ordinary merge). `dark-levels-3d.test.ts` plays the shipped room, opens Levels 3D dark, shoots Plan, 3D and Walk, drags the north wall's two corners a metre in Plan, and plays the edited room: more than 200 sampled pixels differ and the game page is unthemed. The Studio stage's corner pixel is identical in a dark and a light context. iPad and phone, Chromium. Shots in `/mnt/project-files/dark-mode/3d/`. Found on the way, the same in light: the Studio read only `content/figures/*.toml`, so Wick's swatches and gait were missing and its stage never drew; the three 3D editor lists now name `content/figure-*/*.toml` too. |
| N2 dark journey did not press Play | Fixed. It presses Play, clicks the game's Play and reads the played canvas for the painted wall; the comment says what it does. |
| N3 canvas compared with itself | Fixed. The layout test reads the Pixi canvas in the task that draws it, in each look, and has a control that proves a changed colour is seen. It failed first: the grid, selection and link-chip colours followed the look. They are fixed stage tokens now. |
| N4 light before/after | Partly. Light "after" shots of the 3D Home, the Studio, the Plan and Feel are taken; the "before" side needs the pre-dark base built beside this branch and is not. The token test stays the proof of the light values. |
| N5 allow-list by file | Fixed. Eleven exact lines, and a test that each is still there. |
| N6 wrong log line | Fixed. |

Seen, not caused here: on a phone the 3D Plan shows a white box north of the first room (the level's own floor, the same in light); Publish is cut off on a phone-width Feel top bar; inherited gate failures (`boundaries` 3, `source-names` 5, `check:changesets` 3, `api-index` 3 undocumented exports). Not run: WebKit, Firefox, the GPU runner, parity.
