# EDS.2a The suite app: switcher, Home and the list's states: TDD plan

- **Task:** EDS.2a in [02](../../02-master-delivery-plan.md). [Editor suite spec](../specs/2026-10-30-editor-suite-design.md) §2 (the nine rail entries), §4.1 (`SuiteEditor`, `createSuite`), §5 flows 1 and 2, §9 (`suite-home`), §10 (sizes and input), §11 (the list and not-installed rows), §12 (DOM and layout layers), §13 cases EDS-l and EDS-m.
- **Lane:** editors. **Depends on:** EDS.1b (ports, merged), EDS.1c (the list, merged), EDK.1 to EDK.5 (shell, merged). Takes the rail pattern of ED2D.4c4a (#267) and, once #267 merges, its `EditorShell` change that drops an absent inspector's column. **Unblocks:** EDS.2b (pills, Undo, Ask), EDS.2d (the level editors mounted), EDS.P.
- **Status:** drafted 2026-10-30; implemented and locally checked 2026-10-30 (draft PR from `claude/editors-eds-2a-suite-app`); not reviewed, not CI verified. Accepted under the Owner's standing rule (2026-10-30): "Auto accept all spec and plans".
- **Progress:** 8 of 8 steps.
- **Branch:** `claude/editors-eds-2a-suite-app`.

## Scope

In: the suite as a Svelte app in `packages/editor-suite` (Vite page, `svelte-check`, `unit`, `dom` and `layout` test projects as editor-2d has them); `createSuite`; the nine rail entries (seven editors, Levels, Review) as a column in `wide` and a 64 px tab bar below it; Cmd or Ctrl 1 to 9 choosing them in rail order; Home with one card per editor the list names (what it edits: its files), the editor-not-installed state with the package that provides it and its files opening read only, and the list's problems (missing, not TOML, invalid with the key path, newer format) with every editor read only; an entry's page (its cards, or the installed editor mounted in the shell's regions through `SuiteEditor.open` and `regions`); layout at every §10 size in Chromium, WebKit and Firefox.

Out (owner): the scene picker, the change-set, checks and gate pills, Undo and Ask (EDS.2b); Ship, the Review desk, Export and Import (EDS.2c; Review shows a plain "comes later" page meanwhile); the level editors' `./suite` entries and the switch-and-return journey (EDS.2d); "Start a list" (it writes `content/editors.toml`, which the policy always refuses, so it needs the host's own write path: EDS.1d); the Node adapters and `automata editor` (EDS.1d); the Tuner, Studio and Audio (EDS.4a, EDS.9a, EDS.5a).

## Decisions made here (defaults, listed for the Owner's veto)

1. **Where the nine entries come from.** `src/shell/suite-entries.ts` holds them in rail order with the editor ids each covers (Levels covers `levels-2d` and `levels-3d`; Review covers none) and the package that provides them: `editor-suite` for Tuner, Studio and Audio, `editor-2d` and `editor-3d` for Levels, `editor-plus` for Feel, Writer, Schematic and Sequence (spec §2, EDS-D3). It is the suite's own table, not a copy of a contract: ids are the list's vocabulary (§4.2), and nothing else defines them.
2. **Not installed** is any id the list names that no editor given to `createSuite` has, including an id the table does not know (shown by its id, provider unknown). The plain words: "Feel isn't in this build. It comes with the Plus editors (editor-plus). Its files open read only." The free app passes no editors until EDS.4a and EDS.2d register theirs, so today every card says so; that is the truth of the build.
3. **Home is not a rail entry.** The top bar's Home button returns to it; on Home no tab is selected. An entry's page shows that entry's cards; when exactly one installed editor covers it, the page opens that editor (`open` with its files and the ports, once per entry for the app's life, so its session outlives a switch: EDS-D12) and fills the shell's panel, canvas, inspector, dock and status from its `regions`.
4. **The list's problem** shows each problem's message and its key path written `file[0].gates` (the format's own key names), the format found for a newer list, and the line and column for a syntax error, under "The editor list has a problem. Every editor is read only until it is fixed." The files the list names cannot be listed without a list, so Home shows no cards then.
5. **Boot.** `startSuite(target, env)` (`src/shell/boot.ts`) takes the window, the document, the `SuitePorts` and the suite, reads `content/editors.toml` through `ports.workspace.read`, loads it with `loadEditorList`, lists each named editor's files through `ports.workspace.files(editor)` and mounts `Suite.svelte` with the kit's geometry owner. `main.ts` boots it over a memory workspace holding FloorFifty's list and a few files, marked as a sample in the top bar, until EDS.1d serves a real checkout.

## Contract (produced, `@mcthaydt/automata-editor-suite`, private)

```ts
// src/shell/create-suite.ts
interface Suite { readonly editors: readonly SuiteEditor<unknown>[]; editor(id: string): SuiteEditor<unknown> | undefined }
function createSuite(options: { readonly editors: readonly SuiteEditor<unknown>[] }): Suite   // throws on a repeated id
// src/shell/suite-entries.ts
interface SuiteEntry { readonly id: string; readonly label: string; readonly editors: readonly string[] }
const SUITE_ENTRIES: readonly SuiteEntry[]   // nine, rail order
const PROVIDERS: Readonly<Record<string, string>>   // editor id → the package that brings it
// src/shell/home-model.ts
type HomeState =
  | { readonly kind: 'problems'; readonly problems: readonly EditorListProblem[] }
  | { readonly kind: 'cards'; readonly cards: readonly EditorCard[] }
interface EditorCard { readonly editor: string; readonly label: string; readonly entry: string | undefined;
  readonly installed: boolean; readonly provider: string | undefined; readonly files: readonly WorkspaceFile[] }
function homeOf(load: EditorListLoad, files: ReadonlyMap<string, readonly WorkspaceFile[]>, suite: Suite): HomeState
function keyPathText(path: readonly (string | number)[]): string
// src/shell/boot.ts
function startSuite(target: HTMLElement, env: SuiteEnv): Promise<{ dispose(): Promise<void> }>
```

Consumed: `SuiteEditor`, `SuitePorts`, `WorkspaceFile` (`editor-kit/ports`), `createMemoryPorts` (tests and the sample), `EditorShell` (`editor-kit`), `loadEditorList`, `EDITOR_LIST_PATH`, `workspaceFile` (`./core`), `createGeometryOwner` (`automata-ui`), `SIZES`, `REST` (`editor-kit/testing`), `checkLayout`, `publishConditions`, `settleLayout` (`automata-ui/testing`).

## Files

Create under `packages/editor-suite/`: `index.html`, `vite.config.ts`, `biome.json`, `src/main.ts`, `src/main.css`, `src/vitest-setup.ts`; `src/shell/` `suite-entries.ts`, `create-suite.ts`, `home-model.ts`, `boot.ts`, `Suite.svelte`, `SuiteRail.svelte`, `Home.svelte`, `EditorCardView.svelte`, `ListProblems.svelte`, `ReadOnlyFile.svelte` (an entry's page is `Home.svelte` with that entry's cards); tests `suite-entries.test.ts`, `create-suite.test.ts`, `home-model.test.ts`, `Suite.dom.test.ts`, `SuiteRail.dom.test.ts`, `suite.layout.test.ts`; `src/testing/sample-ports.ts` (the memory ports over a fixture list, shared by `main.ts` and the tests).
Modify: `packages/editor-suite/package.json` (scripts, Svelte and test dependencies, pinned as editor-2d pins them), `vitest.config.ts` (three projects), `tsconfig.json` (Svelte files, DOM types); `pnpm-lock.yaml`.

## Steps (each: failing test first, confirm the reason, minimal change, verify)

- [x] 1. This plan.
- [x] 2. `suite-entries.test.ts`: nine entries in the order Tuner, Studio, Audio, Feel, Writer, Schematic, Sequence, Levels, Review; Levels covers both level editors; no id covered twice; the four Plus editors' provider is `editor-plus`. Fails: no module.
- [x] 3. `create-suite.test.ts`: finds an editor by id; two editors with one id throw naming the id. Fails: no module.
- [x] 4. `home-model.test.ts`: FloorFifty's and The Last Light's lists give one card per editor in list order with their files; a list naming `feel` with no Feel editor gives a not-installed card with `editor-plus` (EDS-l); an unknown id is not installed with no provider; a row without `gates` gives the problems state with `file[0].gates` (EDS-m); missing and newer-format lists are problems. Fails: no module.
- [x] 5. App scaffolding: `vitest.config.ts` projects, Svelte dependencies, `svelte-check` typecheck; `SuiteRail.dom.test.ts`: nine tabs, arrow keys and Home and End move, Cmd or Ctrl 1 to 9 choose, the chosen tab is `aria-selected`, focus returns after a remount. Fails: no component.
- [x] 6. `Suite.dom.test.ts` (mounted through `startSuite` over memory ports): Home shows the cards; a not-installed card says so with its package and opening its file shows the text read only (EDS-l); the invalid list shows the problem with its key path and no cards (EDS-m); choosing an entry with an installed fake editor opens it once and fills the canvas from its regions, and coming back to it does not open it again; Review says it comes later. Fails: no component.
- [x] 7. `suite.layout.test.ts` at every `SIZES` entry in Chromium, WebKit and Firefox: the shell's mode; nine tabs, each at least 44 px and inside the window; the tab bar 64 px tall below `wide`; Home's essentials pass `checkLayout`; no page scroll; 1194 × 834 to 834 × 1194 keeps Home's element (no remount). Review images to `docs/evidence/owner-visual/2026-10-30-eds-2a/`.
- [x] 8. `main.ts`, `index.html`, `vite build`; gates.

## Gates

`pnpm format`; `TURBO_FORCE=true pnpm check`; `pnpm --filter @mcthaydt/automata-editor-suite test:layout` (three browsers); `pnpm --filter @mcthaydt/automata-editor-suite build`. No changeset: the package is private. No published export changes, so no api-report.

## Execution record

- Steps 1 to 6 passed as written (unit and dom: 107 tests in `pnpm --filter @mcthaydt/automata-editor-suite test:unit`).
- **Deviation (decision 1):** the provider is per editor id (`PROVIDERS`), not per entry: Levels is two editors from two
  packages, and Home said "the editor-2d and editor-3d package" for Levels 2D. Found on the first review image.
- **Deviation (an entry's page):** no `EntryPage.svelte`; an entry's page is `Home.svelte` given the entry's editors.
- **Deviation (the rail on a phone):** nine 44 px tabs with their words need more than 390 px, so the tab bar below
  `wide` is a declared sideways scroll region (`data-scroll-region="both"`) and the chosen tab scrolls into view; the
  layout test checks that the last tab is reached by scrolling and is whole. In the 56 px column the labels are the
  eyebrow size at weight 500 with the rail's full width, so "Schematic" (54 px) fits whole: measured in Chromium at
  58 px with the old padding.
- **Added (plain words):** the loader's message for a key a row lacks reads "gates is missing" instead of Zod's
  "Invalid input: expected array, received undefined" (`core/editor-list.ts`, test in `editor-list.test.ts`).
- **Pending on #267:** in `wide`, Home has no panel or inspector, and today's `EditorShell` keeps both columns empty.
  #267 collapses an absent inspector; once it merges, the same change for an absent panel (kit, with its layout test)
  lands here.
- Step 7: `test:layout` 75 of 75 in Chromium, WebKit and Firefox (8 sizes × 3 tests + rotation). Half a pixel of
  tolerance on edge comparisons for WebKit's and Firefox's sub-pixel boxes (they measured 390.07 and 834.02).
- Step 8: `vite build` writes `dist/` (176 kB JS); `svelte-check` 0 errors, 0 warnings.
