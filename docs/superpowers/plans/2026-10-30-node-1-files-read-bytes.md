# NODE.1 `Files.readBytes` in `@mcthaydt/automata-node`: TDD plan

- **Task:** NODE.1, a core request from the Plus lane (automata-plus `claude/plus-M3.8a-pipelines-platform`, plan `docs/superpowers/plans/2026-10-30-m3-8a-pipelines-platform.md` decision **D7**): `Files` reads text only, so the M3.8 stage cache hashes an input from its UTF-8 decoding, and two binary files that differ only in invalid UTF-8 bytes hash the same. M3.9's image stages need the cache to hash bytes.
- **Contract owner:** the [M1 ship spec](../specs/2026-10-11-m1-ship-design.md) §3.8 (Node services). This PR amends that section. **Consumers:** `ship`, `cli` (`check`), the Plus `tooling/pipelines` package (M3.8a, M3.9a, M3.9b).
- **Lane:** core. **Depends on:** nothing unmerged. **Unblocks:** the Plus stage cache hashing bytes (M3.8a D7) before M3.9's image stages.
- **Status:** Planned 2026-10-30 on `claude/node-1-files-read-bytes`.
- **Progress:** see the steps; the execution log records each check.

## Scope

**In:** `readBytes(path): Effect<Uint8Array, FileError>` on `FilesService` and `FilesLive`; the one other implementation of `FilesService` in the workspace (the `cli` check test's fake) gains it so typecheck passes; the ship spec §3.8 contract; a patch changeset for `@mcthaydt/automata-node` (published: `tooling/release/src/release-list.test.ts`); the regenerated API report, API index and agent skill reference.

**Out, with owner:**

| What                                          | Why, and where it goes                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `writeBytes`                                  | No consumer in the specs writes binary through `Files`: the image stages are Python (2026-10-16 M3 spec §4.8, M3-D7) and write their own outputs through `ProcessRunner`; the character pipeline's stages (M3 spec §4.6) write text content. If M3.9b's install copies a packed `.bin` through `Files`, the Plus lane asks core for it then. |
| Switching the Plus stage cache to `readBytes` | automata-plus, M3.8a/M3.9 (its D7), once a release carries this method                                                                                                                                                                                                                                                                       |
| `content`'s own `readBytesIfPresent`          | `content` does not use `automata-node` yet (content spec §"File access"); unchanged                                                                                                                                                                                                                                                          |

## Contract (ship spec §3.8, amended)

```ts
interface FilesService {
  readText(path: string): Effect<string, FileError>;
  /** The file's bytes exactly as on disk, in a Uint8Array of their own (not a Node Buffer). */
  readBytes(path: string): Effect<Uint8Array, FileError>;
  writeText(path: string, text: string): Effect<void, FileError>;
  exists(path: string): Effect<boolean>;
  listFiles(dir: string): Effect<readonly string[], FileError>;
  remove(path: string): Effect<void, FileError>;
}
```

A read that fails (missing file, a folder, no permission) fails with the same `FileError { path, cause }` that `readText` uses, its message naming the path. The bytes are copied out of the `Buffer` that `readFileSync` returns (as `content`'s `readBytesIfPresent` does), because a small `Buffer` can be a view into Node's shared pool: a hasher reading `bytes.buffer` would otherwise see other data.

## Files

- Modify: `packages/node/src/files.ts`, `packages/node/src/files.test.ts`, `packages/cli/src/check/run-check.test.ts` (the fake), `docs/superpowers/specs/2026-10-11-m1-ship-design.md` (§3.8).
- Create: `.changeset/node-1-files-read-bytes.md` (patch, `@mcthaydt/automata-node` only).
- Regenerated (commit what the tools write): `tooling/api-report/reports/node.api.md`, the API index and cheatsheet if stale, `agents/automata/skills/automata-api/reference/api.md`.

## Steps

Each step starts with a failing test and the reason it fails.

- [x] **1. The plan.** This file.
- [x] **2. Failing tests.** In `files.test.ts`: (a) "reads a file's bytes exactly, including bytes that are not UTF-8": a file written with `node:fs` holding `00 ff fe c3 28 80 e2 82 41 0a` reads back `toStrictEqual(new Uint8Array([...]))` (a plain `Uint8Array`, not a `Buffer`), and `bytes.buffer.byteLength` equals the file's length (it owns its bytes); (b) "fails with FileError naming the path when a file's bytes cannot be read", the same assertions as `readText`'s missing-file case. Expected red: `files.readBytes is not a function`, and `pnpm --filter @mcthaydt/automata-node typecheck` reports `Property 'readBytes' does not exist on type 'FilesService'`.
- [x] **3. Minimal implementation.** `readBytes` on the interface (with its doc comment) and on `FilesLive`: `attempt(path, () => new Uint8Array(readFileSync(path)))`. Green: `pnpm --filter @mcthaydt/automata-node test`, `typecheck`.
- [x] **4. Every other implementation.** Red first: `pnpm --filter @mcthaydt/automata-cli typecheck` fails on the fake in `run-check.test.ts` (`Property 'readBytes' is missing`). The fake encodes its stored text with `TextEncoder` and fails with `FileError` for a missing path, as its `readText` does. Green: the cli typecheck and its unit tests.
- [x] **5. The contract.** Ship spec §3.8 gains `readBytes`, with a dated amendment note.
- [ ] **6. Release files.** The patch changeset; `pnpm build`; `pnpm api-report --update`; `pnpm api-index` (`pnpm cheatsheet` when stale); `pnpm agent-skills --write`; `pnpm changeset status --since=origin/main`; `node tooling/release/src/check-changesets.ts`.
- [ ] **7. Gates.** `pnpm format`; `TURBO_FORCE=true pnpm check`; `node tooling/consumer-smoke/src/run.ts --from packs` is not needed (no build-config change). Parity: not applicable (no sim, renderer, ui or golden touched).

## Execution log

- 2026-10-30: plan written. The workspace's `FilesService` implementations: `FilesLive` (`packages/node/src/files.ts`) and one test fake (`packages/cli/src/check/run-check.test.ts`); `tooling/consumer-smoke/fixtures/types.ts` names the type only. `content`, `ship` and the rest provide `FilesLive` or their own `content-files.ts` and need no change.
- 2026-10-30, step 2: red as expected. `pnpm --filter @mcthaydt/automata-node test`: 2 failed, 10 passed, both new cases with `TypeError: files.readBytes is not a function`; `typecheck`: `TS2339: Property 'readBytes' does not exist on type 'FilesService'`.
- 2026-10-30, step 3: green. `test`: 3 files, 12 tests passed; `typecheck` exit 0. Evidence for the copy: on Node 24.21.0, `readFileSync` of the 10-byte fixture returns a `Buffer` at `byteOffset` 16 into a 65 536-byte `ArrayBuffer`; `new Uint8Array(buffer)` owns exactly 10 bytes and has `Uint8Array.prototype`. The test's `toStrictEqual` and `buffer.byteLength` assertions would both fail on the uncopied `Buffer`.
- 2026-10-30, step 4: red as expected. `pnpm --filter @mcthaydt/automata-cli typecheck`: `TS2741: Property 'readBytes' is missing in type '{ readText: ...' but required in type 'FilesService'` at `run-check.test.ts(61,38)`. Green: typecheck exit 0; `vitest run src/check/run-check.test.ts` 21 passed. The fake's `readText` became a local so `readBytes` reuses its missing-file failure.
- 2026-10-30, step 5: ship spec §3.8 lists `readBytes` and carries a dated amendment (why, the failure shape, the copy, no `writeBytes`).
