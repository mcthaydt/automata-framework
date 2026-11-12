# Ship readiness: what stands between `main` and a framework a stranger can install

Audit session, 2026-11-12, branch `claude/ship-readiness-audit`, from `main` `517a6eef` (PR #666 merged at 21:12 UTC, a
minute after this session started; the session moved to it). PR #665 merged later, as `d401ec4d` (21:27 UTC); the CI
results on it are recorded where they change a row. No product code changed, no subagents. Every fact below
says how it was found. Times are this container's: 4 CPUs, Chromium on SwiftShader only (no WebKit, no Firefox, no GPU).
Node 24.22.1 from `/opt/node24` for the runs (the container's default `node` is 22.23.4; `.nvmrc` asks for 24.21.0).

## Verdict

> **Superseded in scope by Part 2** (end of this document): the Owner has since ruled that the first release ships
> with 3D, the editors and desktop apps, so the "2D first" recommendation below is withdrawn. Part 2 holds the ship list
> for the full scope.

AF is close in code and far in accounts. A stranger's 2D path works end to end from packed tarballs today: make a game,
install it, check it, test it, build it, play it in Chromium and make its itch.io zip (the stranger's journey, 52 s,
pass). The packages build, the API report and index match, the agent skills are in step and the packed-install smoke
passes all 16 steps. What blocks a launch is mostly outside the code. **The single biggest risk: the package names
cannot be published.** The `@automata` scope on npmjs.org belongs to another account (it holds `noflo-webaudio`, `zeh`
and 13 more), so `npx @automata/tools create-game`, the first command on the README and the site, can never work as
written. Nothing under `@automata/*` or `@automataframework/*` is on the registry today. The second risk is the
domain: `automataframework.com` is not registered (RDAP 404, NXDOMAIN), yet `SECURITY.md` and every site page send mail
there. The fastest honest launch is **2D first**: publish the 13 public packages under a scope the Owner owns, deploy the
site and open the repository. 3D is a later beta. `@pixi/3d` went public today (0.1.0, MIT), but `@automata/3d` ships
raw TypeScript that a stranger's 3D game cannot load (measured below), and its kits depend on a private painter.

## The ship list

Sizes: S is under a session, M is about a session, L is several. "Session" means an agent session on its own branch.

### MUST for a 2D launch, in order

The Owner's account steps come first because they take days to settle, and the code steps can run beside them.

| # | What is wrong (evidence) | Done looks like | Size | Who | Depends on |
|---|---|---|---|---|---|
| M1 | **The npm scope is taken.** `curl https://registry.npmjs.org/-/org/automata/package` returns another account's 15 packages (`noflo-webaudio`, `noflo-canvas`, `zeh`, …); `-/org/automataframework/package` returns `Scope not found` (free). `npm view @automata/framework` and `@automataframework/framework`: E404. The runbook (`docs/runbook.md` "Launch the website", steps 2 and 4) already plans the rename; `site/scripts/check-launch.ts:42` says so; `AGENTS.md` and `.changeset/first-public-release.md` still say `@automata/*` | The Owner creates the npm organisation (the runbook says `automataframework`) and decides the name; one session runs the rename (`tooling/codemods/src/rename-scope-cli.ts` exists) over packages, docs, site, agent package, changesets and `AGENTS.md`, then `pnpm build`, `pnpm api-report --update`, `pnpm api-index --write`, `pnpm check` | Owner S, session M | nothing |
| M2 | **The domain does not exist.** `rdap.verisign.com/com/v1/domain/automataframework.com`: 404; `dns.google` A and MX: NXDOMAIN (Status 3). `SECURITY.md:9` and `site/src/shared/site.js:7-8` give `hello@automataframework.com`, so a security report sent today bounces, and anyone can buy the name | The Owner registers the domain and opens the mailbox (MX record) | Owner S | nothing |
| M3 | **The publish job cannot finish in time.** `release-packages.yml`'s `publish` job has `timeout-minutes: 20` and runs the whole `pnpm check` before it builds and publishes. On the Owner's Mac the same checks take 26 min (ci run 43271549732, job "lint, typecheck, boundaries, style, unit": 18:41:01 to 19:07:17; `pnpm test:unit` alone 18:48:21 to 19:06:54). The `version` job has the same fault and was cancelled on `c364a215` (run 43271549826) and again on `517a6eef` (run 43307899627: "Check the commit being versioned" 21:15:53 to 21:32:54, cancelled). PR #665 (merged as `d401ec4d`) fixed the `version` job and the `checks` job: on `d401ec4d` the version job passed in 8 min 43 s (run 43310470992, job 131508293078). The `publish` job is unchanged | The `publish` job either drops the unit tests (ci.yml ran them on the same commit) or gets a limit that fits check, build, publish and the registry smoke | S | nothing |
| M4 | **The site's launch gate crashes before it checks anything.** `pnpm --filter @automata/site check:launch` (the deploy job's first step, `site.yml:66`): `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../site/src/shared/content/agent-prompt' imported from .../site/src/features/home/home-content.ts`. `home-content.ts:7` imports without `.ts`; Vite and Vitest resolve it, Node does not. Its unit tests pass because they import the functions, not the script | The import names `.ts`; a test runs the script under plain Node and expects its own refusals, not a crash | S | nothing |
| M5 | **The 2D journeys gate is red, and two of its steps have not run in CI since 2026-11-06.** Run here (below, "2D"): the editor's journeys fail. The harness (`packages/editor/tests/e2e/harness/new-game.ts`) links Emberwick's `node_modules` into a new `create-game` game, but a new game now imports `@automata/feel` and `@automata/audio-synth` in its `vite.config.ts`, and Emberwick has neither. Reproduced by hand: `Could not resolve '@automata/audio-synth' in vite.config.ts`, then `automata editor` prints "Play is off" and hides Play, and every journey that clicks Play waits its whole 180 s limit (six files click Play). In CI the job is cancelled at its 30 min limit inside "The editor's journeys" (ci run 43271549732, job 131444747776), so "The website" and "The stranger's journey" are skipped | The harness links every package a new game lists (or reads the game's `package.json`); the editor suite passes in Chromium. **And the job's budget:** measured here, the website's Chromium project alone takes 13 min 9 s and the editor suite's two Chromium projects 19 min 17 s (with 12 tests each burning 180 s; perhaps 8 to 10 min once fixed), after the first step's 15 min 44 s in CI. Green, these still do not fit in 30 min with the WebKit projects on top: split the job (editor, website, stranger) or raise its limit | S to M | nothing |
| M6 | **`main`'s CI is not yet green after #666.** Last finished run on `main` (`c364a215`): ci failed at parity, `@automata/framework#test:browser` on `af-mac-3` (job 131444747679); release checks failed at `test:dist` (job 131369926912). #666 says it fixes both (its record in `docs/refactor/progress.md`, "CI green, second pass"); `test:dist` passes here on `517a6eef`. On `517a6eef` the ci `checks` job was cancelled at its 30 min limit inside `pnpm test:unit` (job 131495931236, 21:12:18 to 21:42:43); #665 raised it to 45 min from `d401ec4d`, whose ci run was pending at the last look. Here, `pnpm check` on `517a6eef` passes whole: exit 0, 16 min 32 s, 66 unit tasks uncached, `check-changesets: 79 changesets, 0 problems`. On `d401ec4d` the 3d workflow passed (run 43310471285: 3D parity in Chromium, WebKit and Firefox on `af-mac-3`, the 3D journeys, base-3d through game-ci) | ci, release checks (nightly or by hand) and the 2D journeys green on one commit of `main` | S to M | a session, the Owner's runners | M3, M5 |
| M7 | **The repository is private.** `curl https://github.com/mcthaydt/automata-framework`: 404 without sign-in. The README's "Play Emberwick from a fresh clone" (`git clone …`) cannot work for a stranger; `site/src/shared/site.js:5` `REPOSITORY_PUBLIC = false`; `check:launch` refuses the deploy until it is true | The Owner opens the repository (and checks history for secrets first: `pnpm secrets` runs in CI and passed on `c364a215`); a one-line PR flips `REPOSITORY_PUBLIC` | Owner S, session S | M1 (the names in history) |
| M8 | **The publish needs the Owner's token and his Mac.** `release-packages.yml` reads `secrets.NPM_TOKEN` in the `release` environment; hosted runners are refused for billing (its header: "recent account payments have failed"), so every job waits for `af-mac` / `af-linux` | `NPM_TOKEN` (an automation token for the organisation of M1) in the `release` environment; a runner online | Owner S | M1 |
| M9 | **The first release has never run.** PR #431 "Version packages" is 77 commits behind `main` (`git rev-list --count origin/changeset-release/main..origin/main`); it holds 0.1.0 (`packages/automata/package.json` on that branch). On `517a6eef` the `version` job was cancelled; on `d401ec4d` it passed and its "Version packages PR" step ran (job 131508293078), so #431 is refreshed. 79 changesets are pending; one is `minor` (`first-public-release.md`), the rest `patch` | After M1 to M8: the version PR refreshed, merged by the Owner, the publish job approved; `verify-published.ts` and the registry smoke pass | S | M1, M3, M6, M8 |
| M10 | **The site has never been deployed.** `site.yml` deploys to Cloudflare Pages only after `check:launch`; the runbook's steps 3 and 7 need the Owner's Cloudflare project and `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` | The site live on the domain; `check:deployed` passes on both addresses; the Owner looks at it on a phone and the iPad (runbook step 8) | Owner S, session S | M1, M2, M4, M7, M9, M11 |
| M11 | **Home promises two things that do not exist.** "Sign in with GitHub to keep your games in sync" (`site/src/features/home/home-content.ts:216`, `site/src/features/app/app-offer.ts:46`): no sign-in or sync code exists in `packages`, `extensions` or `site`. "Every editor, for 2D and 3D games" free in the browser (`home-content.ts:215`): the site's editor build has no 3D renderer, and no 3D editor publishes | Both lines say what is true at launch (or are marked "coming"), with `copy.md` updated | S | session; the Owner approves the words | nothing |

### SHOULD for launch

| # | What is wrong (evidence) | Done looks like | Size | Who |
|---|---|---|---|---|
| S1 | **"Play is off" shows a cut stack line, not the cause.** `automata editor` on a game whose Vite config fails prints `Play is off: Your game stopped before it started:` then `1_esbuild@0.28.2_jiti@2.7.0_tsx@4.23.15_yaml@2.9.1/node_modules/vite/dist/node/module-runner.js:556:64)` and `}`. A drunk grandma cannot tell what to press | The message names the missing package or the file and says what to run (`pnpm install`) | S | session |
| S2 | **`create-game --help` offers `--template <2d\|3d>` to strangers**, who are then refused (`three-d-gate.ts`: "3D games need a package that is not public yet"). Honest, but the help promises what the command refuses | The help says 3D is not public yet, or hides it until it is | S | session |
| S3 | **WebKit, Firefox and a real GPU have not run on `main` for this code.** Parity in three engines is law 3; the last record of a WebKit or Firefox run is the Owner's runner (the `parity` job on `af-mac`); #666's record says "Not run: WebKit (`examples-ipad`, 41 tests need it), Firefox, a real GPU" | One green 2D `parity (chromium, webkit, firefox)` on `main` after M6 (the 3D parity job passed in all three on `d401ec4d`); `pnpm ci:local` once on the Mac | M | Owner's runners |
| S4 | **`docs/status.md` is stale** (written 2026-11-06; says "Edited content shows in play (PR #484, not on main yet)" and nothing of the shared polish, the builders fold or #666) | Rewritten from this audit's facts | S | session |
| S5 | **The frame-budget nightly exits 1 on a runner with no GPU** (#666 record: "Owner's decision: a GPU runner for the job, or exit 0 for an all-software run"); `claude/hook-scope-budget-skip` implements the skip | The branch reviewed and merged, or a GPU runner named | S | Owner decides, session |
| S6 | **The agent package has no public home.** `release-packages.yml` `skills` job mirrors `agents/automata` to `mcthaydt/automata-skills` only with `SKILLS_TOKEN` (`curl` of that repository: 403 here). The site's agent prompt (`site/src/shared/content/agent-prompt.ts`) tells an agent to load Automata's skills | `SKILLS_TOKEN` set and the mirror public, or the prompt says where the skills are | Owner S |
| S7 | **Stale open PRs and branches** muddy the queue (classified below): five pull requests and two branches are superseded or fully merged | The Owner closes the superseded ones and deletes their branches | S | Owner |

### AFTER launch: 3D as a beta

`@pixi/3d` is public as of today, so the closed-beta rule (D-1) can be lifted. But a 3D launch is not one change: it
is the beta.3 port that is still queued, then a second move to 0.1.0, then making `@automata/3d` publishable, then
its kits. The evidence supports **2D first, 3D as a later beta**. The Owner decides.

| # | What is wrong (evidence) | Done looks like | Size |
|---|---|---|---|
| A1 | **`@automata/3d` is not a buildable package.** `packages/3d/package.json`: `exports` point at `./src/entries/*.ts`, no `build` script, `"private": true`, version 0.0.0. The 3D stranger's journey with `AF_BETA_3D=1` fails at "check it": `Error [ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING]: Stripping types is currently unsupported for files under node_modules` for `@automata/3d` (the game's `vite.config.ts` imports `@automata/3d/figures` and `/world-content`). The same holds for `character-kit`, `world-kit`, `sectors`, `lcd-panel`, `retro-crisp` (no build, `src` exports) | `@automata/3d` built with tsdown like `@automata/framework`, joins the fixed group in `.changeset/config.json`, `release-list.test.ts` and the API report; the 3D stranger's journey passes without the gate | L |
| A2 | **The beta.3 port is not merged.** `claude/pixi-3d-beta-3`: 34 commits ahead, 29 behind `main`, 129 files; its audit (`docs/superpowers/audits/2026-11-12-pixi-3d-beta-3/README.md` on that branch) says what is left is "the Owner's cross-engine run" and step 5 is "partly"; step 6, the close, ran in its fifth session | Merged after its own conditions | M |
| A3 | **Public 0.1.0 is not beta.3.** Unpacked side by side (never run): the vendored beta.3 tarball and npm's `0.1.0-beta.3` differ only in `package.json` URLs and the README (code identical); npm's `0.1.0` changes 60 `.mjs` files and 15 `.d.ts` files against beta.3, drops the CommonJS builds (ESM only), adds `FLOATS_PER_LIGHT` and `MAX_LIGHTS`, keeps the MIT `LICENSE` byte for byte and peers `pixi.js ^8.23.0` (core pins 8.22.0: `packages/tools/src/shared/create-game/template-3d.ts` and the template's `pixi.js` 8.22.0). It no longer carries the marker `pixi3d-shadow-budget` that `pixi3d-markers.ts` uses; `./extras` still builds code with `new Function` (`dist/extras/particles/utils/generateSpawn.mjs`), so the extras guard stays | After A2, a second port to `0.1.0` from npm (not a tarball), with the same frame-by-frame review and `pixi.js` 8.23 in core | M |
| A4 | **The private-build rules must be lifted, file by file** (list below) | Every item in "Lifting D-1" done, and the guard for `./extras` kept | M |
| A5 | **The figure painter came from a private repository.** `tooling/release/tests/unit/closed-beta-guard.test.ts:6`: "the figure builder is a private repository: nothing published may bundle either"; `extensions/figures/package.json` `"private": true`; `character-kit` depends on it | The Owner rules whether the painter may be published (licence and provenance), before `character-kit` can be | Owner |
| A6 | **3D CI was red on `main` until today.** 3d run 43271549499 on `c364a215`: parity failed in `@automata/character-kit#test:browser`, journeys failed (3d-story). **Closed on `d401ec4d`:** run 43310471285 passed, parity in all three engines included | Keep it green | none |
| A7 | **The 3D journeys in the editor fail here.** `dark-levels-3d.test.ts:89`: `getByTestId('studio-stage')` not visible in 5 s; `levels-3d-edit-reaches-the-game.test.ts:64`: brightness expected `< 0.19102446945765408`, received `0.2826126621404287` (SwiftShader; may be the renderer, not the code); `new-3d-game-plays-its-edits` fails as M5 | Run on a GPU runner and explained | S |

## Lifting D-1: what must change to depend on the public `@pixi/3d`

Found with `grep -rln "closed.beta\|pixi-3d-0.1.0\|vendor/pixi-3d\|AF_BETA_3D"` and `grep -rn "0.1.0-beta.2"` outside
`node_modules` and `docs/archive`. Nothing was changed.

**Dependency specifiers** (each `file:../../vendor/pixi-3d/pixi-3d-0.1.0-beta.2.tgz` becomes the npm version):
`packages/3d/package.json:55`, `packages/editor-3d/package.json:31`, `games/base-3d/package.json:30`,
`extensions/figures/package.json:38`, `extensions/character-kit/package.json:37`, `extensions/world-kit/package.json:42,51`,
`extensions/lcd-panel/package.json:33,41`, `extensions/retro-crisp/package.json:34,42`; then `pnpm-lock.yaml`.

**Tools and templates:** `packages/tools/src/shared/create-game/template-3d.ts:19` (`PIXI_3D_SPEC = '0.1.0-beta.2'`) and
`:39` (the workspace `file:` path); `packages/tools/src/shared/create-game/three-d-gate.ts` (the `AF_BETA_3D` gate and
`THREE_D_NOT_PUBLIC`) and its test; `tooling/consumer-smoke/src/commands.ts:40-52` (`pack3d` installs the vendored
tarball) and `tooling/consumer-smoke/tests/e2e/stranger-3d.test.ts:21` (`test.skip` unless `AF_BETA_3D=1`);
`.changeset/create-game-3d-template.md` names the gate.

**The ship guard:** `packages/tools/src/shared/ship/prepare/pixi3d-markers.ts` (the core markers go, the `./extras`
markers stay, its own header says so); `build-scans.ts:29-49` (the `audience` split, `Pixi3dInPublicBuild`);
`prepare/prepare-build.ts:12-13,51,60-72`; `targets/itch/prepare-itch.ts:8-9,42-43,49,65`;
`publish/publish-build.ts:14,38` and `publish --private`; `config/ship-config.ts:28` (the `private` audience);
`errors.ts:59-78` (`Pixi3dInPublicBuild`, the private-upload error; `Pixi3dExtrasInBuild` stays); `entries/internal.ts`;
the help text of `automata ship prepare --target web` ("the private Pixi 3D beta"); their unit tests
(`tests/unit/shared/ship/prepare/build-scans.test.ts`, `…/ruken/prepare-build.test.ts`, `…/targets/web/prepare-web.test.ts`,
`…/targets/itch/prepare-itch.test.ts`, `tests/unit/scripts/copy-editor.test.ts`).

**Repository guards:** the root `boundaries` script's `--forbid …:@pixi/3d` entries for the published 2D packages
(keep or drop: they still keep 2D core free of 3D, which is a design rule, not a licence rule; decide which) and
`tooling/release/tests/unit/closed-beta-guard.test.ts`; `site/scripts/scan-closed-beta.ts`, the last step of the
site's `build` (`site/package.json:12`) and its tests (`site/tests/unit/scripts/scan-closed-beta.test.ts`,
`build-script.test.ts`, `playground/runtime/playground-catalog.test.ts`); `site/scripts/check-launch.ts:76-82`
(`pixiPublicProblems` now passes by itself: `@pixi/3d` is on the registry);
`tooling/repo-hygiene/tests/unit/workflow-invariants.test.ts`; `.github/workflows/3d.yml:22` and `site.yml:59`
(paths and comments; read only here).

**Vendored files and licences:** delete `vendor/pixi-3d/` (two tarballs, `LICENSE`, `README.md`, the beta.3 release
notes); the npm package carries the same MIT `LICENSE` (compared byte for byte). Update the provenance in
`LICENSE-SCOPE.md` if it is to name Pixi 3D.

**Docs that state the rule:** `packages/3d/README.md:8`, `extensions/figures/README.md:12`,
`packages/3d/src/entries/camera-view.ts`, `extensions/character-kit/src/features/painted/pose.ts:6`, the comments in
`packages/3d/src/shared/render/light/view-fog.ts:29`, `…/no-eval/pixi3d-uniform-sync.ts:36`, `src/testing/snapshot.ts:9`
and two browser tests, `agents/automata/skills/automata-api/reference/api.md` (regenerated by `pnpm api-index --write`),
`docs/runbook.md` launch step 6, `docs/versions.md` (the pins), and the refactor and superpowers
records that name D-1 (history; leave them).

## What already works (measured here)

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | done in 20.7 s |
| `pnpm build` (16 tasks, uncached) | exit 0, 31 s |
| `pnpm check` (lint, typecheck, boundaries, style, source names, knip, unit, changesets) | exit 0, 16 min 32 s, 66 unit tasks uncached; "check-changesets: 79 changesets, 0 problems" |
| `pnpm build:examples`, `pnpm build:demos` | exit 0 |
| CI on `d401ec4d`: 3d workflow (3D parity in Chromium, WebKit and Firefox; 3D journeys; base-3d through game-ci) and the release `version` job | success (runs 43310471285, 43310470992) |
| `pnpm --filter @automata/release test:dist` | 2 files, 20 tests pass (it failed in the nightly on `c364a215`; #666 fixed it) |
| `pnpm api-report` | "6 core packages; 0 API breaks against the base, 0 undeclared" |
| `pnpm api-index` | "1300 exports from 49 entry points at 0.0.5; 0 undocumented" |
| `pnpm agent-skills` | "agent package: 5 skills, no layout problems" |
| `node tooling/consumer-smoke/src/run.ts --from packs` | "consumer-smoke: passed", 16 steps, 37 s: install, README commands, Node import and a sim hash, content compile, `ship --help`, the packed editor serves, `-tools` 2513 kB (under 3 MB), boundaries, `tsc` with TypeScript 7, 7+nodenext and 6, no `eval`, three bundles, the web build boots in Chromium under Ruken's CSP |
| The stranger's journey, 2D (`playwright test` in `tooling/consumer-smoke`) | pass, 51.6 s: `create-game` from the packed tools outside the workspace, `pnpm install`, `pnpm check`, `pnpm test`, `build:web` + `prepare:web` and play in Chromium, `build:itch` + `prepare:itch` |
| `automata create-game my-game` (built bin) | "Created "My Game" in my-game. Next: cd my-game && pnpm install && pnpm dev": plain; dependencies `^0.0.5` from the registry, no `workspace:*`, no `@ruken/sdk` (the 2026-11-06 audit's N1 and N2 are closed) |
| `pnpm --filter @automata/site build` | exit 0, 36 s, ends "No Pixi 3D closed beta in the build." |
| `pnpm --filter @automata/site check:site` | "Verified 51 built pages: titles, metadata, landmarks, links, anchors, no link into the private repository, …" |
| CI `checks` job (lint, typecheck, boundaries, style, knip, unit, audit:deps, secrets) on `c364a215` | success on `af-mac` (job 131444828689) |
| `emberwick through game-ci` (build, prepare for Ruken) on `c364a215` | success (job 131444754458) |

## 2D

The commands of ci.yml's "2D journeys" job, run here on `517a6eef` in Chromium only, with `--reporter=line` so
nothing is buffered.

| Suite | Result | Time | Notes |
|---|---|---|---|
| The editor's journeys (`packages/editor`, `playwright test -c playwright.journeys.config.ts --project editor-ipad-chromium --project editor-phone-chromium`) | **23 passed, 15 failed, 2 skipped** of 40 | 19 m 17 s (iPad 21:14 to about 21:24, phone to 21:33), 2 workers | It finishes; it is not a hang. 12 failures are the harness fault of M5: 10 wait their whole 180 s for `getByRole('link', { name: 'Play' })` (`animation-plays-in-game`, `controls-change-the-game`, `paint-shows-in-game`, `whole-game-loop`, `new-3d-game-plays-its-edits`, each on both sizes) and 2 are "the game's dev server exited with 1" (`new-game-opens`, both sizes). 3 are 3D: `levels-3d-edit-reaches-the-game` on both sizes (a brightness of 0.283 where the test wants below 0.191, and the same on the phone against 0.161) and `dark-levels-3d` on the iPad only (`studio-stage` not visible in 5 s). `editor-ipad-webkit` was not run (no WebKit). In CI the job's 30 min limit is spent before this step can finish: about 15 min for the first step, then roughly this suite's 19 min for two projects, and a third (WebKit) project on top |
| The stranger's journey, 2D (`tooling/consumer-smoke`) | pass | 52 s | |
| The stranger's journey, 3D (`AF_BETA_3D=1`) | fail at "check it" | | A1 |
| The website (`site`, `playwright test --project chromium`) | **509 passed** | 13 min 9 s | The `webkit` project not run |
| Emberwick, examples-2d, 2d-story journeys | not run here | | They passed in CI on `c364a215` ("2D journeys" step, success, 15 min 44 s, job 131444747776) |
| `pnpm build:examples`, `pnpm build:demos` | exit 0 | 7 s together | |

The 2D game and its examples are not where the risk is. They pass in CI. The risk is the editor suite's harness and the
job's time budget: until M5 is fixed, no pull request proves the website or the stranger's journey.

## The site and the docs

The site builds (36 s) and `check:site` passes on all 51 pages, its links included. These are untrue or unsafe today:

| Where | Claim | Today | Class |
|---|---|---|---|
| Home and Start (`site/src/shared/content/agent-prompt.ts:5`), README "Make a game" | `npx @automata/tools create-game my-game` | Not on npm; the scope is another account's (M1) | MUST (M1) |
| Home, "Free in your browser" (`site/src/features/home/home-content.ts:216`) and `/app` (`site/src/features/app/app-offer.ts:46`) | "Sign in with GitHub to keep your games in sync" | No sign-in or sync exists: `grep -rli "oauth\|sign in"` over `packages/*/src`, `extensions/*/src` and `site/src` finds only these two lines of copy (and unrelated words like "signs") | **MUST (M11): remove the line, or mark it coming** |
| Home, "Free in your browser" (`home-content.ts:215`) | "Every editor, for 2D and 3D games" | The site's editor (`site/build/editor/app/`) carries no 3D renderer (the build ends "No Pixi 3D closed beta in the build."), and no 3D editor publishes. True only after the 3D beta | **MUST (M11): say 2D, or "3D soon"** |
| `/app` | "$19.99", "$39.99, paid once", "Coming soon" | Words only, no buy link (`app-offer.ts`: `url: null` reads "Coming soon"). Honest, but a price on a page before a product is the Owner's call | Owner (checklist 12) |
| Footer, Privacy, Terms, `security.txt`, `SECURITY.md:9` | `hello@automataframework.com` | The domain does not exist (M2) | MUST (M2) |
| README "Play Emberwick from a fresh clone" | `git clone https://github.com/mcthaydt/automata-framework.git` | Private repository (M7) | MUST (M7) |
| `docs/status.md` | "Written 2026-11-06" | Stale (S4) | SHOULD |
| `site/scripts/check-launch.ts` | the deploy gate | Crashes (M4) | MUST |

The agent package and the cheatsheet are current with the code: `pnpm api-index` writes them from the built `.d.ts`
with "0 undocumented", and `pnpm agent-skills` reports no layout problems (the files it wrote under
`tooling/api-index/dist` are build output, not committed). `README.md`'s commands all resolve (consumer smoke step
"readme": "12 commands resolve").

Site journeys in Chromium (`site`, `pnpm exec playwright test --project chromium --reporter=line`): 509 passed in
13 min 9 s. The `webkit` project was not run (no WebKit here).

## Open pull requests and branches

There are 14 open pull requests, not 50 or more: the 15 most recently updated closed ones include 14 closed unmerged between 21:01 and 21:02 UTC today, and #666
merged at 21:12 (`list_pull_requests`, state closed, sorted by update). 24 remote branches besides `main` and this one
(`git ls-remote --heads origin`). "Ahead / behind" is `git rev-list --count` against `origin/main` at `517a6eef`;
"superseded" is proved by the commit on `main` named in the row. Nothing was closed or changed.

| PR | Branch | Ahead / behind | Class | Why |
|---|---|---|---|---|
| #665 | `claude/optimistic-newton-yszrte` | merged as `d401ec4d` after this list was taken | done | M3 in part: the `checks` job's 45 min and the `version` job without unit tests; the `publish` job is still to do. Delete the branch |
| #431 | `changeset-release/main` | 1 / 77 | **needed for ship** (regenerated, not merged as is) | M9: the release PR, refreshed by the next push to `main` with changesets |
| #605 | `claude/fix-site-examples-flake` | 2 / 406 | superseded | `75bcbbfa` on `main`, "fix(site): the example page tests load the orchestrator before they wait on it", the same test file |
| #600 (draft) | `claude/fix-content-hmr-flake` | 2 / 432 | superseded | `.changeset/hmr-test-watcher-catch-up.md` on `main`: "waits for the watcher to catch up before it makes the change it counts", the same test |
| #597 (draft) | `claude/fix-3d-story-journeys` | 1 / 432 | superseded | `af1e7bc0` (#666): the 3D story journeys start the editor with the current CLI; `examples/3d-story/playwright.config.ts:26` no longer passes `--app` |
| #598 | `claude/fix-schematic-journey-flakes` | 3 / 432 | superseded in part | Its 3D story fix is `af1e7bc0`; its 2D Follow wait is `92b708f2` (#666). Its 3D Search and Watch waits were not compared line by line: check before closing |
| #578 (draft) | `claude/elegant-bell-1icwyb` | 1 / 493 | superseded | `pnpm api-index` on `main`: "0 undocumented"; `STICK_DIRECTIONS` has its doc comment (`packages/content/src/shared/controls/controls.schema.ts:20-25`) |
| #599 | `claude/fix-examples-3d-figures` | 1 / 432 | after launch (3D) | The figures journeys wait on the sim clock; not on `main` (its files changed once on `main` since, by #613) |
| #664 | `claude/painter-figure-look` | 24 / 26 | after launch (3D) | The painter's look options (workstream 4) |
| #606 (draft) | `claude/clinic-2` | 28 / 346 | after launch (3D) | The Last Light's clinic, batch 2; The Last Light is stopped at its prologue |
| #596 (draft) | `claude/clinic-1` | 10 / 452 | after launch (3D) | The clinic, batch 1 |
| #575 (draft) | `claude/clinic-level3d` | 5 / 494 | after launch (3D) | The clinic's gap analysis (docs) |
| #574 (draft) | `claude/character-kit-diagnosis` | 2 / 494 | after launch (3D) | Docs: why the kit does not look like FigureBuilder; the builders fold (#661) changed the premise |

Branches with no open pull request:

| Branch | Ahead / behind | Class |
|---|---|---|
| `claude/pixi-3d-beta-3` | 34 / 29 | after launch (A2); queued for merge |
| `claude/hook-scope-budget-skip` | 6 / 1 | should (S5): the hook's scope and the software frame-budget skip |
| `claude/shared-polish-emberwick-site` | 0 / 249 | fully merged: delete |
| `claude/fix-2d-story-journeys` | 2 / 452 | superseded by `92b708f2` and `af1e7bc0` (the `--app` flag and the Follow wait) |
| `claude/builders-look-plan` | 1 / 766 | docs; `main`'s plan file changed 20 times since: probably superseded |
| `claude/eb-source-ref`, `claude/figurebuilder-pixi3d` | 2 / 486, 5 / 494 | after launch (3D docs and an example of the painted pair) |
| `claude/last-light-prologue`, `claude/last-light-ada`, `claude/last-light-figures-look`, `claude/painter-hands` | 178 / 11, 179 / 11, 123 / 77, 1 / 11 | after launch: The Last Light, stopped at its prologue |

`AGENTS.md` says a merged branch is deleted and only `main` and branches with an open pull request live long; nine of
these branches have no pull request.

## The trackers, checked against the code

**Two sources disagree on the npm name.** `docs/refactor/progress.md` (2D editors and website, build, line 216) says the
Owner named the organisation "automata" on 2026-11-06 and task 14.1 renamed every package to `@automata`. The registry
says the `automata` scope is another account's (M1), as the site audit of 2026-11-08 found
(`docs/refactor/2026-11-08-site-audit.md`, short version 1), and `docs/runbook.md` now plans `@automataframework`. The
registry is right; the progress row is out of date.

**`docs/refactor/progress.md`, 2D editors and website (65 of 68 tasks).** The rows not done are 21.0 (the domain:
"Partly … the DNS is the Owner's"; still true, M2) and 21.2 (the Owner's inputs and go: "Not started"; M1, M2, M7, M8,
M10). Everything else in that table is marked done; the stranger's journey and the consumer smoke passing here
(above) confirm the new-game rows.

**The 2D ship audit of 2026-11-06 (`docs/refactor/2026-11-06-2d-ship-rest-audit.md`), its "short version":**

| Finding | Today | How it was checked |
|---|---|---|
| 1. A new game does not install outside the repository (`workspace:*`, `@ruken/sdk`) | closed | `create-game` writes `^0.0.5` from the registry and no `@ruken/*`; the stranger's journey installs it from packs |
| 2. An untouched new game fails its own check | closed | the stranger's journey runs `pnpm check` and `pnpm test` on it: pass |
| 3. Every test passes around these breaks | closed in code, open in CI | the stranger's journey exists and passes here; in CI its step has not run since 2026-11-06 (M5) |
| 4. Packages release to GitHub Packages, restricted, under the Owner's handle | closed but for the scope | `.changeset/config.json` `"access": "public"`; `release-packages.yml` publishes to `registry.npmjs.org`; the scope is the open problem (M1) |
| 5. The published command carries the Owner's machinery | closed | `automata --help` lists `create-game`, `check`, `build`, `editor`, `ship`, `words`; `automata ship --help` lists only `prepare` and `publish` for the four targets |
| 6. Automata Plus is built on the old core | closed by decision | `docs/superpowers/progress.md` header: "`automata-plus` is cut: its packages are the framework's extensions" |
| 7. The agent package and docs teach the old framework | partly verified | `pnpm agent-skills`: "5 skills, no layout problems"; `docs/status.md` is stale (S4); the mirror is not public (S6) |

**The 2D editors and site audit (`docs/refactor/2026-11-06-2d-editors-and-site-audit.md`), its shipping gaps:** E2 (the
editors in no package) closed: the packed `automata editor` serves the 2D editor (consumer smoke step "editor"). E4 (the
3D editor by default) closed: `automata editor --help` says it picks the editors the game needs. E7 (the suite carries
the closed beta) closed for what publishes: `@automata/editors` and `@automata/editor-3d` are `"private": true`. W1 (Start
sends visitors to a private repository) closed: `check:site` checks "no link into the private repository". W5 (never
deployed) open: M10. W9 (a personal contact address) closed in text; the address's domain does not exist (M2). The
other findings were not re-checked one by one here.

**`docs/superpowers/progress.md`.** Workstream 1 (shared polish) is merged (#645) and its fixes too (#654,
`0df11a43`). Workstream 2 (The Last Light) is stopped at its prologue by the Owner; its branches are after launch.
Workstream 3 (an editor for every content kind) and 5 (CI on rented Ubicloud runners) are not started. Workstream 4
(the builders' look, 14 of 19 tasks) and 6 (the builders fold: group 1 merged as #661 and its audit fixes as #663;
`claude/builders-fold-strict` and `claude/builders-fold-scenes` open) are 3D and after launch. None of them is needed
for a 2D launch. Workstream 5 matters to launch speed only through CI capacity: every job waits for the Owner's two
machines.

## What could not be verified here

| Not verified | Why | What would verify it |
|---|---|---|
| WebKit and Firefox: parity, `emberwick-*-webkit`, `editor-ipad-webkit`, `examples-ipad`, the site's `webkit` project, the playground in three engines | Not installed in this container; AGENTS.md says not to install another Playwright | The `parity` job on `af-mac`, or `pnpm ci:local` on the Mac |
| A real GPU; WebGPU on hardware | SwiftShader only | The `frame budget (nightly, GPU runner)` job; the 3D parity job on `af-mac` |
| Real devices (the Owner's phone and iPad) | None here | The runbook's step 8, by the Owner |
| The CI `checks` job on `d401ec4d` | Pending at the last look | ci run 43310471317 |
| `pnpm plugin:validate` and the playground e2e of release checks | Not run here | release checks by hand (`workflow_dispatch`) after M6 |
| Publishing, `verify-published.ts`, the registry smoke | Nothing may be published from here, and the scope is not settled | The first release (M9) |
| `automata ship publish` to itch.io, Ruken; `prepare --target tauri` | Needs `BUTLER_API_KEY`, Ruken credentials, Rust and Tauri | The Owner, once, with each credential |
| The site on its host (`check:deployed`) | No Cloudflare project or token | M10 |
| Whether `claude/pixi-3d-beta-3`'s frames hold on 0.1.0 | Not run; only the tarballs were compared | A2 and A3 |
| #598's 3D Search and Watch waits against `main` | Not compared line by line | Read its diff against `af1e7bc0` before closing it |

## The Owner's checklist

Each is the Owner's alone (credentials, money, approvals, devices, licences). In launch order.

1. **Name the npm organisation and create it.** `@automata` is another account's. Create `automataframework` (the
   runbook's choice) on npmjs.org, or pick another free name, and say which; a session then runs the rename (M1).
2. **Register `automataframework.com`** and open `hello@automataframework.com` with an MX record (M2).
3. **Create `NPM_TOKEN`**: an npm automation token that can publish to that organisation, saved as a secret of the
   `release` environment (Settings, Environments, release). Keep the required reviewer on it (M8).
4. **Keep a runner online** (`af-mac` for release, `af-linux` for the journeys) while CI goes green and while the release
   runs. Or settle the hosted-runner billing block, or say yes to workstream 5 (Ubicloud).
5. **Decide the frame-budget job**: a GPU runner, or the software skip on `claude/hook-scope-budget-skip` (S5).
6. **Open the repository** to the public, after a last look at its history; then a session flips `REPOSITORY_PUBLIC` (M7).
7. **Approve the first release**: merge the refreshed "Version packages" PR (0.1.0), then approve the `publish` job in
   the `release` environment (M9).
8. **Create the Cloudflare Pages project** `automataframework`, attach the domain (`www` to the apex, HTTPS on), then
   add `CLOUDFLARE_API_TOKEN` (secret) and `CLOUDFLARE_ACCOUNT_ID` (variable), last (runbook steps 3 and 7; M10).
9. **Look at the live site** on the phone and the iPad: Home, play Emberwick, Start, Try the editor, the app page
   (runbook step 8).
10. **Create `SKILLS_TOKEN`** for `mcthaydt/automata-skills` and make that repository public, or say the agent package
    waits (S6).
11. **Close the superseded pull requests and delete their branches**: #605, #600, #597, #578, #598 (after the check
    above), and the branches `claude/shared-polish-emberwick-site` and `claude/fix-2d-story-journeys` (S7).
12. **Money:** the app page says "$19.99" and "$39.99, paid once" with "Coming soon" and no buy link
    (`site/src/shared/content/pricing.ts`, `site/src/features/app/app-offer.ts`). Confirm that wording may go live before
    the app is on sale, or ask for the page to wait.
13. **For 3D later:** rule whether the figure painter (from the private FigureBuilder repository) may be published (A5),
    and run the beta.3 branch's cross-engine check (A2).

---

# Part 2: the full launch scope

Added the same day, from `main` `d401ec4d`, after the Owner ruled on scope (relayed by the coordinator, verbatim): "We ship
with 3D, Editors, and Desktop Apps too". Part 1's "2D first" recommendation is withdrawn. Part 1's evidence stands; its
A-list becomes MUST. This part does not repeat the `@pixi/3d` move and its rule list, which branch `claude/pixi-3d-public`
owns (`docs/superpowers/audits/2026-11-12-pixi-3d-public/README.md` on that branch: steps 0 and 1 done, the move and its
proof not yet, at `d098771f`).

## Part 2 verdict

The full scope is several weeks of sessions, not a few days. 2D is close; 3D, the editors and desktop each need a
package-building step that has not started. **Biggest new risk: almost everything 3D, and every editor beyond Levels and
the Tuner, is a private, unbuilt workspace package.** Sixteen packages that a 3D game, the 3D editor or the content
editors import are `"private": true` with source-only exports and no `build` script (measured below). A stranger cannot
install any of them. The second risk is the word "Desktop Apps": the repository holds two different things by that name.
One works in code today and needs signing money (games as desktop apps). The other is a paid app that has not been
built (0 of 30 tasks). The Owner must say which one he means (or both) before the plan is sized.

## 1. 3D for a stranger

**What a 3D game imports.** `automata create-game g3 --template 3d` (the built bin, inside the workspace so the gate
lets it) writes dependencies on `@automata/framework`, `content`, `sim`, `tools` and `@automata/3d`, plus `@pixi/3d`
`0.1.0-beta.2` and `pixi.js` `8.22.0`. Its source imports `@automata/3d`, `/sim`, `/level`, `/figures` and
`/world-content` (grep of the game's `src` and `vite.config.ts`). So the stranger's minimum is `@automata/3d` alone. Note
the pins: `PIXI_3D_SPEC` is still beta.2 on `main` (`template-3d.ts:19`), while beta.3 (the port) and 0.1.0 (`latest`)
both peer `pixi.js ^8.23.0`.

**Every 3D and editor package, as it is today** (each `package.json`: `private`, a `build` script, whether `exports` point
at `dist`, and its `@automata/*` dependencies):

| Package | Private | Build | Exports | Depends on (`@automata/`) | Needed by |
|---|---|---|---|---|---|
| `@automata/3d` | yes | no | `src/*.ts` | content, framework, sim | every 3D game |
| `@automata/editor-3d` | yes | yes (a page) | — | 3d, editor, framework | the 3D editors |
| `@automata/editor` | yes | yes (a page) | — | framework, content | the 2D editors (packed into `-tools`) |
| `@automata/editors` (Feel, Audio, Writer, Sequence, Schematic) | yes | yes (a page) | — | audio-synth, cutscenes, editor, feel, narrative, nav, puzzle, systems, 3d, content, framework, sim | the content editors |
| `@automata/character-kit` | yes | no | `src` | **figures**, 3d, content, framework | clothes, hair, seats |
| `@automata/figures` | yes | no | `src` (types from `types/`) | — | the kit's door only |
| `@automata/world-kit` | yes | no | `src` | 3d, content, framework, sim | props, rooms, sky |
| `@automata/lcd-panel`, `retro-crisp` | yes | no | `src` | 3d, content (+framework) | looks |
| `@automata/sectors`, `nav`, `interact`, `cutscenes`, `narrative`, `systems`, `places`, `hud`, `level-2d`, `pipelines` | yes | no | `src` | 3d and each other (`systems` → nav, places, puzzle, sectors; `pipelines` → editor, 3d, …) | story and level tools |

Yes, a kit that would publish depends on a private package: `character-kit` imports `@automata/figures`, the painter
from the private FigureBuilder repository (`tooling/release/tests/unit/closed-beta-guard.test.ts:6`: "the figure builder is
a private repository: nothing published may bundle either"). Publishing `character-kit` needs the Owner's ruling on the
painter's licence first, or the kit ships without its painted figures.

**The 3D stranger's journey** (`AF_BETA_3D=1 pnpm exec playwright test tests/e2e/stranger-3d.test.ts` in
`tooling/consumer-smoke`, on `517a6eef`). Every step in order:

| Step | Result |
|---|---|
| make a 3D game | pass |
| install it (packed `@automata/3d` 0.0.0 and the vendored `@pixi/3d`) | pass |
| check it: `boundaries`, `typecheck`, `boards`, `achievements`, `orientation`, `inputs`, `levels`, `words` | pass |
| check it: `test` | **fail**: `vitest: wrote no report (exit 1): failed to load config from …/vite.config.ts`, `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` for `@automata/3d` |
| check it: `no-eval` | **fail**: `vite build failed: failed to load config` (same cause) |
| check it: `secrets`, `data-urls` | **fail**: "not scanned: the build failed (see no-eval)" |
| test it, build it, play it, walk Wick | not reached (the journey stops at the first failed step). They load the same `vite.config.ts`, so they fail for the same cause until `@automata/3d` is built |

One cause, four failed checks: `@automata/3d` must be a built package. What that takes: a `tsdown` config and a
`build` script like `@automata/framework`; `exports` with `types` and `import` pointing at `dist` for every entry (`.`,
`/sim`, `/level`, `/figures`, `/figures-kit`, `/world-content`, `/camera-view` and the rest); a README written for a
stranger; `"private"` removed and a 0.x version; joining the fixed group in `.changeset/config.json`; an API report
(`tooling/api-report`) and API-index entries with doc comments (`pnpm api-index` fails on an undocumented export); and the
six publishing guards the pixi-3d-public inventory lists in its §D (the `boundaries --forbid` list, `closed-beta-guard.test.ts`,
`release-list.test.ts`'s "not publishable", `copy-editor.ts`, the `AF_BETA_3D` gate, the playground's filter). Then the
3D stranger's journey runs in CI with no gate.

**`@pixi/3d` 0.1.0.** Its types are compatible with what AF uses. `MAX_LIGHTS` only moved file (`scene/View3D.d.ts` to
`core/lightLimits.d.ts`, still exported). `Box`, `Quaternion` and the other math `.d.ts` changes are doc strings
(`pixi-3d/math` → `@pixi/3d/math`). The risk is the runtime: 60 `.mjs` files change against beta.3. The changed files
include lighting (`LightTiles`, `LightingSystemGl/Gpu`, `LightDataList`), shadows (`ShadowRenderPassGpu`), batching,
`RenderGraph`, the background, copy-opaque and output passes, and the glTF loaders. Those are the areas AF's goldens and
fog conversion pin, so moving to 0.1.0 is a pixel-reviewed port like beta.3's. No public changelog was read (`github.com`
was not tried; only the tarballs).

## 2. The editors

**What exists and who can reach it:**

| Editor | Built in | Published or hosted | A stranger opens it by |
|---|---|---|---|
| Levels (2D) and the Tuner | `packages/editor` (suite-2d page) | packed into `@automata/tools` (`dist/editors/suite`, 1.6 MB); hosted on the site at `/editor/app` | `pnpm exec automata editor` in a 2D game: works (consumer smoke step "editor"; the 2D stranger's journey) |
| Levels 3D, Characters (the full suite) | `packages/editor-3d` (suite-full page) | not published, not hosted | `automata editor` in a 3D game, from published tools, prints **"Error: The 3D editors are not in this release yet."** (`packages/tools/src/features/editor/editor-command.ts:94`) |
| Feel, Audio, Writer, Sequence, Schematic | `extensions/editors` (`@automata/editors`, private, no README) | not published, not hosted (the site's `/editor/app` is the 2D suite) | no way |

**Packing the 3D suite into `-tools` breaks a budget.** The 2D suite is 1.6 MB on disk (387 kB of gzipped JS); the 3D suite
is 2.5 MB (687 kB of gzipped JS). `-tools` packs to 2,513 kB today against `TOOLS_PACK_BUDGET_MB = 3`
(`tooling/consumer-smoke/src/run.ts:119`). Adding the 3D suite will very likely pass 3 MB. Choose: raise the budget, or
ship the editors as their own package (for example an `@<scope>/editors` that `automata editor` resolves), or serve the 3D
suite from the site.

**Their suites:** the 2D editor journeys (Part 1, M5: 23 passed, 15 failed in Chromium; the fix is on
`claude/editor-journeys-green`, not on `origin` at this writing). On `d401ec4d`, `3D - journeys` passed in CI:
`pnpm test:journeys:3d` 1 min 4 s, base-3d e2e, examples-3d e2e, 3d-story e2e (run 43310471285, job 131507059200). The
3D editor's unit suite runs in `pnpm check` (exit 0 here). Three 3D journeys inside the 2D editor package failed here on
SwiftShader (`levels-3d-edit-reaches-the-game` twice, `dark-levels-3d` once).

**Home's lines, against the full scope** (M11):
- "Every editor, for 2D and 3D games": true only once the 3D and content editors are hosted or published (E1 to E3 below).
- "Sign in with GitHub to keep your games in sync": **no code on `main`.** The code was PR #544 ("a game can be kept on
  GitHub (sign-in build, phases 0-5)", 13,143 additions, 146 files, a Cloudflare Pages Function for the GitHub sign-in). It
  was **closed unmerged** on 2026-11-12 at 21:01 with `mergeable_state: dirty`, and its head `f380d358` is not fetchable
  here. Its own body says nothing ran against real GitHub or Cloudflare. Either revive it (L, conflicts with today's
  `main`) or remove the line.

## 3. Desktop apps: two readings

| | (a) Games as desktop apps | (b) The Automata app (the editors on the desktop) |
|---|---|---|
| What the repository holds | The `tauri` target: the adapter (`packages/automata/src/features/targets/tauri/`), `create-game --targets tauri`, `automata ship prepare --target tauri` (writes `.automata/tauri/`, runs `tauri build`), `publish --target itch --from tauri`; the guide `docs/guides/publish-to-desktop.md` | The paid app on `/app` ("$19.99" phone, "$39.99" desktop). `docs/refactor/progress.md`, "The paid apps": spec, plan and plan audit done 2026-11-08; **build "Not started (0 of 30 tasks)"**, with GitHub sync (closed #544) as one of its phases |
| Builds here? | No. `cargo` 1.97.0 is installed, but there is no Tauri CLI (`cargo tauri`: "no such command") and no WebKitGTK 4.1 (`pkg-config webkit2gtk-4.1`: not found; `apt-get` lists are stale here). The unit tests of the adapter and `prepare-tauri` pass inside `pnpm check` | Nothing to build |
| What CI builds | Nothing: no workflow names `tauri` (`grep -rl tauri .github/workflows`: none). The guide says the release workflow `create-game` writes does not build bundles | Nothing |
| Signing and release | Unsigned today. macOS signing and notarisation need an Apple Developer account (money) and six secrets (`APPLE_CERTIFICATE`, `…_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`; the guide). Windows needs a code-signing certificate (money); nothing in the repository mentions one. No updater. Icons: `ship` draws one when none is given | All of (a) for the app itself, plus store accounts (Apple, Google) for the phone apps, a payment provider, an updater endpoint, licence checks and the 30 build tasks |
| Cost to launch | M for a session (a Linux, macOS and Windows bundle each built once on the Owner's machines, a journey that opens one, a CI job per OS), plus the Owner's certificates | L to XL: several weeks of sessions, plus accounts and money |

**For the Owner to say:** does "Desktop Apps" mean (a), (b) or both? The ship list below takes (a) as MUST and (b) as a
decision (D1), because (b) has not been started and would set the launch date by itself.

## 4. The ship list for the full scope

Part 1's items keep their meaning and get new numbers. **P** marks work that can run as its own session, on its own
branch, beside the others. The files named are the ones it would own.

### MUST, in order

| # | What (Part 1 id) | Done looks like | Size | Who | Depends on | P: owns |
|---|---|---|---|---|---|---|
| 1 | npm organisation and the name (M1) | org created; then the rename merged | Owner S, session M | Owner, then session | — | the rename touches everything: run it **alone**, before the package work below |
| 2 | Register the domain and its mailbox (M2) | domain plus MX | S | Owner | — | — |
| 3 | Decide "Desktop Apps" (a), (b) or both (D1 below); rule on the painter's licence (A5) | two answers | S | Owner | — | — |
| 4 | Release workflow `publish` job fits its time (M3) | the job's check drops unit tests or gets a fitting limit | S | session | — | P: `.github/workflows/release-packages.yml` |
| 5 | `check:launch` runs under Node (M4) | `.ts` import, a test that runs the script | S | session | — | P: `site/src/features/home/home-content.ts`, `site/scripts/check-launch.ts`, its tests |
| 6 | The 2D journeys gate: harness and time budget (M5) | editor suite green; job split or limit raised; website and stranger steps run in CI | S to M | session (`claude/editor-journeys-green` has the harness) | — | P: `packages/editor/tests/e2e/harness/`, `.github/workflows/ci.yml` (the journeys job) |
| 7 | `@pixi/3d` from npm, deploy rule lifted (A2, A4) | `claude/pixi-3d-beta-3`, then `claude/pixi-3d-public`, merged with their proofs | M | sessions in work | — | the two branches as they are |
| 8 | `@automata/3d` a built, publishable package (A1) | built `dist`, exports, README, API report and index, fixed group, the six guards changed; the 3D stranger's journey green with no gate | L | session | 1, 7 | `packages/3d/package.json`, `tsdown.config.ts`, its README; `tooling/release`; `three-d-gate.ts`; `tooling/consumer-smoke` |
| 9 | The 3D kits a 3D game or editor needs, built and published: at least `world-kit`, `lcd-panel`, `retro-crisp`, `sectors`, `places`, `nav`, `interact`, `cutscenes`, `narrative`, `systems`, `hud`; `character-kit` only if 3 allows the painter | each built, documented, in the fixed group, API-reported | L | one or two sessions | 3, 8 | `extensions/<each>/` (split the set between sessions by folder) |
| 10 | The 3D editors and the content editors reach a stranger | `automata editor` opens Levels 3D, Characters, Feel, Audio, Writer, Sequence and Schematic from published packages; the pack budget decided (raise it, or ship an editors package); a 3D and a content journey from packs | L | session | 8, 9 | `packages/tools/scripts/copy-editor.ts`, `packages/tools/src/features/editor/`, `packages/editor-3d`, `extensions/editors` |
| 11 | `@pixi/3d` 0.1.0, or a decision to ship on beta.3 (A3) | port with pixel review, `pixi.js` 8.23 in core and the templates; or the Owner says beta.3 | M | session, then Owner | 7 | `packages/3d/src/shared/render`, `world-kit` looks, the goldens |
| 12 | Games as desktop apps, proved (reading (a)) | a bundle built once on Linux, macOS and Windows from a new game; one journey opens it; a CI job per OS; signed on macOS and Windows | M | session, Owner for certificates | 3 | P: `packages/tools/src/shared/ship/targets/tauri/`, a new workflow, `docs/guides/publish-to-desktop.md` |
| 13 | CI green on one commit (M6), now including 3D and desktop | ci, 3d, release checks, the 2D journeys | S to M | session, the Owner's runners | 4 to 12 | — |
| 14 | Open the repository (M7) | public; `REPOSITORY_PUBLIC` true | S | Owner, session | 1 | — |
| 15 | Home and `/app` say only what is true (M11, widened) | each line true at launch: sign-in and sync removed, or #544 revived (L); "every editor, 2D and 3D" true after 10; the app's prices only if (b) is in | S (or L with #544) | session, Owner approves words | 3, 10 | P: `site/src/features/home/home-content.ts`, `site/src/features/app/`, `docs/refactor/copy.md` |
| 16 | `NPM_TOKEN`, runner online (M8) | secret set | S | Owner | 1 | — |
| 17 | First release (M9): the fixed group widened to every package that now publishes | version PR merged, publish approved, `verify-published.ts` and the registry smoke green | S | Owner, session | 8 to 13, 16 | — |
| 18 | Site deployed (M10) | live, `check:deployed` green, looked at on phone and iPad | S | Owner, session | 2, 5, 14, 15, 17 | — |

**Parallel lanes**, once 1 has merged: lane A is 4, 5 and 6 (CI and site, small files). Lane B is 7, then 8, then 9 and 10,
then 11 (3D, one after another, because each builds on the last). Lane C is 12 (desktop, `targets/tauri` and a new
workflow). Lane D is 15 (copy). The 3D lane is the long pole.

### SHOULD

Part 1's S1 to S7 stand: the "Play is off" message, `--template 3d` in help, 2D parity in WebKit and Firefox (the 3D parity
passed in all three on `d401ec4d`), `docs/status.md`, the frame-budget skip, the agent package's public home, and the stale
PRs.

### Decisions for the Owner

- **D1. Desktop Apps.** (a) games as desktop apps (M, plus certificates); (b) the paid Automata app (not started, 30 tasks,
  plus accounts, payments and signing); or both. A launch with (b) inside is weeks later than one without.
- **D2. The painter.** May `@automata/figures` (from the private FigureBuilder repository) be published? If not,
  `character-kit` ships without painted figures, or not at all.
- **D3. `@pixi/3d` version.** Ship on beta.3 (the `beta` tag; done once 7 merges) or wait for the 0.1.0 port (11).
- **D4. Editors packaging.** Raise `-tools`' 3 MB budget, or ship the editors as their own package.
- **D5. GitHub sign-in and sync.** Revive #544 (closed today, 146 files) for launch, or take the line off Home.

## Part 2: the Owner's checklist (full scope)

Part 1's checklist stands (npm org, domain, `NPM_TOKEN`, runners, frame budget, open the repository, approve the release,
Cloudflare, look at the site, `SKILLS_TOKEN`, close stale PRs, the app page's prices). Add:

1. **Answer D1 to D5** above.
2. **For desktop (a):** buy an Apple Developer membership and create the six `APPLE_*` secrets; buy a Windows
   code-signing certificate; keep a Mac, a Windows PC and a Linux machine available to build each bundle once.
3. **For desktop (b), if chosen:** the store accounts (Apple App Store, Google Play), a payment provider and the price
   approval for "$19.99" and "$39.99".
4. **Run the 3D cross-engine check** the beta.3 branch asks for (its audit's parity commands) on the Mac.

## Part 2: not verified here

- The Tauri build on any OS (no Tauri CLI, no WebKitGTK here), signing, and installers.
- The 3D stranger's steps after "check it" (the journey stops at the first failure).
- `claude/editor-journeys-green` (not on `origin` at this writing).
- `@pixi/3d` 0.1.0's public changelog; only the tarballs were compared.
- Whether the content editors (`extensions/editors`) pass their own suites today (not run here).
