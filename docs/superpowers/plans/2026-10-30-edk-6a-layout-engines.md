# EDK.6a WebKit and Firefox in the editor layout projects: TDD plan

- **Task:** EDK.6a in [02](../../02-master-delivery-plan.md). [Editor kit spec](../specs/2026-10-23-editor-kit-design.md) §4.7 (storage: "a file's `mtime` grows with every write"), §7 (sizes), §8 (layout contract in a real browser); acceptance EK-e, EK-f, EK-g.
- **Lane:** editor-kit. **Depends on:** EDK.4 (#139, the widget layout contract) and EDK.5 (the real-OPFS storage contract), both merged. **Unblocks:** EDK.6b (the WebKit iPad journey harness), and the "WebKit and Firefox layout" parts of ED2D.8 and ED3D.11.
- **Status:** drafted 2026-10-30 on `claude/editors-edk-6a-edk-6a-layout-engines`.
- **Progress:** 2 of 5 steps.

## Scope

**In:**

- The `layout` projects of `packages/editor-kit` and `packages/editor-2d` gain WebKit and Firefox instances, the same three-instance shape `packages/ui` and `packages/testing` use (`instances: [chromium, webkit, firefox]`). `packages/editor-3d` has no layout project yet (its config runs Node only), so it has nothing to add; whoever adds one copies this shape.
- Both packages get a `test:parity` script that includes `layout`, as `packages/ui` (`vitest run --project layout`) and `packages/testing` do, so the CI parity job (`pnpm test:parity`, three engines) runs the editor layout contracts. editor-2d's keeps its `browsers` project.
- Every difference the three engines show in the shell, widgets, storage (real OPFS) and Home layout tests, fixed in product code test-first.

**Out, with owner:** WebKit iPad profiles, touch and pen helpers and journeys (EDK.6b); real iPad Safari and Pencil (the Owner's device pass); the docs owner's spec status line and §10 (ED.DOCS); layout tests that open PRs add (#212 adds editor-2d open-flow dialogs: they join the three engines through the same project when they merge, and this branch runs whatever is on `main` before it is pushed).

## Evidence before the plan (2026-10-30, Playwright 1.63.0, `/opt/pw-local`)

First run with the two extra instances, one engine at a time:

| Package | Chromium | WebKit | Firefox |
|---|---|---|---|
| editor-kit (shell, widgets, storage: 112 tests) | pass | **18 fail** (all of `storage.layout.test.ts` that touches OPFS or IndexedDB handles), 94 pass | 112 pass |
| editor-2d (Home: 41 tests) | 41 pass | 41 pass | 41 pass |

Two causes, found with a standalone Playwright probe (`navigator.storage.getDirectory()`, `createWritable`, a handle put into IndexedDB, and `lastModified` across writes 300 ms apart):

1. **Playwright's default WebKit context is ephemeral** (a private session), and there WebKit rejects `navigator.storage.getDirectory()` with `UnknownError: The operation failed for an unknown transient reason`. In a persistent context (`launchPersistentContext`) OPFS, `createWritable` and handles in IndexedDB all work; Firefox works in both. The product already behaves correctly in the ephemeral case: `openWorkspace()` fell back to memory with `persistent: false` (EK-f). This is the test environment, not the product, so the fix is in the config: WebKit runs in a persistent profile. Vitest ignores `persistentContext` when files run in parallel, so the WebKit instance runs its files one at a time.
2. **WebKit's OPFS `lastModified` has whole-second resolution** (`1793339534000` for three writes 300 ms apart; Chromium and Firefox give milliseconds). The handle store's `mtime` is `lastModified`, so two writes in one second share an `mtime`: a save that expects the first goes through over the second (the "takes a conflict" layout case fails with `saved` instead of `conflict`). That breaks EK-e and the spec's "a file's `mtime` grows with every write". A real product bug, fixed in `handle-store.ts`.

## Design of the fix for cause 2

The `ProjectStore` contract does not change: `mtime` stays "the store's own modification time", a number the next write passes back. The handle store keeps, per path it has written or read, what it last saw: `{ token, lastModified, bytes }`.

- A file that matches the record (same `lastModified`, same size, same bytes) reports the record's `token`.
- A file that differs from the record, while its `lastModified` has not passed the record's `token`, reports `token + 1` and becomes the new record. So a change inside one clock tick, by this store or another one (another tab), always gets an `mtime` the earlier caller does not hold, and its `expected` check is a `conflict`.
- A write's new `mtime` is the file's `lastModified`, or one more than the token the file had before the write when the clock did not move past it.
- A file the store never wrote or read reports its `lastModified`, as today, and reading it is not needed; `remove` drops the record.

The comparison reads the bytes of a recorded file only (the documents this tab opened or saved), so `list` stays cheap for the rest. The rule lives in its own small module (`file-versions.ts`), used by `createHandleStore` for both OPFS and a picked folder (a FAT or network folder can have a coarse clock too).

## Files

| File | Change |
|---|---|
| `packages/editor-kit/vitest.config.ts` | WebKit (persistent profile per run, files one at a time) and Firefox in `layout`; comment updated |
| `packages/editor-kit/package.json` | `test:parity`: `vitest run --project layout` |
| `packages/editor-2d/vitest.config.ts` | WebKit and Firefox in `layout`; comment updated |
| `packages/editor-2d/package.json` | `test:parity`: `vitest run --project layout --project browsers` |
| `packages/editor-kit/src/testing/store-contract.ts` | Contract case: a second write in the same clock tick gets a new `mtime`, and a write expecting the first is a conflict |
| `packages/editor-kit/src/storage/handle-store.test.ts` | The contract over a frozen-clock fake; two stores on one root (two tabs) in one tick, same size, are a conflict; a file the store never touched reports `lastModified` |
| `packages/editor-kit/src/storage/file-versions.ts` (new), `file-versions.test.ts` (new) | The per-path version rule above |
| `packages/editor-kit/src/storage/handle-store.ts` | Uses it in `list`, `read`, `write`, `remove` |
| `packages/editor-kit/src/storage/storage.layout.test.ts` | The suite's name no longer says Chromium; a real-OPFS case with two stores on one directory writing within one second |

## Steps

- [x] **1. Plan** (this file, commit 1).
- [x] **2. Engines in the config.** WebKit and Firefox instances in both `layout` projects, `test:parity` scripts. Fails: editor-kit WebKit, 18 storage cases with `UnknownError` (above). The persistent WebKit profile makes OPFS reachable; then exactly one WebKit case still fails, the conflict in "a document session saves, keeps a journal, takes a conflict and recovers on real files" (cause 2).
- [ ] **3. Same-tick writes, failing first.** `store-contract.ts` gains the same-tick case and `handle-store.test.ts` runs the contract over `createFakeOpfs({ now: () => 1_700_000_000_000 })`, plus the two-tab case (two `createHandleStore` on one fake root, frozen clock, `one` then `two`, then a write expecting the first store's `mtime`). Fails: the same `mtime` comes back and the write goes through. `file-versions.test.ts` fails: module missing.
- [ ] **4. `file-versions.ts` and the handle store.** Minimal code for step 3; the memory store already passes the new contract case. The whole kit unit project passes.
- [ ] **5. Real browsers and gates.** The layout two-tab case on real OPFS; kit layout in Chromium, WebKit and Firefox, one engine at a time; editor-2d layout in the three; merge `origin/main` again and rerun what landed; the gates below.

## Gates

Focused: `pnpm --filter @mcthaydt/automata-editor-kit exec vitest run --project unit src/storage`, then `... --project layout --browser=<engine>` for chromium, webkit and firefox in turn, and the same for `@mcthaydt/automata-editor-2d`. Full: `pnpm format`, `TURBO_FORCE=true pnpm check`, `pnpm changeset status --since=origin/main`, `node tooling/release/src/check-changesets.ts`. Both packages are private: no changeset, no API report. The CI parity job runs the layout projects from now on; its run on this PR is pending until the PR leaves draft.

## Execution record

- 2026-10-30: plan drafted (commit 1), with the evidence table above.
- Step 2: with the instances added, kit WebKit failed 18 storage cases with `UnknownError` (log kept); editor-2d passed 41 in each engine; kit Firefox passed 112. With the persistent WebKit profile and `fileParallelism: false`, kit WebKit ran 111 of 112, the one failure being the session conflict (`expected { status: 'saved', … } to deeply equal { status: 'conflict' }`), cause 2.
