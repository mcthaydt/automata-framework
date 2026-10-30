# EDS.1c The game's editor list (`content/editors.toml`): schema and loader: TDD plan

- **Task:** EDS.1c in [02](../../02-master-delivery-plan.md). [Editor suite spec](../specs/2026-10-30-editor-suite-design.md) EDS-D1 (home), EDS-D6 (`af-editors/1`), EDS-D7 (gates always listed), EDS-D8 (check phases), §4.2 (the format), §11 (the list's failure rows) and §13 cases EDS-m and EDS-n (the policy half).
- **Lane:** editor-suite. **Depends on:** EDS.0 (the spec). **Unblocks:** EDS.1d (the disk workspace's allowlist), EDS.2a (Home's list-error and editor-not-installed states).
- **Status:** Drafted 2026-10-30. Not reviewed, not CI verified.
- **Progress:** 0 of 7 steps.

## Scope

**In:** a new private package `packages/editor-suite` with only its headless `./core` entry; in it the Zod schema of `af-editors/1`, the loader (TOML text, or nothing, to a list or a list of problems with key paths), the glob matcher (extracted from The Last Light's `editor/src/shared/manifest.ts` at `92e6704`, with `{scene}` added) and the write policy (first matching row wins; `never` and `generated` refuse; a file no row matches is read only with the reason); two fixtures, The Last Light's Bay scene converted AF-side (`92e6704`) and FloorFifty (`677d456`).

**Out, with owner:**

| What | Where |
|---|---|
| The `./node` entry, reading the list from disk, the disk workspace's allowlist, `{scene}`/`{path}` substitution in `run` | EDS.1d |
| `WorkspaceFile`, `CheckDef` and the other port shapes | EDS.1b in `editor-kit/ports` (one owner); EDS.1d maps this task's rows onto them |
| Home's list-error, "Start a list" template and editor-not-installed states | EDS.2a |
| Reopened gates, gate records | EDS.2b and EDS.1d |
| The content compiler skipping `editors.toml` | Nothing to build: `packages/content/src/compile/read-sources.ts` reads only registered document names, and `editors` is not within two edits of any, so it is already skipped without a warning |

## Decisions made here (defaults, listed for the Owner's veto)

1. **TOML parser: `smol-toml` 1.9.0**, already a dependency of `content` and `editor-2d`. The list is only read, never patched (the suite cannot write it), so `@decimalturn/toml-patch`'s span-keeping writer is not needed; `smol-toml`'s `TomlError` gives the line and column of a syntax error.
2. **Strict tables.** An unknown key (`gate = []` for `gates`) is a schema error with its key path, so a typo cannot silently drop a gate (EDS-D7's intent).
3. **References are checked.** A row's check must be declared in `[[check]]` or be the built-in `content`; a row's gate must be declared in `[[gate]]`; ids are unique; `content` cannot be redeclared. Each failure names its key path.
4. **Defaults:** `check.when` is `after`, `joins` is `[]`, `measure` is `false` (EDS-D8: a game command defaults to `after`); `file`, `check`, `gate`, `generated`, `never` default to empty. `gates` and `checks` on a file row are required (an empty list is written out); `modes` is required and not empty.
5. **Format:** `af-editors/1` loads; `af-editors/<n>` with `n > 1` is a `newer-format` problem naming the format found; anything else is invalid at `format`.
6. **Placeholders:** globs may hold `{scene}` (one path segment, captured as the file's scene); `run` may hold only `{scene}` and `{path}`; any other `{…}` is a schema error.
7. **Always never:** `content/editors.toml`, `.git/**`, `**/gates.json` and every declared gate's `records` glob, whatever the list's `never` says. Paths outside the game root (absolute, `..`) are refused as `outside`.

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

1. [ ] Package skeleton: `packages/editor-suite/{package.json,tsconfig.json,vitest.config.ts,src/core/index.ts}` as editor-3d's headless setup (private, Node test environment); a first test `src/core/index.test.ts` that imports the entry. Fails: package missing.
2. [ ] `src/core/glob.test.ts`: `*` within a segment, `**` across segments, `**/` at the start, `?`, `{scene}` captures one segment, regex characters are literal; The Last Light's policy cases (`92e6704` `editor/tests/policy.test.ts`) on the matcher. Fails: module missing. Then `glob.ts`.
3. [ ] `src/core/editors.schema.test.ts`: the spec §4.2 example parses with its defaults; a file row without `gates` fails at `['file', 0, 'gates']` (EDS-m); unknown key; empty `modes`; a bad mode; an absolute or `..` glob; an unknown placeholder in a glob or in `run`; an empty `run`; a bad `when`. Fails: module missing. Then `editors.schema.ts`.
4. [ ] `src/core/editor-list.test.ts`: `undefined` is `missing` at `content/editors.toml`; a TOML syntax error is `syntax` with line and column; `af-editors/2` is `newer-format` with the format; `format` missing or `json` is `invalid` at `['format']`; an undeclared check or gate, a duplicate id, a redeclared `content` each fail at their key path; a valid list loads. Fails: module missing. Then `editor-list.ts`.
5. [ ] `src/core/workspace-policy.test.ts`: the first matching row wins and carries its scene; `never` refuses, including `content/editors.toml`, `.git/config` and a gate's records even when the list's `never` is empty (EDS-n, policy half); `generated` refuses; an unlisted file is read only with the reason; `..` and absolute paths are `outside`. Fails: module missing. Then `workspace-policy.ts`.
6. [ ] Fixtures `src/testing/fixtures/{last-light-bay,floorfifty}.editors.toml` and `src/core/fixtures.test.ts`: both load; FloorFifty has no `[[gate]]` and every row's `gates = []`; the Bay's `content/scenes/bay/puzzle.toml` is the Schematic's with `P-G1` and scene `bay`; FloorFifty's `content/tuning.toml` is the Tuner's with no gates; `content/generated/content.json` is generated; each fixture's header names its source commit. Then the purity test (`src/core/purity.test.ts`: core imports only `zod`, `smol-toml` and relative files).
7. [ ] Register the package: knip, the API report (or `NOT_CORE`, as editor-3d), `pnpm install`, full gates.

## Gates

`pnpm --filter @mcthaydt/automata-editor-suite exec vitest run --testTimeout=90000`, `pnpm format`, `TURBO_FORCE=true pnpm check`, `pnpm api-report`, `pnpm changeset status --since=origin/main`, `node tooling/release/src/check-changesets.ts`. The package is private: no changeset. No browser suite: the package has no UI yet.

## Execution record

- 2026-10-30: plan drafted (commit 1).
