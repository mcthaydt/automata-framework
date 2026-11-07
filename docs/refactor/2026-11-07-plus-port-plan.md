# Automata Plus as framework extensions: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (Native). AF's rule is no subagents, so
> subagent-driven-development is not used. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port every Automata Plus package except the starter into `mcthaydt/automata-framework` as `extensions/<name>`
(Node tools under `tooling/` where they import no extension), on the framework's house rules, with `@automata/sectors`
as the level's sim side and `@automata/cutscenes` as scripted scenes in place of what the 3D plan's tasks 7.1 and 7.4
would have written.

**Architecture:** Plus comes in with its history (`git subtree add`), then each package is renamed, laid out by feature
with tests in `tests/`, and put on the framework's own checks. Part A needs nothing from the 3D build; part B moves
`sectors` and `cutscenes` onto the 3D slice's `af-sector/2` and timeline as those land; part C closes the publish set
and the tracking.

**Tech Stack:** TypeScript 7.0.2, pnpm 10.34.6 workspaces, turbo, vitest 5.0.3 (node, jsdom and browser projects),
Svelte 5.57.1, Koota, Zod, Rapier deterministic-compat, Colyseus, Effect (Node tools only), changesets.

**Spec:** [2026-11-07-plus-port-spec.md](2026-11-07-plus-port-spec.md). The audit: [2026-11-07-plus-audit.md](2026-11-07-plus-audit.md).

**Source:** `mcthaydt/automata-plus` `main` at `1766c622` (2026-11-01). "Plus" below means that commit.

## Global Constraints

- Names are `@automata/<name>`; the server is `@automata/net-server`, the kit `@automata/ui-screens` (spec 4).
- Core is never imported by `dependencies`: `workspace:^` in `peerDependencies`, `workspace:*` in `devDependencies`.
- Every manifest says `"license": "MIT"`; every package has `"imports": { "#src/*": "./src/*" }`.
- Core never imports an extension (`--no-extension-imports packages games/emberwick`).
- No Effect in an extension a page loads; only `net-server` and `pipelines` import `effect` (spec P-D8).
- `src/` is `app/`, `features/<x>/`, `shared/`, `entries/`, `testing/`; tests in `tests/`, `#src/…` imports, one
  `.test.ts` suffix; files kebab-case, role-suffixed, at most 600 lines.
- Comments say why; no plan IDs, no source-project names (the provenance file holds where code came from).
- Sim rules: no wall clock, no `Math.random`, only the allowed `Math` members, `sortedKeys`/`sortedEntries`, no `**`.
- A sim hash or golden never changes in this port. A change is investigated and its cause reverted, never re-recorded.
- No exemption (`--skip-dir`, an allow-list entry) is added for an extension to pass a check.
- Copy a player sees passes the drunk grandma test: could a drunk grandma tell what is happening and what to press?
- Pins follow the framework: `svelte` 5.57.1, `vite` 8.3.3, `typescript` 7.0.2, `vitest` 5.0.3, `zod` as the root pins it.
- Before every commit: `pnpm format`, then `pnpm check` (the lefthook hook runs Biome and affected tests; commit in the
  background, it takes minutes). After an export or doc-comment change in a published package: `pnpm build`,
  `pnpm api-report --update`, `pnpm api-index --write`, then `pnpm agent-skills` (a check: it has no `--write`).
- WebKit and Firefox are not installable in cloud sessions: record Chromium results and list the other two as pending
  for the Owner's Mac (`pnpm ci:local`), never as passed.

## Review Focus

1. **A level the clinic's TOML could not have held** (a pit by flag, a sloped floor) reaching `resolveLevel`: a pit is
   somewhere Wick falls (no floor under it), and a slope the sim cannot walk yet is reported as a `LevelProblem`
   naming the room, not silently read as flat. Tests in task 3.2.
2. **A cutscene sampled outside its keys or naming a lamp, door or prop the level lacks:** the director holds the end
   values and the lint names the missing piece; nothing throws mid-scene. Tests in task 3.3.
3. **`feel` under a stalled tab** (the clock jumps seconds between frames): the plain-TypeScript `frameNow` returns the
   same values the Effect version did for the same clock readings, including the clamp. Test in task 2.3.
4. **A `gates.json` written by an older pipelines run** (the keyed shape with `pending`) in a game folder: the
   editor's review desk says the file is from an older version and to run the pipeline again, instead of a schema
   dump; the pipelines read the old file once and write the new shape on their next save. Tests in task 2.7.
5. **A game that lists an extension whose sibling it needs is missing** (`systems` without `nav`): building the game
   fails and names the missing one (`requires` is already on `ExtensionDef`); it does not boot half-wired. Test in
   task 2.6.

---

## Part A: the house (no 3D dependency)

## Phase 1: Plus in the workspace, green (PR `claude/plus-import`)

### Task 1.1: Import with history, names and manifests

**Files:**
- Create (by subtree): `plus-import/**` (temporary), then by `git mv`: `extensions/{physics,feel,audio-synth,debug,
  puzzle,net,net-ui,sectors,nav,cutscenes,narrative,systems}` from `plus-import/packages/<same>`,
  `extensions/net-server` from `plus-import/packages/server`, `extensions/ui-screens` from
  `plus-import/kits/ui-screens`, `extensions/pipelines` from `plus-import/tooling/pipelines`, `tooling/dev-tools` from
  `plus-import/packages/dev-tools`
- Delete: the rest of `plus-import/` (starter, `tooling/{core,boundary,ci}`, `docs/`, `.github/`, root files, every
  `.vitest/` folder, every `scripts/register-ts.mjs` and `scripts/ts-resolve.mjs`; the `convert-adventure-*.ts`
  scripts go in task 2.6 with the source names)
- Modify: `pnpm-workspace.yaml` (`extensions/*`, `tooling/dev-tools` is already covered by `tooling/*`), every moved
  `package.json`, `tsconfig.json`, `vitest.config.ts`; every source import of a core name (audit C2's table);
  the eight `*.content.ts` files (`@automata/content/schema`, audit C4)
- Test: `tooling/repo-hygiene/tests/unit/extension-manifests.test.ts`,
  `tooling/repo-hygiene/src/extension-manifests.ts`

**Interfaces:**
- Produces: `extensionManifestProblems(root: string): string[]` (one sentence per problem, naming the file); the
  package names of spec 4.

- [ ] **Step 1: Write the failing test** over real folders and a temporary fixture tree:

```ts
it('every extension is @automata/<folder>, MIT, with #src imports', () => {
  expect(extensionManifestProblems(repoRoot)).toEqual([])
})
it('refuses core in dependencies', () => {
  expect(extensionManifestProblems(fixture({ dependencies: { '@automata/sim': 'workspace:*' } })))
    .toEqual(['extensions/x/package.json: @automata/sim is core, so it belongs in peerDependencies'])
})
it('refuses an old scope', () => {
  expect(extensionManifestProblems(fixture({ name: '@mcthaydt/automata-x' }))[0]).toMatch(/@automata\/x/)
})
```

  The folder-to-name map has one exception, `net-server`; the core set is `@automata/{framework,tools,sim,content,3d,
  evidence}`.
- [ ] **Step 2:** `pnpm --filter @automata/repo-hygiene exec vitest run extension-manifests` → FAIL (no module).
- [ ] **Step 3:** `git fetch --depth=1000 https://github.com/mcthaydt/automata-plus.git 1766c622` then
  `git subtree add --prefix plus-import FETCH_HEAD` (if the proxy refuses the pack: `--squash`, logged). Then the
  `git mv`s and deletes above, in one commit `chore(extensions): bring Automata Plus in with its history`.
- [ ] **Step 4:** Rename, core names first: they follow audit C2's table (`-runtime`, `-ui`, `-game`, `-testing` → `@automata/framework[/extension|/testing]`,
  `-testing/sim/*` → `@automata/sim/testing/*`, `-sector-format` → `@automata/3d/level`, `@mcthaydt/evidence` →
  `@automata/evidence`, `-check-boundaries` → the root's bin), by a one-off script in the session scratchpad. Only then
  `node tooling/codemods/src/rename-scope-cli.ts` for Plus's own names (`@mcthaydt/automata-<x>` → `@automata/<x>`; run
  first, it would turn `-runtime` into a package that does not exist), and `-server` → `net-server`,
  `-kit-ui-screens` → `ui-screens` by hand. Manifests: peers `workspace:^`, dev `workspace:*`, the
  `#src/*` import map, pins from the root. The eight content files import `defineContentSchema` from
  `@automata/content/schema`.
- [ ] **Step 5:** `grep -rn "@mcthaydt/" extensions tooling/dev-tools` → nothing; `pnpm install`; the test passes;
  `pnpm typecheck` passes for every extension (a `-node` import in `pipelines` or `dev-tools` is replaced in task 2.7;
  until then those two keep compiling by a local `node-seams.ts` copied from Plus's use of `Files` and `ProcessRunner`,
  plain Node `fs` and `child_process` behind the same names). **Commit** `refactor(extensions): Plus's packages as
  @automata/<name>`

### Task 1.2: The names the framework dropped (P-D7)

**Files:**
- Modify: `packages/automata/src/entries/extension.ts` (types `UiComponent`, `UiSlotName` from
  `shared/ui/slots/ui-slot.ts`), `packages/automata/src/entries/ui.ts` (the root's UI part, where the other status
  components are: `default as ErrorPanel` from `shared/ui/status/ErrorPanel.svelte`, `type ErrorAction` from
  `shared/ui/status/error-panel.ts`, `default as SettingsScreen` from `app/screens/settings/SettingsScreen.svelte`,
  `type SettingsTab` from `app/screens/settings/settings-screen.ts`; not `game.ts`, which `index.ts` does not
  re-export), `.changeset/extension-ui-names.md`
- Test: `packages/automata/tests/unit/entries/extension-names.test.ts`

**Interfaces:**
- Produces: `import type { UiComponent, UiSlotName } from '@automata/framework/extension'`;
  `import { ErrorPanel, SettingsScreen, type ErrorAction, type SettingsTab } from '@automata/framework'`.

- [ ] **Step 1: Failing test:** `expectTypeOf<ExtensionDef['ui']>().toEqualTypeOf<{ slots?: Partial<Record<UiSlotName,
  UiComponent>> } | undefined>()` importing both from the extension entry, and `expect(typeof ErrorPanel).toBe('function')`
  from the root. (Match the declared shape of `ExtensionDef.ui` as the API report shows it.)
- [ ] **Step 2:** FAIL (not exported). **Step 3:** the exports, the changeset (`patch` per `check-changesets`),
  `pnpm build && pnpm api-report --update && pnpm api-index --write && pnpm agent-skills`.
- [ ] **Step 4:** PASS; `extensions/debug` and `extensions/ui-screens` typecheck on these names. **Commit**
  `feat(framework): export the UI names extensions build on`

### Task 1.3: "Core never imports an extension" and the checks over `extensions/`

**Files:**
- Create: `packages/tools/src/features/boundaries/extensions.ts`
- Modify: `packages/tools/src/features/boundaries/cli.ts` (the `--no-extension-imports <root>...` flag), root
  `package.json` (`boundaries`, `style`, `test:unit:2d|3d`, `test:browser:2d|3d|affected` filters), `knip.jsonc`
  (`extensions/*`), `turbo.json` if a task needs the new folder, `.github/workflows/3d.yml` (`"extensions/**"` in
  the pull-request paths, so a change to a 3D-dependent extension runs the 3D suites), `.github/workflows/ci.yml` (the
  parity scope's `^(packages|tooling|examples|games|docs)/` gains `extensions`, so an extension change runs affected
  parity, not the full set; workflow changes need no Owner sign-off since 2026-10-31), `AGENTS.md` ("Packages and features": extensions live in
  `extensions/<name>`, opt in, and core never imports one), `.changeset/no-extension-imports.md`
- Test: `packages/tools/tests/unit/boundaries/extensions.test.ts`

**Interfaces:**
- Produces: `extensionImportFindings(roots: readonly string[], extensionNames: ReadonlySet<string>): Finding[]`
  (`Finding` from `check.ts`); extension names are read from `extensions/*/package.json`. It is `forbid.ts`'s
  `forbidFindings(root, [...extensionNames])` per root, with its own rule name and message ("core never imports an
  extension: <specifier>"), so type-only imports count and a name in a string does not, as for `--forbid`.

- [ ] **Step 1: Failing tests:**

```ts
it('finds core importing an extension', () => {
  expect(extensionImportFindings([fixture('packages/a/src/x.ts', "import '@automata/physics/2d'")],
    new Set(['@automata/physics']))).toHaveLength(1)
})
it('lets a game other than the listed roots use an extension', () => { /* games/demo not in roots → [] */ })
it('sees a type-only import and a dynamic import', () => { /* both found */ })
```

- [ ] **Step 2:** FAIL. **Step 3:** implement over `forbidFindings` (which reads imports with `imports.ts`). Wire into the
  root: sim roots for each extension's current sim folders (Plus's `src/sim`, `physics/src`), `--features extensions/*`
  is added per package in phase 2 as each moves (not now: the flat layout would pass vacuously), `--platform-imports`
  gains `extensions`, `--forbid extensions/<x>:effect` for every extension but `net-server` and `pipelines` added in the
  task that removes the extension's Effect (2.3, 2.4; the rest now), `--no-extension-imports packages games/emberwick`.
  The six extensions on `@automata/3d` (`sectors`, `nav`, `cutscenes`, `narrative`, `systems`, and `pipelines`, which
  imports four of them) go in the `:3d` test filters and out of the `:2d` and `:affected` ones.
- [ ] **Step 4:** PASS; `pnpm boundaries` exits 0. **Commit** `feat(tools): core never imports an extension`

### Task 1.4: The gate on the old layout

- [ ] **Step 1:** `pnpm check` → exit 0. Record per package: unit test count (Plus's section 3 counts minus the
  starter's 45 and `tooling/{core,boundary,ci}`'s 181 are the floor: 1,816).
- [ ] **Step 2:** In every extension with a browser project: `pnpm exec vitest run --project 'browsers (chromium)'`
  (or `'layout (chromium)'` for `ui-screens`, `net-ui`) → the counts of the audit's "Browser run" table minus the
  starter. The eight parity files' goldens are byte-identical to Plus's (`git diff --stat 1766c622 --` over the golden
  JSON finds nothing once paths are mapped; the build writes the path map into the log).
- [ ] **Step 3:** Execution-log row with the counts, Chromium only, WebKit and Firefox pending. **Commit**
  `docs(refactor): Plus port phase 1 gate`

## Phase 2: each package on the house rules (PRs `claude/plus-house-<group>`)

Every task here follows the same moves, written once:

1. Add the package's rows to `docs/refactor/move-map-plus.json` (feature folders as the task lists them; `entries/`
   one file per `exports` key; `testing/` for published fixtures), dry run
   `node tooling/codemods/src/move-modules-cli.ts --map docs/refactor/move-map-plus.json --dry-run` until it lists
   nothing unmapped and no clash, then for real.
2. Tests: `node tooling/codemods/src/cli.ts extensions/<x> --environment node|jsdom --browser-folders
   --feature-folders --dry-run`, then for real; golden and content fixtures to `tests/fixtures/` by hand in the same
   commit.
3. Root: `--features extensions/<x>`, the sim roots at their new paths, `style --plan-comments` and `--test-imports`
   for `extensions/<x>`.
4. Comments: `node tooling/check-style/src/cli.ts --plan-comments extensions/<x>/src` → 0; `pnpm source-names` → 0
   (every source name becomes a row in `docs/provenance/sources.md`'s "Extensions" section: package, file, source
   repository and commit as Plus recorded it, and "ported from `mcthaydt/automata-plus` at `1766c622`").
5. Verify: the package's unit count unchanged, its Chromium browser and parity suites pass, goldens byte-identical,
   `pnpm check` green. The log row lists the counts.

### Task 2.1: The style rule learns factories

**Files:** Modify `tooling/check-style/src/style.ts`. Test `tooling/check-style/tests/unit/style-factories.test.ts`.

- [ ] **Step 1: Failing tests:** a `cutscenes.plugin.ts` exporting `function createCutscenes(o: Options) { return
  definePlugin({…}) }` gives no "role-missing"; one exporting `createCutscenes` that returns something else still gives
  "role-missing"; a `.plugin.ts` exporting a `define*` result directly stays fine.
- [ ] **Step 2:** FAIL. **Step 3:** a role file may export `create<Name>` functions whose return statements are calls
  to that role's `define*` (`.plugin.ts` → `definePlugin`, and so on). **Step 4:** PASS; over Plus's `src/` the 19
  role-missing findings of audit L3 become 0. **Commit** `feat(check-style): a role file may export a factory`

### Task 2.2: `physics` and `puzzle`

- **physics:** `features/2d/`, `features/3d/` (each with its `sim` files), `shared/` (the deterministic-compat loader,
  the common schema), `entries/{2d,3d}.ts`; `automata.simEntries` `["./2d", "./3d"]` unchanged.
- **puzzle:** `features/{rules,solver}/`, `features/rules/sim/`, `testing/` (the converted puzzles and scene pipes),
  `entries/{index,sim,solver}.ts`.
- [ ] The five moves above. **Commit** `refactor(extensions): physics and puzzle by feature`

### Task 2.3: `feel` without Effect; `audio-synth` and `debug`

**Files:**
- Modify: `extensions/feel/src/feel.ts` → `features/frame/feel.ts` (plain TypeScript), `feel.extension.ts`,
  `extensions/feel/package.json` (drop `effect`)
- Test: `extensions/feel/tests/unit/frame/feel-clock.test.ts`

**Interfaces:**
- Consumes: `Clock` from `@automata/framework` (`now(): number`), `fakeClock()` from `@automata/framework/testing`.
- Produces: `createFeel(options: FeelOptions): Feel` as today, `FeelOptions` gaining `clock: Clock`;
  `Feel.frameNow(drawnTick: number, alpha: number): FeelFrame` (was `Effect.Effect<FeelFrame>`, reading
  `Clock.currentTimeMillis`; both are milliseconds); every other `Feel` member keeps its signature.

- [ ] **Step 1: Failing test** (Review Focus 3): record `frameNow` outputs from the Effect version over a scripted
  clock (steps of 16 ms, then a 5 s stall, then 16 ms) into `tests/fixtures/feel-clock.json` **before** changing code;
  the test asserts the plain version returns the same frames for the same `fakeClock` readings.
- [ ] **Step 2:** the test fails to compile against the new signature. **Step 3:** rewrite with `clock.now()`; callers
  in `debug` and `audio-synth` pass the clock they already get from the runtime. `--forbid extensions/feel:effect`.
- [ ] **Step 4:** PASS. Then the five moves for `feel` (`features/{frame,dynamics}/`), `audio-synth`
  (`features/{synth,measure,render}/`, `entries/{index,measure,render,browser}.ts`), `debug` (`features/{panels,
  overlay,vite}/`). `debug`'s overlay words pass the grandma test (listed in the log). **Commit**
  `refactor(extensions): feel without Effect; feel, audio-synth and debug by feature`

### Task 2.4: `net` without Effect in the page; `net-ui`, `net-server`

**Files:**
- Modify: `extensions/net/src/client/{net-room,room-store,net-error}.ts`, `session/make-net-session.ts`,
  `client/net-port.ts` (its comment: `net` owns its port; audit E3), `config/net.schema.ts` (target-neutral words;
  audit P3); `extensions/net-server/src/**` origin config (P3)
- Test: the existing tests of those files, moved by the mover; `extensions/net/tests/unit/client/net-errors.test.ts`

**Interfaces:**
- Produces: `NetRoom` and `RoomStore` methods return `Promise<T>` or plain values where they returned `Effect`;
  `NetError` becomes `class NetError extends Error { readonly name = 'NetError'; readonly code: NetErrorCode; readonly
  operation: string }` (today's fields from `Data.TaggedError('NetError')`, `NET_ERROR_CODES` from
  `wire/server-message.schema.ts` unchanged, so `net-ui` and `net-server` read the same codes). `net-server` keeps
  Effect.

- [ ] **Step 1: Failing test:** every error path the Effect tests covered rejects with the same `code` and
  `operation` through the promise API (table-driven from `net-error.test.ts` and the `net-room-*.test.ts` cases).
- [ ] **Step 2:** FAIL. **Step 3:** rewrite; timers through an injected `Clock`. `--forbid extensions/net:effect`.
  `net.schema.ts` says the server URL must be allowed by the game's target (each target's network setting), naming no
  one target; `net-server` takes allowed origins from its config list, with the Ruken game origin as one possible entry,
  not the only one.
- [ ] **Step 4:** PASS (net's 376 and server's 437 unit tests carried). Then the five moves: `net`
  (`features/{client,session,wire,interpolation}/`, `features/wire/sim/`, `testing/`), `net-ui`
  (`features/{status,lobby}/`), `net-server` (`features/{room,gates,operations}/`, `app/` for the bin). `net-ui`'s words
  pass the grandma test (listed). **Commit** `refactor(extensions): net without Effect in the page; net, net-ui and
  net-server by feature`

### Task 2.5: `ui-screens` as a package

**Files:** Modify `extensions/ui-screens/{package.json,README.md}` (exports one entry per screen and `.` for all;
README: add the package, import a screen; copy a screen's folder to change it); delete `kit.json` and the
`automata add` words; the kit's tests move.

- [ ] **Step 1: Failing test** `extensions/ui-screens/tests/unit/entries.test.ts`: each screen imports from
  `@automata/ui-screens/<screen>`; `grep -rn "automata add" extensions/ui-screens` → nothing (asserted in the test by
  reading the README).
- [ ] **Step 2:** FAIL. **Step 3:** exports and README. **Step 4:** PASS; the layout suite (550 + 1 skipped) passes in
  Chromium; every screen's words pass the grandma test (listed). The 19 review images under Plus's
  `docs/evidence/owner-visual/product6-ui-screens-kit/` are not ported (they show the old theme); new ones are made by
  the layout suite's own screenshots after DUEL lands (3D task 5.2). The five moves. **Commit**
  `refactor(extensions): ui-screens is a package games import`

### Task 2.6: `sectors`, `nav`, `systems`, `narrative`, `cutscenes` by feature (no behaviour change)

- Layouts: `sectors` `features/{level,colliders}/` (each with `sim/`), `entries/{index,sim,physics}.ts`; `nav`
  `features/{graph,route}/sim/`; `systems` `features/{agents,probes,bots}/`; `narrative` `features/{dialogue,
  storylets,tools}/`; `cutscenes` `features/{script,lint}/`, `features/script/sim/`, `features/play/` (until 3.3).
- The `convert-adventure-*.ts` scripts and their outputs' source names go: the converted fixtures stay as fixtures;
  the provenance rows say where they were converted from.
- **Test (Review Focus 5):** `extensions/systems/tests/unit/extension/requires.test.ts`: `systemsExtension` already
  says `requires: ['sectors', 'nav', 'puzzle']`; a game built with `defineGame` (which calls the internal
  `resolveExtensions`, `app/define-game.ts`) over `[systemsExtension, sectorsExtension, puzzleExtension]` throws an
  `ExtensionError` with `reason: 'missing'`, `names: ['systems', 'nav']` and the message `missing: systems, nav`.
  Assert on the error's fields through the public `defineGame`; add no core export.
- [ ] The five moves for each; all nine Plus parity files (eight after the cut) unchanged. **Commit**
  `refactor(extensions): the level, nav, systems, narrative and cutscenes by feature`

### Task 2.7: `pipelines` without blockout, on the editor's gate shape; `dev-tools`

**Files:**
- Delete: `extensions/pipelines/src/blockout.*.ts`, the `automata-blockout-import` bin, the blockout stage in the
  pipe registry
- Modify: `packages/editor/package.json` (export `./gate-records` → `src/features/suite/node/gate-records.schema.ts`),
  `gate-records.schema.ts` (its comment: the editor owns this shape and the pipelines write it; "The pipelines platform
  owns the real shape (the Plus pipelines) and replaces this when it lands" goes),
  `packages/editor/src/features/suite/node/gates-reader.ts` (an older keyed file rejects, as every unreadable records
  file does, but with the words the review desk shows after "Gates not readable: ": "`<path>` was saved by an older
  version of the pipelines. Run the pipeline again to update it."),
  `extensions/pipelines/src/{state.schema.ts,run-state.ts}` (`gates.json` read and written in the editor's shape,
  below), `extensions/pipelines/package.json` (`@automata/editor` `workspace:*` in `dependencies`: both are private,
  and the manifest rule's core set does not name the editor), `node-seams.ts` → the package's own
  `shared/node/{files,process}.ts`
- Test: `extensions/pipelines/tests/unit/gates/gates-file.test.ts`,
  `packages/editor/tests/unit/suite/node/gates-reader.test.ts` (one new case)

The pipelines also read `gates.json` back (`run-state.ts` line 110, `gateFileSchema`, a keyed `strict` record), so
the file changes shape on both sides at once. Each record keeps every field the pipelines need (`stage`, `files`,
`summary`, `note`, `requestedAt`, `by`); the editor's `z.object` ignores keys it does not know, so they ride along in
the one file. Inside the pipelines a decision stays `pending`; only the file says `open`.

**Interfaces:**
- Consumes: `gateRecordsSchema`, `type GateRecord as EditorGateRecord` from `@automata/editor/gate-records`.
- Produces (in `state.schema.ts`): `type GateFileRecord = EditorGateRecord & Omit<GateRecord, 'id' | 'decision' |
  'decidedAt'>` (the pipelines' own `GateRecord` is unchanged in memory); `gateFileSchema: z.ZodType<{ readonly gates:
  readonly GateFileRecord[] }>`, strict on the pipelines' side; `readGates(json: unknown): Record<string, GateRecord>`
  (the new shape, or once the old keyed one, `open` read as `pending`); `save` writes `{ gates: [...] }` sorted by
  `id`, `pending` written as `open`.

- [ ] **Step 1: Failing tests:** the written file parses with the editor's `gateRecordsSchema`; a `pending` gate is
  written `open` and reads back into the run as `pending`; a run's `stage`, `files` and `by` survive a save and a read;
  (Review Focus 4) the pipelines read an old keyed file and their next save writes the array; the editor's reader given
  the old keyed file rejects with the older-version words, not a Zod dump.
- [ ] **Step 2:** FAIL. **Step 3:** implement; the blockout deletes (and with them the last
  `@automata/3d/level/blockout` import, which 3D 4.1 already removed from core); `dev-tools` moves to
  `tooling/dev-tools` with its own seams. **Step 4:** PASS (pipelines' 235 unit tests minus the blockout ones, counted in the log). The five moves for
  `pipelines` (`features/{audio,narrative,nav,puzzle,systems,gates,mcp}/`, `app/` for the bins) and `dev-tools`.
  **Commit** `refactor(extensions): pipelines without blockout, writing the editor's gate file`

### Task 2.8: The framework's side and the record

**Files:** Modify `tooling/examples-runner/src/catalog.ts` (`EXTENSION_MODULES`, tier `extension`,
`EXTENSION_PACKAGES` = the published extensions of spec 4; `PLUS_MODULES`' `post` is not an extension and goes
unless an example uses it), `tooling/versions/src/stack.ts` (the card points at `extensions/physics`, its tier `'Plus'`
becomes `'Extension'`, and `workspace()` reads `extensions/*` as it reads `packages/*`, so the pin check sees the
extensions' pins), `docs/provenance/sources.md` (the "Extensions" section complete), `README.md` (one paragraph:
what is in `extensions/`). Tests: the catalog's and stack's existing tests, updated first to the new words.

- [ ] **Step 1:** update the catalog and stack tests to expect `extension` and the real list → FAIL. **Step 2:**
  implement → PASS. **Step 3:** `grep -rni "automata-plus\|plus module" packages tooling site agents --include=*.ts`
  → only provenance and history. **Commit** `chore(extensions): the catalog, the stack card and provenance name the
  extensions`

---

## Part B: with the 3D build

Starts per task when the 3D task it names has merged into this branch's base (rebase onto the 3D build's latest).

### Task 3.1: `@automata/3d/timeline` (after 3D 6.3)

**Files:** Create `packages/3d/src/entries/timeline.ts` (re-exports `shared/timeline`'s `Key`, `Ease`, `Mix`,
`Track`, `sample`, `parseEase`, `track`, and `easeSchema`, the Zod schema of `Ease`, exported from
`shared/timeline/ease.ts` if 6.3 left it file-private as `clip.schema.ts`'s `ease` is today); modify
`packages/3d/package.json` (`exports["./timeline"]`, and `automata.simEntries` becomes `["./sim", "./level",
"./timeline"]`: `cutscenes`' schema is a sim file and imports `easeSchema`) and the root `boundaries` script
(`packages/3d/src/shared/timeline` joins the sim list, so the entry a sim may import passes the sim rules). Test
`packages/3d/tests/unit/entries/timeline-entry.test.ts` (each name importable; the entry's import graph reaches only
`shared/timeline`).

- [ ] Failing test, FAIL, implement, PASS; `pnpm boundaries` exits 0. **Commit** `feat(3d): the timeline is an entry`

### Task 3.2: `sectors` reads `af-sector/2` (after 3D 7.1)

**Files:**
- Create: `extensions/sectors/scripts/convert-sector-map.ts` (run once, deleted in the same commit after its output is
  checked in), `extensions/sectors/tests/fixtures/clinic.af-sector.json`
- Modify: `features/level/sim/resolve.ts` (`resolveMap(map: SectorMap)` → `resolveLevel(level: AfSector2)`), the
  checks (`sector-map.schema.ts`'s loop and id checks become `checkLevel`, now `LevelProblem[]` from
  `@automata/3d/level`), the plugin's loader (reads `*.af-sector.json` through `readLevel`),
  `testing/clinic.ts` (`clinicMap()` reads the JSON; `clinicResolved()` and its `ResolvedFixture` stay)

What the clinic needs from `/2`: it uses `zone` on every sector, three `masses`, and on its walls `cut` and `hideFrom`
(besides `thick`, `trimDepth`, `trimTexture`, `handrail`, `frame`, doors and windows, which `/1`'s `AfWall` already
keeps). `/1` has no `zone` and no `masses`, and its `AfWall` is `Omit<WallDef, 'hideFrom' | 'cut'>`. The 3D build's
7.1 adds them to `/2` (spec 9, row 7.1); if 7.1 has merged without them, this task adds them to
`af-sector-2.schema.ts` first, with a migration test, and records it. They are never dropped by the converter: a
resolved map that lost its cuts or masses is a different map.
- Delete: `sector-map.content.ts`, `sector-map.schema.ts`, `load-sector-map.ts`, `clinic.sector-map.toml`; the same
  fixtures in `nav`, `systems`, `narrative`, `cutscenes` switch to the JSON
- Test: `extensions/sectors/tests/unit/level/resolve-level.test.ts`

**Interfaces:**
- Consumes: `AfSector2`, `readLevel`, `LevelProblem` (3D 7.1).
- Produces: `resolveLevel(level: AfSector2): ResolvedMap`; `checkLevel(level: AfSector2): LevelProblem[]`; the queries
  and resource keep their names (`sectorAt`, `InSector`, `resolvedMap`). `Sector` gains `pit: boolean`; `floorAt(p)` is
  `undefined` over a pit, as it is outside the map; a plane floor is read by its `z`.

- [ ] **Step 1: Failing tests:**

```ts
// resolve-level.test.ts runs today's resolve.test.ts cases (sectors, loops and edges in order; points within 1e-12;
// colliders; masses) on resolveLevel(readLevel(clinicJson).level) against clinicResolved(), the fixture's own
// field-by-field form: ResolvedMap holds functions (sectorAt, floorAt, segmentBlocked), so a deep-equal cannot work.
it('keeps the clinic’s cuts, zones and masses through /2', () => {
  const level = readLevel(clinicJson).level
  expect(level.sectors.map((s) => s.zone)).toEqual(clinicMap().sectors.map((s) => s.zone))
  expect(level.masses).toHaveLength(3)
})
it('a pit is where the floor ends', () => { /* Review Focus 1: pit: true → sector.pit, floorAt(inside) undefined */ })
it('reports a sloped floor instead of reading it flat', () => {
  // Review Focus 1: floor { z: 0, slope: [0.1, 0] } → problems contain { code: 'sloped-floor', where: 'ramp' }
})
it('reports a level it cannot resolve as a LevelProblem, without throwing', () => { /* a wall's next names no room */ })
```

- [ ] **Step 2:** FAIL. **Step 3:** run the converter on `clinic.sector-map.toml`, check the JSON in, delete the
  converter, then implement. **Step 4:** PASS; every parity golden in `sectors`, `nav`, `systems`, `narrative`,
  `cutscenes` byte-identical. **Commit** `feat(sectors): the level's sim side reads af-sector/2`

### Task 3.3: `cutscenes` takes the director (after 3D 6.3, 7.2 and 7.4 as shrunk)

**Files:**
- Create: `extensions/cutscenes/src/features/director/{director.ts,scene-state.ts,sequence.ts}`,
  `extensions/cutscenes/tests/fixtures/frames.json` (Plus's `evaluate` frames of the four converted scripts every
  0.1 s, written **before** any code changes, by a one-off script in the session scratchpad)
- Modify: `features/script/sim/cutscene.schema.ts` (gains `doors`, `time`, `grade` and `props` tracks and cues
  `{ at: number; who: string; clip: string }`; its own `Ease`, `EASES` and ease enum go for `easeSchema` from
  `@automata/3d/timeline`), the four fixtures' 13 `ease = "out"` keys (below), the lints (`lint.ts` reads the
  director instead of `evaluate`; a track naming a piece the level lacks)
- Delete: `features/play/evaluate.ts` and its eases; the `./play` export (its one reader is `lint.ts`)
- Test: `extensions/cutscenes/tests/unit/director/*.test.ts`

Two easings meet here and must not change a frame. Plus's `in` is `t²`, `out` is `t(2 − t)`, and a key with no ease is
`smooth` (`t²(3 − 2t)`); AF's `in`, `out` are CSS's curves and no ease is linear. So: a cutscene key with no ease
compiles to `smooth` (the cutscene schema's documented default, unlike a clip's); `smooth` and `linear` are the same
functions on both sides; the 13 `out` keys in the four fixtures become the exact quadratic as a cubic-bezier,
`[1/3, 2/3, 2/3, 1]` written as decimals (none uses `in`; its equivalent is `[1/3, 0, 2/3, 1/3]`); a camera key's
`cut: true` compiles to `step`. The director keeps every rule of `evaluate` that is not key lookup and easing: facing
switches half way, the shake and shiver sines, flicker windows, fades, prop states and how long each has held.

**Interfaces:**
- Consumes: `Track`, `Mix`, `sample`, `Ease`, `easeSchema` (3.1); `PieceStates`, `LampState`, `PropState` from
  `@automata/3d` (3D 7.4 shrunk); `LintWorld` (today's, built from the resolved level of 3.2) for the lints.
- Produces: `createDirector(script: PlacedScript, startClip: (who: string, clip: string, atTick: number) => void):
  Director` (`PlacedScript` from `placeScript`, as `evaluate` takes today); `Director.stateAt(t: number): SceneState`;
  `SceneState extends PieceStates { camera: { pos: V3; look: V3; fov: number }; actors: Record<string, ActorFrame>;
  caption: Caption | null; flicker: boolean; fade: number; done: boolean; states: string[]; held: Record<string,
  number>; time: string; grade: string }`: every `CutsceneFrame` member under its name, with `light` now the
  `lamps` of `PieceStates`.

- [ ] **Step 1: Failing tests** (the 3D plan's 7.4 cases, moved, plus Review Focus 2):

```ts
it('a state at t comes from the keys alone', () => {
  expect(createDirector(script, noop).stateAt(1.5)).toEqual(createDirector(script, noop).stateAt(1.5))
})
it('a cue starts its clip at its tick', () => {
  const calls: unknown[] = []; const d = createDirector(cueAt(2, 'wick', 'reach'), (...a) => calls.push(a))
  d.stateAt(1.9); expect(calls).toEqual([]); d.stateAt(2); expect(calls).toEqual([['wick', 'reach', 2]])
})
it('holds the last values after the last key and the first before the first', () => { /* t = -1, t = end + 5 */ })
it('plays the four scripts as before', () => {
  // every frame of tests/fixtures/frames.json: numbers within 1e-9, everything else equal
})
it('lints a door the level lacks, by name', () => {
  expect(lintCutscene(withDoorTrack('door-9'), clinicWorld)).toContainEqual(expect.objectContaining({ name: 'door-9' }))
})
```

- [ ] **Step 2:** FAIL. **Step 3:** implement; the sim plugin is unchanged. **Step 4:** PASS; the four converted
  fixtures' sim hashes unchanged; `lintCutscenes` gives the same findings on them as before (recorded with the
  frames); `grep -rn "type Ease\b" packages/3d/src extensions` → only
  `packages/3d/src/shared/timeline/ease.ts`. **Commit** `feat(cutscenes): scripted scenes on the one timeline`

### Task 3.4: The base 3D game reads its level through `sectors` (after 3.2)

**Files:** Modify `games/base-3d/package.json` (`@automata/sectors`), `games/base-3d/src/content/levels/sector-area.ts`
(today `areaFromSector` reads the file's sectors itself into the `AreaSource` boxes the game's systems collide with;
it becomes `areaFromResolved(map: ResolvedMap, options: SectorAreaOptions): AreaSource`, its room and wall boxes from
`resolveLevel(readLevel(file).level)`'s sectors, edges and pits), `src/content/room.ts`. The systems (`area.ts`,
`hero.ts`) keep reading `AreaSource`: the sectors plugin and its Rapier colliders are not wired in, which would change
how Wick moves. Test: `sector-area.test.ts` (unchanged cases), base-3d's golden replay.

- [ ] **Step 1:** record the golden replay hash before. **Step 2:** switch. **Step 3:** `pnpm --filter
  @af-games/base-3d test:unit` and the golden replay → same hash. If it differs: stop, revert, and record both readings'
  difference in the log for the build audit (never re-record). **Commit** `refactor(base-3d): the sim reads its level
  through sectors`

### Task 3.5: `examples/3d/cutscene.ts` (after 3.3 and 3D 12.1)

**Files:** Create `examples/3d/cutscene.ts` (`// --- <role> ---` sections; a door opens, a lamp warms, Wick reaches);
modify `examples/3d/README.md`, the runner's list. Test `examples/3d/e2e/cutscene.e2e.ts` (boots, reaches ready, the
door's state after the scene is open).

- [ ] Failing journey, FAIL, implement, PASS in Chromium. **Commit** `feat(examples): a cutscene in 3D`

---

## Part C: closing

### Task 4.1: The publish set

**Files:** Modify `.changeset/config.json` (`fixed` gains `@automata/{physics,feel,audio-synth,debug,puzzle,net,
net-ui,net-server,ui-screens}`), those nine manifests (`"private"` removed, `publishConfig` as core's,
`version` as the group's), `.changeset/extensions-public.md`, `tooling/release/src/publishable-packages.ts` (`GROUPS`
gains `extensions`: it lists the folders by hand, and `check-changesets`, `api-index`'s entry points and the
consumer smoke all find packages through it). Tests: `tooling/release/tests/unit/publishable-packages.test.ts` (expects the nine),
`pnpm check:changesets`.

- [ ] Failing test, FAIL, implement, PASS; `pnpm build && pnpm api-report --update && pnpm api-index --write && pnpm
  agent-skills`; the consumer smoke packs the nine (`pnpm test:e2e --filter @automata/consumer-smoke`).
  **Commit** `chore(release): the free extensions publish with the framework`

### Task 4.2: Tracking and handover

- [ ] `docs/refactor/plus-progress.md`: stage 4 done with counts; execution log complete;
  `docs/refactor/2026-11-07-3d-slice-plan.md`'s "Notes from the automata-plus audit" replaced by the rulings of spec 9
  if the 3D build has not already.
- [ ] The Owner's list in the PR body: archive `mcthaydt/automata-plus` (and its parked server-deploy branch), WebKit
  and Firefox parity on the Mac, the release run.
- [ ] **Commit** `docs(refactor): Plus port build done`

## Self-review (writing-plans, 2026-11-07)

- **Spec coverage:** spec 4 → 1.1, 2.2 to 2.7; spec 5 P-D2/P-D3 → 1.1, 4.1; P-D4 → 2.6, 3.2, 3.4; P-D5 → 3.1, 3.3;
  P-D6 → 2.7; P-D7 → 1.2; P-D8 → 2.3, 2.4; P-D9 → 1.3, 2.1, phase 2's moves; P-D10 → 1.1 (starter), 2.5, 2.7; P-D11 →
  2.7; spec 6 → 1.3, 2.1, phase 2; spec 7 → 3.1 to 3.4; spec 8 → 1.2, 1.3, 2.7, 2.8, 3.1; spec 9 → the coordinator's
  hand-off and 4.2; spec 13 → each task's verify step and 1.4.
- **Gap left on purpose:** spec 7.2's `PieceStates` is made by 3D 7.4 as shrunk (spec 9), not here; if the 3D build
  has not made it when 3.3 starts, 3.3 makes it in `packages/3d/src/shared/level/piece-states.ts` first.
- **Types:** `resolveLevel`, `LevelProblem`, `createDirector`, `SceneState extends PieceStates`, `Clock`, `NetError`,
  `gateRecordsSchema` are named the same in every task that uses them.
- **Proportion:** the moves are written once (phase 2 preamble) and the code is left to the signatures and tests.

## Stage 3 plan audit (2026-11-07)

Audited with the superpowers plugin (`writing-plans`' self-review checklist) against #457's head (`6ddc3180`), Plus at
`1766c622` and the 3D plan; the record and its 16 findings are
[2026-11-07-plus-port-plan-audit.md](2026-11-07-plus-port-plan-audit.md). Every fix is in the tasks above; the build
reads only this plan and the spec. One fix belongs to the 3D build (its task 7.1 adds `zone`, `masses`, `cut` and
`hideFrom` to `af-sector/2`; spec section 9), and task 3.2 covers it if 7.1 lands without it.

## Execution log

(The build writes one entry per task: counts, rulings, deviations with evidence.)
