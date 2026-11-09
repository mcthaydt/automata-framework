# Automata Plus as framework extensions: spec

- **Stage:** 2 of 6 (plan and spec), written with the superpowers plugin (`superpowers:brainstorming`, then
  `superpowers:writing-plans`). The plan is [2026-11-07-plus-port-plan.md](2026-11-07-plus-port-plan.md); the audit it
  answers is [2026-11-07-plus-audit.md](2026-11-07-plus-audit.md) (moved here from `mcthaydt/automata-plus` PR #40,
  head `4cb70b9`). Tracking: [plus-progress.md](plus-progress.md).
- **Date:** 2026-11-07.
- **Base:** the 3D build's branch `claude/project-thread-o80bty` at `1c7db6bf` (#455, tasks 1.1 to 4.1 of the 3D plan
  done), which sits on the whole refactor stack (#388 to #453).
- **The Owner's words:** "do automata-plus too" (2026-11-07 11:19); on the decision card "Pick where automata-plus gets
  brought up to date", first "Port it in its own repo" (15:02 UTC), then "Actually no make them extensions because
  they're free anyway, and move the stuff 3D is doing here, and cut the starter" (15:05 UTC). The last answer stands.
- **Approval:** the Owner's standing rule (2026-10-31): "Reminder that everything is auto approved and accepted, do not
  wait on me to do any approvals". This spec is accepted when its plan audit (stage 3) is done; its veto defaults
  (section 12) stand unless the Owner says otherwise. **Accepted 2026-11-07:** the plan audit is done
  ([2026-11-07-plus-port-plan-audit.md](2026-11-07-plus-port-plan-audit.md), 16 findings fixed in place).

## 1. What this is for

Plus is 31,544 source lines of free, MIT, tested extensions (physics, networking, feel, audio, narrative, puzzles,
navigation, scripted scenes and the rest) written against a core that no longer exists. The Owner wants them in the
framework, as extensions, on the refactored core, and wants the 3D slice to use Plus's level sim and scripted scenes
instead of writing them a second time. Success is:

1. every Plus package except the starter lives in `mcthaydt/automata-framework` under `extensions/` (or `tooling/` for
   Node tools), named `@automata/<name>`, on the framework's house rules, with its tests passing and its
   cross-engine goldens unchanged;
2. one owner for the level's sim side (`@automata/sectors`) and one for scripted scenes (`@automata/cutscenes`), with
   the 3D plan changed so it does not build either;
3. `mcthaydt/automata-plus` holds nothing that is not also in the framework, so the Owner can archive it.

## 2. Reading the Owner's three asks

- **"make them extensions because they're free anyway"**: P-D1 B of the audit. Each Plus package becomes a workspace
  package in the framework: `extensions/<name>` for code a game loads, `tooling/<name>` for Node tools. "Free" also
  answers publishing: an extension that does not depend on the private `@automata/3d` is published (section 5).
- **"move the stuff 3D is doing here"**: the three things the audit found the 3D slice building that Plus already has
  (X1, X2, X3). "Here" is the port. Read against the audit and the 3D plan at `1c7db6bf`:
  - X1, the level's sim side: the 3D plan's task 7.1 writes `shared/level/sim/` and `simLevel()`. Plus's `sectors`
    already resolves a level for the sim (checks, resolution, queries, the resolved-map resource, the plugin). It moves
    here as `@automata/sectors`, reading `af-sector/2` from `@automata/3d/level`, and 7.1 stops writing its own.
  - X2, scripted scenes: the 3D plan's task 7.4 writes a `stage-script` content kind, a director, scene state and
    sequences. Plus's `cutscenes` already has a content kind of scripts with camera keys, lamp tracks, captions and
    actors, a sim plugin and lints. It moves here as `@automata/cutscenes`, gains the tracks 7.4 planned (doors, time of
    day, grade, props, cues that start figure clips), and 7.4 stops writing the stage.
  - X3, the blockout pipeline: the 3D build's task 4.1 already deleted the blockout format (agreed, D3); Plus's
    `pipe blockout` is not ported.
  - Not moved: the 3D slice's timeline (`shared/timeline/`: keys, eases, sampling). Figure clips need it inside
    `@automata/3d`, and core never imports an extension, so it stays there and `cutscenes` uses it (section 7).
  This matches the reading the audit thread wrote into P-D4 and P-D5 (Plus PR #40, `4cb70b9`).
- **"cut the starter"**: `starters/party-racer` is not ported, nor its parity golden, nor its `SOURCE.md`.

## 3. Scope

**In:** every Plus package but the starter, as listed in section 4; the framework changes they need (section 8); the
3D plan's changes (section 9); the provenance record; the tracking.

**Out:**
- New editors for Plus's content kinds (audit G3). The Owner's rule is "editors have only essential features"; the
  suite keeps showing "not installed" for a kind it cannot edit.
- The blockout pipeline and its `automata-blockout-import` bin (X3).
- Plus's `tooling/core` (`core:sync`, `core.ref`, the overrides block), `tooling/boundary` (the F1, seams and game-leak
  tests) and `tooling/ci` (its workflow tests): workspace packages need no sync, and the framework's own checks replace
  the rest (section 6).
- Plus's `docs/` (32 finished plans, the M-era evidence), `README.md`, `AGENTS.md`, `.github/`, and the 118 committed
  `.vitest` screenshots. The finished plans stay in Plus's history and its archive.
- Archiving `mcthaydt/automata-plus`, its description, its 41 branches and the parked
  `claude/plus-M7.7a-server-deploy` branch: the Owner's (branch deletions and repository settings are the Owner's).
- Publishing: the release run stays the Owner's (NPM_TOKEN, the `release` environment's approval).

## 4. Where each package goes

| Plus package | Framework folder | Name | Published | Depends on (beyond core) |
|---|---|---|---|---|
| `packages/physics` | `extensions/physics` | `@automata/physics` | yes | Rapier deterministic-compat (2D, 3D) |
| `packages/feel` | `extensions/feel` | `@automata/feel` | yes | |
| `packages/audio-synth` | `extensions/audio-synth` | `@automata/audio-synth` | yes | `feel` |
| `packages/debug` | `extensions/debug` | `@automata/debug` | yes | `feel`, `audio-synth` |
| `packages/puzzle` | `extensions/puzzle` | `@automata/puzzle` | yes | |
| `packages/net` | `extensions/net` | `@automata/net` | yes | `@colyseus/sdk` |
| `packages/net-ui` | `extensions/net-ui` | `@automata/net-ui` | yes | `net` |
| `packages/server` | `extensions/net-server` | `@automata/net-server` | yes | `net`, Colyseus (Node) |
| `kits/ui-screens` | `extensions/ui-screens` | `@automata/ui-screens` | yes | |
| `packages/sectors` | `extensions/sectors` | `@automata/sectors` | with 3D | `@automata/3d/level`, `physics` |
| `packages/nav` | `extensions/nav` | `@automata/nav` | with 3D | `sectors` |
| `packages/cutscenes` | `extensions/cutscenes` | `@automata/cutscenes` | with 3D | `sectors`, `@automata/3d` (timeline, piece states) |
| `packages/narrative` | `extensions/narrative` | `@automata/narrative` | with 3D | `sectors`, `puzzle` |
| `packages/systems` | `extensions/systems` | `@automata/systems` | with 3D | `sectors`, `nav`, `puzzle` |
| `tooling/pipelines` | `extensions/pipelines` | `@automata/pipelines` | no (private Node tool) | the extensions it drives, `@automata/editor/gate-records` |
| `packages/dev-tools` | `tooling/dev-tools` | `@automata/dev-tools` | no (private Node tool) | |
| `starters/party-racer` | not ported (Owner: "cut the starter") | | | |

- **Why `net-server`:** `@automata/server` would read as the framework's server; it is `net`'s Colyseus room host.
- **Why `pipelines` is under `extensions/`:** it drives six extensions and imports four of them, and core never imports
  an extension. Under `tooling/` it would be tooling that depends on extensions; under `extensions/` the rule "core
  never imports an extension" stays one line (section 6). It stays private and Node-only.
- **Why `dev-tools` is under `tooling/`:** it imports no extension and no game; it is repository tooling
  (`promote-evidence`, `worktree-gc`). Ported, not retired (P-D10 A: the Owner's rule is not to cut what may be wanted).
- **"With 3D"**: `@automata/3d` is private until Pixi 3D's public release (M3R-D18), so an extension that depends on it
  is private until then and goes public in the same release as `@automata/3d`.

## 5. Decisions P-D2 to P-D11

P-D1 is the Owner's (B). The rest run on the audit's recommendations as amended by the Owner's answer, under the
standing rule. Where this spec departs from the audit's text, the row says why.

| ID | Decision | Notes |
|---|---|---|
| P-D2 | `@automata/<name>`, as section 4. The server is `@automata/net-server`; the kit is `@automata/ui-screens` (the audit's `kit-ui-screens` named the folder kind, which is gone) | departs only in the two names |
| P-D3 | Workspace packages beside core: `workspace:*` for core in `devDependencies` and `workspace:^` in `peerDependencies`. No `core:sync`, no packs, no `core.ref`. The published extensions join the changesets `fixed` group, so everything AF publishes shares one version | the audit: "settled by P-D1 B"; the `fixed` group is this spec's addition (one version line is the framework's rule) |
| P-D4 | `@automata/sectors` owns the level's sim side: checks, resolution, queries, the resolved-map resource and plugin, and the colliders on `physics`, reading `af-sector/2` from `@automata/3d/level`. Plus's `sector-map` TOML kind goes; its fixtures are converted once. The 3D plan's 7.1 writes no `shared/level/sim/` and no `simLevel()` | section 7.1 |
| P-D5 | `@automata/cutscenes` owns scripted scenes: its content kind (`cutscene`), the tick-time sim plugin, the lints, and the presentation director that 3D 7.4 planned. It samples with `@automata/3d`'s timeline (new entry `@automata/3d/timeline`). `@automata/3d` keeps figure clips, `evaluate()`, the world view and `updatePieces`, which reads a `PieceStates` type it owns | section 7.2 |
| P-D6 | The blockout pipeline goes with the format (done by 3D 4.1). Later work against `af-sector/2` only if a game needs it | |
| P-D7 | The framework exports `UiComponent` and `UiSlotName` from `@automata/framework/extension`, and `ErrorPanel`, `ErrorAction`, `SettingsScreen` and `SettingsTab` from `@automata/framework`. The Node tools keep their own small file and process seams | section 8 |
| P-D8 | `feel` and `net`'s client become plain TypeScript; `feel` takes a `Clock` from `@automata/framework`. `net-server`, `pipelines` and `dev-tools` keep Effect (Node). `pnpm boundaries` forbids `effect` in every extension except those three | |
| P-D9 | The framework's house rules, run by the framework's own checks (section 6) | |
| P-D10 | The starter is cut (Owner). `dev-tools` and the kit are ported. The kit is an installable package: a game adds `@automata/ui-screens` and imports a screen, or copies a screen's folder to change it (its README says how); `automata add` does not come back. The parked branch is the Owner's | the audit's "documented copy step" becomes "a package, and copying is optional", because extensions are packages now |
| P-D11 | **B:** the editor owns the gate-records shape and exports its schema at `@automata/editor/gate-records`; the pipelines write that shape (`{ gates: [{ id, decision: 'approved' \| 'rejected' \| 'open', decidedAt?, url? }] }`, `pending` written as `open`). | departs from the audit's A: under P-D1 B the pipelines are an extension and the editor is core, and core never imports an extension. Plan audit: the pipelines have no separate state file for gates; they read `gates.json` back themselves (`run-state.ts`), so both sides move to the array at once. Each record also carries the pipelines' own fields (`stage`, `files`, `summary`, `note`, `requestedAt`, `by`), which the editor's non-strict schema ignores, and the pipelines read an old keyed file once and rewrite it |

## 6. The house rules, as checks

Every extension is laid out like a framework package and passes the framework's checks; nothing is exempted to make a
check pass.

- **Layout:** `src/{app,features/<x>,shared,entries,testing}`, tests in `tests/{unit/<feature>,browser,e2e,fixtures}`
  with `#src/…` imports (`"imports": { "#src/*": "./src/*" }`), one `.test.ts` suffix, parity tests in
  `tests/browser/parity/`. The tests move with the framework's mover (`tooling/codemods/src/cli.ts --browser-folders
  --feature-folders`); the source moves by a move map, `docs/refactor/move-map-plus.json`, with the module mover
  (`tooling/codemods/src/move-modules-cli.ts --map`), dry run first, as the 3D slice did.
- **`pnpm boundaries`:** each extension's sim folders join the sim list (`extensions/<x>/src/features/*/sim` as the map
  places them); `--features` covers every extension; `--browser` covers the ones a page loads; `--platform-imports`
  covers `extensions`; `--forbid extensions/<x>:effect` for every extension but `net-server` and `pipelines`; and a new
  rule, `--no-extension-imports packages games/emberwick`, fails when core or the 2D reference game imports an
  `extensions/*` package (section 8). A game other than Emberwick may use extensions.
- **`pnpm style`:** naming over `extensions/*/src`; `--plan-comments` and `--test-imports` over every extension and
  `tooling/dev-tools`. The 19 "role-missing" findings (audit L3) are factories: an extension that takes options exports
  `createCutscenes(options)` whose body returns `definePlugin(...)`. The rule learns that shape (a role file may export
  a `create<Name>` function that returns its role's `define*` result) rather than every extension losing its options.
  The 10 unknown roles in the pipelines are in `extensions/pipelines`, whose files get the naming rule too: they take
  role suffixes the rule knows or plain names.
- **`pnpm source-names`:** no extension or test names a source project (148 files today, audit L4); where code came from
  goes to `docs/provenance/sources.md`, section "Extensions", one row per Plus package with its source repository and
  commit (`mcthaydt/automata-plus` at `1766c622`) and, where Plus recorded one, the earlier source.
- **`pnpm knip`:** `extensions/*` and `tooling/dev-tools` in `knip.jsonc`'s workspaces.
- **Tests and CI:** `pnpm-workspace.yaml` lists `extensions/*`, so turbo's `test:unit`, `test:browser` and `typecheck` pick
  them up. The six that depend on `@automata/3d` (`sectors`, `nav`, `cutscenes`, `narrative`, `systems` and
  `pipelines`) join the `:3d` filters of `test:unit:3d`, `test:browser:3d` and are excluded from the `:2d` and
  `test:browser:affected` ones, so the 2D gate does not wait on 3D. `3d.yml`'s pull-request paths gain
  `extensions/**`, and `ci.yml`'s parity scope counts `extensions/` as a package folder. The tooling that finds
  packages by folder learns `extensions/`: `tooling/release`'s `GROUPS` (changesets, the API index, the consumer smoke)
  and `tooling/versions`' `workspace()` (the pin check).
- **Published extensions:** API reports (`pnpm api-report --update`), the API index and agent skills
  (`pnpm agent-skills`, a check) as for any published package; changesets name them.
- **Dependencies:** Colyseus, Rapier, `@modelcontextprotocol/sdk` and `smol-toml` are new to the framework's lockfile:
  `pnpm deps:new` lists them and `pnpm audit:deps` checks their licences; pins follow the framework's
  (`svelte` 5.57.1, `vite` 8.3.3, `typescript` 7.0.2; audit C9).

## 7. The two overlaps

### 7.1 The level's sim side (`@automata/sectors`)

- **Reads:** `af-sector/2` (the 3D plan's 7.1 schema, `readLevel()` from `@automata/3d/level`), from the game's
  `*.af-sector.json` files, the same files the game and the editor read. One file per level.
- **Owns:** `resolveLevel(level: AfSector2): ResolvedMap` (today's `resolveMap`, reading corners; a sector with
  `pit: true` resolves with `pit` set and no floor under it, so `floorAt` is `undefined` there; a sloped floor, which
  the sim cannot walk yet, is a `sloped-floor` problem naming the room, never read flat), the
  checks a level passes before it resolves (reported as the 3D slice's `LevelProblem`), the queries
  (`sectorAt`, `InSector`, `resolvedMap`), the resolved-map resource, the sectors plugin and system, and the colliders
  on `physics` (`./physics`).
- **What `/2` must hold for it:** the clinic uses `zone` on its sectors, top-level `masses`, and `cut` and `hideFrom`
  on its walls. `/1` has none of these (`AfWall` is `Omit<WallDef, 'hideFrom' | 'cut'>`), so the 3D build's 7.1 adds
  them to `/2` (section 9). A converter that dropped them would resolve a different map.
- **The proof it is the same level sim:** Plus's fixture `clinic.sector-map.toml` is converted once to
  `clinic.af-sector.json` (a script under `extensions/sectors/scripts/`, run once, then deleted with the TOML kind), and
  `resolveLevel(readLevel(clinic).level)` passes today's `resolve.test.ts` comparisons against `clinic.resolved.json`
  (field by field, points within 1e-12; a deep-equal cannot work, as `ResolvedMap` holds functions). Because the resolved map is
  unchanged, the goldens of `nav`, `systems`, `narrative` and `cutscenes` do not move. A hash change is investigated,
  never re-recorded.
- **Before 3D 7.1 lands:** `sectors` is ported on the names `@automata/3d/level` exports today (`SectorDef`, `WallDef`,
  `Corner`, `Trim`, `STEP`, `WALL_THICK`; the 3D build's 4.1 log confirms they are still there), with its TOML kind,
  so the port does not wait on 3D. The move to `af-sector/2` is its own task after 7.1.
- **The base 3D game:** its sim reads the level through `@automata/sectors/sim` once `sectors` reads `af-sector/2`
  (the audit's P-D4): its `AreaSource` boxes come from `resolveLevel`'s map instead of its own reading of the file, and
  its systems stay as they are (the sectors plugin and its Rapier colliders are not wired in). Its golden replay hash must not change; if the two readings of the room differ, the task stops and
  records it rather than re-recording.

### 7.2 Scripted scenes (`@automata/cutscenes`)

- **Content kind:** `cutscene` (Plus's word, which a drunk grandma reads; the 3D plan's `stage-script` is not made).
  A script has tracks and cues: camera keys (lens, ease, cut), lamps, doors, time of day, grade, props, captions, and
  cues that start a figure clip on an actor at a tick.
- **Sim side:** today's plugin: which script plays, started by sim events, advanced in ticks, ended by its last key; the
  lints (`./tools`).
- **Presentation side:** the director the 3D plan's 7.4 specified, moved here: `createDirector(script, startClip)`,
  `Director.stateAt(t)` returning `SceneState { camera; doors; lamps; time; grade; props; captions }`, reading the
  presentation's interpolated tick time as an argument, no clock, no gameplay state. `SceneState` keeps every member of
  Plus's `CutsceneFrame` (actors, caption, flicker, fade, done, prop states and how long each has held; `light` becomes
  `lamps`). Plus's `play/evaluate.ts` and its eases go: tracks sample with `@automata/3d/timeline`'s `sample` and
  `Ease`. No frame moves: a cutscene key with no ease is `smooth` (Plus's default, kept as the kind's documented
  default), Plus's `out` (`t(2 − t)`) is rewritten in the four fixtures as the exact cubic-bezier `[1/3, 2/3, 2/3, 1]`
  (AF's `out` is CSS's curve), and `cut: true` is `step`. `cutscenes`' schema is a sim file, so `./timeline` is one of
  `@automata/3d`'s `simEntries`.
- **What stays in `@automata/3d`:** the timeline, figure clips and `evaluate()`; the world view; `updatePieces(view,
  before: PieceStates, after: PieceStates)` with `PieceStates { doors; lamps; props }` defined in 3D
  (`shared/level/piece-states.ts`), which `SceneState` extends; `compose-scene`'s `startClip`. A game wires the director's
  state into `updatePieces` and its `startClip` into the director: the game imports both, neither imports the other's
  internals, and 3D never imports the extension.
- **Proof:** Plus's four converted fixtures play to the same sim hashes and the same frames (Plus's `evaluate` output
  recorded every 0.1 s before the change, numbers within 1e-9) and lint the same; the 3D plan's 7.4 tests (a state at t comes from
  the keys alone; a door key changes only that door; a cue starts its clip at its tick) move here and pass.

## 8. Framework changes the port makes

| Change | Where | Why |
|---|---|---|
| `extensions/*` in the workspace; turbo, knip, CI filters | root `pnpm-workspace.yaml`, `turbo.json`, `knip.jsonc`, `package.json` scripts | section 6 |
| Export `UiComponent`, `UiSlotName` | `packages/automata/src/entries/extension.ts` | `ExtensionDef.ui.slots` uses them (audit C3) |
| Export `ErrorPanel`, `ErrorAction`, `SettingsScreen`, `SettingsTab` | `packages/automata/src/entries/ui.ts` (the root's UI part; `game.ts` is not re-exported by `index.ts`) | the kit builds screens from them |
| `--no-extension-imports` | `packages/tools/src/features/boundaries/extensions.ts` (over `forbid.ts`), `cli.ts` | "core never imports an extension" as a check |
| `extensions/` in the folder lists | `tooling/release/src/publishable-packages.ts` `GROUPS`, `tooling/versions/src/stack.ts` `workspace()`, `.github/workflows/{3d,ci}.yml` | section 6 |
| The style rule learns factories | `tooling/check-style/src/style.ts` | section 6 |
| `@automata/editor/gate-records` | `packages/editor/package.json` exports | P-D11 B |
| `@automata/3d/timeline` (with `easeSchema`, a sim entry) and `PieceStates` | `packages/3d/src/entries/timeline.ts`, `packages/3d/package.json`, `shared/level/piece-states.ts` | section 7.2 |
| The examples catalog names the real extensions | `tooling/examples-runner/src/catalog.ts` (`PLUS_MODULES` becomes `EXTENSION_MODULES`, the tier `plus` becomes `extension`, `EXTENSION_PACKAGES` lists the published extensions) | audit G4 |
| The stack card points at `extensions/physics` | `tooling/versions/src/stack.ts` | audit G4 |
| Provenance rows | `docs/provenance/sources.md` | section 6 |
| AGENTS.md: where extensions live | `AGENTS.md` "Packages and features" | one line: `extensions/<name>`, never imported by core |

Each published-package change carries a changeset (`check-changesets` decides the bump); `pnpm api-report --update`
and `pnpm agent-skills` follow export changes.

## 9. What changes in the 3D plan

For the 3D build (`docs/refactor/2026-11-07-3d-slice-plan.md` at `1c7db6bf`); the coordinator passes this list on, and
the 3D build applies it to its plan when it reaches each task.

| 3D task | Change |
|---|---|
| 7.1 | Drop `shared/level/sim/` and `simLevel()` from Files and Interfaces; `entries/sim.ts` keeps only `features/camera/sim`. Drop `expect(simLevel(two)).toEqual(simLevelOfV1(f))` from the migration test (the lossless round trip stays). Everything else stays: the `af-sector/2` schema, `readLevel`, the migration, `LevelProblem`, the converter, base-3d's migrated room. `automata.simEntries` stays `["./sim", "./level"]` (`./level` holds the types the extension's sim imports; the port's 3.1 adds `./timeline`). **Added by the plan audit:** `/2` carries what `@automata/sectors` resolves and `/1` lacks: `zone?: string` on a sector, `masses?: MassDef[]` on the level, and `cut?`, `hideFrom?` on a corner's wall (`AfWall` stops omitting them), each with a row in spec 9's table and a migration test (a `/1` file has none, so it migrates unchanged) |
| 7.4 | Shrinks to what 3D keeps: `shared/level/piece-states.ts` (`PieceStates`, `LampState`, `PropState`), `app/update-pieces.ts`, and `compose-scene`'s `startClip`. The `features/stage/` folder, the `stage-script` kind, the director, scene state and sequences are not made (port task 3.3 makes them in `@automata/cutscenes`). Its tests "a door key changes only that door" stays (on `updatePieces`); the other two move to the port |
| 12.1 | `examples/3d/stage-script.ts` is not made; the port adds `examples/3d/cutscene.ts` (port task 3.5) |
| 12.2 | If port task 3.4 has landed, the `3d` template lists `@automata/sectors` beside `@automata/3d` (both private until Pixi 3D's release) |
| Spec section 7 | `stage/` leaves the package tree; `shared/level/` loses `sim/`; the sim entry re-exports only the camera's sim |
| Spec section 8.3 | "The stage" bullet points at `@automata/cutscenes` |
| Spec section 9 | "what the sim reads ... is `shared/level/sim/`" becomes "is `@automata/sectors`" |
| Spec section 3 | "Out: Plus" becomes "Plus is ported separately as extensions; see the Plus port spec" |
| Plan "Notes from the automata-plus audit" | Replaced by "Plus port rulings: see the Plus port spec section 9" |

No 3D task waits on the port: 7.1 and 7.4 only lose work. The port's 3D-dependent tasks wait on 3D 6.3 (timeline), 7.1
(`af-sector/2`) and 7.2 (the world view).

## 10. Order

1. **Part A, the house (no 3D dependency):** import Plus with its history; names, manifests and configs; the framework
   changes of section 8 that do not touch 3D; every package moved to the house rules; `feel` and `net` without Effect;
   `net`'s target-neutral words (audit P3); the pipelines without blockout and on the editor's gate shape; provenance
   and docs. `sectors` and its readers are ported on today's `@automata/3d/level` names.
2. **Part B, with the 3D build:** after 3D 7.1, `sectors` reads `af-sector/2`; after 3D 6.3 and 7.2 (and 7.4 shrunk),
   `cutscenes` takes the director; then base-3d reads its level through `sectors`, and `examples/3d/cutscene.ts`.
3. **Part C, closing:** the publish set (changesets, API reports), the tracking, the handover list for the Owner (archive
   Plus).

## 11. Failure and recovery

- **A hash changes:** investigated, never re-recorded. If a port step changed a sim value, revert that step. If the
  converted fixture resolves differently, the converter is wrong.
- **A check fails on moved code:** fix the code or the move map, never add an exemption (`--skip-dir`, a style
  allow-list) for an extension.
- **The 3D build reaches 7.1 or 7.4 before part A is done:** it applies section 9 anyway (it only removes work); the
  port's part B then starts from what 3D merged.
- **The import's history is refused by the proxy:** `git subtree add --squash` (the site's fallback), recorded in the
  execution log.
- **WebKit and Firefox:** not installable in cloud sessions. Parity in those engines runs on the Owner's Mac
  (`pnpm ci:local`); the build records Chromium and leaves the other two as pending gates, never as passed.

## 12. Veto defaults (stand unless the Owner says otherwise)

1. The server is `@automata/net-server` and the kit `@automata/ui-screens`.
2. The pipelines live in `extensions/pipelines`; `dev-tools` in `tooling/dev-tools`.
3. P-D11 is B (the editor owns the gate shape), against the audit's A, because core never imports an extension.
4. The content kind is `cutscene`, not `stage-script`.
5. Published extensions join the `fixed` version group.
6. The style rule learns factories rather than every extension dropping its options.

## 13. Acceptance

- `pnpm check` green, with every extension on the boundaries, style, source-names and knip lines.
- Every extension's unit tests pass; its Chromium browser and parity suites pass; the parity goldens are byte-identical
  to Plus's at `1766c622` (except the starter's, which is cut). WebKit and Firefox recorded as pending for the Owner's
  Mac.
- `grep -rn "@mcthaydt/" extensions tooling/dev-tools` finds nothing; `grep -rln "from 'effect'" extensions` lists only
  `net-server` and `pipelines` files.
- `clinic` resolves through `af-sector/2` to today's resolved map; base-3d's golden replay hash is unchanged.
- No `stage-script`, `features/stage` or `shared/level/sim` in `packages/3d/src`; `grep -rn "type Ease\b" packages/3d/src
  extensions` finds only `packages/3d/src/shared/timeline/ease.ts`.
- `docs/provenance/sources.md` has a row for every ported package.
- The words a player sees in `ui-screens`, `net-ui` and `debug` pass the drunk grandma test (each reviewed in the task
  that moves it, with the strings listed in the execution log).
