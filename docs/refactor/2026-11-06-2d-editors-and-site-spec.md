# 2D editors and website refactor: spec

- **Stage:** 2 of 6 of the "2D editors and website" slice (plan and spec). The plan that carries this out is
  [2026-11-06-2d-editors-and-site-plan.md](2026-11-06-2d-editors-and-site-plan.md); the facts behind it are in the
  [audit](2026-11-06-2d-editors-and-site-audit.md). Finding IDs (E1 to E7, S1 to S7, K1, K2, T1 to T5, G1 to G5, W1 to
  W9, WS1 to WS6, WT1, WT2, WG1 to WG4) point at the audit.
- **Date:** 2026-11-06, written on `claude/project-thread-y6u4wj`, stacked on the audit branch
  `claude/project-thread-mndkqi` (PR #405), which sits on the core-and-2D stack (#388 to #403).
- **The Owner's direction (2026-11-06):** "we do the editor refactors that 2D touch and website refactor as if it's
  ready to ship with 2D alone, then we do the same for 3D".
- **Decisions it builds on:** the Owner took all eight of the audit's recommendations on 2026-11-06 ("Go with all
  recommendations"): D1 to D8 option A each (section 7 of the audit). D8's inputs are still the Owner's to supply.
- **Added by the Owner (2026-11-06):** "We also need to completely redesign the editors for ux, copy, and ui - it looks
  amatuerish; it should have the design aesthetic of the website". Section 11 is that redesign.
- **Status:** drafted, and not final. On 2026-11-06 the Owner widened the slice ("we need to audit the other automata
  things too then; basically everything but 3D and editors (non-2D, we're addressing that already)"). A separate audit
  of the rest of AF for a 2D ship is running; its findings are folded in here (section 16) and in the plan before stage
  3 reviews them. Nothing here is built.

## 1. What done looks like

The slice is finished when all of these are true, each checked by a command or by the Owner:

1. **A person who has never seen the repository can make a 2D game and edit its level.** In a fresh folder:
   `npx @mcthaydt/automata-tools create-game my-game`, `pnpm install`, `pnpm exec automata editor` opens the 2D editor
   on the new game's starter level, Save changes the game, and `pnpm dev` shows the change. A Playwright journey runs
   these steps against packed tarballs on every pull request (section 9). (E2, E3, E4)
2. **Save in the editor changes the game.** On a checkout, Save writes the level project and the game files the game
   reads, together. `automata check` fails when they disagree. (E1, K1, T5, G1)
3. **The editors are one private package, `packages/editor`, grouped by feature, with tests in `tests/`.**
   `editor-3d` stays its own package and plugs in. (D6, S1, S4, T4)
4. **A 2D build of anything holds no `@pixi/3d`.** The editor build inside `-tools`, the suite's default build and the
   site build are scanned, and the scan fails the build. (E7, seam 5)
5. **The 2D gate runs every 2D editor test.** `pnpm check` runs the editor's unit tests; the pull request gate runs its
   browser tests (Chromium, WebKit, Firefox for layout) and its journeys (Chromium and WebKit). A red 3D suite cannot
   hide a red 2D editor. (T3)
6. **The website lives in this repository as `site/`**, builds from the framework's current code at build time, and
   breaks in the same pull request as the code it describes. No sync script, pin, deploy key or committed demo build
   is left. (D1, W3, W4, W7, WS1, WS3)
7. **The site has the lean page set** (section 10) and every page describes the code as it is: Start begins with
   `create-game`, the home page walks through files that exist, the editor page lets a visitor try the editor. (D7,
   W1, W2, W8, WS4, WG2)
8. **No page or file a visitor can open links to the private repository.** A test fails the site build on a
   `github.com/mcthaydt/automata-framework` link while the repository is private. (W6, D2)
9. **The packages are ready to publish on npmjs.org.** `pnpm pack` of each published package installs and runs in the
   consumer smoke from a plain npm registry layout; the first real publish is the Owner's (D2, D8).
10. **The 2D editor is redesigned in the website's look** (section 11): one token source for the site and the editor,
    every screen rebuilt to the new layouts, and its copy rewritten. The Owner sees the before and after screenshots of
    every screen at phone, iPad and desktop sizes in the redesign pull requests.
11. **Everything a person sees in the editor and on the site passes the drunk grandma test** (section 11.5).
12. **The site is deployed at the Owner's domain** (the Owner's inputs, D8). This is the only criterion that waits on
    the Owner; every other one is done without them.
13. **`docs/refactor/progress.md` says 100% for this slice.**

What does *not* change: the editor kit's iPad gestures and its document model (autosave, recovery, history,
conflicts), the 2D editor's file format
(`.af2d.json`, `af2d-content` version 1), `automata editor`'s server rules (loopback, token, `Host` check, mtime
guard), the core packages' public API except the new `level-2d` entry (section 5), the site's browser gates (horizontal
scroll, console errors, third-party requests, axe, focus rings) and its playground. These are the parts the audit says
to keep (T1, section 7 of the audit, WG4).

## 2. Scope

**In:** `packages/editor-kit`, `packages/editor-2d`, `packages/editor-suite` (the shell, Levels 2D, the Tuner, the
Node adapters, the sample mode), `automata editor` and `create-game` in `packages/tools`, the editor list format,
`docs/guides/editor.md`, `docs/design/editor-kit`, `editor-2d` and `editor-suite`, Emberwick's level kinds, the
release configuration for npmjs.org, and the whole website repository.

**Touched only to keep them building:** `packages/editor-3d` (its imports of the kit, rewritten by codemod, and the
Studio and Levels 3D, which move into it from the suite, section 3.4). Its own code is not restructured; its tests
still run, in the 3D workflow. Its refactor is the 3D slice.

**Out:** the 3D slice (`editor-3d`'s inside, the Studio's inside, `render-pixi3d`, `figures`, `sector-format`,
`games/base-3d`, `vendor/pixi-3d`, 3D pages); shipping the suite (D3: it waits for 3D, when there are two level
editors to hold); wiring the suite's Ship, Ask, checks and gates (E6: they move with the suite and stay unwired);
making the repository public (D2); new editor features beyond Save writing the game and what the redesign needs;
redesigning `editor-3d`'s screens (it picks up the new tokens, section 11.6, and is redesigned in the 3D slice); Plus;
the paid editor apps.

## 3. The editor package (D6)

### 3.1 One package

| Package | Folder | Runs in | Made from | Published |
|---|---|---|---|---|
| `@mcthaydt/automata-editor` | `packages/editor` | browser; its `editor-list` and `level-export` entries also in Node | `editor-kit`, `editor-2d`, `editor-suite` (less the Studio and Levels 3D) | no (private); its 2D build ships inside `-tools` (section 7) |
| `@mcthaydt/automata-editor-3d` | `packages/editor-3d` | browser | today's `editor-3d`, plus the Studio and Levels 3D from the suite, plus the full suite page | no |

The packages `editor-kit`, `editor-2d` and `editor-suite` stop existing. Dependencies point one way:
`editor-3d` → `editor` → `@mcthaydt/automata`, `-content`. `editor` never imports `editor-3d`, `render-pixi3d`,
`figures` or `@pixi/3d`, and `pnpm boundaries` says so (section 3.5).

One `package.json`, one `tsconfig.json`, one Vite config, one `vitest.config.ts` (a call to the repository's
`defineTests` preset), and the root's Biome config and licence. The package pins the root's TypeScript (7.0.2); if
`svelte-check` refuses it, the package keeps 6.0.3 and the plan's execution log says why (S4).

### 3.2 Entry points

Each entry is a file in `src/entries/`. The names map one to one from today's, so the codemod is a table:

| Entry | Today | Who imports it |
|---|---|---|
| `./kit` | `@mcthaydt/automata-editor-kit` | `editor-3d` |
| `./kit/core`, `./kit/documents`, `./kit/fields`, `./kit/ports`, `./kit/ports/testing`, `./kit/testing`, `./kit/journey-project` | the kit's subpaths | `editor-3d` |
| `./tokens.css`, `./fonts.css` | the kit's | `editor-3d` |
| `./suite` | `editor-2d/suite`, the suite shell (`createSuite`, `startSuite`) and the Tuner | `editor-3d`'s full suite page (section 3.4) |
| `./editor-list` | `editor-suite/core` (the editor list: `loadEditorList`, `fileAccess`) | `-tools` (bundled), `automata check` |
| `./level-export` | `editor-2d/src/profiles/level-project` (open a project, export its game files), headless | `-tools` (bundled), `automata check` |

`editor-2d`'s root entry (172 lines of names nobody imports, S3) and the suite's `./node` entry are not carried over:
the Node adapters move inside `features/suite/` and are imported by nothing outside it, as today (E6). knip then
reports them if they stay unused after the 3D slice.

### 3.3 Inside the package: features

The core packages' layout (core-and-2D spec, section 3.3), with editor names. The feature folders take the redesign's
names (section 11.4) when they are made, so nothing is renamed twice; the views' labels on screen change in phase 9:

```
packages/editor/
  index.html            the 2D editor's page
  suite.html            the suite's 2D-only page (not shipped, section 3.4)
  src/
    app/                the composition roots: the 2D editor's boot and the suite's boot. Wires features together.
      editor-2d/        boot.ts, App.svelte, editor-app.ts, profiles.ts, main.ts (the only file that reads globals)
      suite/            main.ts, the 2D-only editor list
    features/           one folder per thing a person sees and does
      home/             the project list, templates, recovery
      document/         the open document: its bar, the view rail, the router, autosave, the save and conflict flow
      level/            the Level view: tools, brush, layers panel, inspector
      map/              today's World view
      tiles/            today's Tilesets view
      characters/       today's Entities view and its field editors
      problems/         today's Checks view (a sheet after the redesign, section 11.4)
      share/            today's Export view (Download, Share, Copy) and "Write to folder"
      suite/            the suite shell, rail, pills, Review, Import/Export, Ship, Ask, its Node adapters, the Tuner
    shared/
      kit/              today's editor kit: commands, documents, fields, gestures, history, keymap, ports, selection,
                        shell, storage, tokens, widgets, dialogs, fonts (dimension-neutral, the same rule as today)
      level-2d/         the 2D model (project types, schema, codecs, grid, commands, migrations), the canvas (Pixi
                        drawing, thumbnails, textures), tiles and auto-tile, the level-project profile and its export
      editor-list/      the editor list format (`editors.toml`), glob matching, write paths
    entries/            the published entry files (section 3.2), re-exports only
    testing/            the test helpers `./kit/testing` and `./kit/journey-project` publish, and the fakes the
                        features' tests share
  tests/
    unit/<feature>/     Node, or jsdom when the file starts with `// @vitest-environment jsdom`
    browser/<feature>/  real browsers: layout (Chromium, WebKit, Firefox), canvas (Chromium, WebKit),
                        journeys (WebKit with the iPad context, Chromium)
    e2e/                Playwright against `automata editor` (section 9)
    fixtures/           data and Svelte test hosts
```

The rules are core's, enforced by `pnpm boundaries --features packages/editor`:

1. A feature imports its own files, `shared/`, other packages' public entries and third-party packages. Never another
   feature, `app/` or `entries/`.
2. `shared/` imports only `shared/` and outside packages. `shared/kit/` imports nothing from `shared/level-2d/` or
   `shared/editor-list/` (it stays dimension-neutral: seam 4).
3. `app/` may import features and shared. Only `entries/` and `testing/` import `app/`.
4. `entries/` re-exports only.

Where two features meet today (the Level view opens the Entities view's field editor; the document bar runs the
export on Save, section 6), `app/editor-2d/` passes the function in. The Entities view's field editor, used by the Level
view's inspector too, is `shared/kit/fields` already, so most meetings need nothing new.

### 3.4 The suite without 3D (D3, E5, E7, S2)

The suite does not ship in this slice, but its default build must stop carrying 3D, because a 2D build with a closed
beta inside is one `cp` from being hosted:

- `packages/editor/src/app/suite/main.ts` registers the editors this package has: Levels 2D and the Tuner. Its build
  (`suite.html`) holds no `@pixi/3d`, and the closed-beta scan (section 7.3) runs on it.
- The Studio (`editor-suite/src/editors/studio`) and Levels 3D (`editor-3d/src/ui/suite`, already in `editor-3d`) are
  registered by `editor-3d`'s own suite page, `packages/editor-3d/suite.html`, which imports `createSuite` from
  `@mcthaydt/automata-editor/suite` and adds its editors to the list. `automata editor --app suite` serves that build
  from a checkout, as today.
- The rail lists only the editors registered in the build (`SUITE_ENTRIES` becomes the registered list), and Cmd 1 to
  9 follow it. The "It comes with the Plus editors (editor-plus)" card goes (S2, G4).
- The page opens the sample game only when no checkout answers `/api/ping`. Served by `automata editor` it opens the
  checkout through the kit's HTTP store, as the 2D editor does (E5). The top bar's "No change set", "No checks run",
  "Gates not readable" and Ship stay as they are; their copy and wiring are the 3D slice's (G2, E6).

### 3.5 Boundaries and style

`package.json`'s scripts grow:

- `boundaries`: `--features packages/editor`; and a new `--forbid packages/editor:@pixi/3d,@mcthaydt/automata-editor-3d,@mcthaydt/automata-render-pixi3d,@mcthaydt/automata-figures`
  (a package may not import the named modules, type imports included). One small rule in `tooling/check-boundaries`,
  tested like its others.
- `style`: `packages/editor` joins `--plan-comments`, `--comments-only` and `--test-imports`. Every `.svelte` component
  is kebab-case-exempt as today (PascalCase is Svelte's convention, and the rule already allows it).
- `knip`: `packages/editor` as a workspace with its entries (`src/entries/*.ts`, `src/app/*/main.ts`).

## 4. Tests and gates (T2, T3, T4)

**Layout:** section 3.3's `tests/` tree. One suffix (`*.test.ts`, `*.svelte.test.ts` for runes); the folder says the
kind. The 15 suffixes go (`.dom`, `.layout`, `.canvas`, `.journey`, `.parity`, `.codec-bug`, ...). Svelte test hosts
(`*.test.svelte`, `FakeLevelCanvas.svelte`, `ShellProbe.svelte`) sit in `tests/fixtures/` or, when a published helper
uses them, `src/testing/`. Tests import through `#src/...`. The core slice's `tooling/codemods` `move-tests` does the
move; the editor needs its suffix table added (task 2.3).

**The preset:** `defineTests` gets what the editor needs and nothing more: `browserProjects`, a list of named browser
projects each with its own folder glob and engines (`layout` in all three, `canvas` and `journeys` in Chromium and
WebKit), because the editor's canvas tests need WebGL2 and its journeys need the iPad context
(`kit/journey-project`). Packages that pass nothing keep today's single `browser` project.

| Gate | Runs | When |
|---|---|---|
| `pnpm check` | lint, typecheck, boundaries, style, knip, every core and 2D `unit` project **including `packages/editor`**, changesets | every PR |
| `pnpm test:browser:2d` (was `:core`) | core and 2D browser projects, **including the editor's layout, canvas and journeys** | every PR touching core, 2D or the editor |
| `pnpm test:e2e` | Emberwick's and the examples' journeys, `create-game`'s journey, **the editor's journeys (section 9)** and **the site's (section 10.4)** | every PR |
| 3D workflow (`3d.yml`, was `3d-and-editors.yml`) | `editor-3d`, `render-pixi3d`, `figures`, `sector-format`, `base-3d`, the 3D examples | PRs touching 3D files or what they import; not required |

`test:unit:core` becomes `test:unit:2d` and its filter drops `./packages/editor-*` for `./packages/editor-3d`. The
`:3d` scripts filter `editor-3d` instead of `editor-*`. `ci.yml`'s `unit` and `browser` jobs gain nothing new: the
filters do it. Its `e2e-2d` job adds the editor and site Playwright configs.

## 5. One owner for the 2D level contract (D5, K1)

The game-facing level format (`af2d-content` version 1: `project.toml`, `levels/<id>.toml`, `world.toml`) moves from
the editor to `@mcthaydt/automata-content`, a new browser-safe entry `./level-2d`:

```ts
// @mcthaydt/automata-content/level-2d
export const levelContentSchema, projectContentSchema, worldContentSchema  // today's strict content.schema.ts
export type ContentLevel, ContentProject, ContentWorld, ...                // written out (isolatedDeclarations)
export function level2dKinds(options?: { folder?: string }): ContentSchema[]  // the three defineContentSchema kinds
export function intGridRows(level: ContentLevel, layer: string): readonly (readonly number[])[]  // decode a layer
export function entitiesOf(level: ContentLevel, layer: string): readonly ContentEntityItem[]
```

- **`content.schema.ts` moves whole**, with the parts of the kit's field schema it needs (`fieldDefSchema`,
  `fieldValuesSchema` and the types and checks they call: `field-types.ts`, `field.schema.ts`, `check-field-def.ts`,
  `check-field-value.ts`, 439 lines). The kit's `fields` re-exports them from `-content`, so there is one copy. The
  Svelte field editors stay in the kit.
- **`level2dKinds()`** returns the kinds Emberwick declares by hand today (`games/emberwick/src/shared/kinds.ts`):
  `levels` (in the sim's content), `project` and `world` (`sim: false`). With the strict schemas, so a level the
  editor did not write fails the content compiler with the schema's message.
- **`intGridRows` and `entitiesOf`** replace each game's own run-length decoding (Emberwick's `level-room.ts`
  `decodeRow`). They live in a sim-safe file, so a game's sim may import them: `-content` declares `./level-2d` in
  `"automata": { "simEntries" }` and the file passes the sim rule (no `Math.random`, no `Object.keys`, etc.).
- **Emberwick** deletes `shared/kinds.ts` and its `LevelLike` type, and reads its room through `level2dKinds()`,
  `intGridRows` and `entitiesOf`. Its golden hash must not change (the sim receives the same values); if it does, the
  change is investigated, never re-recorded.
- **The editor** imports the schemas from `-content/level-2d` in its export and its tests. The editor's own format
  (`.af2d.json`, its schema and migrations) stays in the editor (seam 2).

`-content` gets a `patch` changeset, and the API report is updated (`pnpm api-report --update`, `pnpm agent-skills
--write`).

## 6. Save writes the game (D5, E1, E3, G1)

### 6.1 Where the game files go

A level project's row in `content/editors.toml` names the folder its game files go into:

```toml
[[file]]
glob = "content/rooms/*.af2d.json"
editor = "levels-2d"
modes = ["edit"]
exports = "content"          # new: project.toml, world.toml and levels/<id>.toml are written under content/
checks = ["content"]
```

- `exports` is optional in the editor list schema (`shared/editor-list/editors.schema.ts`); the format stays
  `af-editors/1` (an optional field is additive).
- **The policy** (`-tools` `editor-policy.ts`) lets a browser write `<exports>/project.toml`, `<exports>/world.toml`
  and `<exports>/levels/*.toml` for every row that names `exports`, and nothing else new. `fileAccess` gains the rule
  in `shared/editor-list`, so the suite and the server agree.
- **One project per `exports` folder.** Two rows whose globs match more than one project and share an `exports` folder
  make the list fail to load, with "Two level projects would write content/project.toml. Give each its own exports
  folder." The editor shows the list's problem, as it does for any list that fails.

### 6.2 What Save does

On a checkout (the kit's HTTP store) with a row that names `exports`:

1. Save exports the project (the same `content-export.ts` code the Export view uses) and writes, in order, the game
   files, then the project file. Each write is guarded by the mtime the editor last saw (`writeToFolder`, `guarded`).
   The project file goes last, so a project on disk is never newer than its game files.
2. A conflict on any file stops the save before anything is written and opens the conflict dialog the editor already
   has ("This file changed on disk since you opened it."), with Keep mine and Use theirs.
3. A failure part-way (disk full, permission) leaves the files already written, shows the store's message and keeps
   the document dirty; the next Save writes everything again. The check (section 6.3) catches anything left
   half-written.
4. The Save button says "Saved" once all are written (G1; section 11.4 gives it the glow). Home's "Kept in your game's
   checkout, on the computer running automata editor" becomes "Saved in your game folder".

In browser storage (the site's try-it, or a checkout with no `exports` row), Save writes the project only, as today,
and Download, Share and Copy stay (in the Share menu after the redesign). "Write to folder" is offered only where Save does not already
write the game files (it is then redundant), so "Open a game folder to write into it." no longer shows on a checkout.

### 6.3 The drift check

`automata check` gains a `levels` step, in `-tools` `shared/check`, using `@mcthaydt/automata-editor/level-export`
(bundled into `-tools`, as the editor list is today): for each row with `exports`, open each matching project, export
it, and compare the bytes with the files on disk.

```
content/levels/room-1.toml does not match content/rooms/room-1.af2d.json.
Open the level in the editor and press Save.
```

It runs in `automata check` by default and in `pnpm check` for Emberwick (its `check:example` script). A project that
fails to open is reported with its first problem and the same last line.

### 6.4 A new game has a level (E3)

`create-game` writes, besides the role files:

- `content/editors.toml` with one `levels-2d` row (`exports = "content"`);
- `content/levels/start.af2d.json`, a platformer-template project with one level, a collision layer with a floor and
  a player start, and its exported game files (`content/project.toml`, `content/world.toml`,
  `content/levels/start.toml`), written by the same export code at template-build time and checked in as a template
  fixture in `-tools` (a test regenerates and compares them, so they cannot drift);
- a template sim that reads that level through `level2dKinds()` and `intGridRows`, so the walls and start the editor
  draws are the walls and start the game plays.

Without `content/editors.toml`, the policy fallback narrows from "every `.json` outside tool folders" to
`**/*.af2d.json` read and write, nothing else (E3).

## 7. The editor ships inside `-tools` (D4, E2, E4)

### 7.1 The command

- `automata editor` opens the 2D editor by default (`--app` defaults to `2d`). `--app 3d` and `--app suite` stay, and
  serve a checkout's build of `editor-3d` (they are for the repository's own developers until the 3D slice).
- The build it serves: `--app-dir` when given; otherwise `2d` is the copy inside `-tools` (`dist/editors/2d/`), found
  next to the running bin; `3d` and `suite` are the repository's build, found as today. A missing `3d` or `suite`
  build says "The 3D editor is not in this release yet." outside a checkout.
- It runs from source in the repository (`node packages/tools/src/app/bin.ts editor`), because the editor list and the
  level export are imported from `-editor`'s `.ts` entries with extensions (the suite's extensionless imports are
  rewritten in the package merge; B4 of the build audit already makes the command load lazily). A test spawns the
  source bin.
- The usage text and messages pass section 11 ("Serves an editor against the game checkout" becomes "Opens the level
  editor on your game, until you press Ctrl+C.").

### 7.2 Packaging

`-tools`' build runs after `editor`'s build (turbo `dependsOn`) and copies `packages/editor/dist/2d` into
`packages/tools/dist/editors/2d`. `files` already publishes `dist/`. The copy is about 1 MB (the 439 kB main chunk and
Pixi's chunks); the consumer smoke records the packed size, and a budget fails the build above 3 MB.

### 7.3 The closed-beta scan (seam 5)

One function, `findClosedBeta(dir)`, in `-tools` `shared/ship` (where `ship prepare` already refuses `@pixi/3d` in a
public game bundle), is reused by three callers: `ship prepare` (unchanged behaviour), `-tools`' build after the copy,
and the site's build (section 10.3). Each fails with "This build contains the private Pixi 3D beta (<file>). It cannot
be published." A unit test feeds it a fixture with the beta's marker; the suite's 2D build and the editor build are
scanned in CI.

## 8. Publishing on npmjs.org (D2)

- Every published package's `publishConfig.registry` becomes `https://registry.npmjs.org`, with `access: public`
  (`.changeset/config.json` `"access": "public"`). `release-packages.yml` sends `NPM_TOKEN` to npmjs.org and drops the
  GitHub Packages `.npmrc` step. The consumer smoke's `--from registry` mode reads the registry from an environment
  variable, so it can run against a local Verdaccio in CI before the first real publish.
- The packages' `repository`, `homepage` and `bugs` fields point at the site, not the private repository, until it is
  public. READMEs link to the site's docs.
- The old GitHub Packages names are deprecated after the first npmjs.org publish (the Owner's: it needs the token).
- The first publish and its release approval are the Owner's (D8). Everything up to `changeset publish --dry-run`
  against Verdaccio is done in this slice.

## 9. Real journeys (T2)

`packages/editor/tests/e2e/`, with its own `playwright.config.ts` (the core slice's `tooling/playwright-preset`),
projects `editor-ipad-webkit`, `editor-ipad-chromium` and `editor-phone-chromium`. Each journey works on a temporary
copy of a game, never the checkout itself, and starts the real command:

| Journey | Steps | Proves |
|---|---|---|
| Save reaches the game | copy Emberwick to a temp folder; start the built `automata editor` on it; open the room; paint a solid cell on the collision layer with real pointer events; Save; read `content/levels/room-1.toml` on disk and see the cell; run `automata check --only levels` and see it pass; start Emberwick's dev server on the copy and read the room through its test hook | E1, G1, T5 |
| Drift is caught | in the copy, edit `content/levels/room-1.toml` by hand; `automata check --only levels` fails with section 6.3's message | T5 |
| A conflict stops the save | open the room; change the project on disk; paint and Save; the conflict dialog shows; Keep mine writes both files | section 6.2 |
| A new game opens in the editor | `create-game` from the packed `-tools` tarball into a temp folder; install; `automata editor` (no flags) opens the 2D editor on `start`; paint, Save; the game's dev server shows the wall | criterion 1, E2 to E4 |
| The suite opens the checkout | `automata editor --app suite` on the copy (from the repository build); the page says "Emberwick", Levels 2D lists the room, no "Sample game" | E5 |

The suite journey runs in Chromium only and is not in the iPad set. The editor's Vitest browser journeys (today's ten
`*.journey.test.ts`) stay as browser tests: they test gestures, which these do not.

## 10. The website (D1, D7)

### 10.1 It moves in

- `git subtree add --prefix site` of `automata-website`'s `main`, so its history is kept, then one commit per change.
  `site/` joins `pnpm-workspace.yaml` as `@mcthaydt/automata-site` (private). The old repository is archived by the
  Owner after the move merges (a repository setting).
- **Imports, not copies.** The site depends on the workspace packages it shows (`@mcthaydt/automata`, `-content`,
  `-tools` for the editor build, `tooling/examples-runner` for the playground protocol, `tooling/api-index` for the
  API data). Docs are read from `docs/guides/` at build time. Demos (the examples and Emberwick) are built by turbo
  before the site and copied into its build output, never into git.
- **Deleted:** the ten sync scripts and their helpers (1,081 lines), `framework.ref`, the read-only deploy key and the
  CI step that clones the framework, `static/demos/` (7.3 MB) and the generated playground runtime (2.0 MB), committed
  `llms*.txt` and API JSON (made at build time), the double-jump `workshop/` (its lesson moves to Start as a code
  sample that the site's tests compile against the current API), `restorations.ts`, the evidence schema and Proof
  page, the release manifests, the rollback rehearsal, the uptime and deployed-site checks, the Lighthouse baseline
  test (Lighthouse stays as a report), and every test that pins history ("expected red until DX.11") (WS1 to WS3).
- **Tooling:** the root's Biome, the root's exact pins (Vite 8, SvelteKit's latest 2.x that runs on Vite 8, the Svelte
  plugin 7, Zod 4.6.6), `tsx` replaced by Node's own TypeScript (`node file.ts`, as the framework's scripts run) (WS6).

### 10.2 The pages (D7)

| Page | Route | What it does | From today's |
|---|---|---|---|
| Home | `/` | What AF is in one screen; Emberwick playable inline; "Make a game" to Start; a short walk through three real files of the starter game (`create-game`'s output, read at build time) | Home (W2 rewritten) |
| Start | `/start` | Make a game (`npx @mcthaydt/automata-tools create-game`), play it, edit its level, publish it to the web or itch.io; each step one command and what you see | Start (W1), the workshop |
| Examples | `/examples`, `/examples/<id>` | The playground and the examples, by 2D (3D added in the 3D slice) | Examples |
| Editor | `/editor` | What the editor does in three pictures; "Try the editor" opens the same build `automata editor` serves, on browser storage, at `/editor/app/` | Editors (W8) |
| Docs | `/docs`, `/docs/<guide>` | The framework's `docs/guides/*.md`, read at build time; a "How it works" page folds today's ECS, determinism, CSP and runtime pages into one; "Coming from" pages wait | Docs (W7, WG1) |
| API | `/api`, `/api/<package>` | Generated per published package from `tooling/api-index` at build time | API (W4) |
| Terms, Privacy | `/terms`, `/privacy` | Unchanged text except the contact address (W9) | Terms, Privacy |

Showcase, Community, AI, Inside, Proof, Releases, Cheatsheet and the source explorer go. Their routes redirect (a
static `_redirects`-style map the deploy honours, or a meta refresh page): `/ai` and `/inside` to `/docs/how-it-works`,
`/cheatsheet` to `/api`, the rest to `/`. The AI page's agent setup becomes a section of Start ("Using a coding agent").
`llms.txt` and `llms-full.txt` stay, generated from the docs and API at build time.

### 10.3 Inside `site/`: features

```
site/
  src/
    routes/             thin: each +page.svelte imports its feature's page component and +page.ts its loader
    features/
      home/  start/  examples/  playground/  editor/  docs/  api/  legal/
                        each holds its page component, its content, its loader and its components
    shared/             Header, Footer, CodeBlock, CopyButton, PageMeta, the CSP and security headers, site config
    app.html  app.css  hooks.server.ts
  scripts/              build steps only: build-demos.ts, write-seo-files.ts, render-favicons.ts
  tests/
    unit/<feature>/  e2e/  fixtures/
  static/               favicons, fonts, images (no builds)
```

The rules are the packages': a feature does not import another feature; `shared/` imports no feature
(`pnpm boundaries --features site`). The site build runs the closed-beta scan (section 7.3) over its output.

### 10.4 The site's tests (WT1, WT2)

- **Unit:** what a page builds from the framework (the guides list, the API list, the starter files) is read from the
  real files, so a test that "the docs list has the editor guide" fails when the guide moves. The claim-to-data tests
  that pin history go (section 10.1).
- **End to end** (`site/tests/e2e/`, Playwright, Chromium and WebKit, phone and desktop): today's gates stay (every
  sitemap page at four sizes: horizontal scroll, console errors, third-party requests, cookies, storage, axe, focus
  rings, dead buttons) plus:
  - **The visitor's journey:** land on Home; play Emberwick inline (a key press moves the player, read through its
    test hook); go to Start; copy the `create-game` command (the clipboard holds it); open the Editor page; press Try
    the editor; make a level from the platformer template; paint; reload; the level is still there.
  - **Links:** every internal link and anchor on every page resolves in the built site; no link points at
    `github.com/mcthaydt/automata-framework` while `site/config.ts` says the repository is private (one switch the
    Owner flips when it opens).
  - **No closed beta:** the scan of section 7.3 over the built site.

### 10.5 Deploy (W5, D8)

`site/` builds to static files. A `site.yml` workflow builds and tests it on pull requests (inside `ci.yml`'s
`e2e-2d` job, so no new required check) and deploys on `main` when the Owner's host secret exists; without it the
deploy step prints "No host configured yet." and passes. The host, its credential, the domain (recommended: an AF
domain rather than `automata.ruken.com`, ADR 0006) and the project contact address are the Owner's (D8). The site's
`config.ts` holds the origin, so the domain is one line.

## 11. The redesign: UX, copy and UI in the website's look

The Owner, 2026-11-06: "We also need to completely redesign the editors for ux, copy, and ui - it looks amatuerish; it
should have the design aesthetic of the website".

### 11.1 Where the two looks stand

| | The website (`app.css`) | The editors (`editor-kit/src/tokens.css`) |
|---|---|---|
| Theme | light: sage field `#edf1ec`, paper `#f9fbf8`, ink `#11151c`, muted `#434d55`, hairlines at 9% and 18% ink | dark: app `#111214`, surface `#1a1b1e`, text `#e8e6e1` |
| Accent | cobalt `#1d278a` for links, focus and selection; one chartreuse `#cbf25c` glow for the primary action and live state | amber `#e0a54a` for everything that is selected or primary |
| Type | Geist Variable and Geist Mono; light, tight display type; a fluid scale (`--step-micro` to `--step-display`) | IBM Plex Sans and Mono, fixed sizes |
| Shape | radii 12 / 18 / 26 px and pills; frosted glass controls (`--glass`); fluted gradients on surfaces; charcoal "cabinets" (`#16191e`) around the demos | radii 6 / 8 / 12 / 16 px; flat bordered boxes |
| Source | hand-written CSS custom properties | generated from `docs/design/editor-kit/tokens.json` by `scripts/generate-tokens.ts` |

The screenshots in the audit's project files (`editor2d-home-ipad.png`, `editor2d-level-ipad.png`) show what reads as
amateur: five regions on the Level view at once (view rail, layers panel, tool bar, inspector, level strip), every
control a same-weight bordered box labelled with text, three columns on Home with the detail panel repeating the card,
a status bar that says only "Saved", and words from the file format ("Level project", "Grid values", "Things").

### 11.2 One look, one token source

- **The website's language is the product's.** Its brief, from the top of `app.css`: "a lit room. Frosted, fluted
  surfaces on a pale green field; cobalt curtain bands; charcoal cabinets for the demos; one chartreuse glow for live
  state and the primary action." In the editor that reads as: light frosted chrome on the sage field; the canvas sits in
  a charcoal cabinet, the way the site's demos do; cobalt marks selection and focus; the one chartreuse glow is Save
  (and "Saved" as its live state) or the one primary action of a dialog.
- **One source.** `packages/editor/src/shared/kit/tokens/tokens.json` holds the tokens (it moves there from
  `docs/design/editor-kit/` before that folder is archived, S6). The generator writes `tokens.css`, published as
  `@mcthaydt/automata-editor/tokens.css`, and the site imports it in place of the custom properties at the top of its
  `app.css` (D1 makes that one import). Token names are both kits' names merged: the site's `--bg`, `--paper`, `--ink`,
  `--cobalt`, `--lime`, `--radius*`, `--step-*` become the source, and the editor's names
  (`--color-bg-app`, `--color-accent-default`, ...) are aliases to them for one release, then the components use the
  new names.
- **Kept on purpose:** the layer colour tokens (`--color-layer-entities`, `--color-layer-intgrid`, ...) keep their names,
  because projects store them (`layer/entities`, read by `canvas/colors.ts`); their values are retuned for the charcoal
  canvas. `--size-hit` (44 px) and `--size-primary` (48 px) stay.
- **Fonts:** Geist Variable and Geist Mono (the site's `@fontsource-variable` packages) replace IBM Plex in the kit's
  `fonts.css`. Mono is for paths and numbers only, as on the site.
- **Light only for this slice.** A dark theme is a token set away and waits until someone asks (veto default 9).
- **Game screens stay themable per game** (core's Button, Dialog, Slider, Toast). They are not part of this.

### 11.3 The kit's components, rebuilt

Every widget in `shared/kit/widgets`, `dialogs` and `shell` is restyled to the site's controls and checked in a design
board (section 11.7):

| Component | After |
|---|---|
| Button | the site's frosted pill (44 px); `primary` is the chartreuse panel with its glow (48 px); `quiet` has no border; `danger` is ink on a pale red wash, never a red outline next to a primary |
| Icon button | new: a 44 px round frosted button with an icon and an accessible name, and a tooltip on hover and long-press |
| Segmented, Tabs, Chips | pills on a glass track; the chosen one is paper with ink text and a cobalt underline (Tabs) or fill (Segmented) |
| Dialog, Menu, Popup, Picker | paper sheets with the 26 px radius and a soft shadow; on a phone, a sheet from the bottom with a grab handle |
| Fields, Stepper, Slider, Color field | the site's input look (paper, hairline, 12 px radius, cobalt focus ring) |
| Toasts, Status line | one toast region, bottom centre; the status bar goes (its "Saved" lives on the Save button, section 11.4) |
| Editor shell | regions become: a top bar, the stage, and side sheets that slide over the stage on narrow screens and dock beside it on wide ones |

**Icons:** about 24 icons (tools, undo, redo, layers, eye, lock, more, back, plus, trash, share, play) as inline SVG
components in `shared/kit/icons/`, drawn from Lucide (ISC licence, recorded in `docs/provenance/sources.md`), so no new
runtime dependency. Every icon button keeps a visible label where there is room and an accessible name always.

### 11.4 The screens, redesigned (UX)

The layouts are designed phone first and checked at four sizes: phone 390 × 844, compact landscape 780 × 270
(AGENTS.md's compact height), iPad 1194 × 834 and 834 × 1194, desktop 1440 × 900.

**Home.** One column of project cards with large thumbnails on the sage field; a "New level" primary button opens a
sheet of three illustrated templates (Platformer, Top-down, Blank). Selecting a card opens it; its details, Duplicate
and Delete live in the card's "More" menu, not in a third column. "Open from" (This game, Import files) is a segmented
control above the list. Storage collapses to one line under the list ("Saved in your game folder. Edits are kept if the
page closes.").

**The document.** A top bar holds Back, the level's name (tap to rename), the view switcher, Undo and Redo as icon
buttons, and Save as the one chartreuse button, which says "Save", "Saving…" or "Saved" with the glow as its live
state. The six-item view rail becomes the view switcher (a segmented control on wide screens, a menu on a phone) with
four views: **Level**, **Map** (today's World), **Tiles** (Tilesets), **Characters** (Entities). Checks stops being a
view: a problem count in the top bar ("2 problems") opens a sheet that lists them and jumps to each. Export stops being
a view: on a checkout Save writes the game (section 6); in browser storage a Share menu in the top bar holds Download,
Share and Copy.

**The Level view.** Canvas first: the level fills a charcoal cabinet edge to edge. The tools float over it in a frosted
pill (Select, Brush, Rectangle, Fill, Eraser, Copy a tile; brush size inside the Brush tool's popover), at the bottom on
a phone and the top on wider screens, so it never runs off the edge (G5). Layers become a sheet opened from a layers
button: each layer a row with its colour, name, eye and lock icons, and the paint palette below the chosen layer. The
inspector becomes a sheet that opens when something is selected and docks on the right from iPad landscape up. The level
strip becomes a level picker in the top bar (with "New level") and the world map.

**Map, Tiles, Characters.** The same frame: the stage in its cabinet, a sheet for the list, a sheet for the selected
item. Their own controls follow the kit's components; nothing in them is restyled one-off.

**Dialogs.** Conflict, recovery, delete and the new-level sheet follow the kit's Dialog, with one primary action each
and plain words (section 11.5).

**What stays:** every action a view has today stays reachable (nothing is dropped to make a screen fit; AGENTS.md), the
keyboard shortcuts and their help, the iPad gestures, focus order and focus restore, and 44 / 48 px targets.

### 11.5 Copy (the drunk grandma test)

The core slice's four questions (core-and-2D spec, section 8) apply to every string in the editor, the CLI's editor
and check messages, and the site. Every changed string is listed in `docs/refactor/copy.md` (new sections "Editor" and
"Site"), old and new, and the journeys of sections 9 and 10.4 assert the key ones by role and name. Known rewrites from
the audit and the redesign:

| Where | Today | After |
|---|---|---|
| Save button after saving on a checkout | status bar "Saved" | the button says "Saved", with the glow |
| Home, storage | "Kept in your game's checkout, on the computer running automata editor" | "Saved in your game folder" |
| Home, badges | "Level project", "Valid" | (gone: every card is a level; a card with problems says "2 problems") |
| Export, on a checkout | "Open a game folder to write into it." | (gone: Save writes the game) |
| View names | Level, World, Tilesets, Entities, Checks, Export | Level, Map, Tiles, Characters; "2 problems"; Share |
| Layers | Entities "Things"; Collision "Grid values" | Entities "Characters and items"; Collision "Walls and floors" |
| Level inspector, no fields | "This project gives levels no fields." | "This level has no settings." |
| Eyedropper | "Pick" | "Copy a tile" |
| New project cards | "Platformer / side view", "Top-down RPG / maps · NPCs", "Blank / own layers" | "Platformer: jump between platforms", "Top-down: walk around a map", "Blank: start from nothing" |
| Suite card | "... It comes with the Plus editors (editor-plus)." | (card gone, S2) |
| CLI | "no editor build at ... Build it first: pnpm --filter ..." | (the build ships; for 3D: "The 3D editor is not in this release yet.") |
| Site, Editors | "None of these is released yet and there is no editor to open on this site." | "Draw your levels by hand. Try the editor →" |

### 11.6 What the redesign touches outside the 2D editor

- `editor-3d` imports the kit's tokens and components, so it takes the new look automatically. Its layout and visual
  tests run in the 3D workflow on the same pull request; a test that asserted an old colour or size is updated with the
  reason in the commit. Its screens are redesigned in the 3D slice.
- The canvas's review images (`ED2D_VISUALS=1`) and any pixel test that reads the old colours change. Each changed image
  is opened (expected, actual, diff) and explained in the pull request, per AGENTS.md; no image is promoted unexplained.

### 11.7 How the design is checked

- **A design board:** `packages/editor/design.html` (not shipped) mounts every kit component in every state (rest,
  hover, focus, pressed, disabled, busy, error) and every screen with fixture data. A Playwright script screenshots it at
  the four sizes into `packages/editor/tests/e2e/screens/` (git-ignored; uploaded as a CI artifact).
- **Before and after:** each redesign pull request attaches before and after screenshots of the screens it changes, at
  phone, iPad and desktop. The Owner's standing rule auto-approves visual acceptance once a reviewer has opened the actual
  images and the pull request explains every change (AGENTS.md, Owner 2026-10-30).
- **Layout tests** (`tests/browser/layout/`): no horizontal scroll, every button's box inside the viewport, 44 / 48 px
  targets, the tool pill fully visible, sheets not covering Save, at the four sizes, in Chromium, WebKit and Firefox.
- **Behaviour tests** keep passing: the redesign changes names and places, so DOM tests that find controls by role and
  name are updated with the copy table, and nothing else about them.

## 12. Order and pull requests

Each phase is one pull request, stacked on the one before while the core stack is unmerged, then based on `main`.
Moves come before behaviour, as in the core slice: the package merge (phase 2) is behaviour-preserving, so the save
loop, shipping and the redesign happen once, in the new layout. The site moves in (phase 7) before the redesign, so
the shared token source is shared from its first commit. Journeys (phase 10) come after the redesign, so they are
written once against the final names. Sessions are refreshed after 90 minutes; tasks 2.2, 2.3, 7.1 and 9.2 to 9.4 name
their session breaks.

| # | Phase | Findings | PRs |
|---|---|---|---|
| 1 | The 2D gate sees the 2D editors; one workflow per dimension | T3 | 1 |
| 2 | One editor package, by feature, tests in `tests/`; the Studio and Levels 3D move to `editor-3d` | D6, S1, S3 to S6, T4 | 2 (merge and move; features and tidy) |
| 3 | The 2D level contract in `-content` | D5, K1 | 1 |
| 4 | Save writes the game; the drift check; the narrow fallback | E1, E3, T5 | 1 |
| 5 | The editor ships inside `-tools`; `create-game` makes a level | D4, E2 to E4 | 1 |
| 6 | The suite without 3D, opening the checkout | E5, E7, S2 | 1 |
| 7 | The website moves in | D1, W3, WS1 to WS3, WS6 | 1 |
| 8 | One design system: shared tokens, Geist, icons, the kit's components, the design board | S7, section 11.2, 11.3 | 1 |
| 9 | The 2D editor redesigned: Home, the document frame, Level, Map, Tiles, Characters, problems, dialogs, copy | G1 to G5, section 11.4, 11.5 | 2 (Home and the frame; the views) |
| 10 | Real journeys | T2 | 1 |
| 11 | npmjs.org | D2 | 1 |
| 12 | The lean site, by feature, on the shared tokens | D7, W1, W2, W4, W6 to W8, WS4, WS5, WG2, WG3 | 1 |
| 13 | The site's journeys and link checks | WT1, WT2 | 1 |
| 14 | The site's and the CLI's copy pass | WG1 to WG3, section 11.5 | 1 |
| 15 | Launch: deploy wired; the Owner's inputs | W5, W9, D8 | 1, then the Owner's steps |

## 13. If the Owner changes a decision later

All eight were taken as recommended; this table says what a later change would move.

| Decision | What changes |
|---|---|
| D1 B (site separate) | Phase 7 becomes: the site consumes published packages and a data bundle from `release-checks.yml`; section 10.1's "imports, not copies", 10.3's boundaries rule and 11.2's one-import token sharing go (the site would copy the published `tokens.css`) |
| D2 B or C | Phase 11 changes or waits; section 10.4's private-link switch is set to public (B) or the launch waits (C) |
| D3 B or C | Phase 6 grows into shipping the suite: the 2D views inside it, its redesign and copy (G2), wiring E6; section 7 serves `suite` by default |
| D4 B or C | Section 7.2: a separate `@mcthaydt/automata-editor` package (B) or no CLI editor (C) |
| D5 B or C | Sections 5 and 6: the compiler reads `.af2d.json` (B), or Save stays as it is and only the check is added (C) |
| D6 B | Phase 2 keeps three packages, each moved to feature folders and `tests/` |
| D7 B | Phase 12 updates all 17 pages instead of cutting |

## 14. Risks

| Risk | Handling |
|---|---|
| The package merge changes behaviour | Phase 2 is moves only; the 3,348 unit and DOM tests and the 252 Chromium browser tests pass with the same counts before and after; `editor-3d`'s suites pass in the 3D workflow on the same PR |
| Moving the field schema breaks the kit's field editors | The kit re-exports from `-content`; its field tests run unchanged |
| Save writes three files without a transaction | The project goes last and the check catches a half-written save (section 6.2); the journey of section 9 covers the conflict path |
| Emberwick's golden hash moves with the level contract | It must not: the sim gets the same values. A change is investigated in phase 3 before anything else lands |
| The editor build makes `-tools` heavy | Section 7.2's 3 MB budget; the editor's Pixi chunks load lazily |
| WebKit journeys cannot run in a cloud session | Chromium runs here; WebKit runs on the Owner's Mac (`pnpm ci:local`) or hosted CI, as for the core slice. The plan's steps say which engine each check ran in |
| The site's history is large | `git subtree add` without `--squash` keeps it; if the pack is too big for the proxy, `--squash` and a tag on the archived repository's last commit |
| The redesign drops an action to make a screen fit | Section 11.4's "what stays" list; the DOM tests that reach every action by role stay and are only renamed; layout tests assert every action is visible or one tap away |
| The new look breaks `editor-3d`'s tests | They run in the 3D workflow on the same pull request; changes are explained, not hidden (section 11.6) |
| Pixi in the editor needs `eval` under the site's CSP | The try-it page runs under the site's CSP in the visitor journey; if Pixi needs it, the editor imports `@mcthaydt/automata/no-eval` first, as games do |
| `create-game`'s template still uses the role layout | Out of scope here (the template's layout is the core slice's call); the template only gains its content folder and the level read |

## 15. Veto defaults (decided here; the plan audit or the Owner may change them)

1. The editor package is `@mcthaydt/automata-editor` at `packages/editor`, private.
2. Game files go where the row's `exports` says (not a fixed convention), so Emberwick's layout keeps working.
3. The project file is written last on Save (section 6.2).
4. The drift check runs in `automata check` by default.
5. The site's source is `site/` at the repository root, not `packages/site`, because it is not a package anyone
   installs.
6. The editor takes the website's look, not the other way round, and the token source lives in the editor package
   (the site imports it), because the editor is the larger surface.
7. The suite's top bar copy (G2) and its redesign wait for the 3D slice with the rest of the suite.
8. Old site routes redirect rather than 404.
9. Light theme only for this slice; a dark theme waits until it is asked for.
10. Icons are inline SVG components drawn from Lucide (ISC), not a runtime dependency.
11. The redesign's view names are Level, Map, Tiles and Characters; Checks becomes a problem count and Export a Share
    menu (section 11.4).

## 16. Findings from the wider 2D-ship audit (to be folded in)

The Owner widened the slice on 2026-11-06 to everything in AF except 3D and the non-2D editors. A separate audit covers
what this one did not (the core packages, Emberwick, the examples, tooling, CI and docs, judged for a 2D ship). When it
reports, each of its findings is placed here:

- into an existing phase, when it touches the same files (for example a `create-game` finding into phase 5, a docs
  finding into phase 12);
- into new phases after phase 6 and before the site's move, when it is core or Emberwick work the editor and site
  phases build on;
- or into section 2's "Out", with the reason, when it belongs to the 3D slice or is not needed to ship 2D.

Section 1's criteria and section 12's table are updated in the same change, and the plan's task count and percentages
with them.
