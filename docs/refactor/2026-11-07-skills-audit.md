# automata-skills audit (stage 1)

- **Stage:** 1 of 6 (audit) of the "Bring automata-skills up to date" pipeline. Next: plan and spec, then plan audit,
  build, build audit and fixes, each in its own thread. Progress: [skills-progress.md](skills-progress.md).
- **Date:** 2026-11-07, written on `claude/project-thread-l4q4y1`.
- **Asked by the Owner (2026-11-07):** "Have we been updating automata-skills, I know we worked on automata-plus", then
  "Oh, let's handle that".
- **This is the full copy.** It moved here, to the framework's `docs/refactor/`, in stage 2 (decision D1 A). The copy
  first written in `mcthaydt/automata-skills` (`docs/2026-11-07-skills-audit.md`, PR #1) is public, so it leaves out the
  names of the projects the framework's code came from; otherwise the two are the same.

## Short version

**No, automata-skills has not been updated, and nothing has gone wrong there yet: it is still its first commit.** It is a
generated mirror. Its source is the framework's agent package, `agents/automata` in `mcthaydt/automata-framework`, and
the refactor did update that source (#436, commit `39ae6cd9`, "the skills teach the refactored framework"). The release
workflow copies the package into this repository after a publish, once a `SKILLS_TOKEN` exists. No `@automata/*`
release has run and the token does not exist, so nothing has been copied.

The skills themselves are in good shape at the head of the stack. They teach the feature layout, the `@automata/*`
names and the plain-TypeScript browser runtime, and their gates pass. The problems are in how they reach people, and
in what the 3D slice is about to change:

1. **The mirror would not install as a Claude Code plugin** (M1, high). The release job copies only `agents/automata`,
   with no `marketplace.json`. Claude Code 2.1.301 refuses it: "Marketplace file not found". With a generated
   marketplace file, the same tree validates and installs, with 5 skills and 2 hooks.
2. **The first mirror push deletes everything else in this repository** (M2, medium). That includes the README, this
   audit and its progress page, and it leaves the repository with no licence.
3. **The 3D slice would make 3D skills public before 3D is public** (T1, high), and its plan asks the API index for a
   3D reference that the index cannot make until the release phase (T2, medium).
4. **`pnpm source-names` does not know EnvironmentBuilder** (T3, medium). The 3D port takes code and doc comments from
   it, and the generated reference copies doc comments into the public mirror.
5. **The editor skill covers the level editor only** (C3). There is nothing on the Tuner, `--app` or `--game-url`. The
   API reference also prints the source code of six re-exported sim functions (C1).

DUEL and 0.1.0 need almost nothing from the skills. The release regenerates the version (V1). The palette move
regenerates the reference (D1), but its plan leaves out `create-game`'s colours. automata-plus does not overlap with
automata-skills (P1). Its drift is recorded in P2.

## 1. What was read and run

| Repository | Commit | Notes |
|---|---|---|
| `automata-skills` | `e14c0ba1` (main, 2026-10-15) | One commit, `README.md` only (2 lines). Public. No PRs, tags or other branches. |
| `automata-framework` main | `97270d4b` (#391 merged) | Still the pre-refactor agent package (V3). |
| `automata-framework` stack head | `ac899051` (#443, on #442 `6159c702`, on #441 `b989526c`, down to #392) | The agent package as it will land. |
| `automata-framework` #440 head | `3eae41d6` | Holds the 0.1.0 changeset (`12bda870`), not yet merged up into #441 to #443. `git diff origin/s443 origin/s440 -- agents tooling/agent-skills` is empty, so the agent package is the same on both. |
| `automata-plus` | `1766c622` (main) | `core.ref` is `f1b38528`, AF's #363 merge from 2026-10-31. |
| `automata-website` | `4a514eb` | Being archived. The site now lives in AF's `site/`. |
| FigureBuilder, EnvironmentBuilder | as checked out | No skills. They are 3D sources only; read for T3. |

Run at the stack head (`ac899051`, Node 24.21 through pnpm):

| Command | Result |
|---|---|
| `pnpm --filter @automata/agent-skills test` | 7 files, 111 tests passed (the worked example's test included) |
| `pnpm --filter @automata/agent-skills typecheck` | passed (the example included, through the package's `paths`) |
| `pnpm agent-skills` | "agent package: 5 skills, no layout problems" |
| `turbo build` of the four published packages, then `pnpm api-index` | "564 exports from 21 entry points at 0.0.5; 0 undocumented". The committed `reference/api.md` and `plugin.json` are not stale. |
| `node tooling/repo-hygiene/src/source-names-cli.ts` | 0 findings |
| `claude plugin validate agents/automata --strict` and `validate . --strict` (Claude Code 2.1.301, the pinned version, in a throwaway `CLAUDE_CONFIG_DIR`) | both passed |
| `claude plugin marketplace add <AF checkout>`, `plugin install automata@automata-framework`, `plugin details` | installed; "Skills (5) automata, automata-api, automata-editor, automata-feature, automata-verify", "Hooks (2) PostToolUse, Stop" |
| The release job's copy, re-enacted on a local clone of this repository (`find … ! -name .git -exec rm -rf`, `cp -R agents/automata/.`), then `claude plugin marketplace add <clone>` | **exit 1: "Marketplace file not found at …/automata-skills/.claude-plugin/marketplace.json"** |
| The same clone plus a generated `.claude-plugin/marketplace.json` (`"name": "automata-skills"`, plugin `automata`, `"source": "./"`) | validate, marketplace add and `plugin install automata@automata-skills` all passed; Skills (5), Hooks (2) |
| `automata check games/emberwick --sim-only --json` (from source) | boundaries and typecheck ok; test: `tool-error`, "failed to load config" (M5) |
| `gh api search/repositories` | `automata-skills` public (last push 2026-10-16); `automata-framework`, `automata-plus` and `automata-website` private |

Not run: `npx skills add` (the Agent Skills installer). This session refused to run code downloaded from npm, so that
install route is unverified here. The `test:install` suite needs the same installer. WebKit and Firefox were not
needed.

## 2. What automata-skills is, and what it would receive

The DX spec chose it as the public home of the agent package while the framework is private (D-DX-2, 2026-10-16). The
2D slice kept it (D16 A, "Go with all recommendations", 2026-11-06). The `skills` job in
`.github/workflows/release-packages.yml:197` runs after a publish that published something. Without `SKILLS_TOKEN` it
prints "No skills token yet." and passes. With the token, it empties a clone of this repository except `.git` (line
232), copies `agents/automata/.` in (line 233), and pushes "Agent package for <version>". Everything it needs before
it can run is the Owner's: the `@automata` organisation on npmjs.org, `NPM_TOKEN` in the `release` environment,
approval of the release run, and `SKILLS_TOKEN`.

What it would receive from the stack head:

| Path | What | Size |
|---|---|---|
| `.claude-plugin/plugin.json` | plugin `automata`, version set by `pnpm api-index --write` (0.0.5 now) | 8 lines |
| `hooks/hooks.json` | `PostToolUse` on `Edit\|Write` runs `check.mjs post-edit`; `Stop` runs `check.mjs stop` | 2 hooks |
| `scripts/check.mjs` | the hook: `automata check --sim-only --json` after a sim edit, `automata check --json` on stop | 114 lines |
| `skills/automata/SKILL.md` | the seven laws, where code lives, where a change goes, the order to verify in | 82 lines |
| `skills/automata-feature/` | test-first gameplay, with the double jump as a `create-game` feature (4 source files, 1 test) | 67 lines plus 145 |
| `skills/automata-verify/SKILL.md` | `automata check`, its `--json`, and every rule with its fix | 137 lines |
| `skills/automata-editor/SKILL.md` | `automata editor`: opening, what it may write, troubleshooting | 40 lines |
| `skills/automata-api/` | how to use the reference, plus `reference/api.md`, generated | 25 lines plus 7,760 |

## 3. The areas asked about

| Area | Verdict | Findings |
|---|---|---|
| The DUEL palette, AF-wide | Not in the code yet: it lands in the 3D slice's phase 5. The skills name no palette; the reference names Endesga 64 twice and is regenerated in task 5.1. | D1 |
| The 0.1.0 version | Nothing to do by hand: `release:version` regenerates `plugin.json` and the reference's version. | V1, V2 |
| Feature folders and the new package names | Done. The skills teach `src/features/<name>/`, `src/shared/`, `src/app/game.ts`, `tests/unit/<name>/` and the `@automata/*` names, matching what `create-game` writes and what `automata check` accepts. No `@mcthaydt` is left in `agents/` or `.claude-plugin/`. | C4, V3 |
| The 2D APIs and editors | The API reference is current at 0.0.5. The editor skill describes the level editor only. | C1 to C3, C5 to C8 |
| The planned 3D slice (#442, #443) | The plan touches the agent package in tasks 5.1, 5.2 and 13.2 only, without naming what changes. Three other tasks change what the skills state, and they leave the skills out. | T1 to T5 |
| automata-plus | No overlap. Pre-refactor names and pin; D12 A archives it. | P1, P2 |
| Distribution (the mirror) | Would not install as a plugin; would delete this repository's own files. | M1 to M5 |

## 4. Findings

Severity: **High** blocks the skills' purpose or breaks an Owner rule. **Medium** misleads an agent or a user, or a
plan step cannot work as written. **Low** is wording or a small gap. Paths are at the stack head `ac899051` unless
another commit is named.

### Distribution (M)

**M1, high. The mirror is not a Claude Code marketplace, so `/plugin marketplace add mcthaydt/automata-skills` would
fail.** The job copies `agents/automata` only. Claude Code needs `.claude-plugin/marketplace.json` at the repository
root to add a marketplace. Re-enacted with the pinned CLI, it fails with "Marketplace file not found". The DX spec
(§3.7, plan D5, row DX.11c) asked for "a generated `.claude-plugin/marketplace.json` (marketplace `automata-skills`)",
but the 2D slice's task 16.4 wrote the job without it, and no test checks the mirror's layout. The framework's own
marketplace file still tells people "Public installs use the mcthaydt/automata-skills mirror"
(`.claude-plugin/marketplace.json:3`). *Verified fix:* the same tree with a marketplace file listing plugin
`automata` from `"./"` validates, adds and installs, with 5 skills and 2 hooks. *Recommendation:* the job writes that
file, and a unit test builds the mirror tree in a temp folder and checks it with `readAgentPackage` and
`diffSkillTrees`.

**M2, medium. The first mirror push wipes this repository: the README, this audit, its progress page, and any licence.**
`find "$mirror" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +` (`release-packages.yml:232`) is meant to make
the mirror exactly `agents/automata`. `agents/automata` has no README and no LICENSE. The public result would be a
repository with no install line, no description of itself and no licence, although the framework and Plus are MIT.
`claude plugin validate` also advises a README line that installs the plugin. *Recommendation:* the job writes the
README (the two install lines from M1) and copies the framework's `LICENSE`. This pipeline's documents live in the
framework's `docs/refactor/` from stage 2 on (decision D1), so this repository stays output only.

**M3, medium. Nothing tells a person to install the framework's own plugin.** The site's "Set up your agent once"
(`site/src/features/start/agent-setup.ts`) installs Superpowers and the PixiJS skills only. The framework's plugin, with
the seven laws, the worked example and the check hooks, is offered nowhere: not on the site, in the docs or in a
README. The old website held the claim back until it had proof (`automata-website` `src/data/restorations.ts`, row
DX.10c: "each command tested on a named agent version"). The AF site has no such row because it has no claim to hold.
*Recommendation (D3):* once M1 is fixed and a release has mirrored, add the install lines to Start beside Superpowers
and PixiJS, each tested on a named agent version.

**M4, info. The mirror stays empty until the first release.** The release needs the Owner's npm organisation,
`NPM_TOKEN`, approval of the release run, and `SKILLS_TOKEN`. The job is right to pass without them. Until they exist,
the answer to "is automata-skills up to date" is "it has never been written".

**M5, low. The install suite, the only proof of a real install, is stale, and no gate runs it.**
`tooling/agent-skills/tests/install/install.test.ts`:
- It expects `Skills (4)` (line 68; `SKILL_NAMES` on line 15 lists four), but the package has 5 (verified above).
- It seeds `games/emberwick/src/sim/dx7-seeded.system.ts` (line 79). Emberwick is laid out by feature, with no
  `src/sim`, and `automata check` refuses a game that has a `src/sim` folder (`check-steps.ts:52–54`).
- The hook it drives runs `automata check` on Emberwick, whose test step fails in the workspace. Emberwick's own scripts
  load its Vitest config with `--configLoader runner`, and `automata check`'s test step does not, so it reports
  `tool-error` "failed to load config". This run reproduced it, with Node 22 and with Node 24.
- It installs only from the framework's marketplace, never from the mirror's layout, so it could not have caught M1.

*Recommendation:* point it at a `create-game` game made in a temp folder, expect 5 skills, add the mirror layout as a
second install source, and run it in `release-checks.yml` before a publish.

### Skill content (C)

**C1, medium. The API reference prints the source code of six functions, not their declarations.** `@automata/framework`
re-exports `defineCommand`, `defineComponent`, `defineEvent`, `definePlugin`, `defineResource` and `defineSystem` from
`@automata/sim` (`packages/automata/dist/entries/game-and-sim.d.ts`). Inside the workspace, `@automata/sim`'s
`exports["."]` is `./src/entries/index.ts`, so the extractor follows the re-export into source. The framework section of
`reference/api.md` (lines 2489 to 2680) then shows the function bodies, with internals such as `checkId`, `sortedKeys`
and `defineSystemFrom`. The sim's own section, and the published `.d.ts` (`packages/sim/dist/sim-*.d.ts:138–140`), have
declarations only. The skill says the reference is "generated from the packages' published `.d.ts` files", which is
not true for these six, and an agent may copy calls to internals. *Recommendation:* resolve workspace packages through
their `publishConfig` types when indexing, and add a test that no indexed signature has a body. The site's API pages
read the same index, so they should be checked too.

**C2, low. Two entry points are left out of a reference that says it lists every one.** `@automata/framework/target` (a
conditional export with no `types` key) and `./theme.css` are not indexed (`tooling/api-index/src/entry-points.ts`). No
game imports `/target`: the runtime picks it by build condition. But "an export not listed does not exist" would lead
an agent to believe `createHosting` does not exist. *Recommendation:* the skill names what is left out and why, in one
line.

**C3, medium. The editor skill covers only the level editor.** `automata editor` now takes
`[--app 2d|3d|suite] [--app-dir <build>] [--game-url <address>]` (`packages/tools/src/features/editor/editor-command.ts:32`).
It also opens the Tuner, which shows the game beside its settings and needs `pnpm dev` running ("The Tuner shows your
game beside its settings: start it with pnpm dev, and give --game-url if it is not on http://localhost:5173"). The 2D
editor has Map, Tiles (with Add tiles) and Characters (`packages/editor/src/features/`). The skill's usage line lists
none of these. The Owner called the Tuner and Add tiles essential (2026-11-06), so an agent asked to "tune the jump" or
"add a tileset" has no guidance. Also, the symptom row "`listening beyond the loopback needs a token`" cannot be reached
from the command, because `--lan` always makes a token (`editor-command.ts:105`). *Recommendation:* the usage line,
one paragraph on the Tuner (`pnpm dev`, `--game-url`), and one line on the other views. Drop the unreachable row.

**C4, low. The sim import rule is stated two different ways, and neither matches the checker.** The `automata` skill
says "only `@automata/sim` (and `/math`, `/hash`), `zod`, `koota` through the sim's API, and relative imports". The
verify skill says "…`zod`, the physics entry points…". The checker allows `koota`, `zod`, Rapier's 2D and 3D
deterministic-compat builds, and the three sim entries (`packages/tools/src/features/boundaries/sim-rules.ts:83–93`),
plus any `simEntries` an installed extension declares (`sim-imports.ts`). AF has no physics package any more, and a 3D
game will import `@automata/3d/sim` that way (3D spec, `"simEntries": ["./sim"]`). *Recommendation:* one list in both
skills, read from `IMPORT_ALLOWED` by `skill-content.test.ts`.

**C5, low. The verify skill documents ten rules that `automata check` never reports on a game.** The rules
`feature-import`, `shared-import`, `app-import`, `entries-import`, `entries-logic`, `testing-import`, `alias-in-src`,
`browser-import`, `forbidden-import` and `platform-import` come from the checker's `--features`, `--browser`, `--forbid`
and `--platform-imports` modes. `automata check` runs only `--game src` (`check-steps.ts:66`). They are listed because
`skill-content.test.ts` requires every rule id. One of their messages is also stale: `platform-import` suggests
"`@automata/framework/testing (FakeHosting)`" (`features/boundaries/platform-imports.ts:27`), but `FakeHosting` is gone;
the export is `fakeHosting`. *Recommendation:* move the ten into a "framework repository only" table, and fix the
message.

**C6, low. The CSP rules read as Ruken-only.** `no-eval`, `data-urls` and `csp` are explained through "Ruken's CSP". By
ADR 0006 and `AGENTS.md`, every web target allows no `eval`, Ruken's included, and the check uses Ruken's policy
(`shared/check/ruken/`). An agent shipping only to itch.io could read the rule as not applying to it.
*Recommendation:* "web targets run without `eval`; the check loads the game under Ruken's policy".

**C7, low. No skill says how to ship.** The `automata` skill says only "`Hosting` and `ship.config.ts`". The commands
(`automata build`, `automata ship prepare|publish --target web|itch|tauri|ruken`) and the guides
(`docs/guides/publish-to-*.md`) are not mentioned. *Recommendation:* one bullet pointing to the guides and the command.
No new skill: the Owner wants essentials only.

**C8, low.** `plugin.json`'s description names rules, features, the API and check findings, and leaves out the editor.

### Versions and names (V)

**V1, verified, no change needed.** At the stack head, `plugin.json` and the reference say 0.0.5, and the four packages
are 0.0.5. The first release is 0.1.0 through `.changeset/first-public-release.md` (on #440, `12bda870`). The release's
version step runs `changeset version && … && pnpm api-index --write` (root `package.json` `release:version`). That
rewrites both files to the released version, as #431 already did for 0.0.6 (its diff changes `plugin.json` and
`reference/api.md`). The mirror commit would say "Agent package for 0.1.0".

**V2, low. #431 ("Version packages", open against main) would publish 0.0.6 under the old names.** It bumps the
`@mcthaydt/*` packages and the plugin to 0.0.6 on main. Merging it would fork the version line before the stack lands.
main's release workflow has no `skills` job, so it would not touch this repository. *Recommendation:* close #431 when
the stack merges (the merge thread's call).

**V3, info.** main still has the pre-refactor skills: law 7 "Ruken is the reference host", law 2 on networked truth,
`src/sim/` and the `@mcthaydt/automata-*` names. The stack replaces them. Nothing reads them from main.

### DUEL (D)

**D1, medium. The palette move regenerates the reference, but leaves the starter game and the skills' guidance out.**
The reference names the palette in two places: "The palette a game gets when it has no `content/palette.toml`:
Endesga 64" (`reference/api.md:227` and `:1768`). Task 5.1 regenerates it ("API report, agent skills"), which is
right. Two gaps:
- **`create-game`'s colours stay Endesga 64.** The new game's square is `0xffc825` (Endesga 64,
  `packages/content/src/shared/palette/endesga-64.ts:37`; `template-game.ts:75`), and its wall is `0x64748b`, which is
  in neither Endesga 64 nor DUEL (`template-level.ts:102`; FigureBuilder's `duel-ramps.ts` has neither colour). Task 5.2's file list covers Emberwick, the theme, the 2D examples and the
  editors, not `packages/tools/src/shared/create-game/`. The feature skill holds up that `square` feature as the
  model.
- **The skills never say how game colour works.** Task 5.1 adds `ramps`, `rampOf` and `step` so that game art "moves
  colour the DUEL way", but no skill tells an agent to draw with palette colours and move them a whole step along a
  ramp.

*Recommendation:* add `create-game`'s template to task 5.2, and one line to the `automata` skill's "How it looks"
bullet once 5.1 lands.

### The 3D slice (T)

**T1, high. 3D skill text would go public before 3D is public.** Task 13.2 (`2026-11-07-3d-slice-plan.md:724`) writes
"the agent package's 3D skills". The mirror copies whatever `agents/automata` holds on main at the next release, and
the first release (0.1.0, 2D only) waits on the Owner's npm inputs. If part B merges first, a public repository would
teach `@automata/3d` and `create-game --template 3d`. That template answers "3D games need a package that is not
public yet." (task 12.2), and the 3D audit's W2 says "Nothing 3D can be public yet". *Recommendation (D2):* keep 3D
skill text out of `agents/automata` until phase 20 (written beside the release PR), with a unit test that the package
names no unpublished package.

**T2, medium. Task 13.2 asks `pnpm api-index` for a 3D reference that it cannot make yet.** The index covers "every
package Changesets publishes" (`tooling/api-index/src/entry-points.ts:1–2`, `publishablePackages`). `@automata/3d`
stays private until phase 20 (3D spec §11 "Versions"). So during parts A to C, `pnpm api-index --write` writes no 3D
entries, and a 3D skill would have no generated API to point to. *Recommendation:* move the 3D reference to phase 20,
when the package becomes public. Until then, the 3D package's own docs are the source.

**T3, medium. `pnpm source-names` does not stop EnvironmentBuilder's name.** The 3D plan relies on it: "`sources.md` is
the only file that names them (`pnpm source-names`)" (plan line 53). But `SOURCE_NAMES`
(`tooling/repo-hygiene/src/source-names.ts:13`) lists FloorFifty, The Last Light, PixiJS3D_Experiment, FigureBuilder
and LegacyV2, not EnvironmentBuilder. It reads only `.md` under `agents/` (line 52), so the worked example's `.ts` files
and `check.mjs` are not scanned either. The 3D port brings EnvironmentBuilder code and doc comments, and the reference
copies doc comments into the public mirror. *Recommendation:* add EnvironmentBuilder (and the `.ts` and `.mjs` files
under `agents/`) before part A's ports start.

**T4, medium. Three 3D tasks change what the skills say, and leave the skills off their file lists.**
- **Task 13.1** (`automata editor` reads 3D levels): `LEVEL_FILES` gains `.af-sector.json`. The editor skill says
  "Without it: only level files (`*.af2d.json`)", and the `automata` skill's content row says
  "`content/levels/*.af2d.json` opens in the level editor".
- **Task 12.2** (`create-game --template 3d`): the `automata` skill's "Where code lives" describes the 2D game only.
- **Task 11.1** (base-3d by feature): afterwards, no game is laid out by role. The hook's copy of the role list
  (`check.mjs:14–17`), `check-steps.ts:40` (`ROLE_LAYOUT_GAMES = ['base-3d']`) and the hook test's role case become
  dead.

`skills-text.test.ts` pins none of these, so they would go stale silently. *Recommendation:* each of those tasks lists
the skill lines it changes, and `skill-content.test.ts` reads `LEVEL_FILES` and the template's paths, as it already
reads the rule ids.

**T5, info.** The Owner's 2026-11-07 call that the diorama, first-person and top-down views belong in the editor, not in
3D core, changes no skill today. The editor skill's 3D lines (T1, T4) should say where they are.

### automata-plus (P)

**P1, info. No overlap.** `automata-plus` has no skills, no agent files, and no reference to `automata-skills` or
`agents/automata` (`git grep`). Its `AGENTS.md` mentions "agent packs (PRODUCT spec §6)" as later work.

**P2, low. Plus is pre-refactor throughout, and is to be archived.** `core.ref` is `f1b38528` (AF #363, 2026-10-31).
Its packages import the `@mcthaydt/automata-*` names: 253 files, and manifests at 0.0.3 and 0.0.4. Its
`kits/ui-screens` is copied in by `automata add`, which the refactor removed: `automata --help` lists `create-game`,
`check`, `build`, `editor` and `ship` (spec 16.7). By D12 A, Plus does not ship and the Owner archives it. An extension
that comes back returns as `extensions/<name>` on the current core. *Recommendation:* any agent text for a returning
extension belongs in `agents/automata`, behind the same tests, not in a Plus "agent pack" or a second mirror.

## 5. Verified as right

What the skills claim, checked against the stack head:

- **Layout.** `create-game` writes `src/features/{square,level}/`, `src/shared/constants.ts`, `src/app/game.ts`,
  `src/main.ts`, `content/levels/start.af2d.json` with `content/editors.toml`, `tests/unit/{square,level}/`,
  `ship.config.ts`, and `test: vitest run` (`packages/tools/src/shared/create-game/template-*.ts`). `automata check`
  refuses `src/sim` and asks for `src/features/<name>/` (`check-steps.ts:35, 52–54`).
- **`automata check`.** The flags (`check-args.ts:1`), the steps and what `--sim-only` skips (`run-check.ts`), the 20 s
  CSP wait (`check-steps.ts:21`), the `--json` shape and exit 2 for a tool that cannot run (seen on the Emberwick run),
  and every rule id (pinned by `skill-content.test.ts`). `assetsInlineLimit: 0` is set by the content plugin and the
  template.
- **The worked example.** Typechecked, tested (part of the 111) and boundary-checked (root `boundaries` names
  `agents/automata/skills/automata-feature/example/src`). Its calls match the reference: `createSim` is async,
  `defineSystem` has three forms, the six `PHASES`, `render: false`, `ctx.emit`.
- **`automata editor`.** The 2D editor by default, loopback unless `--lan`, a token made with `--lan`, the files it owns
  (`editor-policy.ts:17, 20`), `401` and `403`, and the conflict dialog's "Use mine", "Use theirs" and save-a-copy.
- **The hook.** It finds `node_modules/.bin/automata`, recognises a game by its `@automata/` dependencies, names
  `@automata/tools` when the bin is missing, and stops at the second Stop (unit `hook.test.ts`).
- **Laws.** Law 7 matches ADR 0006 (peer targets, `Hosting`, no fallback to device storage).
- **Names.** `Hosting`, `startGame`, `defineGame`, `keys`, `rect`, `defaultContent`, `defineShipConfig` and
  `fakeHosting` are all in the reference.

## 6. Decisions (recommended defaults)

Under the Owner's standing rule ("everything is auto approved and accepted", 2026-10-31), each runs on its
recommendation unless the Owner says otherwise.

- **D1. Where this pipeline's documents live.**
  - **A (recommended):** stage 2 onward writes to the framework's `docs/refactor/`, and this audit is copied there.
    automata-skills stays output only, written by the release job, with a generated README and LICENSE (M2).
  - B: the job keeps `docs/` in the mirror, and the documents stay here.
- **D2. 3D in the public skills.**
  - **A (recommended):** no 3D skill text in `agents/automata` until the 3D release phase (T1, T2).
  - B: 3D text lives in a folder the mirror job leaves out until then.
- **D3. Offer the framework's own plugin to the public.**
  - **A (recommended):** once M1 is fixed and an install from the mirror has been tested on a named Claude Code version
    (and on the Agent Skills installer), Start lists it beside Superpowers and PixiJS (M3).
  - B: keep offering only Superpowers and PixiJS.

## 7. What the plan stage should cover

In the framework repository (the source), in this order:

1. **Release job (M1, M2):** the mirror gets `.claude-plugin/marketplace.json`, a README with the install lines, and the
   framework's LICENSE. A unit test builds the mirror tree and checks it with `readAgentPackage`, `diffSkillTrees` and
   `claude plugin validate`.
2. **Install suite (M5):** a `create-game` game, 5 skills, the mirror layout as a source, run in `release-checks.yml`.
3. **API index (C1, C2):** declarations through `publishConfig` types, a no-body test, and a line on what is left out.
4. **Skill text (C3 to C8):** the editor's Tuner and flags, one sim import list read from the checker, the repository-only
   rules apart, web-target CSP wording, a shipping pointer, the plugin description, the `FakeHosting` message.
5. **3D plan amendments, to #443 or the 3D plan audit (T1 to T4, D1):** keep 3D out of the skills until phase 20;
   move the 3D reference to phase 20; add EnvironmentBuilder to `source-names`; add the skill lines to tasks 11.1,
   12.2 and 13.1; add `create-game`'s colours to task 5.2.
6. **Site (M3, D3):** after a tested mirror install.

Here, in automata-skills: nothing by hand once D1 A stands. The first release writes it.

Left to the Owner: the npm organisation, `NPM_TOKEN`, the release approval and `SKILLS_TOKEN` (M4), and closing #431
(V2) with the merge thread.
