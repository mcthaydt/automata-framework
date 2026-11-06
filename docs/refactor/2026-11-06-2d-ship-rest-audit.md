# The rest of AF for a 2D ship: audit

- **Stage:** 1 of 6 of the "2D editors and website" slice (audit), widened. The Owner, 2026-11-06: "we need to audit
  the other automata things too then; basically everything but 3D and editors (non-2D, we're addressing that
  already)". The plan stage folds this in beside the
  [2D editors and website audit](2026-11-06-2d-editors-and-site-audit.md).
- **Date:** 2026-11-06, on top of the stack (PR #405, head `0de2e586`). Other repositories at their default branches:
  `mcthaydt/automata-plus` `1766c622` (2026-11-01), `mcthaydt/automata-skills` `e14c0ba1` (2026-10-15).
- **What it covers:** everything a stranger touches on the way from "I want to make a 2D game" to "it is published",
  outside the code the earlier audits covered: `create-game` and the rest of the published `automata` command, the
  release of the packages, the reusable game workflows, the agent package, the docs, the 17 `tooling/` packages, the 2D
  examples as shipped, repository hygiene, and every other `automata` repository on the Owner's account.
- **What it does not do:** change code, or audit 3D (`render-pixi3d`, `figures`, `sector-format`, `games/base-3d`,
  `editor-3d`), the editors and the website (the [2D editors and website audit](2026-11-06-2d-editors-and-site-audit.md)),
  or the core code itself (the [core audit](2026-11-05-core-and-2d-audit.md) and the
  [build audit](2026-11-06-core-and-2d-build-audit.md)). The source project's name in code comments is PR #404's job.

Every number below was measured on these checkouts on 2026-11-06; the commands are in the appendix. WebKit and Firefox
cannot be installed in a cloud session, so the one browser run here is Chromium; hosted CI was not run.

## The short version

1. **A game made with `create-game` does not install outside this repository.** The new game's `package.json` asks for
   AF's packages as `workspace:*`, which only means something inside this monorepo, and by default it also asks for
   `@ruken/sdk`, which no registry has. `pnpm install` in the new folder fails on the first line, right after the
   command printed "Next: cd my-game && pnpm install && pnpm dev".
2. **An untouched new game fails its own check.** `automata check` cannot run two of its steps (the game was never
   given the tools they need) and fails a third on the template's own gamepad bindings.
3. **Every test passes around these breaks.** The `create-game` journey links the workspace's packages into the new
   game by hand, and the packed-install smoke installs the packages into a project it writes itself. Both are good
   harnesses pointed at the wrong project.
4. **The packages still release to GitHub Packages, as restricted.** The Owner chose npmjs.org for the 2D launch (D2).
   Sixteen files say GitHub Packages, the changesets config publishes as private, and the scope is the Owner's own
   handle, which the first public publish fixes forever.
5. **The published command carries the Owner's own machinery.** `ship test-remote` runs this repository's CI,
   `ship deploy-dev` deploys to a staging machine of another project, `automata add` clones the private Plus
   repository "on purchase", and Ruken is still the default target. The tools package exports 111 names; a game uses
   one.
6. **Automata Plus is as big as the refactored core and is built on the old one.** 36,594 source lines in 20 packages,
   pinned to a framework commit from before the refactor; 73 of its files import packages the refactor removed.
   Nothing in a 2D launch uses it. The "public mirror" of the agent package is an empty repository, and nine older
   Automata repositories, two of them public, are still live.
7. **The agent package and several docs teach the framework before the refactor**, and three different game layouts
   are each taught somewhere. The good parts are worth keeping: `pnpm check` is green in 4 minutes, the packed-install
   smoke passes all 14 steps in 29 seconds, `automata check`'s step design is right, and the publish guides are short
   and plain.

## 1. What this audit covers

| Area | In this audit | Covered elsewhere |
|---|---|---|
| The `automata` command | `create-game`, `check`, `build`, `add`, `ship` (all targets), the published surface of `-tools` | `automata editor` (editors audit, E2 to E4) |
| Releases | the five published packages, changesets, `release-packages.yml`, `release-checks.yml`, the registry, versions | |
| Game workflows | `game-ci.yml`, `game-release.yml`, the publish guides | |
| CI and the repository | the seven workflows' shape, root config, branches in every Automata repository | the PR gate's content (core audit, refactor phase 1) |
| Tooling | the 17 `tooling/` packages, judged by what they still serve | their code (core audit) |
| Agents and docs | `agents/automata`, `.claude-plugin`, `AGENTS.md`, `docs/` outside `archive/`, `design/` and `refactor/` | `docs/guides/editor.md`, `docs/design` (editors audit) |
| Examples | the 2D examples as shipped and built | their code (core audit) |
| Other repositories | `automata-plus` (read in full), `automata-skills` (read in full), nine older Automata repositories (metadata only) | `automata-website` (editors and website audit) |
| 3D | | `render-pixi3d`, `figures`, `sector-format`, `games/base-3d`, `editor-3d`, `vendor/pixi-3d` |

The core audit looked at `ship`, `cli` and `tooling/` before the refactor, as code. This audit looks at what they are
after it, as products a stranger installs.

## 2. The numbers

| What | Measure |
|---|---|
| `-tools` (`packages/tools`) | 7,685 source lines, 9,006 test lines; 673 unit tests (66 files) and 1 journey; the root entry exports 111 names (plus 17 in `./e2e`) |
| `tooling/` | 17 packages, 11,492 source lines, 10,901 test lines, 929 unit tests |
| Published packages | 5: `@mcthaydt/automata` (280 names in its API report), `-sim` (113), `-content` (115), `-tools` (128), `-check-boundaries` (a bin); all at 0.0.5 on GitHub Packages; none on npmjs.org (registry 404, 2026-11-06) |
| Generated API text | 10 API reports (16,049 lines), `docs/cheatsheet.md` (706), the agent package's `reference/api.md` (8,525) |
| Workflows | 7 files, 1,464 lines; 46 lines cite plan IDs or dated decisions |
| Agent package (`agents/automata`) | 4 skills, 2 hooks, 9,133 lines, of which 8,525 are the generated API reference |
| Current docs | 1,542 lines of Markdown outside `archive/`, `design/` and `refactor/`; 9 broken relative links |
| `automata-plus` | 20 workspace packages; 36,594 source lines, 28,376 test lines, 1,008 files, 5,898 lines of Markdown; last commit 2026-11-01 |
| Branches | framework 25 (main and 24 open pull requests), Plus 41 (0 open pull requests), website 39 (0 open pull requests) |
| Gates run here | `pnpm check`: passes, 4 min 0 s. Packed-install smoke (`--from packs`): passes, 14 of 14 steps, 29 s |
| The new-game path, run here | `create-game` then `pnpm install` outside the workspace: fails. `automata check` on the untouched game: 3 of 10 steps fail, 1 could not be judged |

For scale: the refactored core and Emberwick are 45,944 source lines (editors audit, section 2).

## 3. Findings

Each finding has an ID so the plan can point at it. The IDs do not repeat the editors audit's (E, S, K, T, G, W, WS, WT,
WG).

### A new game (N)

**N1. A new game does not install outside this repository.** `create-game` writes `"@mcthaydt/automata":
"workspace:*"`, `"@mcthaydt/automata-sim": "workspace:*"` and `"@mcthaydt/automata-tools": "workspace:*"`
(`packages/tools/src/shared/create-game/create-game.ts:83-91`). Run from the built bin in a scratch folder outside the
workspace, then `pnpm install`:

```
Failed to resolve @mcthaydt/automata-tools@workspace:*
Cannot resolve package from workspace because workspace packages were not loaded into the resolver
```

The command's own last line was "Next: cd my-game && pnpm install && pnpm dev".

**N2. The default targets add a package no registry has.** With no `--targets`, a game builds for all four, and the
`ruken` target adds `"@ruken/sdk": "^0.0.0"` (`create-game-targets.ts:51`). The `@ruken` organisation does not exist on
npm (`vendor/ruken/README.md`; the registry answers 404), so this fails even once N1 is fixed. The game never needed it:
`@mcthaydt/automata` bundles the Ruken SDK into its `ruken` entry (`packages/automata/tsdown.config.ts`). The Ruken guide
repeats "The game's package depends on `@ruken/sdk`".

**N3. An untouched new game fails `automata check`.** A `--targets web` game, with its dependencies linked from the
workspace (as the journey does), gave:

| Step | Result |
|---|---|
| boundaries | could not run: "automata-check-boundaries not found; install it" |
| typecheck | not judged here: the hand-made links resolve to the workspace's source, not the published build |
| test | could not run: "vitest not found; install it" |
| inputs | fails: "binds pad buttons but runtime.inputs has no "gamepad"". The template's `keys()` binds pad buttons 12 to 15, and its `ship.config.ts` declares `inputs: ['touch', 'keyboard']` |
| boards, orientation, no-eval, secrets, data-urls | pass |

`automata check` needs `@mcthaydt/automata-check-boundaries` and `vitest` in the game's `node_modules`; `create-game`
installs neither and `-tools` depends on neither.

**N4. A new game has no test and no check script.** The template writes the role files and `main.ts`, but no
`game.test.ts`, no `vitest`, and no `test` or `check` script (`dev`, `build:*`, `prepare:*` and `typecheck` only). The
framework's pitch is a deterministic sim you prove with tests, and the agent skill tells the agent to run
`vitest run src/sim/<feature>.test.ts`.

**N5. There is no one command to start.** `automata create-game` runs from an installed `-tools`, and `-tools`'s README
says `pnpm add -D @mcthaydt/automata-tools`, then `pnpm exec automata create-game my-game`, which needs a project to add
it to first. Once N1 and R1 are fixed, `pnpm dlx @<scope>/automata-tools create-game my-game` is one command; nothing
says so today.

**N6. The tests prove the path around the break.** The `create-game` journey (`packages/tools/tests/e2e/serve-new-game.ts`)
says: "installing there would rewrite the lockfile, so the links are made here by hand". The integration test symlinks
`-tools` into its scratch folder. The packed-install smoke installs the packs into a manifest it writes itself
(`tooling/consumer-smoke/src/project.ts`), not into what `create-game` writes. All three pass while the real path fails.

**N7. The new game's README points into a private repository:** "Publishing to each target is described in the
Automata Framework guides (`docs/guides/publish-to-*.md`)."

### What the published tools hold (U)

**U1. `-tools` exports 111 names; a game imports one.** A game's `ship.config.ts` imports `defineShipConfig`. The root
entry also exports error classes, Effect services (`FilesLive`, `ProcessRunnerLive`), `deployDev`, `testRemote`,
`PIXI3D_MARKERS`, `ITCH_LIMITS` and the rest of the internals. Each is public API: every internal change moves the API
report, the API index, the cheatsheet and the agent reference. The core refactor cut the browser package's root from
600 names to 274; this one was not cut.

**U2. `ship test-remote` runs this repository's CI.** It dispatches `ci.yml` with `gh` and polls the run (251 lines,
`shared/ship/remote/test-remote.ts`). In a game's repository there is no such workflow. It is in the published help.

**U3. `ship deploy-dev` deploys to another project's staging machine.** The "standalone dev host" is "a second Caddy
site on the FloorFifty staging VM" (`packages/tools/deploy/README.md`), at `af-dev.floorfifty.duckdns.org`, installing
into `/srv/automata/placeholder` (the placeholder game the refactor deleted). It brings `deploy/` (412 lines: a
Caddyfile and an ssh forced command) and `game-release.yml`'s `dev-host` job. It is not one of the four targets.

**U4. `automata add` can only fail for anyone else.** It clones `https://github.com/mcthaydt/automata-plus.git`, "the
private Automata Plus repository; buyers are given read access on purchase" (`features/add/add-args.ts`). Plus has been
free since 2026-11-01, the repository is private, and its one kit (`kits/ui-screens`) imports `@mcthaydt/automata-ui`,
which the refactor removed (P1).

**U5. Ruken is still the default target of `ship`.** `ship prepare` with no `--target` writes `ruken.toml`; `ship publish`
with none publishes to Ruken; `--private` reads "Ruken's local stack only; allows @pixi/3d, which a public build refuses
(D-1)". ADR 0006 says no target is the reference. The web target, the one every new game builds by default, has no
`ship` step at all, so the command's own target list leaves out the most common one.

**U6. A second published package for one command's step.** `automata check` needs `@mcthaydt/automata-check-boundaries`,
a separate published package that `-tools` does not depend on (N3). Five published packages where four would do.

**U7. A deprecation alias for a name nobody outside installed.** "`automata-ship` still works for one more release; it
prints that it has moved to `automata ship`" (`-tools` README). The packages have only been on GitHub Packages, used by
this repository, Plus and the website. A first public release needs no aliases, and no deprecation of the old GitHub
Packages names.

### Releasing the packages (R)

**R1. Releases go to GitHub Packages; the launch is on npmjs.org.** D2 (the Owner, 2026-11-06) chose npmjs.org. Sixteen
files name the GitHub Packages registry or its token: the five `publishConfig.registry` fields, the root `.npmrc`,
`release-packages.yml` (publishes with the workflow's `GITHUB_TOKEN`), `game-ci.yml` and `game-release.yml` (install with
`AF_READ_TOKEN`, a classic token with `read:packages`), the consumer smoke's `--from registry`, the runbook, and five test
files that pin it. `AGENTS.md` says the same in words ("Packages publish as `@mcthaydt/automata-<name>` to GitHub
Packages").

**R2. The changesets config publishes as private.** `.changeset/config.json` has `"access": "restricted"`. On npmjs.org a
restricted scoped package is a private, paid package; a public one needs `"public"`.

**R3. The scope is the Owner's own handle, and the first public publish fixes it.** Every import a game author writes
will say `@mcthaydt/...`. Renaming after the first npmjs.org release means deprecating every package and a codemod in
every game; renaming before it is one codemod in this repository. The licence names "Team Automata", and D8 already
moves the contact address off the personal mailbox. (D9)

**R4. The first public version has no plan.** The packages are 0.0.5. Fourteen pending changesets describe refactor
internals ("tests-in-tests-folders", "remove-network-port", "ship-test-remote-per-area"), and the changelogs carry
0.0.1 to 0.0.5 of private history. `check-changesets` allows only patch releases before 1.0, so anything but 0.0.6 needs
a one-time exception. 1.0 is the 3D launch (the Owner, 2026-10-23). (D10)

**R5. The reusable game workflows cannot be reused by anyone else.** The guides tell a game author to call
`mcthaydt/automata-framework/.github/workflows/game-release.yml@main`. The repository is private, and its workflows are
"Accessible from repositories owned by mcthaydt" (`game-ci.yml` header). Their defaults are the Owner's self-hosted
labels (`desktop-runners: ["af-linux", "af-mac"]`), and the example `dev-target` names the FloorFifty host. (D15)

**R6. No provenance while the repository is private.** npm no longer accepts provenance from a private source
repository ([GitHub changelog, 2023-07-25](https://github.blog/changelog/2023-07-25-publishing-with-npm-provenance-from-private-source-repositories-is-no-longer-supported/)).
`release-packages.yml` already says "No --provenance". It turns on when the repository opens with 3D.

**R7. The vendored Ruken notes describe packages that no longer exist.** `vendor/ruken/README.md` lists `packages/host`,
`packages/testing`, `packages/ship` and `packages/ui` as the users, and a "PRODUCT.4r follow-up" for licence notices in
testing and ui. After the merge, `@mcthaydt/automata` and `-tools` bundle the Ruken code and both publish
`VENDORED.md` with its MIT notice, which is right; the README is what is stale.

### Plus and the other repositories (P)

**P1. Plus is the size of the refactored core and is built on the old one.** `mcthaydt/automata-plus` holds 14
extensions (audio-synth, cutscenes, debug, dev-tools, feel, narrative, nav, net, net-ui, physics, puzzle, sectors, server,
systems), a kit, a starter and a pipelines tool: 36,594 source lines and 28,376 test lines. It builds core from framework
commit `f1b38528` (`core.ref`, before the refactor) through its own sync tool. 73 files in 14 of its packages import
`-node`, `-runtime`, `-ui`, `-testing`, `-game`, `-host`, `-render-pixi` or `-ship`, which the refactor merged into
`@mcthaydt/automata` and `-tools`; one import reaches into `@mcthaydt/automata-sim/src/world/sim`; physics peers on `-sim`
at exactly `0.0.3`. Moving `core.ref` to the refactor would break it (read from the imports; not run here, since the sync
builds the framework from a commit).

**P2. Nothing in a 2D launch uses Plus.** No framework package, game or example imports a Plus package. What points at
Plus from here is plumbing for Plus itself: `automata add` (U4), `tooling/core-packs` (exists to feed Plus's sync),
`tooling/api-report/src/seams.ts` ("A Plus package may import only these entries"), the examples catalog's physics
entry, the stack page's Plus rows, and the editor suite's gate reader, which expects Plus's pipelines (editors audit,
E6). Plus is not wired in by `defineGame`, the default screens or `create-game`. The first audit's D4 ("features no game
uses leave core") is the same rule seen from the other side. (D12)

**P3. Plus repeats the framework's old process.** Its own `AGENTS.md` citing the PRODUCT spec, 32 plans, its own CI on
the Owner's Mac, a core sync tool (405 lines and 814 test lines) that exists only because core is not on a registry, 118
failure screenshots committed under `packages/net/.vitest/` (ignored later, never removed), and a description that still
says "paid extensions".

**P4. The agent package has no public home.** `.claude-plugin/marketplace.json` says "Public installs use the
mcthaydt/automata-skills mirror". That repository is public and holds one commit from 2026-10-15: a two-line README.
With the framework private, nobody outside can install the agent package. (D16)

**P5. Nine older Automata repositories are still live.** Public: `AutomataEngineV1` ("Web-First AI-First Decentralized
Game Engine", last push 2026-08-16) and `automata-template` (a Godot 4.7 base, 2026-05-17). Private:
`AutomataEngine-LegacyV2-`, `AutomataCharacters`, `Automata-Immersive-Sim`, `automata-engine`, `automata-contracts`,
`automata-levels-v1` and `automata-game-builder` (May to September 2026). None is part of AF, so only their metadata was
read. A visitor who searches GitHub for Automata finds the two public ones; archiving makes them read-only and is
reversible.

**P6. Branches were pruned in the framework only.** Plus has 41 branches and the website 39, neither with an open pull
request. The framework has 25: `main` and the 24 open refactor pull requests, two of which (#379, #383) were ported in
#403 and can close. The Owner's end state ("only main and branches with active CI, fewer than 5") holds in none of the
three yet; the framework's will when the stack merges.

**P7. The repository descriptions say old things.** The framework: "versioned packages for building Ruken-ready web
games (snek_attak)". Plus: "AutomataFramework Plus paid extensions".

### The agent package and the docs (A)

**A1. The agent package teaches the framework before the refactor.** `skills/automata/SKILL.md`: law 7 "The host is a
port, and Ruken is the reference host" (`AGENTS.md` and ADR 0006: no target is the reference); law 2 about "networked
truth" (the network port left core in #390); layers in `src/sim/`, `src/input/`, `src/render/` and `src/screens/`;
verify with `vitest run src/sim/<feature>.test.ts` (N4). The worked example lives in `example/src/sim/`. The editor skill
builds `editor-3d` first and points at a guide "in the framework repository".

**A2. Three game layouts, and each document teaches a different one.** `automata check` accepts `src/sim/`,
`src/features/` or role files (`shared/check/check-steps.ts:87-110`). `create-game` writes role files (the GL spec);
Emberwick is laid out by feature (refactor task 6.3); `AGENTS.md` says "A game's `src/` has the same shape" as a package
(features); `games/base-3d` keeps role files until its slice; the agent skills teach `src/sim/` layers. (D13)

**A3. Three generated copies of one API.** `pnpm api-report` writes ten reports, `pnpm cheatsheet` writes
`docs/cheatsheet.md`, and `pnpm agent-skills --write` writes the agent package's `api.md`. After an export changes, the
rule is: build, run all three, commit all three; `release:version` runs two of them again. The website syncs a fourth
copy. One reference for people and agents, plus the review report, would carry the same facts.

**A4. Docs that contradict the direction.**

- ADR 0005 is titled "Ruken is the reference, itch.io is a peer", status "Accepted", with no note that ADR 0006
  replaced it. ADR 0004 ("Ruken first") is "superseded in part". ADRs 0002 and 0004 still say "written-spec review
  pending".
- `docs/stack.md`, generated from `tooling/versions/src/stack-cards.ts`, says "Plus is the paid Automata Plus tier", lists
  Effect as core and Colyseus as "planned for M7". It is the source of the website's stale "What's inside" page
  (website W4).
- `docs/versions.md` says "Where Ruken pins the same package, AF uses Ruken's version", and `renovate.json` holds 18
  packages and images (Node, pnpm, Vite, Vitest, Playwright, Zod and more) to Ruken's versions file. ADR 0006 made AF own its choices; this
  is the coupling it removed, still in the toolchain.
- `docs/status.md` says hosted CI has no runners and the README's first section clones the private repository; both
  were true for contributors, neither is the launch story.

**A5. Plan IDs outside code.** The build audit's rule (C1) covers code, config and Svelte. It does not cover YAML or
Markdown: the workflows carry 46 lines of plan IDs and dated decisions ("QB.1 (QB spec §4.1)", "M2.4 spec §3.5",
"Owner, 2026-10-30"), `docs/versions.md` 25, `docs/stack.md` 13, the vendor READMEs 11, the runbook 5, and
`renovate.json` and `.npmrc` a few more. (`docs/provenance/sources.md` is meant to carry them.)

**A6. Nine broken links in the current docs.** Five ADR links and one each in `docs/design/editor-2d`,
`docs/provenance/sources.md` and `docs/versions.md` point at `docs/superpowers/...`, which moved to `docs/archive/`; the
runbook links `02-master-delivery-plan.md` and `03-continuation-prompt.md`, also archived.

**A7. The source-names rule never runs.** `tooling/repo-hygiene/src/source-names.ts` checks the published READMEs,
changelogs and agent pages for the source projects' names; only its own test calls it, and no script, hook or workflow
does. Outside code comments (PR #404), the names remain in `packages/tools/deploy/` (Caddyfile, README, `bin/deploy`),
`docs/versions.md` (9), `docs/stack.md` and `stack-cards.ts` (11 each), and in the generated `cheatsheet.md` (6) and
`api.md` (15), which copy doc comments. The built `-tools` keeps comments, so its `dist/` names FloorFifty three times
until #404 lands.

### CI, tests and tooling (Q)

**Q1. Seventeen tooling packages for four published packages.** 22,393 lines and 929 unit tests. Several lose their reason
under the decisions already taken:

| Package | What it serves | After D1, D2 and D12 |
|---|---|---|
| `core-packs` | packs core for Plus's sync and the consumer smoke | Plus's half goes (D12); the smoke can pack with `pnpm pack` |
| `codemods` | the refactor's one-time moves | done once 3D and the editors have moved |
| `bundle-report` | one before-and-after measure (task 5.1) | a release-check step, or gone |
| `examples-runner` (4,725 lines) | the examples index and the website's playground | the playground moves with the site (D1) |
| `evidence` | golden and parity evidence, and the website's Proof page | the Proof page goes (D7) |
| `versions` | the pin table and the stack page | the stack page's Plus and Effect rows go (A4) |
| `frame-budget` | a frame-time budget measured on the Owner's Mac | it skips on a software renderer, which the default runner has (core audit C2) |

**Q2. 1,447 lines of tests restate the CI files.** `packages/tools/tests/unit/shared/ship/workflows.test.ts` (108 tests)
pins the YAML of all seven workflows, inside the published tools package; two `turbo-inputs` tests, a Renovate test and
the versions tests pin more config. Every CI change edits a test in `-tools`. A few of them guard something real (where
tokens go, which jobs skip drafts); those fit in a short invariant check beside `actionlint`.

**Q3. Every job runs on the Owner's machines, with no fork guard.** The workflows default to `af-linux` and `af-mac` (the
Owner's PC and Mac) and none checks where a pull request comes from (Plus's workflow does, and pins it with a test).
Harmless while the repository is private. GitHub advises self-hosted runners for private repositories only
([secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)), so this blocks opening the
repository with 3D.

**Q4. The examples package mixes 2D and 3D.** One package holds the 2D examples, the three `render3d` examples and the
five `figures` examples, and depends on `render-pixi3d` and `figures`. The catalog marks those private, but building the
2D examples (the site's demos and playground) installs the closed Pixi 3D beta. The editors audit's seam 5 (one licence
check for every public artifact) has to cover the examples build too.

**Q5. No test follows a stranger.** The pull request gate runs `pnpm check`, parity and the 2D journeys; the packed-install
smoke runs only before a release and nightly. Nothing does what a new author does: install the packed packages into an
empty folder, `create-game`, install, `automata check`, build for the web, boot it, prepare the itch.io zip. That path
fails today (N1 to N3), so a journey written for it fails first and then guards it.

### Copy and UX: the drunk grandma test (Y)

**Y1. `automata --help` is a wall.** It opens with six usage lines, then a paragraph of exit codes ("exit 0 added and
checked, 1 added and check found problems, 2 either not added (no access, unknown kit, core version, collision, or a
failed copy, which is undone) or added and a check step could not run"), "the boards, orientation and inputs scans",
and `__AUTOMATA_DEBUG__`. A first-time user needs four lines: make a game, run it, check it, publish it.

**Y2. `automata ship --help` speaks Ruken and internals:** "writes ruken.toml into the build (from ship.config.ts) and
checks it with Ruken's parser", "Ruken's local stack only", "allows @pixi/3d, which a public build refuses (D-1)", then
`deploy-dev` and `test-remote`.

**Y3. The first thing a new author is told fails** (N1), and the first check they run fails on code they did not write
(N3: "binds pad buttons but runtime.inputs has no "gamepad"").

**Y4. Worth keeping:** the web, itch.io and desktop guides are short, ordered and plain; `create-game` says
"Created "My Game" in my-game."; `automata check` names the file, line and rule for each finding.

## 4. Ready to ship with 2D alone: where each step stands

This adds to the editors audit's table (its section 5).

| Step | Today | Findings |
|---|---|---|
| Install AF from npmjs.org | No: GitHub Packages, restricted, no npm token yet | R1 to R3, D9 |
| Start a game with one command | No: install `-tools` into a project first | N5 |
| `pnpm install` in the new game | Fails | N1, N2 |
| `automata check` passes on the untouched game | No: 3 of 10 steps fail | N3, N4 |
| Write gameplay with a coding agent | The agent package has no public install, and teaches the old layout | P4, A1, A2 |
| Publish to the web | Yes: upload `dist/` (no `ship` step) | U5 |
| Publish to itch.io | Yes from the command line with butler; the CI route is a private workflow | R5 |
| Publish to Ruken | Only with Ruken credentials; whether outside authors can get them is the Owner's call | N2, U5, D11 |
| Publish to the desktop | Builds locally with Rust; unsigned without the Apple secrets; the CI route is private | R5 |
| Optional extensions | None usable: Plus is on the old core, private, and `automata add` cannot reach it | P1 to P3, U4 |
| Docs and the agent package describe today's framework | No | A1 to A7 |
| Nothing closed-beta reaches a public artifact | Packages yes (`ship prepare` refuses `@pixi/3d`; `render-pixi3d` is private); the examples build installs it | Q4 |
| Tests prove the stranger's path on every pull request | No | N6, Q5 |

## 5. Seams 3D will need

1. **Opening the repository** (with Pixi 3D's public release): a fork guard or GitHub-hosted runners for pull requests
   (Q3), provenance on (R6), the reusable workflows callable (R5), `repository` links that resolve, and the runbook's
   machine names taken out.
2. **Examples by dimension:** a 2D examples package and a 3D one, so the 2D build never installs `@pixi/3d` and the
   site's 3D demos arrive with the 3D slice (Q4).
3. **One version for every published package.** The changesets `fixed` group already does this; keep it, so
   `render-pixi3d` and `figures` join at the same number when they publish.
4. **Extensions arrive with the game that needs them.** If a Plus extension comes back (say 3D physics for the 3D
   game), it lands in this repository as `extensions/<name>`, by feature, tests in `tests/`, on the current core (D12).
5. **One API reference per published package** (A3), so 3D entries appear in the docs and the agent package the day
   3D publishes.
6. **`create-game --dimension 3d`** later, from the same template code, once one game layout is settled (D13).

## 6. For the plan stage

### Decisions (made by the Owner, 2026-11-06)

They continue the editors audit's numbering (D1 to D8). The Owner took all nine recommendations on 2026-11-06 ("Go
with all recommendations", on the question "Go with all nine recommended defaults from the audit (D9 to D17)?"). The
plan stage builds on the options marked recommended. D17's actions (the npm organisation and token, the push token for
`automata-skills`, archiving, the branch prune in Plus and the website, the descriptions, and whether outside authors
can publish to Ruken) are still the Owner's to carry out.

- **D9. The npm scope.**
  - **A (recommended):** a project scope (an npm organisation the Owner creates, such as `@automata-framework`),
    renamed in one codemod pull request before the first npmjs.org publish. This is the last cheap moment; it matches
    the "Team Automata" licence and the project contact address (D8).
  - B: keep `@mcthaydt/automata*`. No codemod, no organisation; the Owner's handle is in every game's imports for good.
- **D10. The first public version.**
  - **A (recommended):** 0.1.0 on npmjs.org, "the first public release", with one written changelog entry instead of
    the fourteen pending refactor entries; a one-time exception in `check-changesets`, then patches again; 1.0 stays the
    3D launch.
  - B: 0.0.6 with the pending changesets as they are.
- **D11. The targets a new game starts with.**
  - **A (recommended):** `create-game` defaults to `web` and `itch`, which any author can publish to today with no SDK;
    `--targets` adds `tauri` and `ruken`. No game depends on `@ruken/sdk` for any target (the adapter is bundled). The
    four stay peers in code (ADR 0006); only the starting set changes.
  - B: keep all four by default and drop only the `@ruken/sdk` line.
- **D12. Automata Plus.**
  - **A (recommended):** Plus does not ship with 2D. Archive the repository (read-only, reversible); take
    `automata add`, `core-packs`' Plus half, the API seams list and the stack page's Plus rows out of this repository;
    an extension comes back, ported, as `extensions/<name>` here when a game here uses it.
  - B: port Plus to the refactored core now (73 files) and publish its extensions with 2D.
  - C: move Plus into this repository now as `extensions/`, ported, unpublished.
- **D13. One game layout.**
  - **A (recommended):** feature folders for every game (`src/app`, `src/features/<x>`, `src/shared`, sim files by role
    suffix), as Emberwick and `AGENTS.md` have it. `create-game` writes that shape (one `features/square`), `automata
    check` accepts only it (and `games/base-3d` until its slice), and the agent skills teach it. The GL role-file layout
    retires.
  - B: role files for every game (the GL spec); Emberwick moves back.
- **D14. What the published `automata` command holds.**
  - **A (recommended):** what a game author needs: `create-game`, `check`, `build`, `editor` (2D, per D3 and D4) and
    `ship prepare|publish --target <web|itch|tauri|ruken>`, with the target always named. `test-remote`, `deploy-dev`
    (with `deploy/` and the `dev-host` job), `add` and the `automata-ship` alias leave the package; `test-remote`
    becomes a repository script if the Owner still wants it. The root entry shrinks to `defineShipConfig` and its types,
    and `check-boundaries` folds into `-tools`.
  - B: keep every command and fix the copy.
- **D15. CI for a game made with AF.**
  - **A (recommended):** `create-game` writes a small `.github/workflows/release.yml` into the new game that runs
    `automata ship` on GitHub's runners. The framework's `game-ci.yml` and `game-release.yml` shrink to what Emberwick
    needs, or become that template's source.
  - B: keep the reusable workflows, usable by others when the repository opens.
  - C: no CI for games at launch; the guides show the commands.
- **D16. The agent package's public home.**
  - **A (recommended):** the release workflow copies `agents/automata` into `mcthaydt/automata-skills` (the public
    mirror the marketplace already names), so it installs from there; the skills are rewritten for the refactored
    framework first (A1, A2).
  - B: delete `automata-skills` and launch without an agent package.
- **D17. The Owner's own actions.** These block the launch, not the refactor: create the npm organisation (D9 A) with
  `NPM_TOKEN` (D8); a token that can push to `automata-skills` (D16 A); archive Plus (D12 A) and the nine older
  repositories (P5), or say which to keep; let the branch prune run in Plus and the website (P6); update the
  repository descriptions (P7); and say whether outside authors can publish to Ruken (D11).

### Work the plan should cover, in order

1. **Write the stranger's journey first** (Q5): pack the packages, `create-game` in an empty folder outside the
   workspace, install from the packs, `automata check`, build for the web, boot it in Chromium, prepare the itch.io zip.
   On every pull request that touches `packages/`. It fails today (N1 to N3).
2. **Fix `create-game`** (N1 to N4, N7, D11, D13): real version ranges instead of `workspace:*`, no `@ruken/sdk`, the
   default targets, inputs that match the template, a first test with `vitest`, `test` and `check` scripts, the feature
   layout, README links to the site.
3. **Trim the published command** (D14, U1 to U7, Y1, Y2): the commands that leave, `--target` required, the root entry,
   `check-boundaries` folded in, help text that passes the drunk grandma test.
4. **Release to npmjs.org** (R1 to R4, R7, D9, D10): the scope codemod if D9 A, the registry and `access: public`, the
   first-release changelog, the smoke `--from registry` against npmjs.org, the runbook, `AGENTS.md` and the guides;
   then the Owner's token and release approval (D17).
5. **CI for games** (D15, R5).
6. **The agent package and the docs** (A1 to A7, D16): skills rewritten for the refactored framework, one API
   reference, ADRs 0004 and 0005 marked superseded, the stack page and `versions.md` without Plus, Effect-in-core or
   Ruken-matched pins, the plan-comment rule extended to YAML and Markdown, links fixed, the source-names rule wired
   into `pnpm check` (or deleted).
7. **A tooling diet** (Q1, Q2): `core-packs` and the API seams list with D12, the codemods after the 3D and editor
   moves, `bundle-report`, the workflow tests cut to a few invariants, the playground with the site (D1).
8. **Examples by dimension** (Q4).
9. **Plus and the other repositories** (D12, D17, P1 to P7): what the Owner decides, then the branch prune.

## Appendix: how the numbers were measured

Framework at `0de2e586` (#405), Node 24.22.1 (`/opt/node24/bin`), pnpm 10.34.6 through Corepack, Playwright's preinstalled
Chromium. Plus at `1766c622`, automata-skills at `e14c0ba1`.

- **Lines:** `find <dir> -type f \( -name '*.ts' -o -name '*.svelte' -o -name '*.js' -o -name '*.mjs' -o -name '*.css' \)`
  over source (tests, `tests/` and `fixtures/` left out) and over `*.test.ts` and `tests/` for tests, piped to
  `xargs cat | wc -l`.
- **Gates:** `pnpm install --frozen-lockfile`, then `time pnpm check` (exit 0, 4 min 0 s); `turbo run build` for the five
  published packages, then `node tooling/consumer-smoke/src/run.ts --from packs` (exit 0, 14 of 14 steps, 29 s). Unit
  test counts from the `pnpm check` log.
- **The new-game path:** `node packages/tools/dist/bin.js create-game my-game` in a scratch folder outside the
  workspace, then `pnpm install` (fails, quoted in N1). A second game with `--targets web`, its dependencies symlinked
  from the workspace as `serve-new-game.ts` does, then `node packages/tools/dist/bin.js check` (exit 2; the step table in
  N3).
- **Registries:** `npm view <name> version --registry https://registry.npmjs.org` for `@mcthaydt/automata`,
  `@mcthaydt/automata-tools` and `@ruken/sdk` (all 404).
- **API surface:** `### ` headings per entry in `tooling/api-report/reports/<package>.api.md`.
- **Plan IDs:** `grep -cE` for `M<n>`, `DX.`, `QB.`, `PUB.`, `PRODUCT.`, `DIST.`, `EX.`, `GL.`, `APP.`, `ED2D.`,
  `EDS.`, `EDK.`, `M<n>R-D<n>`, `D-<n>`, "spec §" and "Owner, 2026" per file.
- **Links:** a script that resolves every relative Markdown link in `git ls-files '*.md'` outside `docs/archive/`, the
  changelogs and the generated references.
- **Plus's imports:** `grep -rlE "from '@mcthaydt/automata-(node|runtime|ui|testing|game|host|render-pixi|ship)['/]"`
  over its `packages`, `kits`, `starters` and `tooling`.
- **Branches and pull requests:** `git ls-remote --heads origin` in each repository; the GitHub API's open pull requests.
- **Other repositories:** `gh api -X GET search/repositories -f q='user:mcthaydt automata'` and the full repository list
  of the account.
- **Not run:** WebKit and Firefox, hosted CI, Plus's own checks (its sync builds the old framework commit), `ship publish`
  to any real target, `prepare --target tauri` (no Rust here).
