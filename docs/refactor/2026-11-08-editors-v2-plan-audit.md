# Editors v2: plan audit

Stage 3 of the editors v2 pipeline: an audit of [`2026-11-08-editors-v2-spec.md`](2026-11-08-editors-v2-spec.md) and
[`2026-11-08-editors-v2-plan.md`](2026-11-08-editors-v2-plan.md) (PR #519) for completeness, consistency and cohesion
with the approved mockup (`editors-v2/`), its shots and boards, and `PATTERNS-EDITORS-2026.md`. Every finding below is
fixed in the spec and the plan on this branch.

**What was read.** The spec, the plan and the design note; the mockup's `editors.css`, `app.js` and `icons.js`; the
shared-editors plan (#512, `8e2a7b10`). Code claims were checked on #508 (`claude/complete-game-journeys`,
`89db7336`), #506 (`claude/project-thread-6mtkk6`, `30667aa3`) and the site slice #517 (`87619dbb`).

**What was measured.** Every contrast pair in spec §4, in both looks, with the WCAG formula: all clear 4.5:1; the
closest is `tool-faint` on `tool-selected` in light, 4.55:1. `on-lime` on lime is 14.3:1 and on `lime-hover` 15.3:1.
`stage-warn` on the new stage is 10.8:1.

**What was not run.** No code changed, so no gate ran. The project rule that the build audit makes a game, plays it and
sees what was made is in the plan (Task 14 and the build-audit note) and now covers a 2D and a 3D game.

## High

- **A1. Review does not exist.** The spec gave the sidebar a "Waiting for you" group with Review, an empty Review page,
  a Review card and a Review tab under More, and plan Task 9 changed `ReviewDesk.svelte`. That file is not on either
  base: the Review desk was deleted with the change-set desk in `a15c7b36` ("the change-set desk, Tuner locks and the
  ask mode are gone"), which both #506 and #508 hold. Building it again is a new feature, which spec §2 rules out and
  the essential-only rule argues against. **Fix:** Review is out (spec §2); the sidebar has one group, "Editors"; the
  empty state is proved on Characters with no character (Task 9). The `review` icon stays in the kit, unused.
- **A2. The journeys would lose every editor.** Every journey opens an editor with
  `getByRole('tab', { name, exact: true })` (`packages/editor/tests/e2e/harness/complete-game.ts:10-18`), and today's
  rail is a `tablist` named "Editors" (`SuiteRail.svelte:75-87`). The plan's sidebar named no roles, and a count at a
  row's end ("Schematic 1") would change the tab's name. **Fix:** a global constraint and Task 5's test: a `tablist` of
  `tab`s named by the editor's name alone, the count `aria-hidden` and given as a description, Home outside the list;
  Task 8 keeps the same for the tab bar and reruns `complete-game-2d` on a phone.
- **A3. The problem count dropped states.** `SuiteHeader` took `problems: CheckFinding[]` and said only "1 problem" or
  "No problems". Today's pill (`checksPill`, `features/suite/core/pills-model.ts`) also shows checks running, none run
  and a check that could not run. A count of zero while checks run, or after one failed to run, tells a person
  everything is fine when it is not. **Fix:** the header takes the `Pill`, and spec §7.4 gives words for each state:
  "Checking…", "Not checked yet", "No problems", "N problems", "Couldn't check".
- **A4. The 3D editors would break the one-lime rule.** Spec §9 counted the 3D editors' `variant="primary"` buttons, but
  no task changed them, and spec §2 said their insides are not touched. On #508 there are 11, in Levels 3D's dialogs,
  sheets and home and in the Studio. **Fix:** spec §2 and §9 and plan Task 14 turn those outside a dialog to secondary,
  then run the 3D workflow.
- **A5. The Door's words were wrong.** There is no "No Checkpoint yet" string. A missing required field says
  `` `${field.id} is required` `` (`shared/kit/fields/field-values.ts:17`), which puts a file key on the page
  ("target is required"). And a Door's Leads to points at a door, a checkpoint or a player start
  (`templates/platformer.ts:74-84`), not at a level, so "Choose the level it opens" would send a person looking for the
  wrong thing. **Fix:** "The Door doesn't lead anywhere yet. Choose where it goes." for a missing ref, "The Slime needs a
  Patrol path. Fill it in." for any other required field, built from the thing's label and the field's label, with a
  test that no problem's words hold a field id. The top-down template's Door and Warp take the same words.
- **A6. The played game asked for things nothing proves.** Task 14 placed a coin and wrote a line in Writer. The new 2D
  game's template defines a coin, but no test shows the game draws one; and a new 2D game has a dialogue box only once
  the shared-editors build adds the keeper (its Task 13). It also gave no command. **Fix:** Task 14 makes the game with
  the complete-game helpers (Decor cell, the player's picture, a key, a flash, 880 Hz, and the keeper's line when the
  template has it), gives the commands, and reruns `complete-game-2d` and `complete-game-3d`, so every editor is proven
  in both kinds. The build audit makes a 2D and a 3D game.
- **A7. Wrong package names and runners.** The plan filtered `@mcthaydt/automata-editor`; the package is
  `@automata/editor` (and `@automata/editors`, `@automata/editor-3d`, `@automata/site`). Task 2 ran
  `pnpm test:browser:2d -- theme` to run `tests/e2e/theme.test.ts`, which is a Playwright test that needs `pnpm build`
  and is not in `test:browser`. The layout theme test (`tests/browser/layout/shared/kit/theme/theme.test.ts`), which
  assumes no attribute follows the device, was not listed. **Fix:** the names, the commands and the file.

## Medium

- **A8. Three sets of words for an empty Home card.** The spec said "Nothing yet", the mockup "Nothing waiting.", and
  the shared-editors plan's Task 3 asserts "Nothing made yet. Open it to start.". **Fix:** the shared-editors words,
  which also tell a person what to press.
- **A9. Icons.** Levels 2D's rail entries carry their own icons in the shared-editors build (`SuiteEntryDef.icon`,
  `grid` and `person`), so changing `iconFor` alone leaves Levels on `grid`. `iconFor` is not exported. `minus`,
  `eye-off`, `home`, `sliders` and `review` are already in `paths.ts`. **Fix:** spec §7.3 maps by id, Task 4 changes the
  entry definitions, exports `iconFor` and copies only the missing icons.
- **A10. The site check duplicated a gate.** `site/tests/e2e/site.e2e.ts` already runs axe at WCAG 2.2 AA on every page
  of `PAGES` at 375 and 1280 px; the plan made a new file with its own route list. **Fix:** Task 3 adds a dark-device
  pass to `site.e2e.ts` over `PAGES`, and names #517's `site/src/shared/styles/tokens.css` as where the site's scheme
  goes once the site slice is in.
- **A11. The sidebar's counts had no source.** `counts` was a prop nobody computed. **Fix:** `problemCounts(findings,
  list)` in `features/suite/core/problem-counts.ts`, a finding counted for the editor the list gives its `path` to.
- **A12. Raw colours in the mockup.** A secondary button's hover edge is `#4a4f58` / `#a1a1aa` in `editors.css`, and
  `pnpm style --tokens` refuses raw colours in the kit. **Fix:** a `tool-line-hover` token in both looks.
- **A13. The token table hid what stays.** `tool-theme.json` holds eight keys the table did not name, and `tool-stage`
  moves (`#0e1014` to `#08090b`), which moves stage baselines. **Fix:** spec §4 says which keys stay and that the stage
  move is expected; Task 2's test checks no key is lost.

## Low

- **A14.** `EditorShell.svelte` is 332 lines on #508, not 632. The split into `shell-sheets.svelte` stays, for Task 8.
- **A15.** The status line was Geist Mono 11.5 px in §7.10 and 12 px in §4; it is 12 (`text-mono-12`).
- **A16.** Publish's dialog is `PublishGameDialog.svelte`, not `ShipDialog.svelte` or `SuitePublish.svelte`; it already
  says "Build my game". Its later phases' buttons ("Download the zip", "Try again") are each the dialog's one lime only
  in their own phase.
- **A17.** Home has no rail today (`data-rail="none"`); the mockup's Home has the sidebar. Task 4's test says so.

## Checked and sound

- The breakpoints (`shell-mode.ts:19-21`: 1180, 760, 520), the kit's density tokens (`tool-chrome.css`, 32/44 and
  32/48), Geist and Geist Mono in `tokens.json`, the three `theme-boot.js` copies and `THEME_KEY`.
- The dark default's shape (`:root` dark, `[data-theme="light"]`, `device` under `prefers-color-scheme: light`) keeps
  plain values for the level canvas's `getPropertyValue`.
- The grandma words: "What do you want to change?", the card lines, "Hits to beat it", "Brush size – 1 +", and "Put your
  game online" with the mockup's line that says it makes a zip to upload.
- Every editor in both kinds of game: the plan works on the shared-editors build's entries and now reruns both
  complete-game journeys. Which editors the web page keeps is left to the apps work, as the spec says.
