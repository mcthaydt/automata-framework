# automata-skills: design spec (stage 2)

- **Pipeline:** "Bring automata-skills up to date", stage 2 of 6 (plan and spec). The facts are the
  [audit](2026-11-07-skills-audit.md); the steps are the [plan](2026-11-07-skills-plan.md); progress is
  [skills-progress.md](skills-progress.md).
- **Written:** 2026-11-07 with the superpowers plugin (`superpowers:brainstorming`, then `superpowers:writing-plans`),
  on `claude/project-thread-wd20yh`, stacked on the 3D slice plan (#444).
- **Accepted** under the Owner's standing rules: "Auto accept all spec and plans" (2026-10-30) and "Reminder that
  everything is auto approved and accepted, do not wait on me to do any approvals" (2026-10-31). The audit's three
  decisions run on their recommended defaults (D1 A, D2 A, D3 A), and so do this spec's veto defaults (section 9).

## 0. The brief

The Owner, 2026-11-07: "Have we been updating automata-skills, I know we worked on automata-plus", then "Oh, let's
handle that". Later the same morning, through the project's coordinator: bring automata-skills (and automata-plus) up to
date with the refactor, the full pipeline each.

What that means here, from the audit: `mcthaydt/automata-skills` is a public, generated mirror of the framework's agent
package (`agents/automata`). It has never been written: the release job that fills it needs a release and the Owner's
`SKILLS_TOKEN`. The skills are current at the stack head. What is broken is the road from the source to a person's
agent, and three things the 3D slice is about to change.

**Classification:** architectural (brainstorming's heaviest path). It changes a release workflow, a published
repository's shape, the API index other tools read, and two plans' interfaces.

## 1. What done looks like

1. The first release's mirror push leaves `mcthaydt/automata-skills` holding a Claude Code marketplace that installs:
   `/plugin marketplace add mcthaydt/automata-skills` then `/plugin install automata@automata-skills` gives 5 skills and 2
   hooks, on the pinned Claude Code (2.1.301). Proven before any release by installing from a mirror tree built by the
   same code the job runs (M1).
2. That mirror has a README with the install lines and the framework's MIT `LICENSE`, and nothing else that the
   generator did not write: no stray files survive a push (M2).
3. The install suite passes against a `create-game` game installed from packs, expects the skill count the package
   really has, installs from both the framework's marketplace and the mirror tree, and runs in `release-checks.yml`
   before every publish (M5).
4. The API reference shows declarations only. `defineSystem` and the five other sim definers read the same in the
   framework's section as in the sim's, and a test pins that (C1). The skill says in one line which two entry points
   the reference leaves out and why (C2).
5. The skills say what the code does (C3 to C8): the editor's flags and the Tuner; one list of what a sim file may
   import, read from the checker by a test; the repository-only rules apart from the game rules; the CSP rules as
   every web target's; one line on shipping; an editor mention in the plugin description; the `fakeHosting` message.
6. The agent package names no package that is not published, and a unit test fails if it does (D2 A, T1). So 3D skill
   text cannot go public before phase 20 of the 3D slice.
7. `pnpm source-names` stops both builder projects' names, in every file under `agents/` (`.md`, `.ts`, `.mjs`,
   `.json`), so nothing the mirror copies can name a source project (T3).
8. The 3D slice plan's audit has the list of cross-dependencies in section 7, so the 3D plan changes there, not here.
9. After the first mirror push, the site's Start page offers the framework's plugin beside Superpowers and the PixiJS
   skills, with the Claude Code version it was tested on (D3 A, M3).
10. This pipeline's documents live in the framework's `docs/refactor/` (D1 A). `automata-skills` stays output only.

## 2. Approaches considered

**A. A mirror generator in `tooling/agent-skills`, the job only clones and pushes (chosen).** One TypeScript module
writes the whole mirror tree (the plugin, the marketplace file, the README, the licence) into a folder. The release job
calls it; the unit test, `plugin:validate` and the install suite call it too. What is tested is what ships.

B. Keep the copy in the workflow's shell and add `cat > marketplace.json` lines. Smallest diff, but the only test
would be a string match on YAML, which is how M1 slipped through the 2D slice (the DX spec asked for the file; nothing
checked the tree).

C. Make the framework's repository root the mirror (publish the root marketplace with `"source": "./agents/automata"`).
It would copy the whole repository layout to a public place, which the source-names rule and the private repository
forbid.

## 3. Scope

In scope, all in `mcthaydt/automata-framework`: `tooling/agent-skills` (the mirror generator, its tests, the install
suite), `.github/workflows/release-packages.yml` (`skills` job) and `release-checks.yml`, `tooling/api-index` and
`tooling/api-report/src/extract.ts` (C1), `tooling/repo-hygiene/src/source-names.ts` (T3), the five skills and
`plugin.json`'s description, the `platform-import` message in `packages/tools`, the site's agent setup (M3, last),
`docs/refactor/` (this pipeline's documents), root `package.json` scripts.

Out of scope:
- Writing anything in `automata-skills` by hand. Its PR #1 (the audit's first home) is closed once the audit copy here
  merges; that is the merge thread's call, recorded in `skills-progress.md`.
- The release itself and `SKILLS_TOKEN` (the Owner's: the npm organisation, `NPM_TOKEN`, the release approval and the
  token, M4). Closing #431 (V2) is the merge thread's.
- 3D skill text and the 3D API reference: phase 20 of the 3D slice (D2 A, T2).
- `automata check`'s test step failing on Emberwick ("failed to load config", audit M5): a tools bug, not a skills
  one. The install suite stops using Emberwick, so it no longer depends on it. Handed to the coordinator as its own
  item.
- automata-plus: no overlap (P1); its own pipeline handles it.

## 4. The mirror (M1, M2)

### 4.1 What the mirror holds

| Path | From |
|---|---|
| `.claude-plugin/plugin.json`, `hooks/`, `scripts/`, `skills/` | `agents/automata/`, byte for byte |
| `.claude-plugin/marketplace.json` | generated: `{ "name": "automata-skills", "description": …, "owner": { "name": "mcthaydt" }, "plugins": [{ "name": "automata", "source": "./" }] }` |
| `README.md` | generated: what the package is, the two Claude Code lines, the Agent Skills line, the version, "generated, do not edit here" with the framework's agent package named as the source |
| `LICENSE` | the framework's root `LICENSE`, byte for byte |

The plugin manifest and the marketplace file share `.claude-plugin/`. The audit verified that this layout validates
and installs on Claude Code 2.1.301.

The README's lines (public text, so no source-project names and nothing about closed betas):

```
/plugin marketplace add mcthaydt/automata-skills
/plugin install automata@automata-skills
npx skills add mcthaydt/automata-skills
```

### 4.2 Interfaces

`tooling/agent-skills/src/mirror.ts` (Node built-ins only, so the release job runs it with no `pnpm install`):

```ts
export const MIRROR_MARKETPLACE = 'automata-skills'
export interface MirrorOptions {
  readonly repo: string       // the framework checkout
  readonly out: string        // an empty folder, or one holding only `.git`
}
/** Writes the mirror tree into `out`; returns the paths written, sorted. Throws MirrorError if `out` holds anything but `.git`. */
export function writeMirror(options: MirrorOptions): string[]
export function mirrorMarketplace(): object
export function mirrorReadme(version: string): string
```

`tooling/agent-skills/src/mirror-cli.ts`: `node tooling/agent-skills/src/mirror-cli.ts --out <dir>` prints one line per
file written. Exit 0 written, 1 `out` not empty, 2 the agent package is missing.

### 4.3 The release job (ordered flow)

1. Is `SKILLS_TOKEN` set? Unchanged: without it, a notice and a pass.
2. Check out the framework; set up Node from `.nvmrc` (the job has no Node step today).
3. Clone the mirror into `$RUNNER_TEMP/automata-skills` with the token as an auth header (unchanged).
4. Empty it except `.git` (unchanged), then `node tooling/agent-skills/src/mirror-cli.ts --out "$mirror"`. This replaces
   `cp -R agents/automata/.`.
5. Commit "Agent package for <version>" and push, or say it already matches (unchanged). Remove the clone (unchanged).

Failure: a generator error fails the job before anything is committed. The publish has already happened, so the job's
failure is reported and rerun by hand; it never retries on its own.

### 4.4 Checks before any release

- A unit test writes the mirror to a temp folder and checks it with `readAgentPackage` (no problems, 5 skills, 2 hook
  events), `diffSkillTrees` (skills identical to `agents/automata/skills`), the README's three lines and the LICENSE's
  bytes. The `--root` of `pnpm agent-skills` works on a mirror tree too.
- `release-checks.yml` builds the mirror into `$RUNNER_TEMP` and runs `claude plugin validate <mirror> --strict`
  (pinned 2.1.301) as part of `pnpm plugin:validate`.
- `ci.test.ts` and the workflow invariants pin that the job runs the generator and no longer runs `cp -R`.

## 5. The install suite (M5)

`tooling/agent-skills/tests/install/install.test.ts`, rewritten around two sources and a stranger's game:

- **Skill names** come from `readAgentPackage(REPO).skills`, so the count is never typed by hand.
- **Sources:** the framework's marketplace (`automata@automata-framework`) and a mirror tree written by `writeMirror`
  (`automata@automata-skills`). Each one: validate `--strict`, `marketplace add`, `install`, `details` shows
  `Skills (<n>)` and `Hooks (2) PostToolUse, Stop`, and the installed skills equal the source byte for byte.
- **The game:** a `create-game` game made in a folder outside the workspace and installed from the packs, with the
  consumer smoke's helpers (`strangerFolder`, `packOverrides`, `overridesYaml`). The hook passes a clean edit of
  `src/features/square/square.system.ts` and blocks `src/features/square/seeded.system.ts` importing `effect`
  (exit 2, rule `import`).
- **Agent Skills:** `npx skills add <mirror tree>` installs every skill for Claude Code, Codex and Cursor, byte for
  byte (the route the README offers).
- **Where it runs:** `release-checks.yml`, after the consumer smoke (the packs exist then), with the pinned CLI
  installed into `$RUNNER_TEMP` and put on `PATH`. Cloud sessions refuse to run downloaded npm code, so in a session
  the suite is run on the Owner's runner only; the plan's step says so.

## 6. The skills and the reference (C1 to C8, D2 A)

### 6.1 Declarations only (C1, C2)

Cause: `declarationExports` resolves `@automata/sim` through `node_modules` to the workspace manifest, whose `exports`
point at source. Fix: `declarationExports(files, paths)` takes a `paths` map, and `indexRows` builds it from the entry
points it indexes (`<package><entry>` → the entry's `.d.ts`), the same way `sourceExports` already maps source. A
re-export of another published package then reads that package's built declarations.

Tests: a fixture where one package re-exports a function from another whose workspace `exports` is a `.ts` with a
body; the row's signature is the declaration. A reference test: each of the six definers' signature in
`@automata/framework` equals its signature in `@automata/sim`. `reference/api.md`, `llms-api.txt` and the site's API
pages (which read the same `api.json`) are regenerated.

C2 is one line in the `automata-api` skill: the reference lists every typed entry point; `@automata/framework/target`
(picked by the build, never imported) and `@automata/framework/theme.css` (a stylesheet) are the two it leaves out.

### 6.2 Skill text (C3 to C8)

| Finding | Change | Pinned by |
|---|---|---|
| C3 | The editor skill's usage line is `automata editor`'s, with `--app 2d|suite`, `--app-dir` and `--game-url`; one paragraph on the Tuner (start `pnpm dev`; `--game-url` when the game is not on `http://localhost:5173`); one line on Map, Tiles (Add tiles) and Characters; the unreachable token row goes | `skill-content.test.ts`: every flag in `USAGE` but `3d` appears in the skill; the Tuner paragraph names `pnpm dev` and `--game-url` |
| C4 | Both skills state one list: `koota`, `zod`, Rapier's 2D and 3D deterministic-compat builds, `@automata/sim` (and `/hash`, `/math`), an installed extension's declared sim entries, relative imports | the test reads `IMPORT_ALLOWED` and requires each name in both skills; "physics entry points" is retired |
| C5 | The ten repository-only rules move to a table headed "Only in the framework's own repository" | the test reads `check-steps.ts`'s `--game` call and requires the ten under that heading |
| C5 | `platform-import`'s replacement for `@ruken/sdk-host` reads `@automata/framework/testing (fakeHosting)` | `platform-imports.test.ts` |
| C6 | "Web targets run without `eval`; the check loads the game under Ruken's policy" replaces "Ruken's CSP" as the reason | `skills-text.test.ts`: `Ruken's CSP` is retired |
| C7 | One bullet: `automata build`, `automata ship prepare|publish --target web|itch|tauri|ruken`, and the publish guides | the test checks the targets against `DIST_TARGETS` (`create-game-targets.ts`) |
| C8 | `plugin.json`'s description names the editor | `layout.test.ts` |

### 6.3 Only published packages (D2 A, T1)

A unit test lists every `@automata/<name>` the agent package names (skills, the example, the hook, `plugin.json`) and
requires each to be a package `publishablePackages` returns. Today that is `framework`, `sim`, `content` and `tools`
(and `create-game` by command). `@automata/3d` stays private until the 3D slice's phase 20, so the test fails if 3D text
arrives early. Phase 20 adds the 3D skill text in the same PR that makes the package public.

### 6.4 Source names (T3)

`SOURCE_NAMES` gains the second builder's name (`environment[\s_-]?builder`), and `publishedSurfaces` reads every
`.md`, `.ts`, `.mjs` and `.json` under `agents/`. The 3D plan's task 10.1 adds the same pattern and a `--code` option;
whichever lands second keeps one pattern (section 7).

## 7. Cross-dependencies with the 3D slice plan (#444)

These belong in the 3D plan, so they go to its audit ("Audit the rewritten 3D slice plan") as notes, not as edits to
#444:

| 3D task | Change | Why |
|---|---|---|
| 13.2 | Drop "the agent package's 3D skills and API reference"; keep the guides and the `--code` folders | D2 A: the published-only test (6.3) fails on 3D text before phase 20 |
| 20.1 | Add: the 3D skill text (the editor's `--app 3d` and `.af-sector.json`, `create-game --template 3d`, `@automata/3d/sim` in the import list), `pnpm api-index --write` with `@automata/3d` now published, `pnpm agent-skills` | T1, T2: the reference can only list a published package |
| 10.1 | `environment[\s_-]?builder` may already be in `SOURCE_NAMES` (this plan's task 3.2); keep one pattern; `agents/` is already scanned for `.ts`, `.mjs` and `.json` | T3 |
| 5.1 | Step 5 adds one line to the `automata` skill's "How it looks": draw with the palette's colours, move a colour a whole step along its ramp (`step`) | D1 |
| 5.2 | Add `packages/tools/src/shared/create-game/template-game.ts` and `template-level.ts` (the square `0xffc825`, the wall `0x64748b`) to the file list; the feature skill's example follows | D1 |
| 11.1 | Once base-3d is laid out by feature, delete `ROLE_LAYOUT_GAMES`, the hook's role list (`check.mjs`) and the hook test's role case | T4 |
| 13.1 | The editor skill keeps "2D level files (`*.af2d.json`)" until phase 20 | T4 with D2 A |

## 8. Order and pull requests

One PR per part, stacked on this plan's PR, each opened ready and merged by hand once every check is green on its head:

1. **Part 1, the mirror** (M1, M2): generator, job, checks.
2. **Part 2, the reference and the names** (C1, C2, T3, D2 A's test).
3. **Part 3, the skill text** (C3 to C8).
4. **Part 4, the install suite** (M5) in `release-checks.yml`.
5. **Part 5, the site** (M3, D3 A): built after part 4, merged only after the first mirror push has been installed
   from `mcthaydt/automata-skills` with the pinned CLI. Until then the PR stays open with that line at the top.

Each part regenerates what it changes (`pnpm api-index --write`, `pnpm agent-skills`, `pnpm api-report --update`
where exports or doc comments change) and runs `pnpm format` and `pnpm check`. No changeset: every package touched is
private, except the `platform-import` message in `@automata/tools`, which takes a `patch` changeset.

## 9. Veto defaults

Each stands unless the Owner says otherwise:

1. The mirror's marketplace is named `automata-skills` and lists one plugin, `automata`, from `"./"`.
2. The README offers the Agent Skills line (`npx skills add`) because the install suite proves it on the runner.
3. The site waits for the first real mirror push; a locally built tree is not enough to put a public install line on
   the site.
4. The ten repository-only rules stay in the verify skill, under their own heading, instead of being deleted, because
   `skill-content.test.ts` requires every rule id the checker can report.

## 10. Risks

- **The install suite can only run on the Owner's runner** (sessions refuse downloaded npm code). Its first real run
  may fail on something no session saw; the plan keeps its first-attempt log.
- **#444 moves** while its audit runs. This PR only adds files under `docs/refactor/`, so a rebase is mechanical.
- **The C1 fix regenerates the site's API pages.** The site's link and page checks run in the part's PR.
- **A release happens before part 1 merges.** Then the mirror's first push is the old copy without a marketplace.
  The plan's part 1 is first for that reason, and `skills-progress.md` asks the merge thread to land it before the
  release.
