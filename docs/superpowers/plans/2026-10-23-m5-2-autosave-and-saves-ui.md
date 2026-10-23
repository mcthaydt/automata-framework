# M5.2 Autosave, exit flush, cross-device changes, per-device settings, Saves UI: TDD plan

- **Task:** M5.2 in [02](../../02-master-delivery-plan.md). M5 spec [§4.4](../specs/2026-10-16-m5-saves-audio-design.md) (autosave), §4.5 (per-device settings), §5 (boot, exit, cross-device resume, change while running, conflict, background), §6 (failure rows), §7 (`SaveSlots`, `SaveStatus`, the changed-elsewhere Toast and pause choice), §8, §9. Acceptance S-c, S-d, S-g (and S-b with autosave).
- **Lanes:** host (exit order, round observable), runtime, ui; the game lane consumes. **Depends on:** M5.1 (merged: `Hosting.saves.keys` and `changed`, `SaveDef`, the `Save` service), M4.4 and M4.6 (merged), the Settings and Pause redo (#91, merged: the Settings groups, `Toast`, the paused dialog).
- **Two PRs, in this order:**
  - **M5.2a, steps 1 to 11:** host, runtime and the boot wiring. Nothing visual.
  - **M5.2b, steps 12 to 17:** `SaveStatus`, `SaveSlots`, the changed-elsewhere choice, the game-lane surface, example `core/core-saves.ts` and its journey (S-c under the fake host). It starts when M5.2a has merged, and its steps are refined then.
- **Status:** Plan drafted 2026-10-23. Nothing implemented.
- **Progress:** 0 of 17 steps.

## Sources, read at these commits

- **FloorFifty at `ee5d44e`** (`SNEKPRTY/FloorFifty`, main on 2026-10-23; the earlier extraction used `ac72660` and `a28dc44`):
  - `apps/client/src/common/settings.ts` lines 20 to 30 and 110 to 235: `keepAudioOnDevice(account, device)`. One record, split on write: the device keeps `audio` under its own key, the account gets everything else. The account's `audio` is never read, so an old account-wide mute does not follow the player to a device that has none. A blocked or throwing device storage holds the sound for the visit and never writes it to the account. Owner, 2026-10-10: "muting a Mac must not mute the same player's iPad".
  - `apps/client/src/ruken/exit.ts` (50 lines): on `session.exiting` the game flushes saves and leaves the room under a 1 s cap, inside Ruken's grace. FloorFifty's saves are written synchronously, so its flush needs no ordering; AF's `Save` writes through Effects, so AF must write first and flush second (below).
  - `tests/client/ruken/settings-hosted.test.ts` lines 72 to 160, "sound stays on the device inside Ruken" (six cases): a mute stays in the device's storage and out of the player's saves; everything else still saves; both read back on the next launch; a second device does not get the mute though the rest follows; a device with no sound settings starts unmuted even if the account's save still holds an old mute; blocked device storage keeps the mute for the visit and plays on. These are the behaviour specs for steps 8 and 9.
  - `common/progress.ts` and `ui/store/progress.svelte.ts` are not ported here: M5.1 took their save rules.
- **Ruken SDK, vendored (`vendor/ruken/ruken-sdk-0.0.0.tgz`, read in its `dist/index.js`):**
  - `handleExiting` runs every `onExiting` listener at once (`Promise.allSettled`) and then emits `session.exitReady`. So a game's pending write and the built-in `saves.flush` would race: the flush can finish before the write reaches the SDK's outbox. AF's `Hosting.onExiting` is the place to order them (step 2).
  - `saves.flush` is `drain()` of the outbox and then the request; `saves.set` is rate-limited to 20 per 1.25 s per game, so autosave must not write on every `touch`.
  - The save map limits are the SDK's: 1 MiB per value, 256 keys, 10 MiB in all. AF quotes none (R-5).
- **AF on `main` (`1fa4acc`):** `packages/runtime/src/save/{save.manager,save.schema,save-error}.ts` (M5.1: `load`, `write`, `remove`, `slots`, canonical-envelope dedupe through `lastKnown`); `packages/host/src/hosting-live.ts` (`onExiting`, the built-in flush handler, `HOST_EXIT_CAP`); `packages/runtime/src/settings/{settings.manager,migrate-settings,core-settings,audio-settings.schema}.ts` (the audio choices sit in the account's `settings` record "until M5.2 moves them to the device"); `packages/runtime/src/boot/boot-program.ts` (the `Leaderboards` wiring is the template for a `Saves` service); `PresentationBus` facts `screen.entered`, `save.loaded`, `save.written`, `save.failed`; `Hosting.lifecycle`, `Hosting.savesStatus`, `Hosting.saves.changed`.

## Scope

**In (M5.2a):**
- `AutosavePolicy` and `SaveDef.autosave`; `Save.touch`, `Save.flushPending`, the loaded slot, per-slot serialized writes, the four triggers.
- The exit order: a game's exit handlers, then the host flush, under one `HOST_EXIT_CAP`.
- `Hosting.round.ended`, so the `round-end` trigger has a source.
- A change on another device while a slot is loaded: hold, a `save.changedElsewhere` fact, `loadNewer` and `keepPlaying` on the service.
- `SettingsDef.deviceFields`, `DeviceStorage`, and the core `audio` choices moved to the device.
- `GameDefinition.saves`, a `Saves` runtime service, the boot wiring, `RuntimeTest`.

**In (M5.2b):** `SaveStatus`, `SaveSlots`, the changed-elsewhere Toast and the paused screen's Load newer / Keep playing choice, `defineGame({ saves })` and the default screens' use of it, example `core/core-saves.ts` with its golden and journey.

**Out:** a device fallback for a denied `saves` grant (AGENTS.md; the status says "Progress won't be kept"); a local copy of any host-owned save; quota preflight (Ruken request R-5); a host-owned device scope (R-6; `DeviceStorage` is the declared stand-in); conflict resolution UI (the host shell's, §5); `audio-stream` and the Plus screens; real-device acceptance of S-c (Owner).

## Contracts

```ts
// packages/runtime/src/save/save.schema.ts
export interface AutosavePolicy {
  readonly on: readonly ('screen-exit' | 'round-end' | 'background' | 'interval')[]
  readonly intervalSeconds?: number // default 60, only read when `interval` is in `on`
}
// M5-D10: absent `autosave` = on ['screen-exit', 'round-end', 'background'], no interval. `autosave: { on: [] }` turns it off.

// packages/runtime/src/save/save.manager.ts (additions)
interface Save<S> {
  /** The slot the game is playing: the last one `load` returned. Undefined before the first load. */
  readonly loaded: Subscribable.Subscribable<number | undefined>
  touch(data: () => S): void // plain function, safe per tick; marks the loaded slot dirty
  readonly flushPending: Effect.Effect<void> // writes the dirty loaded slot now, whatever the policy; never fails
  autosave(trigger: AutosaveTrigger): Effect.Effect<void> // what the boot wiring calls; a no-op when `trigger` is not in the policy
  /** Another device changed the loaded slot while it is being played (M5-D6). Cleared by `keepPlaying`, `loadNewer` or a load. */
  readonly changedElsewhere: Subscribable.Subscribable<boolean>
  loadNewer(): Effect.Effect<Loaded<S>, SaveUnreadable | SaveFromNewerBuild | HostError>
  keepPlaying(): void
}
```

- **Dirty and write rules (§4.4).** A trigger writes only a slot that `touch` marked dirty and whose canonical envelope differs from the last write (`write` already dedupes on `lastKnown`, so the unchanged case sends nothing). Autosave never writes while the loaded slot is `newer`, `unreadable` or `other-content`: `touch` still records the data, and the slot stays dirty. Writes are serialized per slot: one in flight; any number of triggers during it collapse into one more write that reads the latest `touch` thunk when its turn comes.
- **`flushPending`** ignores the policy (an exit must not lose progress because `on` omitted `background`) but not the guards above. A failure is the `save.failed` fact already; the Effect never fails, because it runs inside the host's exit.
- **Triggers wired at boot:** `screen-exit` = a `screen.entered` fact with a `from`; `round-end` = `Hosting.round.ended`; `background` = `Hosting.lifecycle` to `background`, which then calls `Hosting.saves.flush` (S-d); `interval` = an Effect `Schedule.fixed` on the `Clock` (a `TestClock` in tests).
- **Changed elsewhere (§5, M5-D6).** `Hosting.saves.changed` for a key of this save: the slot list re-reads that key (state and `lastKnown` follow the host's value). If it is the loaded slot, `changedElsewhere` becomes true, `save.changedElsewhere { key, slot }` is published, autosave stays enabled (Keep playing "overwrites on the next write, as a normal write would"), and nothing is reloaded. `loadNewer()` = `load(loaded)`; `keepPlaying()` clears the flag. A change to any other slot only refreshes the list.
- **Exit (§5).** `Save.flushPending` is registered with `Hosting.onExiting`. Host change: `onExiting` handlers run one after another in registration order, then the built-in `saves.flush`, all inside one `HOST_EXIT_CAP`; one SDK listener replaces today's one-per-handler. A handler that never returns costs the flush, and the host still gets its answer at the cap.
- **`Hosting.round.ended`:** `Stream<RoundOutcome | undefined>`, one item per round the guard let through (`guardRounds` already drops a second start and an end with no round open), ending at shutdown, like `saves.changed`.
- **Per-device settings (§4.5, M5-D4).**
  - `SettingsDef.deviceFields?: readonly (keyof S & string)[]`.
  - `DeviceStorage = { get(key): string | null; set(key, value): void; remove(key): void }`, any method may throw. `liveDeviceStorage(win, prefix)` is the frame's `localStorage` behind `try/catch`, keys `<prefix>:<def.key>:device`; `RuntimeSeams.deviceStorage` replaces it in tests. A blocked storage gives `undefined`.
  - `makeSettings(def, raw, saves, device?)`: the stored value is the account part merged with the device part. Read: the account record's device fields are dropped (never read), the device record's fields are read through the same per-field fallbacks. Write: the device part goes to `DeviceStorage` first (so a refused account save cannot lose it), the account part, without the device fields, to `Hosting.saves.set`. A device write that throws holds the value for the session: the store keeps it, and it is never written to `Hosting.saves` (S-g).
  - `CORE_SETTINGS.deviceFields = ['audio']`: mute, mute when unfocused and the five gains. A game's own `settings` declares its own.

## Steps (each: failing test first, its failure reason confirmed, then the minimal change)

**M5.2a**

1. [ ] **Plan.** This file; the 02 row split into M5.2a and M5.2b with the link; 03.
2. [ ] **Host: exit handlers run in order, then the flush, under one cap.** `packages/host/src/shutdown.test.ts`: with the fake host, a handler that writes through `hosting.saves.set` and finishes after a delay is awaited before `saves.flush` is called (the order is observed on the fake outbox); two handlers run in registration order; a handler that never returns leaves the exit answered at `HOST_EXIT_CAP` with the flush skipped; a handler removed with its scope does not run. Red: today the flush and the handler run together, so the flush call comes first.
3. [ ] **Host: `Hosting.round.ended`.** `rounds.test.ts` and `hosting-test`: ends once per guarded round, not for a dropped second end, and the stream ends at shutdown. Red: no such member.
4. [ ] **Runtime: the autosave policy and the dirty bookkeeping.** `save.test.ts` (schema: defaults per M5-D10, `on: []` off, `intervalSeconds` read only with `interval`) and `save-service.test.ts` (`loaded` follows `load`; `touch` before any load is a defect-free no-op that keeps nothing; `touch` marks dirty). Red: no `autosave`, no `touch`.
5. [ ] **Runtime: `flushPending` and serialized writes.** Under the fake host: a dirty slot is written once however many `flushPending` calls; touching the same data again sends nothing (S-b, autosave half); three triggers during one slow write collapse to one more write carrying the latest data; a `newer`, `unreadable` or `other-content` loaded slot is never written and stays dirty (S-e still holds: bytes unchanged); a host failure publishes `save.failed` and `flushPending` still succeeds.
6. [ ] **Runtime: the four triggers.** `autosave(trigger)` honours the policy; `screen-exit`, `round-end` and `background` are wired to their sources in a unit boot test; `interval` with `TestClock`: nothing before `intervalSeconds`, one write at it, none again while clean, default 60 s; the scope closing cancels the timer after one final `flushPending`. S-d: `Hosting.lifecycle` to `background` with a dirty slot writes it and calls `saves.flush` once.
7. [ ] **Runtime: changed elsewhere.** A second device's `remoteWrite` while slot 1 is loaded: `changedElsewhere` true, the fact published, the slot list shows the other device's label, the loaded data untouched; `keepPlaying` then a `touch` and a trigger overwrite the other device's value; `loadNewer` returns the other device's data; a change to slot 2 only refreshes the list; `resolveConflict('theirs')` arrives the same way (R-7 caveat recorded, from the fake host only).
8. [ ] **Runtime: per-device settings.** Port the six FloorFifty cases (above) to `makeSettings` with `deviceFields: ['audio']`, plus: a changed value of a non-device field still reaches `Hosting.saves`; the device part is read through the field fallbacks; `DeviceStorage` throwing on read gives defaults, on write holds for the session. S-g: with device storage throwing, a changed music volume holds for the session and never appears in `Hosting.saves` (checked on the fake host's server). Red: `deviceFields` unknown; the audio choices are in the account record.
9. [ ] **Runtime: the core audio choices on the device.** `CORE_SETTINGS.deviceFields`; an existing account record that holds `audio` (written by #91's build) reads as the defaults on a device with none, and the next write leaves it out; the Settings screen's Audio group and the `Audio` service read and write as before (their tests unchanged). Boot: `liveDeviceStorage` over the frame's `localStorage`, `RuntimeSeams.deviceStorage`.
10. [ ] **Boot wiring.** `GameDefinition.saves?: SaveDef<unknown>`; a `Saves` tag (`Context.Tag<Saves, { key; save: Save<unknown> } | undefined>`) and `saveOf(def)` as `settingsStore(def)` is (a key mismatch dies); `buildRuntimeServices`, `RuntimeServices`, `RuntimeTest`; the triggers of step 6; `Hosting.onExiting(save.flushPending)`; `contentHash` from the game's content. A game without `saves` builds none of it.
11. [ ] **Exports, reports, gates.** Runtime and host index exports with doc comments; API reports, cheatsheet, API index, skill `api.md`; changesets (host is published: patch); then `pnpm format`, `TURBO_FORCE=true pnpm check`, the CI extras, `pnpm test:parity` (a save made from a sim and loaded through `restore` hashes equal in three engines, M5 spec §9), `CI=1 pnpm test:e2e`, prepare-ruken; the 02 row, the execution record and 03.

**M5.2b** (refined when M5.2a has merged)

12. [ ] `SaveStatus`: every `SavesStatus` state plus "no grant" ("Progress won't be kept"), a polite live region, hidden standalone; DOM tests and the layout contract at every reference size.
13. [ ] `SaveSlots`: loading, empty, ready (label, time through `Intl`), unreadable, newer, other-content, writing, failed; 48 px rows in a `ScrollList`; Delete behind a `Dialog`, hidden on `newer` unless confirmed; DOM tests and layout contract (including `xx-long` and 780×270).
14. [ ] The changed-elsewhere Toast ("Your progress changed on another device") and the paused screen's Load newer / Keep playing choice.
15. [ ] Game lane: `defineGame({ saves })` (see the decisions below), the default screens' use of it (Title: Continue or the slot list; Paused: the status and the choice), `wants: ['saves']` once.
16. [ ] Example `examples/core/core-saves.ts` (one file, 100 lines or fewer), its golden, and `examples/e2e/core-saves.e2e.ts`: save, exit, a new session on the same `FakeSavesServer` lists the slot with its label and resumes equal data (S-c); the changed-elsewhere journey; the offline and no-grant states.
17. [ ] Exports, reports, changesets, gates as step 11, plus the layout contracts in three engines and the Owner's visual gate.

## Decisions for review (recommended defaults in effect)

- **The exit order lives in `Hosting`, not in each game.** The SDK runs listeners in parallel; ordering write-then-flush is the one place that can guarantee it for every game, so `onExiting` becomes ordered (a behaviour change inside the host lane; no handler exists outside AF yet).
- **`Hosting.round.ended` is new host surface** because the spec lists `round-end` as a trigger and no observable carried it. Additive.
- **The loaded slot is the autosave target.** The spec's `touch(data)` names no slot; one loaded slot at a time is what a game can mean. A game with several live slots would call `write` itself.
- **`autosave` defaults per M5-D10 apply when `autosave` is absent**, and `{ on: [] }` is how a game opts out.
- **`audio` moves to the device for every game that uses the core settings.** Its tests and the Audio group do not change; the one visible effect is that an account written by #91's build reads as defaults on its first launch under this build (FloorFifty's rule, written in the 02 execution record).
- **`defineGame({ saves })` shape (step 15)** is new design, as `sounds` and `scores` were. Proposed: `saves: { def: SaveDef<D>, capture(sim): D, apply?(sim, data: D): void }`, one loaded slot, the default Play screen touching `capture` once per second of sim time and on a pause. The spec gives the game lane no surface; this is the smallest that a one-file example can use. It is refined, and may be revised after review, before M5.2b starts.

## Verification

- **Focused first:** `pnpm --filter @mcthaydt/automata-host exec vitest run src/shutdown.test.ts src/rounds.test.ts`; `pnpm --filter @mcthaydt/automata-runtime exec vitest run --project unit src/save src/settings`; later the ui DOM tests and `CI=1 pnpm exec playwright test examples/e2e/core-saves.e2e.ts`.
- **Full:** step 11's and step 17's gates, first attempts recorded. Heavy parity and e2e runs on the Owner's Mac go through the CI of the PR; the container does not stand in for them.

## Owner acceptance (never ticked by an agent)

- S-c on two real devices on Ruken's local stack: write, exit, open on the other device, resume.
- One real conflict resolved through the host shell (R-7), with devices, browsers and dates recorded.
- The look of `SaveSlots`, `SaveStatus` and the paused choice at the reference sizes.

## Execution record

| Step | Commit | Evidence |
|---|---|---|
