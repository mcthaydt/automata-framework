# FigureBuilder, surveyed for the fold

Workstream 6, stage 2. The spec is
[`2026-11-12-builders-into-the-framework-design.md`](../../specs/2026-11-12-builders-into-the-framework-design.md); the
plan this survey feeds is [`2026-11-12-builders-fold.md`](../../plans/2026-11-12-builders-fold.md).

## What was read and run

- `mcthaydt/FigureBuilder` at `23f889c8a5cda3511f4a2d044324c57ba624dc1c` (its `main`, and the framework's pin), a
  full clone, read only. Its branches were read from the same clone. Nothing was committed or pushed there.
- The framework at `main` `0df11a43`.
- Counts are from `git ls-files`, `wc -l` and `git cat-file --batch-check`, not from reading. Lines are physical
  lines, blank ones included.
- Run on the session's machine (x86_64, 4 cores, Node 22.23 for the builder's own `npm` scripts, Node 24.21 through
  `pnpm` for the framework's tools):
  - `npm ci`, then `npx vitest run`: **47 files, 561 tests, all pass, 227 s**. Another suite ran on the same four
    cores for part of that time, so 227 s is an upper bound for this machine.
  - `npx vitest run tests/golden tests/features/actors/actors.test.ts` (the five goldens alone): **pass, 22 s**.
  - `npx tsc --noEmit`: 0 errors, 3.5 s.
  - The framework's own checks pointed at the builder's source (the numbers under "Rules" below).
- **Not run:** `npm run view-check` (needs Chromium on SwiftShader; no number in the plan depends on it), any render
  script, anything on arm64, the tests of the `claude/c9-wardrobe` branch.

## What is in the repository

428 tracked files, 20.0 MB in the working tree.

| Folder | Files | What |
|---|---|---|
| `src/` | 47 | 39 `.ts` (7,528 lines) and 8 library `.json` (320 lines) |
| `base/` | 1 | `base.ts`, 53 lines: the base pair |
| `scripts/` | 6 | 546 lines: `render`, `lit`, `golden`, `actors-demo`, `c5-finish-sheet`, `view-check` |
| `viewer/` | 4 | 350 lines of `.ts` and an `index.html`: the Pixi 3D viewer `view-check` drives |
| `tests/` | 73 | 57 `.ts` (4,130 lines; 47 are `.test.ts`), 4 golden `.json`, 12 golden `.rgba.gz` (80 kB) |
| `pixi/vendor/` | 3 | `@pixi/3d` 0.1.0-beta.2 as a tarball (5.9 MB), its licence and a readme |
| `docs/` | 271 | 37 `.md`, 228 `.png` (12.2 MB), and audit data; 14 MB in all |
| root | 8 | `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `CLAUDE.md`, `README.md`, `.gitignore`, `.vscode/settings.json` |

`src/` and `base/` together are 7,581 lines of TypeScript in 40 files. The spec's "about 7,500 lines in 36 files"
counts the 36 files under `src/features/` and `src/lib/` (7,455 lines); these are the measured numbers.

All 228 PNGs are under `docs/superpowers/` (gate sheets and audit evidence). **No PNG is source or test data.** The
goldens are md5 lists in JSON and twelve gzipped RGBA sheets.

## Every feature, and where it goes

The home is one private package, **`extensions/painted-figures`, named `@automata/painted-figures`** (the reason is in
the next section). Inside it the framework's shape applies: `src/shared/`, `src/features/`, `src/entries/`, and
`tests/` beside `src/`.

The builder's features are a pipeline: each imports the ones below it. The framework's feature rule
(`packages/tools/src/features/boundaries/features.ts`, rule 1) lets a feature import only itself and `shared/`. So the
Pixi-free pipeline goes to `src/shared/<layer>/`, where layers may import each other, and the one consumer that loads
Pixi stays a feature.

| Builder path | `.ts` files | Lines | Library data | Tests (`tests/features/<x>`) | Home in `extensions/painted-figures` |
|---|---|---|---|---|---|
| `src/lib/` | 2 | 91 | | (used by all) | `src/shared/math/` |
| `src/features/body/` | 4 | 677 | | 6 files, 385 lines | `src/shared/body/` |
| `src/features/paint/` | 5 | 2,020 | | 6 files, 792 lines | `src/shared/paint/` |
| `src/features/lighting/` | 4 | 389 | `times.json` (36) | 1 file, 168 lines | `src/shared/lighting/` |
| `src/features/motion/` | 2 | 730 | `gaits.json`, `poses.json`, `seats.json` (48) | 4 files, 229 lines | `src/shared/motion/` |
| `src/features/hair/` | 1 | 597 | `hair.json` (4) | 5 files, 373 lines | `src/shared/hair/` |
| `src/features/outfit/` | 3 | 577 | `items.json`, `swatches.json` (29) | 7 files, 476 lines | `src/shared/outfit/` |
| `src/features/figure/` | 4 | 826 | | 5 files, 478 lines | `src/shared/figure/` |
| `base/base.ts` | 1 | 53 | | (the goldens) | `src/shared/base/base-pair.ts` |
| `src/features/actors/` | 3 | 736 | `actions.json` (203) | 1 file, 111 lines | `src/shared/actors/` |
| `src/features/stage/` | 3 | 330 | | 7 files, 514 lines | `src/shared/stage/` |
| `src/features/view/` | 5 | 482 | | 2 files, 112 lines (Node) | `src/features/view/` (the only folder that imports Pixi) |
| `src/index.ts`, `src/kit.ts`, `src/view.ts` | 3 | 73 | | `tests/api.test.ts` (72) | `src/entries/index.ts`, `kit.ts`, `view.ts` (they only re-export today) |
| `tests/golden/` | 9 `.ts` | 270 | 4 `.json`, 12 `.rgba.gz` | | tests in `tests/unit/golden/`, recorded data in `tests/fixtures/golden/` |
| `tests/support/ulp.ts`, `tests/features/draw.ts` | 2 | 72 | | | `tests/fixtures/` |
| `tests/architecture.test.ts` | 1 | 78 | | | `tests/unit/layers.test.ts`, restated (below) |
| `scripts/` | 6 | 546 | | | `scripts/` in the package, run by hand |
| `viewer/` | 3 `.ts` + html | 350 | | | `tests/browser/` fixtures: `view-check` becomes a browser suite |
| `pixi/vendor/` | | | | | **does not come**: the framework's `vendor/pixi-3d/` holds the same bytes |
| `docs/contract.md`, `docs/actors.md` | | | | | the package's `docs/` (the contract is live) |
| the rest of `docs/` (33 `.md`, 228 `.png`) | | | | | **does not come**: the retired repository keeps it |
| `CLAUDE.md`, `README.md` | | | | | their live rules go into the package's `README.md`; the files do not come |
| `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `.vscode/` | | | | | replaced by the package's own |

**The eight library JSON files** total 320 lines. Each is read by one module of its own feature and typed with a cast;
none is checked when it loads.

**The tarball:** `pixi/vendor/pixi-3d-0.1.0-beta.2.tgz` has SHA-256
`f515c1b603da64e2d546ffc74a71d14a0218f9819b09d250310b55b9ff04013a`, the same as
`vendor/pixi-3d/pixi-3d-0.1.0-beta.2.tgz` in the framework (and as EnvironmentBuilder's copy). The package depends on
the framework's copy through the `file:` specifier the character kit already uses.

## The home, its name, and the door

**A private extension, `extensions/painted-figures`, `@automata/painted-figures`.** From `AGENTS.md`:

- "Extensions are opt-in and never edit core. They live in `extensions/<name>` as `@automata/<name>`, and core never
  imports one." The painter is opt-in, and core must not import it: `pnpm boundaries` already forbids `figure-builder`
  to four packages and nine extensions.
- The spec's rule 3: neither builder is core; a piece generic within a genre is an extension. A CPU painter for
  sprite figures is that.
- It is not folded into `extensions/character-kit` (4,940 lines in 50 files): the kit is clothes, hair and seats that
  sit on the painter, the painter is 1.5 times its size with its own layer order, contract and goldens, and
  13 of the 22 extensions already depend on another extension, so the kit depending on this one is the usual shape.
- It is not `packages/3d`: that package has its own figures (`packages/3d/src/features/figures/`, the mesh figures
  ported from this builder at `025ffb48`, recorded in `docs/provenance/sources.md`). The painted figures are a second,
  different system; putting both under one `figures` folder would hide that.
- `"private": true`, like `@automata/character-kit`: it depends on the closed `@pixi/3d` beta. No changeset.

**The name.** `tooling/repo-hygiene/src/source-names.ts` lists `figure[\s_-]?builder` as a source project's name that
published text must not carry. Extensions' code is not scanned today, but a package of the framework's own should not
be named for the project it came from. `AGENTS.md` already says "Private ones (the editors, figures)". The plain name
`figures` would clash in a reader's head with core's `features/figures`, the `figure` content kind and the Studio's
figures; `painted-figures` says which ones these are and matches the kit's own word (`features/painted/`). **A call
for the coordinator:** `@automata/painted-figures` (default) or `@automata/figures`.

**The door stays, and gets smaller in meaning.** Today `extensions/character-kit/src/shared/figure-builder/door.ts`
(45 names from the index, 10 from the kit entry) and `door-view.ts` (2 names from the view entry) are the only files
that import the builder, held by `tests/unit/shared/door.test.ts`. After the fold:

- They import `@automata/painted-figures`, `@automata/painted-figures/kit` and `@automata/painted-figures/view`.
- The folder is renamed `src/shared/painted-figures/` (a source project's name leaves the path).
- The door test stays: the kit still takes only the names it uses, through one file, so a change in the painter
  breaks one file of the kit.
- `contract.test.ts` (`STAGE_VERSION` is 1) stays.
- The comment "Fix the builder upstream and bump the submodule; never patch the vendored copy" goes: the painter is
  changed in place, in the same pull request as the kit change that needs it.

## The five goldens

All five fail on one texel. None holds a PNG.

| Golden | Recorded data | Test | What it draws |
|---|---|---|---|
| base | `tests/golden/base/*.rgba.gz`, 12 files, 80 kB | `tests/golden/base.test.ts` | every pixel of the base pair's sheets |
| lit | `tests/golden/lit.json` (3.1 kB) | `tests/golden/lit.test.ts` | the base pair lit |
| actors | `tests/golden/actors.json` (17 kB) | `tests/golden/actors.test.ts` | every actor frame |
| sprites | `tests/golden/sprites.json` (2.7 kB) | `tests/features/actors/actors.test.ts` | an md5 per frame of hero, 8 standing views and walk, at D1 and D2 |
| sprite | `tests/golden/sprite.json` (3.5 kB) | `tests/golden/sprite.test.ts` | the base pair, 8 directions, D2, lit as a sprite under four lights |

Besides the five, `tests/features/paint/identity.test.ts` pins md5s of material cases, and
`tests/features/hair/ulp.test.ts` (with `tests/support/ulp.ts`) redraws with the maths nudged by a last bit and expects
the same cells: this is the guard that came from the arm64 difference fixed in `d5ca055` (2026-11-11). Both come with
the tests and are stops like the goldens.

The goldens read their data with `import.meta.dirname` and relative paths, so a move of the test without its data
breaks them loudly, not silently.

## The builder's rules against the framework's

Measured by running the framework's own tools on the builder's `src/` and `base/` (copied to a scratch folder with
the framework's `biome.json`; `tooling/check-style`; `tsc` 6.0.3 with `tsconfig.base.json`).

### Already enforced by the framework, nothing to restate

| Builder rule | Framework check |
|---|---|
| No test beside the source | tests live in `tests/`; `pnpm style` |
| Kebab-case file names | `pnpm style`: **0 naming findings** in 40 files |
| No Effect, plain TypeScript | `pnpm boundaries --forbid …:effect` (the package joins the list) |
| PixiJS only for rendering | law 6; the package's only renderer is Pixi 3D |
| Free to run, no API | spec rule 7 |
| Typecheck before commit | `pnpm typecheck` in `pnpm check` |

### To restate in the framework's form

| Builder rule | Where it lives today | What it becomes |
|---|---|---|
| Layers, lowest first: `lib → body → paint → lighting → motion → hair → outfit → figure → base → actors → stage → index → kit → view`; no cycles; a library JSON is imported only by its own feature | `tests/architecture.test.ts` (78 lines, walks the import graph itself) | `tests/unit/layers.test.ts` in the package, over `src/shared/<layer>/`, `src/entries/` and `src/features/view/`. `pnpm boundaries --features` holds the outer shape (a feature imports only itself and `shared/`); the order inside `shared/` is the test's, and the test runs in `pnpm check` |
| Only `src/features/view/` and `viewer/` import Pixi | the same test | the same test, plus the framework's own shape: `src/shared/` is Pixi-free, `src/features/view/` is the one feature |
| The contract: a change to a `Cell` field, the kit entry or the breaking-change list raises `STAGE_VERSION` and the version, and is written in the changelog; `tests/api.test.ts` pins the export names of both entries | `docs/contract.md`, `tests/api.test.ts` | `docs/contract.md` in the package and `tests/unit/api.test.ts`; the kit's `contract.test.ts` keeps `STAGE_VERSION` at 1. The package is private, so `pnpm api-report` does not read it; the pin test is the report |
| The part index seeds the painter's grain: never reorder the parts a figure is built from | `CLAUDE.md`, and the goldens | the package's `README.md`, and a comment at the part list saying why; the goldens are the check |
| Parts of one surface share a `seam` number | `CLAUDE.md` | the package's `README.md` |
| Colours snap to DUEL; lighting moves whole steps | `CLAUDE.md`, the goldens | the package's `README.md` |
| Generic machinery no base figure reaches is never cut as dead (hems, cuffs, prints, materials, seats, moods, the hooks H1 to H5) | `CLAUDE.md`, with a test each under `tests/features/` | the tests come; `knip` must be told the entries are the surface (the same reason `knip.jsonc` gives the wrapper an empty entry list today) |
| Base is generic: no brand, character or content | `CLAUDE.md` | the framework's source-names rule and the spec's rule 3 |
| Never nudity or sex; no costume or stereotype | `CLAUDE.md` | the package's `README.md` |
| After a change to the painter, the stage or the view: `npm run view-check` | `CLAUDE.md` | a browser suite in the package's `tests/browser/`, run by `pnpm test:browser:3d` and `.github/workflows/3d.yml` |

### In conflict with a framework rule

| Framework rule | Finding | Files affected |
|---|---|---|
| A source file has at most 600 lines | `paint/paint.ts` 1,588 and `motion/motion.ts` 716 (`check-style`: 2 `file-length` findings in 40 files). `hair/hair.ts` is 597 and becomes 692 with `c9-wardrobe` | **2 at `main`, 3 with the wardrobe branch** |
| A test imports the code it tests as `#src/…` | relative chains into `src/` or `base/` | **51 of 57** test `.ts` files (250 import lines) |
| `pnpm format` (Biome) | the builder writes semicolons and dense lines | **46 of 47** in `src/`, 1 of 1 in `base/`, **61 of 61** in `tests/`, 6 of 6 in `scripts/` would be rewritten |
| `pnpm lint` (Biome) | **137 findings** in `src/` and `base/`: 92 `noNonNullAssertion`, 13 `noAssignInExpressions`, 13 `noUnusedVariables`, 5 `noUnusedImports`, 4 `noSelfCompare`, 3 `useOptionalChain`, 2 `noExplicitAny`, 2 `noUnusedFunctionParameters`, 1 each of `useIterableCallbackReturn`, `noEmptyInterface`, `useConst` | counted by rule, not by file |
| `tsconfig.base.json` (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) | **1,395 errors** in `src/` and `base/` (686 TS2532, 243 TS18048, 237 TS2345, 123 TS2322, 75 TS2538); **0 errors** with those two flags off and everything else of the base kept, on TypeScript 6.0.3 | the whole painter; see the note |
| Zod is the only schema language | no other schema language is used, so there is no conflict; but the 8 library JSON files are typed by a cast and not checked | 8 files |
| Comments say why, not which plan asked | `check-style --plan-comments`: **0 findings** in `src/` and `base/` | 0 |
| One test suffix, `.test.ts`; tests in `tests/unit/<feature>/` | the suffix is already `.test.ts`; the folders are `tests/features/<x>/` and `tests/golden/` | 47 test files move folder |
| Names a source project | comments in `src/` and `viewer/` name the game the gameplay camera came from (5 files in `src/`, 1 in `viewer/`, 1 test) | 7 files; extensions are not scanned, so this is a courtesy, not a gate |

**Note on the 1,395 type errors.** Each is an index into an array or a typed array that the stricter flags treat as
possibly undefined. Fixing them means about 1,400 edits inside a painter whose every branch is pinned by a golden, and
a guard added for the type checker can change a code path. The plan's recommendation: the package's `tsconfig.json`
extends the framework's base and turns those two flags off, with a comment saying why, as the wrapper does today with
the builder's own settings. Bringing the painter under them is following work, one file at a time, each behind the
goldens.

**What the two flags mean for the wrapper's type step.** The kit and everything that imports the kit compile with the
framework's strict base, and TypeScript checks an imported `.ts` source with the importer's options. If the kit
imported the painter's source directly, the 1,395 errors would appear in the kit's typecheck. That is why
`vendor/figure-builder` builds declarations with the builder's own settings (`tsconfig.types.json`, `types.mjs`) and
its `exports` names them as `types`. The step cannot simply be deleted with the wrapper: it moves into the package and
runs in `prepare` and `typecheck`, so no session runs it by hand, until the painter passes the two flags.

**Note on `noSelfCompare` and `noAssignInExpressions`.** `x !== x` is a NaN test and an assignment inside an
expression may be load-bearing in the rasteriser's loops. The plan fixes lint rule by rule, one commit a rule, with
the goldens run after each, and stops on any moved texel.

## The dev tools

| Builder | Version there | The framework has | What to do |
|---|---|---|---|
| `vitest` | `^5.0.3` (5.0.5 installed) | 5.0.3, with `@automata/vitest-preset` | the framework's; the builder's `vitest.config.ts` sets only a 30 s timeout, which the root `test:unit` already exceeds (90 s) |
| `typescript` | `^5.9.3` | 6.0.3 | the framework's; measured: 0 errors on 6.0.3 with the two flags off |
| `vite` | `^8.3.4` | 8.3.3 | the framework's |
| `playwright` | `^1.63.0` | 1.63.0 with `@vitest/browser-playwright` 5.0.3 | the framework's; `view-check` becomes a browser suite |
| `vite-node` | 6.0.0 | not in the lockfile; the kit runs scripts with `tsx` 4.23.15 and Node's own type stripping | the scripts run with `tsx`, as `extensions/character-kit/package.json` does |
| `@napi-rs/canvas` | `^1.0.10` | **not in the lockfile** | used only by five scripts to write PNG sheets. A new dependency for a private package's hand-run scripts; `pnpm deps:new` (run in `ci.yml`) reports it. The plan keeps it as a `devDependency` at the move and lists it for the coordinator |
| `@types/node` | `^26.6.4` | 24.19.1 | the framework's |
| `pixi.js`, `@pixi/3d` | 8.22.0 exact, beta.2 from `pixi/vendor` | 8.22.0, beta.2 from `vendor/pixi-3d` | the framework's copies |

## The `claude/c9-wardrobe` branch

`856498a`, 10 commits ahead of `main` and 0 behind, so it sits directly on `23f889c8`.

- **Two document commits** (`24f8ce3`, `d162e89`): the spec, the plan (646 lines), the plan audit.
- **Seven code commits**, F0 to F6: the sheet script and pins (`add621c`), a sheer material denser at its rim
  (`ab109cb`), the shod foot's form (`92a6f4f`), the head's form on the kit entry (`bcee6e2`), a fall in front of the
  shoulders (`aec06ed`), long hair resting on the trunk (`a244703`), the fringe piece and three styles (`3c9b36d`).
- **One evidence commit** (`856498a`): five Checkpoint A sheets (PNG, 5.1 MB) and their notes.
- The diff is 37 files, +2,501 and −29 lines. Code and tests: `src/features/outfit/shoe.ts` (new, 124), changes in
  `hair.ts` (+109), `garments.ts`, `paint.ts` (+19), `parts.ts`, `fit.ts`, `hair.json`, the two entries, five new test
  files (634 lines), `tests/support/pins.ts`, `tests/features/outfit/wardrobe-fixtures.ts`, two scripts.
- **Built:** F0 to F6 (six of its ten tasks counted its own way: sheer cloth, the shod foot, the head's form, front
  hair, hair that rests on the trunk, a fringe and three styles). **Not built:** F7 (glyphs), F8 (the drawn moods), F9
  (the wardrobe golden, the docs, the merge), and its showcase part.
- **What it moves:** the diff touches nothing under `tests/golden/`, so none of the five goldens is re-recorded. It
  adds pins of its own (`tests/support/pins.ts`, read by `identity.test.ts`). It changes the public surface on purpose:
  `src/index.ts` gains two types, `src/kit.ts` gains `rampOf`, `skull`, `onHead`, `headForm` and two types, and
  `tests/api.test.ts` is updated to match. **Not verified here:** its tests were not run in this session; the first
  step that brings it across runs them.
- **How it comes across:** as its own commits, on top of the base, before any conform step (a conform step reformats
  every file, after which these commits would no longer apply). The plan gives the exact method under "History".
- **Nothing in it is brand or game content.** The showcase (two characters of the reference game) is its unbuilt
  part 3 and on another branch (`claude/showcase-ada-nurse`); it does not come.

## The other branches

| Branch | Ahead / behind `main` | Last commit | What | Work not on `main`? |
|---|---|---|---|---|
| `claude/c9-wardrobe` | 10 / 0 | 2026-11-11 | above | **yes; comes across** |
| `claude/c9-wardrobe-spec` | 2 / 0 | 2026-11-11 | the first two commits of the branch above | no (contained in `c9-wardrobe`) |
| `claude/c5-finish-fixes` | 8 / 49 | 2026-11-10 | eight c5-finish audit fixes (the weave's depth table, sheen bounds, a quilted crest) | **yes: 8 patches not on `main`** by `git cherry`; whether `main` fixed them another way was not checked |
| `claude/turned-face-both-eyes`, `claude/project-thread-2ts3yn` | 2 / 66 | 2026-11-09 | the same two commits (`434b5f3`): a turned face keeps both eyes, with a golden re-record | **yes: a painter fix that moves a golden** |
| `claude/spike-live-mesh` | 2 / 21 | 2026-11-10 | a spike: a GPU painter on the live mesh against the CPU painter | a spike with its report; not wanted |
| `claude/c3-spike-cloth` | 1 / 159 | 2026-11-06 | a spike for cloth, superseded by c3-cloth on `main` | no |
| `claude/showcase-ada-nurse` | 1 / 12 | 2026-11-11 | two characters of the reference game as builder characters | **game content: must not come** |
| `claude/demo-characters` | 2 / 142 | 2026-11-06 | seven demo characters and their renders | content |
| `claude/music-video`, `claude/runway-video` | 2 / 124, 7 / 66 | 2026-11-06 | the Owner's song clips, "on a branch never merged" | content, and third-party music |

Two branches besides the wardrobe carry painter work that is not on `main`: `c5-finish-fixes` and
`turned-face-both-eyes`. Neither is part of this fold (the spec brings `main` and the wardrobe branch). The plan lists
them for the Owner: bring later as framework changes, or leave in the retired repository.

## Brand and game content on `main`

- No character, wardrobe or advert is on `main`: `base/base.ts` holds only the base pair, and all five registries are
  empty in base.
- The reference game is named in comments and one identifier's doc: `src/features/stage/pose.ts` (`GAMEPLAY`,
  `gameplay()`: its gameplay camera as a pose, with the repository and commit it was read at), `stage.ts`, `motion.ts`,
  `paint.ts`, `parts.ts`, `viewer/main.ts`, `tests/features/stage/pose.test.ts`. The Owner's decisions (2026-11-11) say
  the reference game is no longer a source project, so its name is allowed; the old repository's name
  (`PixiJS3D_Experiment_001`) in `pose.ts` is still on the source-names list and is reworded in a conform step.
- `README.md`'s "Forking FigureBuilder" and the tag `archive/dressed-golden` (`7f0f634d`, a wardrobe's golden for forks)
  concern forks; the spec leaves forks out.

## History, measured

| What | Commits | Packed size |
|---|---|---|
| The whole clone, all branches | | 44.79 MiB |
| `main` alone, everything | 347 (286 without merges) | 20.6 MB |
| `main`, only `src base tests scripts viewer`, the root config, `CLAUDE.md`, `README.md`, `docs/contract.md`, `docs/actors.md` | | **1.87 MB** |
| What `claude/c9-wardrobe` adds, everything | 10 | 1.93 MB (the five sheets are most of it) |
| `main` and the wardrobe branch after the plan's filter (`git filter-repo`, the code paths only, dry-run in a scratch clone) | 243 (236 and 7) | **1.64 MB** |

10 of `main`'s 347 commit subjects are Conventional Commits. The framework's clone here is shallow (483 commits,
100.32 MiB packed), so the framework's full history size was not measured.

## What names the builder in the framework today

The retire list, file by file, is in the plan. In short: `.gitmodules`; the gitlink `vendor/FigureBuilder`; the wrapper
`vendor/figure-builder/` (4 tracked files and two links); one line of `pnpm-workspace.yaml`; `biome.json`, `knip.jsonc`,
`.gitignore`; the root `package.json` (the `--forbid` lists, and `@pixi/3d` and `pixi.js` at the root, there only
because the submodule's sources resolve from the root); `.github/scripts/checkout-submodules.sh`; 73 lines in eight
workflow files; `tooling/repo-hygiene` (the workflow invariants and two tests); `tooling/release`'s closed-beta guard;
`docs/runbook.md`; `docs/provenance/sources.md` and `builders-manifest.json`; the character kit (its `package.json`,
`README.md`, two door files, and 91 files in all that name the builder, most of them in comments).

## Not verified

- `npm run view-check` was not run, so "the GPU's frame is `compose`'s, byte for byte" at `23f889c8` is the builder's
  own claim here.
- Nothing ran on arm64. The arch-stable pole rule (`d5ca055`) and its `ulp.test.ts` are read, not exercised on a
  second architecture.
- The wardrobe branch's tests were not run.
- Whether `c5-finish-fixes`' eight patches were superseded on `main`.
- The framework's full history size (shallow clone).
