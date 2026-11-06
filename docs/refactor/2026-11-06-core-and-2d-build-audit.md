# Core and 2D refactor: build audit (stage 5)

- **Stage:** 5 of 6 (build audit). Stage 6 (fixes) closes every finding below.
- **Date:** 2026-11-06, on `claude/project-thread-io2n15`, stacked on the build's last PR (#401,
  `claude/project-thread-ttb6rx`, head `90bfcad6`).
- **Audited:** the build stack #388 to #401 (137 commits over `main` at `da765837`) against the
  [spec](2026-11-05-core-and-2d-spec.md), the [plan](2026-11-05-core-and-2d-plan.md) and its execution log,
  [progress.md](progress.md) and the code itself. Copy and UX against the drunk grandma test (spec section 8).
- **How:** every claim below was checked in the tree at `90bfcad6` with the command shown, not taken from the log.

## 1. Verdict

The build did most of what the spec asks, and the gates that run here are green. The two biggest promises hold:
core is four packages (`sim`, `content`, `automata`, `tools`), and no Effect module is left in `@mcthaydt/automata`
or in Emberwick's bundle (303 kB gzip, down from 360 kB). Tests live in `tests/`, the test count was kept through
each move, and the boundaries, style and browser rules are enforced by `pnpm check`.

It is **not done**, and some of what the tracking says is done is not:

- Two fixes the plan said the refactor "carries" (#379 no double-tap zoom, #383 browser-safe content entries) are
  **not in the tree**. base-3d's dev server is still blank and the iPad still zooms on a double tap (B1, B2).
- The workspace `automata` command **crashes on start** from source, so `automata ship prepare` in Emberwick's and
  base-3d's `prepare-ruken` script and in `game-ci.yml` fails (B3).
- The plan-comment rule skips `.svelte` and `.css` files and the `M4-D9` style of citation: 112 citations are left
  in core and tooling (C1).
- `progress.md`, the plan's checkboxes, `docs/status.md` and `AGENTS.md` disagree with each other and with the code (D1
  to D4).
- None of the stack's PRs has merged or run hosted CI; WebKit and Firefox have never run (E1).

Findings are grouped by kind and ranked by severity: **high** (a promise of the spec is broken or something a
user runs fails), **medium** (the spec and the code disagree, or tracking is wrong), **low** (tidiness).

## 2. What was run (2026-11-06, Node 24.21, Chromium only)

| Gate | Result |
|---|---|
| `pnpm install --frozen-lockfile` | passes |
| `pnpm check` (lint, typecheck 33 tasks, boundaries, style, knip, `test:unit:core` 23 tasks, no cache) | **passes** (lint: 231 warnings, all in `docs/design/*.mjs`, the editors' area) |
| `pnpm build` | **passes** (every package; 19 s with turbo) |
| Emberwick journeys, the three Chromium projects | **28 of 28 pass** (1.7 min; phone, compact, iPad) |
| `node packages/tools/src/app/bin.ts --help` (the workspace `automata` bin) | **fails**: `ERR_MODULE_NOT_FOUND` (B3) |
| WebKit, Firefox, parity in three engines, `test:dist`, consumer smoke, hosted CI | **not run**: WebKit and Firefox downloads are refused here, hosted CI has no runners |

## 3. Findings

### B. Broken behaviour (high)

**B1. #383 was not carried: base-3d's dev server is still blank.** The plan (task 2.1, execution log) and
`progress.md` say #379 and #383 "are carried in task 4.3". They are not. `packages/content/package.json` has no
`./schema` or `./palette` entry (spec section 3.2 lists both), `packages/content/src/entries/` has neither file, and
nine `packages/figures/src` files and `render-pixi3d`'s content kinds still value-import the content root, which
reaches `node:fs/promises` (#383's own reproduction). Deviation 54 treats `schema` and `palette` as "not entries";
that contradicts the spec without a recorded decision.
*Fix:* port #383 (its diff is small: two entry files, `package.json` `exports` and `publishConfig.exports`, the build
entries, the browser-entries test, the two packages' import guards, the imports, the base-3d dev-server journey under
`games/base-3d/tests/e2e-dev/`), with a changeset. Then close #383 naming the PR that carries it (task 9.1).

**B2. #379 was not carried: a double tap still zooms.** `packages/automata/src/shared/ui/theme.css` has no
`touch-action: manipulation` on `html, body` (only on `.af-control`); Emberwick's `style.css` has no
`touch-action` or `-webkit-touch-callout` on `body`; `create-game`'s template `style.css` and `editor-kit`'s
`EditorShell.svelte` miss the guard; the `theme.test.ts` "touch" cases and the editor tests are absent.
This was the Owner's own iPad report.
*Fix:* port #379 into the new paths (`shared/ui/theme.css`, `games/emberwick/style.css`, the template in
`packages/tools/src/shared/create-game/`, `editor-kit`, `editor-suite`), tests first, with a `patch` changeset for
`@mcthaydt/automata` (the original names `automata-ui`, which no longer exists). Close #379 naming the PR.

**B3. The workspace `automata` command crashes on start.** `packages/tools/package.json` points `bin.automata` at
`./src/app/bin.ts`; `cli.ts` imports the editor command, which imports `@mcthaydt/automata-editor-suite/core`, whose
source uses extensionless imports that plain Node cannot load:

```
$ node packages/tools/src/app/bin.ts --help
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../packages/editor-suite/src/core/change-set-journal.schema'
```

pnpm links a workspace bin to the source path (`publishConfig.bin` only applies to the published package), so every
in-repository use fails: `pnpm --filter @af-games/emberwick prepare-ruken`, the same in base-3d, the `check:example`
script of `tools`, and `pnpm exec automata ship prepare` in `game-ci.yml` (the Emberwick and base-3d game jobs). On
`main` the old `automata-ship` bin had no editor import and ran from source. The memory note "use dist/bin.js"
worked around it in the create-game journey instead of fixing it.
*Fix (smallest):* load the editor command with a dynamic `import()` inside the `editor` branch of `cli.ts`, so the
other commands never touch `editor-suite`; add a unit test that spawns `node src/app/bin.ts --help` and expects exit 0
with the usage text. (Giving `editor-suite` explicit `.ts` extensions is the 3D/editors phase's job.)

**B4. `automata-ship --help` says "unknown command: --help".** The alias prints its rename notice, then passes
`--help` on as a command name. A developer asking for help gets an error.
*Fix:* `automata --help`, `automata ship --help` and the alias with `--help` print the usage and exit 0; tests in
`tests/unit/app/bin.test.ts`.

### C. The spec and the code disagree (medium)

**C1. The plan-comment rule misses three kinds of citation; 112 are left.** Spec section 7 says `check-style`
fails on a comment citing a plan. The rule in `tooling/check-style/src/style.ts` (`PLAN_REFERENCE`):

1. reads only `.ts` files: `.svelte` and `.css` are never checked (20 hits in `.svelte`, 4 in `.css` in
   `packages/automata/src`, for example `theme.css` "(M1.6 spec §3.3)", `TouchControls.svelte` "(M4 spec §4.9)");
2. ends `M\d+` with `(?![\w-])`, so `M4-D9`, `M5-D6` and the like pass (30 in `.ts` files);
3. does not match "task 6.4" (5 hits, for example `entries/index.ts` "task 6.4 cut this").
4. names a fixed list of plan prefixes (`DX`, `EX`, `QB`, ...), so `WEB.PLAY.1`, `FR.3`, `EDS.1d` and `PRODUCT.7`
   pass, and `pnpm style` checks only `tooling/*/src`, so `tooling/examples-runner/{host,playground}` and the
   Playwright configs are never read (most of tooling's 33).

Count with the spec's own regex over comment lines (`grep -rnE "(//|/\*|\*|<!--).*\b(M[0-9]+(\.[0-9]+)*|[A-Z]{2,}\.[0-9]+|§[0-9])"`,
tests excluded): automata 64, sim 10, content 2, tools 3 (79 in core: 55 in `.ts`, 20 in `.svelte`, 4 in `.css`),
and 33 in `tooling/`; 112 in all.
*Fix:* tests first: a `.svelte` comment, a CSS comment, `(M4-D9)`, `WEB.PLAY.1` and "task 6.4" each fail (match any
`[A-Z]{2,}(\.[A-Z]+)*\.\d` code, as the spec's regex does); implement (Svelte: the
`<script>` and `<style>` comments; CSS: `/* */` blocks); rewrite the hits to the reason.

**C2. Tests still reach into `src` by relative path in 68 files.** Spec section 3.4: "No `../../src` chains." 55
files in `packages/automata/tests`, 9 in `content`, 16 in `tools` (some files in both counts import more than one),
for example `tests/browser/shared/ui/dialog/dialog.test.ts` importing `'../../../../../src/testing/fixtures/mount.ts'`.
*Fix:* rewrite to `#src/…` (the codemod's rewrite already exists in `tooling/codemods`); add a `check-boundaries`
or `check-style` test that fails on `from '(../)+src/` under `tests/`.

**C8. Four journeys were never moved to `tests/e2e/`.** `tooling/examples-runner/playground/e2e/` still holds
`feasibility.e2e.ts`, `examples.e2e.ts` and `frame.e2e.ts` (its Playwright config's `testDir` and `testMatch` name them),
and `games/base-3d/e2e/base-3d.e2e.ts` is 3D's (fine until that phase). Spec section 3.4 and task 3.3 cover all of
`tooling/`. *Fix:* move the three to `tooling/examples-runner/tests/e2e/*.test.ts` and update the config and
`knip.jsonc`.

**C3. The feature layout is mostly `app/` and `shared/`, and the spec does not say so.** Spec section 3.3 lists
`flow`, `screens` and `settings` as features of `automata`, `world`, `schedule`, `define`, `rng` and `hash` as
features of `sim`, eleven features of `content` and six of `tools`. What was built (deviations 51 to 53, 56):

| Package | `features/` | Moved instead to |
|---|---|---|
| automata | audio, display, extension, input, leaderboards, locale, render, saves, targets | `app/` (flow, screens, every Settings and Saves screen: 51 files, 5,246 lines) and `shared/runtime/` (time, loop, presentation, render, settings storage, loading) |
| sim | replay | `shared/` (define, hash, rng, schedule, world, math, util) |
| content | preload, vite | `shared/` (13 folders: the whole compiler) |
| tools | add, build, editor | `shared/` (check, create-game, ship) |

The rule "no feature imports another" was met by moving the code that crossed features out of `features/`. That is
a reasonable result, but the spec, `AGENTS.md` and the 3D phase still describe the old shape. *Fix:* rewrite spec
section 3.3's lists and diagram to what was built and why (the pipeline cycle in `content`, the screens being the
composition of every feature), so the 3D phase copies the real shape. Do not move code to match the old text.

**C4. Leftover entry scaffolding.** `packages/automata/src/entries/` still holds the codemod's temporary
`from-<old package>.ts` files (`from-automata`, `from-game`, `from-host`, `from-render-pixi`, `from-runtime`,
`from-testing`, `from-ui`) that `index.ts` re-exports, plus a three-file `no-eval` chain:
`from-automata-no-eval.ts` → `from-game-no-eval.ts` → `no-eval.ts`, of which only `no-eval.ts` is an export; the other
two live only because `tests/unit/entries/from-automata.test.ts` imports them. `tools` has `entries/from-node.ts`.
The move map said one `no-eval.ts` (plan task 4.2) and deviation 35 called the `from-*` files temporary.
*Fix:* fold the `from-*` lists into `index.ts` (or name the files by what they hold: `host-contract.ts`,
`runtime.ts`, ...), delete the two dead `no-eval` files and their test lines; the API report must not change.

**C5. Old package names in live text.** `packages/automata/src/testing/ui/index.ts` ("`@mcthaydt/automata-ui/testing`",
"Needs `@mcthaydt/automata-testing` installed"), `tools`' `csp-probe.ts` and `kit-source.ts` (service tags
`@mcthaydt/automata-cli/...`, comments naming `automata-node`), `docs/versions.md` (six rows), `docs/adr/0006` (three
mentions), `tooling/versions/src/stack-cards.ts` (five, which `docs/stack.md` is generated from), and
`tooling/consumer-smoke/src/run.ts` (runs the deprecated `automata-ship` alias, and a comment on
`automata-host/target`). *Fix:* rename to the current packages; consumer smoke runs `automata ship --help`.

**C6. Spec section 1 criterion 4 is met for core only.** "Effect is gone from everything that runs in the
browser": `render-pixi3d` keeps Effect inside (deviation 77) and base-3d ships it. That is the 3D phase's, by
decision D3, but the criterion reads as done. *Fix:* the spec's criterion says "core and Emberwick"; the 3D audit
carries the rest.

**C7. `pnpm check` does not run the changeset checks.** Spec section 3.4's gate table puts `changeset status` and
`check-changesets` in `pnpm check`; they run only in `ci.yml`'s `checks` job. Locally a missing changeset is found
only after pushing. *Fix:* add both to `check` (or change the table; the plan audit's veto default 9 wants them
early).

### D. Tracking says something the tree does not (medium)

**D1. `progress.md` is stale and its numbers are wrong.** The build row still says "8.1's Settings, CLI and README
copy left" and "PRs #393 to #400"; twelve rows say "PR to open" for tasks whose PRs (#389 to #392) exist; "77% (23 of
30)" does not match its own rows (27 rows say Done; 2.1 and 8.2 are partial; 9.2 not started); 4.3's row still lists
"the browser, journey, WebKit/Firefox, 3D and editor runs" as open after 5.4's log says Chromium browser suites ran.
*Fix:* recount (27 of 30 is 90% by the plan's rule, though B1 and B2 reopen 2.1's carry), point each row at its PR,
add the stage 5 record.

**D2. The plan's checkboxes contradict progress.md.** Unticked although progress says done: every step of 1.1 to
1.4, 3.1 and 3.2, 4.3 steps 2 to 4, 4.4 step 4, 5.4 steps 1 to 3 and 6, 8.3's PR step. Ticked although not true:
4.3 step 1 says the old packages' configs are deleted and "one `tsdown.config.ts` builds every entry" (deviation 41
replaced it). The plan's rule is "tick a step only when its check has passed"; where a step is done except for
"green, merge" (no CI here), split the box so the done part is ticked and the merge stays open.

**D3. `docs/status.md` describes a state two sessions old.** It says 5.4 is "still to do", Emberwick has "25
journeys" (28 now), lists PRs up to #398, and does not mention #399 to #401. *Fix:* rewrite from the tree.

**D4. `AGENTS.md` says what is no longer true.** Law 5: Effect "is leaving the browser package (task 5.4 finishes
it" (done). "Gates": "After `pnpm build`, CI also runs `pnpm api-report`, `pnpm api-index`, `pnpm agent-skills`"
(phase 1 moved those to `release-checks.yml`, not pull requests). The test layout line omits `bench/`, `slow/` and
`install/`, which exist. *Fix:* update those three lines.

### E. Not verified (medium; the fix stage runs what it can, the rest goes to the Owner)

**E1. No PR of the stack has merged or run CI, and two engines never ran.** Spec section 10: "each phase is one pull
request, merged before the next starts". Seventeen stacked PRs sit open, sixteen as drafts (`e2e-2d` and `parity`
skip drafts, so even a runner would not start them). WebKit and Firefox have never run on this code: the Emberwick
golden `421c5a1bf522299e` is Chromium-only, and criterion 1 ("journeys pass in Chromium and WebKit") is unproven.
`test:dist`, the consumer smoke and `pnpm lint:actions` did not run either. Deviation 41's risk has shrunk: in today's
`dist/` the `HostError` class is defined once (`shared/runtime/boot-error.js`), but the target bundles still carry their
own host-contract chunks (`dist/rounds-*.js`, `dist/hosting-web-*.js`); only `test:dist` and the consumer smoke prove
a consumer sees one contract.
*Fix:* run `ci:local` with WebKit and Firefox on the Owner's Mac or a runner, then mark the PRs ready and merge
bottom up. Squashing the stack into fewer PRs is an option the Owner may prefer; it is their call.

**E2. Boot failure journey (8.2) is still blocked on Ruken's fake host.** Known, recorded (deviation 64). The
failure copy is asserted only by the no-WebGL journey; spec section 8 asks a journey to assert the failure copy by
role and name. *Fix:* ask Ruken for the refusal switch, or test the panel's copy by role in AF's own fake host,
which AF owns (ADR 0006), and keep the Ruken journey for later.

### G. Copy and UX (drunk grandma, low to medium)

Most strings pass. These do not:

- **G1 (medium).** Default paused screen: the menu button, the confirm question and the confirm button are all
  `Quit to title` (`screens-copy.ts`). "Title" is a game-maker word (she does not know there is a "title screen"),
  and a confirm button that repeats the button she just pressed does not tell her what is about to happen. Try
  `Back to menu` (the word Emberwick already uses), confirm `Leave this game? Unsaved progress is lost.` with
  `Leave` / `Keep playing`.
- **G2.** The same confirm says `This run is lost.` "Run" is a game-maker word, and with saves on it is not true
  (saved progress is kept). Covered by G1's rewrite; the copy test should assert it by role.
- **G3.** Saves: `Couldn't save this slot`. "Slot" is jargon: `Couldn't save your game. Try again.`
- **G4 (medium).** Boot failure: when Ruken's `init` throws and Ruken says a retry cannot succeed,
  `bootFailureView` (`shared/ui/status/boot-failure.ts`, line 145) gives `Couldn't start the game.` with **no
  button at all**. Spec section 8: "one button that fixes the usual cause". She is stuck on a sentence. Give it the
  exit action (`Back to {host}`) when hosted, or a sentence that says what to do (`Close the game and open it
  again.`); one unit test for the view.
- **G5.** `automata-ship --help` (B4) and the four published packages have **no README** (`sim`, `content`,
  `automata`, `tools`; none existed before either). A developer on the npm page sees nothing. One short README each:
  what it is, one install line, one example, link to the docs.

Emberwick itself passes: the keyboard hint hides on touch (`@media (pointer: coarse)`), every button is 44 or 48 px,
the splash moves on by itself after 1.5 s.

### L. Tidiness (low)

- **L1.** `Subscribable.subscribe` on an owner that is already disposed still calls the listener once with the
  current value (the owner runs `stop` at once, then the listener fires). Return before the first call when the
  owner is disposed; one test.
- **L2.** Two undo stacks, `Disposables` (sync) and `Teardown` (async, boot only). A second `Teardown.close()` returns
  before the first finishes, so a caller that awaits it does not wait. Keep the promise of the first `close` and
  return it.
- **L3.** Plain errors keep Effect's `_tag` field (`LoadStalled`, `RendererUnavailable`, ...). Harmless, but say in
  `shared/lib/result.ts` why (matching by tag survives duplicated `dist/` chunks where `instanceof` may not), or drop it.
- **L4.** `.superpowers/` (old SDD ledgers) is at the repository root, outside `docs/archive/`; move it there.
- **L5.** `ci.yml` comments still point at `docs/archive/cloud-parity.md` as the draft parity route, and line 190
  says `automata check` "results stay pending until create-game (DX.5) and automata check (DX.6) land" (both landed).
- **L6.** `entries/index.ts`'s header says "Plus extensions are separate imports"; Plus is free now (AGENTS.md
  history). Say "extensions".

## 4. Spec section 1, line by line

| # | Criterion | Now |
|---|---|---|
| 1 | Emberwick journeys on every PR in Chromium and WebKit | wired (`e2e-2d`), Chromium passes here, WebKit never run (E1) |
| 2 | Owner plays Emberwick on the iPad | not asked yet (after E1; B2 affects it) |
| 3 | Core is four packages, by feature | four packages yes; "by feature" is mostly `app/` and `shared/` (C3) |
| 4 | No Effect in the browser | core and Emberwick yes; 3D no (C6) |
| 5 | Every test in `tests/`, one suffix | yes, except four kept qualifiers (`keys.devices`, `keys.analog`, `fake-hosting.contract`, `create-game.integration`, deviation 18) and 68 files with `../src` chains (C2) |
| 6 | No feature imports a feature, lint says so | yes (`pnpm boundaries`, 0 findings) |
| 7 | Core PRs not blocked by 3D or editors | yes (`3d-and-editors.yml`, not required) |
| 8 | `main` plus fewer than five branches | no: 23 open PRs, 9.2 waits for the Owner |
| 9 | `.vscode/` hides clutter | yes |
| 10 | Drunk grandma | mostly (G1 to G5) |
| 11 | progress.md says 100% | no (D1) |

## 5. Order for the fix stage

1. B3 and B4 (small, unblock `prepare-ruken` and `game-ci`).
2. B1 and B2 (port #383 and #379, tests first; they are the Owner's device bugs).
3. C1, C2, C4, C5, C8 (mechanical, each behind a new failing check).
4. G1 to G5.
5. C3, C6, C7 and D1 to D4 (docs and tracking, last, so they describe the fixed tree).
6. L1 to L6.
7. E1: run what can run, hand the rest to the Owner with the exact commands.

Each fix is one commit with its test; `pnpm check` and the Chromium journeys after each group.
