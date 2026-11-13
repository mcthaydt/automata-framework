# Editors v2 landing: Task 3's log

Branch `claude/editors-v2-landing`. Task 3 of the editors' v2 landing plan (`docs/superpowers/plans/2026-11-12-editors-v2-landing.md`
on `claude/editors-v2-landing-plan-audit`; "v2 on `main`'s gates"): the merged tree passes every gate `main` passes,
and nothing `main` had is lost. Progress: **Task 3 100 %** (every step below passes; the journeys are Task 4's).

## Steps

| Step | State | Evidence |
|---|---|---|
| 1. The header test (A12) | done | `suite-header.test.ts` red on the tip (`no Not checked yet`, ipad-pro-11-portrait, mouse and touch), then 46 of 46 after the change: under 900 px, or compact, no count; from 900 px the count; new case: one problem shows `1` whole at 834 px, accessible name `1 problem` (5 sizes, mouse and touch). Flipping one expectation made it fail, so it measures. |
| 1b. Editor-3d camera rooms | done | see "The inspector at 1194" below. |
| 2. Compact and mixed-pointer tests | done | `suite-header-compact.test.ts`, 4 of 4 (mouse and touch). Three mutations (cover the field, a target 100 px larger, focus lost) each failed it. |
| 3. `pnpm check` | done | whole uncached run (`TURBO_FORCE=true`, `origin/main` `7b6ce6ac` is in `HEAD`) exit 0: lint, typecheck, boundaries (238 files, 0), style (244, 0), source-names, knip, `test:unit`, `changeset status` and `check-changesets` (92 changesets, 0 problems). Two runs before it were red, for what Task 2 had not run: see "Found by the gates". |
| 4. Build, reports, `agent-skills` | done | `pnpm build` 16 of 16; `api-report --update` (only `editor.api.md`: `list: ListPolicy`), `api-index --write` ("1303 exports from 49 entry points; 0 undocumented"), `agent-skills` ("5 skills, no layout problems"); committed in `b26e2bd3f`; `api-report` exit 0 after. |
| 5. Layout suites, Chromium, mouse and touch | done | editor (`layout` + `storage`) 51 files, **982 of 982**; editors **116 of 116**; editor-3d **287 passed, 3 skipped** (the 3 are `main`'s own skips). |
| 6. K1 to K16 | done | see "Kept from main" below. |
| 6b. The site | done | `pnpm --filter @automata/site build` exit 0 (51 pages), `check:site` passes, site unit 84 files, 518 tests. The built home page in Chromium (desktop 1440 and phone 390): `color-scheme: dark`, background `rgb(11, 12, 14)` = `--bg: #0b0c0e` of `site/src/shared/styles/tokens.css`; `site/src/app.css` is `main`'s whole and `git diff origin/main HEAD -- site/src site/static` is empty (A7). |
| 7. Format, commit, push | done | `pnpm format` run before each commit by the hook's Biome step; pushed. |

## Rulings

- **Play is held to a hit size, Publish to the primary size** (Step 2). The plan's sketch asserted
  `heightOf(play) >= targets.primary`. #567's patterns say "one primary button per screen: Publish is the only lime
  button" and `SuiteHeader.svelte` draws Play at `--size-hit` on purpose, so with touch Play is 44 px and Publish 48.
  The test holds Play to `targets.hit` and Publish to `targets.primary`. (`targets.control` in the sketch is
  `targets.hit` in `editorTargets()`.) The product is unchanged.
- **The camera-rooms test asks for a Room** (Step 1b), the coordinator accepted it. See below.

## The inspector at 1194 (Step 1b)

`levels-3d/inspector/inspector.test.ts` "the camera's rooms in the inspector at ipad-pro-11-landscape" failed:
`[aria-label="Rooms this camera draws"]` was not in the inspector. Nothing was lost: `SectorCard.svelte` merged intact
with `main`'s camera section (`5b5ac5e22`). v2's sidebar is 224 px at `wide` (`--shell-sidebar`, `shell-layout.css`; `main`'s
rail was 56), so at 1194 x 834 the plan canvas is 378 px wide (554 on `main`), and the helper's first tap (30 % across,
45 % down) lands within a touch's reach of the hall's left wall and selects the wall, whose card has no camera rooms.
A tap in the hall's middle gives the card with the list. The test's intent is unchanged: the helper `tapARoom` takes an
optional pattern and this test asks for `Room … selected` (stricter, not looser); the other tests keep the room-or-wall
helper. A second test (`the plan beside the inspector`) pins the width (378 px at least wherever the inspector shows
beside the plan) and taps each room at its middle, computed from the level through the plan's own `fitInto` and
`planViewport`, not from fractions of the canvas.

Other main-side inspector or Details commits since the merge-base (`30667aa3`): only `5b5ac5e22` touches the 3D
inspector; the rest of the `main` commits in the editors' folders are K1 to K16's.

## For the Owner's sheet (Task 5)

**Levels 3D at iPad landscape, with a room selected and the inspector open.** With v2's 224 px sidebar, the 264 px panel
and the 320 px inspector, the plan canvas is **378 px wide at 1194 x 834** (554 px on `main`, 558 px at 1366 x 1024). The
sheet must show that screen (a room selected, the inspector open) with the plan's width stated, so the Owner can judge
whether the plan is too cramped. Options to name: raise `INSPECTOR_MIN_WIDTH` in `DocumentFrame.svelte` from 1100 to about
1268 (the same 460 px plan `main` kept with its 56 px rail; but `main`'s own tests expect the inspector at 1194, so the
tests would change with it), or collapse the sidebar to its 76 px rail while the inspector is open. Not changed here.


## Found by the gates (Task 2 had not run them)

- **Catalog budget.** `examples/3d/cutscenes/cutscenes-door-and-lamp.ts` was 102 code lines against the budget of 100
  (`tooling/examples-runner`, "the real 3d examples pass the catalog"); Task 2's move to `showScene3d` added two. The
  colour function and the canvas's `dataset` are written where they are used; behaviour unchanged (`84964518f`).
- **A torn read of `events.json`.** `@automata/content` `automata-content.test.ts` "follow a new event file without a
  restart" failed once in the whole check with `Unexpected end of JSON input` and passes alone. Cause: v2's
  `writeEventIds` (`event-ids.ts`) truncates the file and then writes it, so a reader (the test, and the editors reading
  it from the dev server) can get an empty file. Test first: a reader polling while the list is rewritten 150 times read
  half a file 451, 797 and 607 times; after writing beside the file and renaming over it, 0. Patch changeset
  `events-list-written-whole.md` (`dcaa063a6`).
- A generated `examples/2d/content/hot-reload/content/generated/events.json` (`[]`) appears whenever that example builds,
  as it does for `games/emberwick` and `games/base-3d`, whose copies v2 committed; it is committed.

## Kept from `main`: K1 to K16 on this tree

| # | Result |
|---|---|
| K1 | `delivery-field` (editors), `dialogue-box` and `delivery` (narrative), `caption` (cutscenes): all pass; `git diff origin/main HEAD` on those four tests and `dialogue-box.ts` is empty (byte-equal). |
| K2 | `plan-view-3d.test.ts` passes (editors unit, 14 tests with K1's). |
| K3 | `pnpm boundaries` exit 0 (238 files, 0 findings); the `git grep features/audio` over feel, sequence and writer prints nothing. |
| K4 | `grep -c data-scroll-region Home.svelte` = 1. |
| K5 | `flex: 1 0 auto` is at `Segmented.svelte:133`. |
| K6 | `createToasts({ clock })` 1, `clock: env.clock` 1. |
| K7 | `template.test.ts` and the whole `create-game` folder: 131 passed, 1 skipped of 132 (14 files). |
| K8 | `pointers.test.ts` 10 of 10. |
| K9 | `pnpm check` exit 0 (above). |
| K10 | 78 test files `main` changed in the editors; 31 differ from `main` here. Read one by one (below). |
| K11 | `stage-3d.test.ts` passes; `git diff origin/main HEAD` on `cutscene-stage-3d.ts` is empty. |
| K12 | the diff of `DialogueBox.svelte` against `main` is v2's three guard lines only; narrative unit 183 of 183. |
| K13 | create-game suite passes with `template-fonts.test.ts`; `uiSounds` appears 2 times in `template-game.ts`. |
| K14 | content unit 538 of 538 (537 + the new torn-read test); the relative-import grep prints nothing. |
| K15 | `git diff origin/main HEAD -- packages/automata/src/app/screens/settings` is empty; `api-index`: 0 undocumented. |
| K16 | `boundaries`, `style`, `source-names` exit 0; `packages/editor/src/features/suite/memory/` does not exist. |

## Task 2's judgement calls, re-checked

- **K10, the 31 test files.** Read the removed lines of each. Every removed or changed assertion is a v2 design change
  with its replacement beside it: the sidebar, the 76 px rail, the 56 px tab bar and the 72 px column on a phone held
  sideways (`suite.test.ts`, `suite-phone.test.ts`; the old "editors fold into a menu" and "tabs scroll sideways" cases
  went with the folding and the scrolling bar), the problem count in words in place of the pill (`suite-edit`,
  `Suite-edit`), Dark first and the new dark tokens (`theme.test.ts`, `dark-levels-3d`: `rgb(11, 12, 14)`), Share and
  Save both secondary because Publish is the one lime button (`DocumentScreen`), "Hits to beat it" for "Hit points"
  (`LevelView`, `inspector`, `field-commit`), and the Levels breadcrumb with its views (`Suite-levels`, `home-model`).
  `Suite-topbar.test.ts` was renamed to `suite-header.test.ts`, not dropped; `main`'s other changes to it were a path move.
  One assertion is weakened by design and goes to the Owner's sheet: `main` showed "Saved in your game folder" in the bar;
  the header says "Saved" (Home still says where). No assertion is dropped for a reason other than v2's design.
- **The default story template against `main`'s plain one.** Generated both from `main`'s `create-game` and from this
  tree (`story: false` and `story: true`, six languages, web target) and diffed every file: no file `main` writes is
  missing in either; the plain game differs in 16 files, all v2's own (tuning, `Bumped` with `entity`, `PLAY` content,
  the feel and audio file built by one function, the `editor` script, the title); `feel-audio.ts` keeps `uiSounds`, the
  fonts scripts and the six languages are in `package.json`/`content/messages`, and `main`'s `automata.content.ts`
  gains only the story's schemas. Not done: an install and `automata check` of each generated game (the workspace
  has no installable copy of `@automata/*` at `^0.0.5`, so that is Task 4's journeys, which link the packages).
- **`automata-content.ts` watches `src` only when it exists.** Content unit 538 of 538, including `main`'s HMR test,
  alone and in the whole check except for the one torn read, whose cause was `writeEventIds`, not the watch (above).
- **`live-list.ts` and `ListPolicy`.** The editor's API changed (`listChanged` to `list: ListPolicy` on the memory
  ports); the reports are regenerated and committed. `SuiteEnv` and `editorsMenu` are the other two changes, private.
- **The content package's `Picture`.** Patch changeset `picture-still-or-clip.md`.

## What did not run

Journeys (Task 4), WebKit, Firefox, the GPU runner, a real device, the install of a generated game.

## For the tracker

| Task | State | Evidence |
|---|---|---|
| 3. v2 on `main`'s gates | done on `claude/editors-v2-landing`, not merged | `pnpm check` exit 0 uncached; build 16 of 16; reports regenerated; layout suites in Chromium, mouse and touch: editor 982, editors 116, editor-3d 287 (+3 skipped); K1 to K16 pass; site build and `check:site` pass; `pnpm secrets` clean on the full history. Not run: journeys (Task 4), WebKit, Firefox, the GPU runner, a real device. |

## What Task 4's brief must know

- The README of `automata editor`-made games says `pnpm editor`; the journeys' harness (`new-game.ts`, `run-editor.ts`) is
  still `main`'s plus v2's, and `claude/editor-journeys-green` is not merged here yet (Task 4 Step 1).
- At 1194 x 834 the plan is 378 px wide beside the open inspector; journeys that tap a plan by fractions of the canvas
  can hit a wall where they used to hit a room (the camera-rooms layout test did).
- Play is a plain 44 px button with touch and Publish the one 48 px primary: `rotation-keeps-the-field` should hold Play
  to the hit size, not the primary one.
- `examples/3d/cutscenes/cutscenes-door-and-lamp.ts` is at the catalog's 100-line budget exactly.
