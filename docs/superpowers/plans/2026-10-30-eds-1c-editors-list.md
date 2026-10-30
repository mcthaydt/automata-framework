# EDS.1c The game's editor list (`content/editors.toml`): schema and loader: TDD plan

- **Task:** EDS.1c in [02](../../02-master-delivery-plan.md). [Editor suite spec](../specs/2026-10-30-editor-suite-design.md) EDS-D1 (home), EDS-D6 (`af-editors/1`), EDS-D7 (gates always listed), EDS-D8 (check phases), §4.2 (the format), §11 (the list's failure rows) and §13 cases EDS-m and EDS-n (the policy half).
- **Lane:** editor-suite. **Depends on:** EDS.0 (the spec). **Unblocks:** EDS.1d (the disk workspace's allowlist), EDS.2a (Home's list-error and editor-not-installed states).
- **Status:** Implemented and locally checked 2026-10-30 (draft PR from `claude/editors-eds.1c-eds-1c-editors-list`). Not reviewed, not CI verified.
- **Progress:** 7 of 7 steps.

## Scope

**In:** a new private package `packages/editor-suite` with only its headless `./core` entry; in it the Zod schema of `af-editors/1`, the loader (TOML text, or nothing, to a list or a list of problems with key paths), the glob matcher (extracted from The Last Light's `editor/src/shared/manifest.ts` at `92e6704`, with `{scene}` added) and the write policy (first matching row wins; `never` and `generated` refuse; a file no row matches is read only with the reason); two fixtures, The Last Light's Bay scene converted AF-side (`92e6704`) and FloorFifty (`677d456`).

**Out, with owner:**

| What | Where |
|---|---|
| The `./node` entry, reading the list from disk, the disk workspace's allowlist, `{scene}`/`{path}` substitution in `run` | EDS.1d |
| `WorkspaceFile`, `CheckDef` and the other port shapes | EDS.1b in `editor-kit/ports` (one owner); EDS.1d maps this task's rows onto them |
| Home's list-error, "Start a list" template and editor-not-installed states | EDS.2a |
| Reopened gates, gate records | EDS.2b and EDS.1d |
| Creating the list ("Start a list", spec §11) | EDS.1d and EDS.2a: it writes `content/editors.toml`, which `fileAccess` always refuses, so it needs its own creation path (a write with `expected: 'absent'` of the template only, after the person's tap), not the policy's allowlist |
| The content compiler skipping `editors.toml` | Nothing to build: `packages/content/src/compile/read-sources.ts` reads only registered document names, and `editors` is not within two edits of any, so it is already skipped without a warning |

## Decisions made here (defaults, listed for the Owner's veto)

1. **TOML parser: `smol-toml` 1.9.0**, already a dependency of `content` and `editor-2d`. The list is only read, never patched (the suite cannot write it), so `@decimalturn/toml-patch`'s span-keeping writer is not needed; `smol-toml`'s `TomlError` gives the line and column of a syntax error.
2. **Strict tables.** An unknown key (`gate = []` for `gates`) is a schema error with its key path, so a typo cannot silently drop a gate (EDS-D7's intent).
3. **References are checked.** A row's check must be declared in `[[check]]` or be the built-in `content`; a row's gate must be declared in `[[gate]]`; ids are unique; `content` cannot be redeclared. Each failure names its key path.
4. **Defaults:** `check.when` is `after`, `joins` is `[]`, `measure` is `false` (EDS-D8: a game command defaults to `after`); `file`, `check`, `gate`, `generated`, `never` default to empty. `gates` and `checks` on a file row are required (an empty list is written out); `modes` is required and not empty.
5. **Format:** `af-editors/1` loads; `af-editors/<n>` with `n > 1` is a `newer-format` problem naming the format found; anything else is invalid at `format`.
6. **Placeholders:** globs may hold `{scene}` (one path segment, captured as the file's scene); `run` may hold only `{scene}` and `{path}`; any other `{…}` is a schema error.
7. **Always never:** `content/editors.toml`, `.git` and `.git/**`, `**/gates.json`, The Last Light's always-refused `.claude/**`, `.github/**`, `**/.env`, `**/.env.*`, and every declared gate's `records` glob, whatever the list's `never` says, matched in any letter case (recorded in spec §4.2, 2026-10-30). Paths outside the game root (absolute, `..`, empty or `.` segments, backslashes) are refused as `outside`, and globs with those are schema errors. The disk adapter (EDS.1d) resolves real paths first.

## Contract (produced, `@mcthaydt/automata-editor-suite/core`)

```ts
export const EDITOR_LIST_PATH = 'content/editors.toml'
export const EDITOR_LIST_FORMAT = 'af-editors/1'
export type EditMode = 'edit' | 'ask'
export interface FileRow { glob; editor; modes; gates; checks }
export interface CheckRow { id; run; when: 'before' | 'after'; joins; measure }
export interface GateRow { id; name; records }
export interface EditorList { format; scenes?; file; check; gate; generated; never }
export const editorListSchema: z.ZodType<EditorList>
export type EditorListLoad = { ok: true; list: EditorList } | { ok: false; problems: readonly EditorListProblem[] }
export interface EditorListProblem { kind: 'missing' | 'syntax' | 'invalid' | 'newer-format'; keyPath; message; line?; column?; format? }
export function loadEditorList(text: string | undefined): EditorListLoad
export function globMatch(glob: string, path: string): { scene?: string } | undefined
export type FileAccess = { writable: true; path; row; scene? } | { writable: false; path; reason: 'outside' | 'never' | 'generated' | 'unlisted'; why }
export function fileAccess(list: EditorList, path: string): FileAccess
```

Consumed: `zod` 4.6.6, `smol-toml` 1.9.0. No Svelte, DOM, Node or clock in `src/core` (a test reads the imports).

## Steps (each: failing test first, confirm the reason, minimal change, verify)

1. [x] Package skeleton: `packages/editor-suite/{package.json,tsconfig.json,vitest.config.ts,src/core/index.ts}` as editor-3d's headless setup (private, Node test environment); a first test `src/core/index.test.ts` that imports the entry. Fails: package missing.
2. [x] `src/core/glob.test.ts`: `*` within a segment, `**` across segments, `**/` at the start, `?`, `{scene}` captures one segment, regex characters are literal; The Last Light's policy cases (`92e6704` `editor/tests/policy.test.ts`) on the matcher. Fails: module missing. Then `glob.ts`.
3. [x] `src/core/editors.schema.test.ts`: the spec §4.2 example parses with its defaults; a file row without `gates` fails at `['file', 0, 'gates']` (EDS-m); unknown key; empty `modes`; a bad mode; an absolute or `..` glob; an unknown placeholder in a glob or in `run`; an empty `run`; a bad `when`. Fails: module missing. Then `editors.schema.ts`.
4. [x] `src/core/editor-list.test.ts`: `undefined` is `missing` at `content/editors.toml`; a TOML syntax error is `syntax` with line and column; `af-editors/2` is `newer-format` with the format; `format` missing or `json` is `invalid` at `['format']`; an undeclared check or gate, a duplicate id, a redeclared `content` each fail at their key path; a valid list loads. Fails: module missing. Then `editor-list.ts`.
5. [x] `src/core/workspace-policy.test.ts`: the first matching row wins and carries its scene; `never` refuses, including `content/editors.toml`, `.git/config` and a gate's records even when the list's `never` is empty (EDS-n, policy half); `generated` refuses; an unlisted file is read only with the reason; `..` and absolute paths are `outside`. Fails: module missing. Then `workspace-policy.ts`.
6. [x] Fixtures `src/testing/fixtures/{last-light-bay,floorfifty}.editors.toml` and `src/core/fixtures.test.ts`: both load; FloorFifty has no `[[gate]]` and every row's `gates = []`; the Bay's `content/scenes/bay/puzzle.toml` is the Schematic's with `P-G1` and scene `bay`; FloorFifty's `content/tuning.toml` is the Tuner's with no gates; `content/generated/content.json` is generated; each fixture's header names its source commit. Then the purity test (`src/core/purity.test.ts`: core imports only `zod`, `smol-toml` and relative files).
7. [x] Register the package: knip, the API report (or `NOT_CORE`, as editor-3d), `pnpm install`, full gates. Done with an API report, as editor-kit and editor-2d have (`tooling/api-report/reports/editor-suite.api.md`); `packages/*` already covers the workspace, knip and `pnpm style`, so no config changed.

## Gates

`pnpm --filter @mcthaydt/automata-editor-suite exec vitest run --testTimeout=90000`, `pnpm format`, `TURBO_FORCE=true pnpm check`, `pnpm api-report`, `pnpm changeset status --since=origin/main`, `node tooling/release/src/check-changesets.ts`. The package is private: no changeset. No browser suite: the package has no UI yet.

## Execution record

- 2026-10-30: plan drafted (commit 1).
- Step 1: `index.test.ts` failed on the missing entry, then passed with the two constants.
- Step 2: `glob.test.ts` failed on the missing module; 7 pass with `glob.ts` (The Last Light's `globToRegExp` plus `{scene}`).
- Step 3: `editors.schema.test.ts` failed (12 of 12, `editorListSchema` undefined). With the schema, the spec §4.2 example failed: as printed, `generated` and `never` follow the last `[[gate]]`, so TOML puts them inside that gate, and the strict gate table refused them (`unrecognized_keys` at `['gate', 0]`). **Deviation:** the spec's example is corrected (top-level keys before the first table, with a comment saying why) and the test keeps a case for the late-key mistake. 13 pass.
- Step 4: `editor-list.test.ts` failed on the missing module; 10 pass.
- Step 5: `workspace-policy.test.ts` failed on the missing module; 8 pass.
- Step 6: the fixtures were written with their test, so `fixtures.test.ts` passed at once; a hand mutation (dropping one FloorFifty row's `gates = []`) failed it at load with `['file', 0, 'gates']`. The purity test failed on a hand-added `node:fs` import and `Date.now()`. Q-FEEL and Q-AUD have no gate record at `92e6704`; the fixture says so in its header.
- Step 7: 56 package tests; typecheck, lint, knip and style clean; the API report written.
- Review fixes (2026-10-30, after the coordinator's review of #244), each test-first: the always-never list and gate records match in any letter case, and `.git` itself is refused (4 new policy cases failed with `unlisted`, then pass); The Last Light's `.claude/**`, `.github/**`, `**/.env`, `**/.env.*` restored to the always-never list and recorded in spec §4.2; globs with empty or `.` segments or a backslash are schema errors (the glob case failed, then passes; `scenes` keeps its trailing `/`); `a/**` is pinned not to match `a`; `globMatch` takes `ignoreCase`; `docs/versions.md`'s smol-toml row names editor-suite. "Start a list" needs its own creation path (Out table). 61 package tests.
