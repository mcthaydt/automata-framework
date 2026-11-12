# Landing the editors' new look (v2) on `main`: the survey

Plan session, 2026-11-12, branch `claude/editors-v2-landing-plan` from `main` `d401ec4d`. No product code changed, no
subagents. Everything below was measured here, in Chromium only; each section gives its commands. The plan that follows
from it is [`../plans/2026-11-12-editors-v2-landing.md`](../plans/2026-11-12-editors-v2-landing.md).

## The three findings that decide the plan

1. **The closed stack merges into today's `main` with 51 conflicting files, not 882.** The paid-app re-audit's "882 files
   conflict" is what a shallow clone measures. This session's clone was shallow too and gave 882 for #544 at first
   (810 to 957 across the stack). After `git fetch --unshallow` the same trial merges give 44 to 85. The stack and `main`
   share history up to 2026-11-08; git only could not see it.
2. **The v2 look's real tip is #567, not #559.** #562 (the build audit and five journey fixes) and #567 (the audit's
   fixes: breadcrumb, phone header, Home names) sit on top of #559. Their branches were not restored, but their commits
   are fetchable as `refs/pull/562/head` and `refs/pull/567/head`. Landing #559 alone would land a look whose own audit
   found three high defects.
3. **Typed words are lost on `main` today.** A text field commits only on Enter or when focus leaves it. A reproduction
   is described in section 6.

## What was run

| What | Result |
|---|---|
| `git fetch origin main && git checkout -B claude/editors-v2-landing-plan origin/main`; `pnpm install --frozen-lockfile` | `d401ec4d`; exit 0 |
| `git rev-parse --is-shallow-repository` | `true` at first; `git fetch --unshallow origin`, then `false` |
| `git fetch origin refs/pull/<n>/head:refs/remotes/pr/<n>` for 508, 512, 519, 522, 523, 528, 531, 532, 534, 536, 538, 544, 545, 548, 559, 560, 562, 564, 567, 570 | all fetched |
| `gh api repos/mcthaydt/automata-framework/pulls/<n>` and `.../issues/<n>/comments` for the same | all `closed`, `merged_at: null`, closed 2026-11-12 21:01:44 to 21:02:05 |
| `gh api -X GET repos/…/pulls -f state=closed -f per_page=100`, filtered to closed unmerged today | 91 pull requests |
| Trial merges, `git merge --no-commit --no-ff pr/<n>` on `origin/main` in a scratch worktree, each aborted, nothing pushed | section 2 |
| `tooling/codemods/src/rename-scope-cli.ts` run on #531's tree in the scratch worktree, then the trial merge again | section 2 |
| Each pull request's own diff applied to `main` one file at a time with `git apply --3way` | section 2 |
| `pnpm install --frozen-lockfile` on `pr/567` in the scratch worktree; its unit and Chromium layout suites | section 4 |
| A scratch DOM test of the typed-words loss on `main`, written, run, deleted | section 6 |

Not run: WebKit, Firefox, the GPU runner, any journey (Playwright) suite, `pnpm check` on any stack branch, a real
phone or iPad, anything against GitHub's or Cloudflare's services. `claude/ship-3d-plan`, `claude/editor-journeys-green`
and `claude/scope-rename` are not on `origin` (`git fetch origin <branch>`: "couldn't find remote ref"), so nothing here
was checked against them.

## 1. The graph of the closed editor stack

`main` here is the common history up to 2026-11-08 (merge-bases `22d41ddc`, 12:59 UTC, and `30667aa3`, 16:26 UTC).

```
main (2026-11-08)
└─ #508  complete-game journeys, the every-editor page          cf6a8e6a
   └─ #522  shared editors: every editor in new 2D and 3D games 5cf0825b
      ├─ #523  build audit of #522 (docs)                        57157666
      ├─ #534  fixes for #523's findings                         3736b0ac
      │  └─ #559  THE V2 LOOK, built (contains #534)             68cdd642
      │     └─ #562  v2 build audit + 5 journey fixes            43907511
      │        └─ #567  v2 audit fixes  ◀ the v2 tip             47391563
      │           └─ #570 … #573  3D painted look (not editors)
      └─ #532  every editor free on the web, sample kept         829039d5
         ├─ #545  build audit of #532 (docs)                     5c3ff908
         │  └─ #548  fixes for #545  ◀ the web tip               3c2c37f5
         ├─ #544  typed words, games in the browser, GitHub sync f380d358
         │  └─ #560  build audit of #544 (docs)                  ecfccbf2
         │     └─ #564  fixes for #560  ◀ the sync tip           cc10fdfd
         └─ #538  AI game maker fixes (not editors' look)
main ── #512 shared-editors spec and plan ── #519 v2 spec and plan (docs; copied into the stack)
main ── #528 ── #536 ── #537  saving and sign-in audit, spec, plan (docs; copied into #544)
main ── #531  the paid app's first build session (old `@mcthaydt/*` names)   714796a2
```

Commands: `gh api …/pulls/<n> --jq '.base.ref, .head.sha'`; `git merge-base --is-ancestor pr/<a> pr/<b>` for every pair.
The three tips do not contain each other: v2 (#567) has neither #532 nor #544; the web tip has neither v2 nor sync; the
sync tip has neither v2 nor #548's fixes.

Own diff is `git diff --shortstat <base head>...<head>`:

| PR | Base | Own diff | What it delivered (its body and tests) | Audit, and are the fixes in the stack |
|---|---|---|---|---|
| #508 | `main` | 776 files, +28,260 −17,337 (GitHub's count; 24 commits not on `main`) | One page with every editor (`extensions/editors` imports `editors3d` from `@automata/editor-3d/suite`); `complete-game-2d` and `complete-game-3d` journeys; `page-for.ts` | none of its own |
| #522 | #508 | 193 files, +11,100 −738 | The rail shows every editor of the game's kinds, a Home card each, "More" on a phone; new 2D and 3D games carry a keeper, a cutscene, a guard; `StageCharacters` port; 3D cutscene stage | #523: 1 critical, 2 high, 4 medium, 4 low. Fixed in #534, which v2 contains |
| #534 | #522 | 60 files, +1,100 −145 | #523's fixes; journey `new-game-checks`; 46 editor icons | — |
| #559 | #534 | 349 files, +13,771 −2,291 (45 commits, 9 merges) | v2: Dark by default, one lime Publish, inset work panel, sidebar or tab bar, breadcrumb header, rows and label-left fields, floating canvas tools, empty states, in every editor | #562: 3 high, 4 medium, 5 low |
| #562 | #559 | 8 files, +224 −8 | The audit; journey waits J1 to J4; new journey `work-survives-reopening` | — |
| #567 | #562 | 51 files, +1,026 −190 | Every #562 finding answered except F3 (a white strip in headless phone captures, not reproduced as a defect; "look at the phone's level once on a real device") | — |
| #532 | #522 | 37 files, +418 −309 | `automata editor` opens the one page for every game (`page-for.ts` gone); the site's try-it opens it on a sample with a file in every editor; the sample is kept in the browser's private storage | #545: 4 high, 6 medium, 4 low. Fixed in #548 except L4 |
| #548 | #545 | 137 files, +662 −193 | #545's fixes; Pixi 3D loads before anything draws; `check-pixi3d-public.ts` refuses a release that carries the vendored beta | — |
| #544 | #532 | 146 files, +13,143 −249 | Phase 1 typed words saved; phase 2 games kept in the browser; phases 4 and 5 GitHub sign-in (a Cloudflare Pages Function) and sync over GitHub's REST API | #560: 3 high (B1 to B3), 7 medium, 4 low. #564 fixes all but B4 and B9 |
| #564 | #560 | 48 files, +1,037 −70 | Drafts keyed by the field's place; a pull waits while a person types; honest "Sending to GitHub…" | — |
| #531 | `main` | 127 files, +8,336 −773 | The paid app's first build session (the re-audit's F5 lists it) | none |

**Was the stack green when it closed?** By its own bodies: #567 ran `pnpm check` (pass) and the journeys at iPad and
phone in Chromium (pass, two flakes that passed on rerun). Nothing in the stack ever ran in WebKit, Firefox or on the GPU
runner. Hosted CI was red on `base-3d through game-ci` for the artifact quota, not for code. **Run here, the v2 tip is
green but for one layout test** (section 4): 6,415 unit tests and 1,082 of 1,084 Chromium layout tests pass.

## 2. How far `main` has moved, and the trial merges

`git merge-base origin/main pr/<n>`, `git rev-list --count`, `git rev-list --first-parent --count`:

| Branch | Merge-base | Commits ahead | `main` ahead | `main`'s merges since |
|---|---|---|---|---|
| #508, #522, #532, #548, #544, #564 | `22d41ddc` 2026-11-08 12:59 UTC | 24, 42, 43, 47, 64, 74 | 1,020 | 107 |
| #559, #567 | `30667aa3` 2026-11-08 16:26 UTC (two merge-bases) | 61, 63 | 992 | 107 |
| #531 | `c68a666a` 2026-11-08 21:49 UTC | 24 | 1,485 | 83 |

**The stack is already in today's shape.** `git ls-tree pr/559 packages/` is `3d automata content editor editor-3d sim
tools`, the same seven as `main`; `packages/editor/src` is `app/ features/ shared/ entries/ testing/`; the scope is
`@automata/*` (`git grep -l '@mcthaydt/' pr/<n> -- . ':!pnpm-lock.yaml' ':!docs'`: 6 files on every stack branch and the
same 6 on `main`; 1,925 to 1,984 files name `@automata/`). Only #531 is on the old names (984 files, 0 on the new).

The big moves on `main` since: the trunk's gates after the refactor's merge (2026-11-09), The Last Light's framework
(#643, 22 editor files), the builders' look (#640, #648, #655), the shared polish (#645, 433 files, none in the editors;
#654), the builders fold (#661, 284 files; #663), CI green (#666). In the editors' folders `main` changed 209 files since
the v2 merge-base and v2 changed 337; **57 are changed on both sides** (`comm -12` of the two `git diff --name-only`
lists per folder).

### Trial merges with `main` (scratch worktree, `merge.renameLimit 20000`, each aborted)

Conflicts are `git status --porcelain` rows `UU AA DU UD AU UA DD`.

| Branch | Shallow clone (wrong) | **Full history** | Generated | Docs | Deleted on `main` | Both added | Rename against add | Both changed, source | Both changed, tests | Manifests, workflows | Lockfile |
|---|---|---|---|---|---|---|---|---|---|---|---|
| #508 | 810 | **44** | 2 | 3 | 1 | 1 | 0 | 28 | 8 | 1 | merged clean |
| #522 | 863 | **65** | 2 | 3 | 1 | 3 | 1 | 43 | 10 | 2 | merged clean |
| #534 | — | **66** | 2 | 3 | 1 | 3 | 2 | 43 | 10 | 2 | merged clean |
| #559 | 911 | **48** | 2 | 2 | 1 | 3 | 2 | 31 | 6 | 1 | merged clean |
| **#567 (v2 tip)** | 919 | **51** | 2 | 2 | 1 | 3 | 4 | 32 | 6 | 1 | merged clean |
| #532 | 871 | **70** | 2 | 3 | 3 | 3 | 1 | 45 | 11 | 2 | merged clean |
| **#548 (web tip)** | 957 | **76** | 2 | 3 | 4 | 3 | 1 | 46 | 13 | 4 | merged clean |
| #544 | 882 | **85** | 3 | 4 | 3 | 3 | 1 | 54 | 15 | 2 | merged clean |
| **#564 (sync tip)** | 885 | **85** | 3 | 4 | 3 | 3 | 1 | 54 | 15 | 2 | merged clean |
| #531 | 29 | **29** | 2 | 2 | 1 (+1 deleted on the branch) | 0 | 0 | 12 | 5 | 5 (with `pnpm-workspace.yaml`) | **conflicts** |

"Generated" is the agent's `api.md`, `docs/cheatsheet.md` and `tooling/api-report/reports/*`: regenerated, never merged
by hand. "Renamed path only" as its own kind: none; git followed every rename. The lockfile merges textually and is
regenerated by `pnpm install` anyway.

The v2 tip's 51 files hold **63 conflict hunks** (`grep -c '^<<<<<<<'` per file): 46 files have one, the worst has six
(`extensions/editors/src/features/sequence/sequence-names.ts`). #548 holds 113 hunks, #564 130. The v2 tip's files:

- docs and generated (5): `api.md`, `cheatsheet.md`, `docs/refactor/progress.md`, `docs/status.md`,
  `.changeset/runner-port-offset.md`;
- the editors' shell (9): `Suite.svelte`, `Home.svelte`, `open-suite-ports.ts`, `sample-ports.ts`, `suite-editor.ts`,
  `memory-workspace.ts`, `live-list.ts`, `Levels2dTools.svelte`, `suite-layout.ts`;
- the content editors (10): Writer (4), Sequence (4), `audio-session.svelte.ts`, `shared/audio-play.ts`;
- narrative and cutscenes (7): `DialogueBox.svelte`, `dialogue-box.ts` and its test, the 3D cutscene stage (both sides
  added it), `lint.ts`, `package.json`;
- content and core (6): `automata-content.ts` and its test, `controls.schema.ts`, `picture-of.ts`, the settings screen
  and its copy;
- `create-game` (5): `template.ts`, `template-game.ts`, `template-level.ts`, `template-project.ts`, `template.test.ts`;
- tests (7), two 3D examples, `site/src/app.css`.

**Between the tips** (`git merge --no-commit pr/<b>` on `pr/<a>`): the web tip into the v2 tip conflicts in 8 files, the
sync tip into the v2 tip in 12, the sync tip into the web tip in 3.

### Mechanical renames first

`tooling/codemods/src` holds `rename-scope.ts` with `rename-scope-cli.ts` (the scope), `move-modules.ts` with
`move-modules-cli.ts` and `move-tests.ts` (the layout moves, by `docs/refactor/move-map.json`), `module-specifiers.ts`
and `remap-palette.ts`.

| Branch | Before | After the codemod | Why |
|---|---|---|---|
| The six stack branches, #567, #548, #564 | 44 to 85 | the same | Nothing to rename: they are already `@automata/*` and already in the `app/ features/ shared/` layout |
| #531 | 29 | **445** (104 deleted on `main`, 340 both changed) | `rename-scope-cli.ts` changed 998 files on the branch; every one `main` also touched since now conflicts. The codemod on a branch before a merge makes it worse, not better |

So for the scope rename still to come (`@automata/*` to the Owner's organisation): **merge `main` first, run the codemod
after**, never the reverse. The brief's "each branch catches up by running it on itself before merging main" would turn
a 51-file merge into a several-hundred-file one. This is for the coordinator and the rename's own plan.

### Each pull request's own diff, replayed on `main`

`git diff --binary <base> <head> -- <file> | git apply --3way`, one file at a time, on `origin/main`:

| Own diff | Files | Apply clean | Conflict | Cannot apply (path gone or changed past the base) |
|---|---|---|---|---|
| #522 | 195 | 163 | 26 | 6 |
| #534 | 60 | 30 | 16 | 14 |
| #559 | 351 | 260 | 73 | 18 |
| #562 | 8 | 4 | 2 | 2 |
| #567 | 51 | 18 | 21 | 12 |
| v2 as one (#534..#567) | 373 | 276 | 77 | 20 |
| #532 | 37 | 22 | 10 | 5 |
| #548 | 137 | 117 | 13 | 7 |
| #544 | 146 | 120 | 24 | 2 |
| #564 | 48 | 16 | 10 | 22 |

Replaying is worse than merging at every step: v2 alone is 77 conflicts and 20 unappliable files against the merge's 51
for v2 **and everything under it** (#508, #522, #534), because a replay throws away the history git uses to see what
`main` already has.

## 3. What of the stack is already on `main`

By ancestry (`git merge-base --is-ancestor <head> origin/main`) over the 91 pull requests closed today: 16 heads are
already in `main` (#465, #467, #473, #476, #477, #488, #490, #493, #499, #503, #510, #513, #543, #551, #553, #555).
Closing them lost nothing. **None of the editor stack is**: #480, #483, #491, #494, #508, #522, #532, #534, #544, #548,
#559, #562, #564 and #567 are in no ancestor of `main`.

By content, for the items the audits call superseded:

| Item | On `main`? | How checked |
|---|---|---|
| The every-editor page | **No.** `main`'s `extensions/editors/src/app/suite/main.ts` makes the Tuner, Levels 2D and the five content editors; it imports nothing from `@automata/editor-3d` | `sed -n 1,60p` of the file; the same file on `pr/567` line 17 imports `editors3d` |
| `automata editor` refusing a 3D game | Still refuses: `editor-command.ts:94` "The 3D editors are not in this release yet."; `page-for.ts` is on `main` and on v2, gone on #532 | `grep -n 'not in this release'`; `git ls-tree` |
| The v2 kit (`kit/nav`, `kit/rows`, `kit/sheets`, `kit/states`, `kit/toolbar`), `SuiteHeader`, `SaveState`, `ProblemCount` | **No**, none of the 25 new source files | `git cat-file -e origin/main:<path>` per file added by #534..#567 |
| Part of #559's own diff | **Yes, 85 of 351 files**: 30 it added are byte-identical on `main` and 55 it modified equal `main`'s copy. These are what #559's nine merges brought in from branches that later reached `main` (Levels 3D, dark mode), not the look | blob comparison of `pr/559:<f>` with `origin/main:<f>` |
| Audio's mix (#500) | 36 of its 44 files are identical on `main` | the same comparison |
| The 2D Schematic journey's Follow wait, the 3D story journeys | On `main` as `92b708f2` and `af1e7bc0` (#666), by the ship audit; not re-derived here | the ship audit's table |
| #562's journey waits J1 to J4 and `work-survives-reopening` | **No**: `main` has 18 editor journeys, v2 has 23; `complete-game-2d`, `complete-game-3d`, `new-game-checks`, `tuner-after-levels` and `work-survives-reopening` are missing | `ls packages/editor/tests/e2e/journeys` on both |
| `automata editor`'s seams for the paid app (`GET /api/watch`, `--app-origin`) | No; they are #531's | the re-audit's F5 |
| The site's try-it on every editor, kept in the browser | **No**: `site/scripts/build-demos.ts:99-104` copies `packages/editor/dist/suite`, the 2D suite | `grep -n editor site/scripts/build-demos.ts` |

## 4. v2 itself

**Where it lives** (on `pr/567`):

- Tokens and the look: `packages/editor/src/shared/kit/tool-theme.css` (+93 lines of Dark and the lime action),
  `tool-chrome.css`, `tokens.css`, `shell/shell-layout.css` (156 lines changed), `shell/shell-regions.css`.
- Kit components, all new: `kit/nav/{Sidebar,TabBar}.svelte`, `rail-keys.ts`, `tab-slots.ts`;
  `kit/rows/{Row,Field,Section,Block}.svelte`; `kit/sheets/Sheet.svelte`; `kit/states/EmptyState.svelte`;
  `kit/toolbar/FloatingToolbar.svelte`.
- The shell: `features/suite/shell/{SuiteHeader,SaveState,ProblemCount}.svelte`, `rail-fit.ts`,
  `features/suite/core/problem-counts.ts`; `SuiteTopBar.svelte` and `SuitePills.svelte` are deleted and `SuiteRail`
  is rebuilt on `Sidebar` and `TabBar`.
- Levels 2D's header: `app/suite/levels-2d/levels-2d-header.ts`, `levels-2d-home-names.ts`,
  `features/level/level-picker-model.ts`.
- Each editor restyled: 62 files in `extensions/editors/src`, 14 in `packages/editor-3d/src`.
- The patterns: `docs/design/editors-v2/PATTERNS.md`; the spec, plan, plan audit and build audit in `docs/refactor/`
  (`2026-11-08-editors-v2-*.md`, `2026-11-09-editors-v2-build-audit.md`). None of these documents is on `main`.

**`main`'s pre-v2 shell:** `packages/editor/src/features/suite/shell/` holds `SuiteTopBar.svelte`, `SuiteRail.svelte`,
`SuitePills.svelte`, `Suite.svelte`, `Home.svelte`, `SuiteHome.svelte`; `shared/kit/` has no `nav`, `rows`, `sheets`,
`states` or `toolbar` folder.

**What `main` changed that v2 must keep.** 48 commits on `main` since the merge-base touch the editors' folders
(`git log --no-merges 30667aa3..origin/main -- packages/editor packages/editor-3d extensions/editors
packages/tools/src/features/editor`). A merge keeps every one that does not conflict by itself. The ones that meet v2 in
the same files, and so are decided by hand, are:

| On `main` | Commit | Meets v2 in |
|---|---|---|
| Writer edits how a line is said; the box and caption type it out | `6efc228d` | `WriterPanel.svelte`, `writer-model.ts`, `dialogue-model.ts`, `writer-session.svelte.ts`, `DialogueBox.svelte`, `dialogue-box.ts` |
| Sequence previews a cutscene over a 3D level | `b302f205` | `SequencePreview.svelte`, `plan-view.ts`, `sequence-names.ts`, `sequence-session.svelte.ts`, the 3D cutscene stage (added on both sides) |
| `AudioPlay` and `humanize` in `shared/`, so no feature imports another (after two reverts) | `4b285235`, `053b40fe` | `extensions/editors/src/shared/audio-play.ts` (added on both sides), `audio-session.svelte.ts` |
| The suite Home is a declared scroll region | `ca2dc922` | `Home.svelte`, `Suite.svelte` |
| A segmented option never shrinks under its words | `05d93b11` | merges clean; v2's rows must not undo it |
| The suite's toasts take a clock | `82a1924e` | `Suite.svelte` |
| A new game plays the level the editor saved, under any name | `fc1c6cff` | `template-*.ts` (5 files) |
| The level scene test reads the stage tokens; selects take the kit's size | `1c17124c` | `level-scene.test.ts`, `suite-layout.ts` |
| A tap lifts in the task that pressed it; every 3D journey poll gets 10 s | `4ebafaae`, `3a4b3bee` | merge clean; the harness v2's journeys use |
| A camera view names the rooms it draws; the default gameplay camera | `5b5ac5e2`, `dd8f7164` | `packages/editor-3d`, merges clean |
| The builders fold: figures and the painter in the framework | #661 | two 3D examples; `character-kit` |
| The shared polish: six languages, settings copy | #645, #654 | `SettingsScreen.svelte`, `settings-copy.ts` |

**The stack's suites, run here on `pr/567` as it is** (scratch worktree, `pnpm install --frozen-lockfile` exit 0,
Chromium only):

| Suite | Command | Result |
|---|---|---|
| `packages/editor` unit | `pnpm exec vitest run --project unit` | 285 files, 3,471 tests, all pass (91 s) |
| `extensions/editors` unit | the same | 685 tests, all pass (40 s) |
| `packages/editor-3d` unit | the same | 2,259 tests, all pass (87 s) |
| `packages/editor` layout and storage | `pnpm exec vitest run --project layout --project storage --browser.name=chromium` | **966 of 968 pass.** One test fails, with a mouse and with touch, and fails again run alone: `suite-header.test.ts` > "The header at ipad-pro-11-portrait (834 x 1194) > has Play, Publish, Undo, Redo and the problems whole, and Publish the only lime button": `Error: no Not checked yet`. #567's F5 hides the problem count under 900 px when there is nothing to count; the test at 834 px still looks for it. #567's body lists only the Levels, Schematic and Layers layout tests as run |
| `extensions/editors` layout | `pnpm exec vitest run --project layout --browser.name=chromium` | 6 files, 116 tests, all pass (26 s) |
| Journeys (`playwright test -c playwright.journeys.config.ts` in both packages), `pnpm check`, `pnpm build` | not run here | The bodies of #562 and #567 report them green in Chromium at phone and iPad |

**Pictures.** The editors have no compared visual baselines (`git ls-tree -r … | grep -c '\.png$'` is 0 for the three
editor packages on `main` and on v2). The recorded pictures of the editor are the site's:
`site/static/previews/editor.webp` and `editor-640.webp`. Those move only after the Owner has seen the sheet.

## 5. The every-editor page

**Yes, and it exists from #508 up.** `extensions/editors/src/app/suite/main.ts` on #508, #522, #559 and #567 makes the
Tuner and Levels 2D, spreads `contentEditors(…)` (Feel, Audio, Writer, Sequence, Schematic) and `editors3d` from
`@automata/editor-3d/suite` (Levels 3D and Characters). A game sees all of them except those for the other kind of game
(a 2D game has no Levels 3D). On those branches `automata editor` serves it only when the game's list names a 3D or
content editor (`page-for.ts`).

**#532 and #548 make it the only page.** `page-for.ts` and the refusal are gone; `packages/tools/scripts/copy-editor.ts`
packs it into `dist/editors/suite`; the two build scans stop refusing Pixi 3D (they still refuse its `./extras` entry).
The site's "Try the editor" opens that page on a sample: `extensions/editors/src/app/suite/sample/` holds
`editors.toml`, `audio.toml`, `cutscene.toml`, `dialogue.toml`, `feel.toml`, `lines.toml`, `nav.toml`, `systems.toml`,
with a 2D level started from a template and a 3D room and characters. The sample is kept in the browser's private
storage (it was in memory and every edit was lost on reload); a browser that cannot keep it says "Your changes are lost
when you close this page." #548 adds: Pixi 3D loads before anything draws (no "Preview unavailable", no Characters 3D
freeze under software WebGL), "Characters 2D" and "Characters 3D" apart on the rail, and a release guard.

**Two things #532 leaves open:** it packs the 3D suite into `@automata/tools`, which the 3D lane's spec (Part C) rules
out (2,513 kB today against a 3 MB budget; the editors ship as their own package). And its site half edits
`site/src/features/editor/EditorPage.svelte`, which `main` no longer has (`ls site/src/features`: no `editor`).

## 6. Saving

**The data-loss bug is on `main`.** `packages/editor/src/shared/kit/fields/FieldEditor.svelte:64-78` commits a text
field in `onTextKey` (Enter) and `onTextBlur` only. `extensions/editors/src/shared/ui/WordsField.svelte:33` and
`FieldRow.svelte:88` commit on `change`, which a browser fires when focus leaves. `kit/storage/page-lifecycle.ts`
flushes on `visibilitychange` and `pagehide`, but it writes edits that were already committed; words still in the field
were never handed to it.

*Reproduction (run here, not committed):* a jsdom test beside `FieldEditor.test.ts` mounts a `text` row with the value
"Keeper", clicks the box, types " of the gate", advances fake timers 5 s, dispatches `pagehide` on `window` and
`visibilitychange` on `document`, and expects `oncommit` to have been called with "Keeper of the gate". On `main`:
`AssertionError: expected "vi.fn()" to be called with arguments: [ 'Keeper of the gate' ]. Number of calls: 0`. In a
person's words: type a line in Writer, close the tab, and the line is gone. `main`'s own test names the behaviour:
"commits text on Enter and on blur, not on each key".

**#544's phase 1 is the fix**: three commits (`bd43773f`, `a6574d64`, `bb233f40`), 52 files, +2,395 −135 as they land
on `main`: `kit/widgets/typed-save.ts` (write 500 ms after the last key, on leaving, when the page hides),
`kit/storage/typing-drafts.ts` (a draft in the browser until the write lands), `leave-guard.ts`, `save-line.ts`,
`keep-storage.ts`, one Undo step per visit to a field, in Writer, Feel, the Tuner, Stepper, colour hex and the
Characters and Tiles fields; journeys `typed-words-kept`. Its audit (#560) found that drafts keyed by a field's **label**
go back into the wrong field (B1, high); #564 fixes that (keyed by place) and adds `typed-words-fields`.

`git cherry-pick --no-commit` of the three onto `main`: 8, 0 and 4 conflicting files (12 of 52): `Suite.svelte`,
`open-suite-ports.ts`, `suite-session.ts`, `suite-ports.ts` and their two tests, two docs, and four Characters and Tiles
inspectors. It also edits `SuiteTopBar.svelte` (18 lines, the saved line), the file v2 deletes.

**The sign-in phases** (4 and 5) are a Cloudflare Pages Function (`site/functions/api/github/[[route]].ts`), a REST
engine (`kit/sync/rest-engine.ts`), "Your games on GitHub" and the clash dialog. Nothing ran against the real GitHub or
Cloudflare; Privacy and Terms wait for the Owner's words. The Owner's ruling of 2026-11-08 stands in #544's spec: "D2:
GitHub sync is free on the web". `main`'s Home already says it (`home-content.ts:216`) with no code behind it.

**A cheaper honest route for sync than rebuilding it:** the sync tip merges into `main` with 85 conflicting files and
into the v2 tip with 12. Once v2 and the web chain are on `main`, merging the sync tip is one more merge of the same
kind, with its tests. The re-audit's "rebuild on `main`" was sized on the 882 figure.
