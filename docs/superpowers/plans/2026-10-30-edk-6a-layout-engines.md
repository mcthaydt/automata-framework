# EDK.6a WebKit and Firefox in the editor layout projects: TDD plan

- **Task:** EDK.6a in [02](../../02-master-delivery-plan.md). [Editor kit spec](../specs/2026-10-23-editor-kit-design.md) §4.7 (storage: "a file's `mtime` grows with every write"), §7 (sizes), §8 (layout contract in a real browser); acceptance EK-e, EK-f, EK-g.
- **Lane:** editor-kit. **Depends on:** EDK.4 (#139, the widget layout contract) and EDK.5 (the real-OPFS storage contract), both merged. **Unblocks:** EDK.6b (the WebKit iPad journey harness), and the "WebKit and Firefox layout" parts of ED2D.8 and ED3D.11.
- **Status:** implemented 2026-10-30 on `claude/editors-edk-6a-edk-6a-layout-engines`.
- **Progress:** 5 of 5 steps and the review fixes (step 6); implemented and locally checked, not CI verified.

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
| `packages/editor-kit/vitest.config.ts` | WebKit and Firefox in `layout`; Chromium and WebKit in a persistent profile per run, files one at a time (step 5 found the Chromium half); comment updated |
| `packages/editor-kit/package.json` | `test:parity`: `vitest run --project layout` |
| `packages/editor-2d/vitest.config.ts` | WebKit and Firefox in `layout`; comment updated |
| `packages/editor-2d/package.json` | `test:parity`: `vitest run --project browsers --project layout` (the ship test in `packages/ship/src/workflows.test.ts` checks the script's text, which must start with `--project browsers`; the order of the `--project` flags does not set the order the projects run in) |
| `packages/editor-kit/src/testing/store-contract.ts` | Contract case: a second write in the same clock tick gets a new `mtime`, and a write expecting the first is a conflict |
| `packages/editor-kit/src/storage/handle-store.test.ts` | The contract over a frozen-clock fake; two stores on one root (two tabs) in one tick, same size, are a conflict; a file the store never touched reports `lastModified` |
| `packages/editor-kit/src/storage/file-versions.ts` (new) | The per-path version rule above, tested through `handle-store.test.ts` (it has no other caller) |
| `packages/editor-kit/src/storage/handle-store.ts` | Uses it in `list`, `read`, `write`, `remove` |
| `packages/editor-kit/src/storage/storage.layout.test.ts` | The suite's name no longer says Chromium; a real-OPFS case with two stores on one directory writing within one second |

## Steps

- [x] **1. Plan** (this file, commit 1).
- [x] **2. Engines in the config.** WebKit and Firefox instances in both `layout` projects, `test:parity` scripts. Fails: editor-kit WebKit, 18 storage cases with `UnknownError` (above). The persistent WebKit profile makes OPFS reachable; then exactly one WebKit case still fails, the conflict in "a document session saves, keeps a journal, takes a conflict and recovers on real files" (cause 2).
- [x] **3. Same-tick writes, failing first.** `store-contract.ts` gains the same-tick case and `handle-store.test.ts` runs the contract over `createFakeOpfs({ now: () => 1_700_000_000_000 })`, plus the two-tab case (two `createHandleStore` on one fake root, frozen clock, `one` then `two`, then a write expecting the first store's `mtime`). Fails: the same `mtime` comes back and the write goes through. 
- [x] **4. `file-versions.ts` and the handle store.** Minimal code for step 3; the memory store already passes the new contract case. The whole kit unit project passes.
- [x] **5. Real browsers and gates.** The layout two-tab case on real OPFS; kit layout in Chromium, WebKit and Firefox, one engine at a time; editor-2d layout in the three; merge `origin/main` again and rerun what landed; the gates below.

- [x] **6. Review fixes (coordinator, 2026-10-30), each test-first.**
  1. A same-second save gave the session a synthetic `mtime`, which went into the journal as `baseMtime`; a reloaded tab's store knows only `lastModified`, so `baseChanged` was falsely true. Fails first: `recovery.test.ts` "the file the autosave was made on has not changed" (after a reload on a frozen clock). Fix: the journal carries `baseHash`, the SHA-256 of what the session saved (`content-hash.ts`), and `findRecovery` compares the file's hash with it when it is there. Deviation from the review's wording: the journal keeps `baseMtime` as the session's token rather than the real `lastModified`, because the session never sees the real one; the hash makes the comparison honest either way. Kit spec §4.7 records the new `mtime` definition and a dated note on coarse clocks with what stays blind.
  2. `file-versions.ts` keeps a hash, not a copy of the bytes, and reads bytes only when `lastModified` and size both match the record (or, in the rare case where the clock moved but not past the store's token, to keep that token). `file-versions.test.ts` (new) fails first on "a file whose clock moved past what the store saw … its bytes are not read".
  3. The listed-only gap is written down in `file-versions.ts` and the spec note.
  4. WebKit also runs once in Playwright's ephemeral context (instance `layout (webkit, private window)`) on `private-window.layout.test.ts` alone: EK-f's fallback (memory stores, `persistent: false`, a reason, writes still read back) in a real engine. The Chromium 153 IndexedDB crash is a `test.skip` there whose name and comment say why it cannot run.
  5. The profiles live in one `mkdtemp` directory per run, removed by `vitest.global-teardown.ts`; Chromium still writes to its profile while it shuts down, after the teardown, so the removal runs again on process exit (seen once: a `chromium` folder left behind; with the exit hook nothing is left).
  6. The note on `--project` order is reworded (above).

## Gates

Focused: `pnpm --filter @mcthaydt/automata-editor-kit exec vitest run --project unit src/storage`, then `... --project layout --browser=<engine>` for chromium, webkit and firefox in turn, and the same for `@mcthaydt/automata-editor-2d`. Full: `pnpm format`, `TURBO_FORCE=true pnpm check`, `pnpm changeset status --since=origin/main`, `node tooling/release/src/check-changesets.ts`. Both packages are private: no changeset, no API report. The CI parity job runs the layout projects from now on; its run on this PR is pending until the PR leaves draft.

## Execution record

- 2026-10-30: plan drafted (commit 1), with the evidence table above.
- Step 2: with the instances added, kit WebKit failed 18 storage cases with `UnknownError` (log kept); editor-2d passed 41 in each engine; kit Firefox passed 112. With the persistent WebKit profile and `fileParallelism: false`, kit WebKit ran 111 of 112, the one failure being the session conflict (`expected { status: 'saved', … } to deeply equal { status: 'conflict' }`), cause 2.
- Step 3: the new contract case failed on the frozen-clock fake (`expected 1700000000000 not to be 1700000000000`), as did the two-tab, read-then-change and remove-then-write cases; the memory store passed the contract case already. Deviation: no separate `file-versions.test.ts`; the module has one caller and every rule in it is pinned by a `handle-store.test.ts` case.
- Step 4: `file-versions.ts` (the per-path token, bytes compared only for paths the store wrote or read, a removed path keeps its token) and `handle-store.ts` using it; 891 kit unit tests pass. Hand mutations, each failing a case: no byte comparison (2 fail), no tombstone on remove (1), no record on read (1), no floor from the file's token before the write (survived at first, so "overwriting a file this store only listed still gives a new mtime" was added and fails on it).
- Step 5: with the old `handle-store.ts`, WebKit fails 3 real-OPFS cases (the new contract case, the two-store case, the session conflict); with the new one all 22 storage cases pass. Chromium then crashed the whole browser (`SIGTRAP`, `VITEST_BROWSER_CONNECTION_CLOSED`) in `storage.layout.test.ts`, on `main` too: a standalone probe narrowed it to Chromium 153 (headless shell and full build, Playwright 1.63.0) reading a directory handle back from IndexedDB in an ephemeral context; in a persistent context it works. EDK.5 landed on Chromium 141. Chromium therefore also runs in a persistent profile. Kit layout: Chromium 114, WebKit 114, Firefox 114 pass.
- Step 5, gates: the first full `pnpm check` failed one case, `packages/ship/src/workflows.test.ts` "gives every package with a browsers vitest project a test:parity script" (the test matches the script's text against `^vitest run --project browsers…`; the flag order does not change which project runs first); editor-2d's script became `vitest run --project browsers --project layout`, and that file passes (125). Then `pnpm format` and `TURBO_FORCE=true pnpm check` exit 0 (34 of 34 test tasks). Layout, one engine at a time on the final tree: editor-kit Chromium 114, WebKit 114, Firefox 114; editor-2d Chromium 41, WebKit 41, Firefox 41. `pnpm changeset status --since=origin/main` and `check-changesets` (0 problems): no changeset, both packages are private. `origin/main` had nothing new before the push (#212 is still open; its layout tests join the three engines through the same project when it merges).
- Not run: the CI parity job (a draft skips it), real iPad Safari (OPFS in a private window, the whole-second clock on Apple's file system), a real Chrome Incognito window (whether the IndexedDB handle crash reaches users).
- Step 6, gates: kit unit 901 pass; kit layout Chromium 114, WebKit 115 plus 1 skip (the private-window run and the documented Chromium crash), Firefox 114; editor-2d unit and dom 2042, layout 41 in each engine; `TURBO_FORCE=true pnpm check` exit 0 (34 of 34). `origin/main` had nothing new. No temporary profile is left after a run.
- Mac parity failure (CI job 123960592759, coordinator, 2026-10-30): three WebKit layout cases (`storage.layout.test.ts` twice, `private-window.layout.test.ts`) threw `TypeError: Can only call Navigator.canShare on instances of Navigator` from `browserDownloadEnv`, which called `canShare` detached from `navigator`. macOS WebKit has `canShare`; the Linux WebKit build here does not, so the local runs never reached it. A product bug, fixed test-first: a `download-store.test.ts` case whose fake `canShare`, `share` and `clipboard.writeText` throw unless called on their objects failed on `canShare`, then `canShare` is called as `navigator.canShare(...)`. Audit of the editor packages: `share` already used `.call(navigator)`, `writeText` and `getDirectory` are called on their objects or bound, `showDirectoryPicker` is bound; nothing else is called detached.
