## Summary

M5.1 saves ([plan](docs/superpowers/plans/2026-10-17-m5-1-saves.md); M5 spec §4.1–§4.3, §5, §6; acceptance S-a, S-b, S-e, S-f). From `main`; the first commit is the TDD plan, with the M5.1–M5.8 rows in 02. Rules read from FloorFifty `apps/client/src/common/progress.ts` at `ac72660` and its tests.

- **Host:** `Hosting.saves.keys` (sorted by code unit) and `Hosting.saves.changed` (a `Stream` of the SDK's `changed` payload that ends on shutdown). Covered for success, CANCELLED after shutdown, and a remote write resolved as `theirs`.
- **`SaveDef` (runtime `save/save.schema.ts`):**
  - `defineSave`, with slot keys `<key>.slot.<n>`;
  - the envelope is canonical JSON with `version`, `contentHash`, `savedAt`, and the record;
  - slots are classified from the header alone: empty, ok, unreadable, or newer;
  - `readSave` migrates one version at a time, then validates the record with Zod. Unknown fields pass through.
- **`Save` service (`save/save.manager.ts`):**
  - `saveService(def, { contentHash })` classifies every slot at boot into a `SubscriptionRef`;
  - `write` refuses a newer build's slot (S-e, `SaveRefused`). It stamps `savedAt` from Effect's `Clock`, skips a write whose content (apart from `savedAt`) is unchanged, and publishes `save.written`, or `save.failed` with the host's error code;
  - `load` re-reads from the host and publishes `save.loaded`. It returns the sim snapshot only when the content hash matches;
  - an unreadable value is never written over by a load (FloorFifty).
- **Errors:** `SaveUnreadable`, `SaveFromNewerBuild`, `SaveRefused`.
- **Exports, reports:** the runtime root exports, the host and runtime API reports, and the skill's `api.md`.
- **Changeset:** host patch. runtime is private.
- **Goldens:** unchanged. No sim code changes.

**For review (deviations in the plan):**
- the example `core/core-saves.ts` moves to M5.2: the spec gives `Save` no game-lane surface until the SaveSlots screen;
- `saveService` takes the build's content hash as an option, needs no `Scope`, and fails with `HostError`;
- `touch`, `flushPending` and autosave are M5.2's.

## Gates (local, `TURBO_FORCE=true`)

| Gate | Result |
|---|---|
| `pnpm format` | clean |
| `pnpm check` | 30 of 30 tasks, first attempt |
| CI extras (`pnpm build`, `api-index`, `build:examples`, changesets) | passed, first attempt |
| `pnpm test:parity` | 11 of 11 tasks, first attempt |
| `CI=1 pnpm test:e2e` (selected: the host adapter changes) | 72 passed, 2 skipped |
| `prepare-ruken` (placeholder, Emberwick) | passed |

Omitted: none. Pending: hosted CI on this head.

**Owner acceptance:** none in M5.1. S-c's two real devices belong to M5.2.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01QQDa25MEpciFkK7k5UV2dC
