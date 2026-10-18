# M5.7 Leaderboard flow: TDD plan

- **Task:** M5.7 in [02](../../02-master-delivery-plan.md). M5 spec [§4.8](../specs/2026-10-16-m5-saves-audio-design.md), §6 (the leaderboard rows), §7 (`LeaderboardPanel`), §8, §9. Acceptance L-a, L-b.
- **Lane:** runtime and ui, with the game lane as the consumer and ship and cli for the board check. **Depends on:** M5.0 (Owner-approved 2026-10-16) and PRODUCT.1 (merged: `Hosting.leaderboards`).
- **Status:** Planned 2026-10-18.
- **Progress:** 8 of 9 steps.

## Sources, read at these commits

- **FloorFifty at `ac72660`:**
  - `apps/client/src/ruken/score-boards.ts` (30 lines): one board list that both `ruken.toml` and the game's submit read, so the two cannot drift; `min`/`max` are Ruken's, which refuses a score outside the range and never clamps it.
  - `apps/client/src/ruken/scores.ts` (36 lines): the score comes from the finished snapshot, never typed by a person (R-80); a race that does not count submits nothing.
  - `tests/client/ruken/scores-hosted.test.ts` (49 lines): submit reaches the host; the game asks for the `leaderboards` capability; offline, no grant and a non-integer score all settle without throwing; standalone sends nothing.
  FloorFifty only submits. It has no board view, so `readBoard` and `LeaderboardPanel` are built to the spec's §4.8 and §7 rules.
- **Ruken SDK, vendored (`vendor/ruken/ruken-sdk-0.0.0.tgz`):** `LeaderboardsApi.submit(board, score, meta)` → `{ accepted, personalBest, rank? }`; `get(board, { scope: 'top' | 'around-me', limit })` → `{ entries: { rank, displayName, score, isMe }[] }`. The fake host's `createFakeLeaderboards` (`offline`, `submits`; `get` returns the player's best as one "You" entry).
- **AF on `main` (`287ab5d`):** `HostingLeaderboards` (`packages/host/src/hosting.ts`), the ship config's `leaderboards` and its `[leaderboards]` table (`packages/ship/src/manifest/ruken-toml.ts`), the `sounds` pattern (`packages/runtime/src/audio/event-sounds.ts`: sim events reach a service as presentation-bus facts).

## Scope

**In:**
- runtime `Leaderboards` service: `submitScore`, `readBoard`, and the board states;
- the score mapping from sim events (`defineGame({ scores })`), with the `leaderboards` capability asked for automatically;
- ui `LeaderboardPanel`, shown by the default paused screen when the game has scores;
- the undeclared-board check in `ship prepare` and `automata check`;
- example `core/core-leaderboard.ts`, its golden and its journey under the fake host.

**Out:** a local board of any kind (§4.8, host authority); restating `min`/`max` (Ruken checks the range); the Plus leaderboard screens (none planned).

## Contract

- `BoardState` = `idle` | `submitting` | `accepted { personalBest, rank? }` | `refused` | `unavailable` | `offline`:
  - `refused`: the host answered `accepted: false`, or rejected the score (`INVALID_PAYLOAD`, for example a non-integer).
  - `unavailable`: `UNSUPPORTED` (no grant, or standalone).
  - `offline`: `OFFLINE` or `TIMEOUT` (Ruken has no separate network code).
  - Every other host error (`DENIED`, `NOT_READY`, `RATE_LIMITED`, `QUOTA_EXCEEDED`, `CANCELLED`, `INTERNAL`) is `unavailable`, so a screen always has a named state.
- `makeLeaderboards({ hosting, bus })` → `Leaderboards`:
  - `submitScore(board, score)`: an `Effect` that never fails. It publishes `leaderboard.submitted { board, state }` and returns the state.
  - `readBoard(board, query?)` returns `{ state: 'entries', entries }` | `{ state: 'empty' }` | `{ state: 'unavailable' }` | `{ state: 'offline' }`, from `Hosting.leaderboards.get`.
  - `state(board)` holds the last submit's state.
- `EventScores` = sim event type → `{ board, score(payload) }`. Each such sim event submits once. A score that is not a finite integer is not sent: a `refused` state, and a warning naming the event.
- The board check: every board name used by `scores` entries and by `submitScore` / `readBoard` calls with a string literal must be a key of the ship config's `leaderboards`. Otherwise `UndeclaredBoard { board, file, line, col }`. The scan reads the game's TypeScript sources with `oxc-parser`, not the minified bundle.

## Steps (each: failing test first, its failure reason confirmed, then the minimal change)

- [x] **1. Plan.** This file, the 02 row's link, 03.
  - *Plan written from the M5 spec, FloorFifty ac72660 (score-boards.ts, scores.ts, scores-hosted.test.ts) and the vendored SDK; 02 row linked; 03 updated.*
- [x] **2. Board states from host answers.** `packages/runtime/src/leaderboards/board-state.ts`: map `LeaderboardSubmitRes` and `HostError` codes to `BoardState`. Unit tests cover every row of the contract.
  - *Red: the test failed to resolve ./board-state.js (no module). Green: board-state.ts; 12 unit tests (accepted with and without rank, refused, every Ruken error code); runtime tsc clean. The submit answer type comes from Hosting.leaderboards, so runtime takes no @ruken/sdk dependency.*
- [x] **3. The `Leaderboards` service under the fake host.** `leaderboards.manager.ts` over `Hosting` with `@ruken/sdk-host/testing`:
  - *Red: leaderboards.test.ts failed to resolve ./leaderboards.manager.js. Green: makeLeaderboards over Hosting.leaderboards, the leaderboard.submitted fact; under the fake host: accepted with personalBest and rank (L-a), offline keeps nothing and reads offline (L-b, runtime half), no grant is unavailable and sends nothing, 1.5/NaN/Infinity refused before the host; 18 tests, runtime tsc clean.*
  - L-a: a declared board returns `accepted` with `personalBest`;
  - offline is `offline` and keeps no local score (a later `readBoard` while offline is `offline`, not a cached entry);
  - no grant is `unavailable` and sends nothing;
  - a non-integer score is refused before it reaches the host.
- [x] **4. `readBoard`:** entries with `isMe`, empty, unavailable, offline.
  - *Deviation: readBoard was written in step 3, because the offline test needed it, so these tests passed on their first run. Mutation check instead: with readBoard forced to answer empty, the entries test failed (1 of 21); restored, 21 of 21 pass (entries with isMe, empty, unavailable without the grant, offline even after the host stored a score).*
- [x] **5. Scores from sim events.** `event-scores.ts` on the presentation bus; boot wiring; the `leaderboard.submitted` fact. Game lane: `defineGame({ scores })` validated against the plugins' events (as `sounds` is), and `leaderboards` added to `hosting.wants` when `scores` is set.
  - *Red: event-scores.test.ts could not resolve ./event-scores.js; the boot test saw no Leaderboards service; the two defineGame tests failed (no scores check, no wants). Green: submitEventScores on the presentation bus; Leaderboards in RuntimeServices, buildRuntimeServices, the boot program and RuntimeTest; GameDefinition.scores submitted at boot (a scored sim event reached the fake host: submits [{best, 300}], state accepted); defineGame scores validated against the plugins' events and leaderboards added to hosting.wants once; runtime root exports Leaderboards, makeLeaderboards and the board types (index test updated). runtime and game tsc clean.*
- [x] **6. ui `LeaderboardPanel`.**
  - *Red: leaderboard-panel.test.ts could not resolve LeaderboardPanel.svelte; the viewer smoke test had no leaderboard frame. Green: LeaderboardPanel (loading, entries with the player's row marked in words, empty, unavailable, offline; rows out of the focus order; polite status for the messages), 8 DOM tests. The layout contract found a real defect at 780x270, host strips and TV scale: the action row fell below the fold (12 of 12 conditions); fixed by making the panel fill its parent with the rows in a 1fr ScrollList reserving one row. Then 150 of 150 leaderboard layout cases in Chromium, WebKit and Firefox; status unit 59; ui index 62; viewer smoke 26 (new leaderboard frame); ui and viewer svelte-check 0 errors.*
  - States: loading, entries (with "you"), empty, unavailable ("Scores aren't available here"), offline ("You're offline").
  - A ScrollList whose entries are not focusable; only the action row is. Copy keys.
  - DOM tests, a renderer-free fixture in `examples/ui/primitives`, and its layout contract at every reference size (parity).
- [x] **7. The default paused screen shows the panel** for the game's first scored board, when the game has `scores`.
  - *Red: the default-screens test timed out waiting for the board on paused. Green: defineGame hands the first scored board to the default screens; paused reads it from the host each time it opens (Leaderboards.readBoard) and shows LeaderboardPanel (standalone: 'Scores aren't available here'); a game without scores shows none; default-screens 26 of 26. Layout: a new paused-board case (twelve rows, the loaded state asserted first) passes at every reference size and variant in Chromium, WebKit and Firefox; screens layout 300 of 300; game svelte-check 0 errors.*
- [x] **8. The board check.** `packages/ship/src/prepare/board-names.ts` (scan, with fixture games: a declared board passes; an undeclared one in `scores`, in `submitScore` and in `readBoard` each fail with file and line). `prepare-build` fails with `UndeclaredBoard` (L-b, first half); an `automata check` step does the same.
  - *Red: board-names.test.ts could not import ./board-names.ts; the prepare test had no UndeclaredBoard; run-check had no boards step (4 failures). Green: findUndeclaredBoards and boardNamesIn (oxc AST: scores.<event>.board literals, submitScore/readBoard first-argument literals; node_modules, dist and dot folders skipped), UndeclaredBoard in prepareBuild (L-b, first half: 'src/game.ts:1:44: "weekly"', no ruken.toml written; passes once declared), and an automata check 'boards' step (rule undeclared-board) after test, skipped by --sim-only, reading ship.config.ts's leaderboards keys as written (declaredBoardsIn); the usage text and the automata-verify skill name it (the skill-content test required the new rule). ship prepare 64, cli 52, agent-skills 77. Deviations: declaredBoardsIn was written just before its tests (they passed on the first run); two expected columns in the new tests were miscounted by hand (43 and 67), and the code's 1-based columns (44, 68) were checked with a script and kept. Earlier run-check tests that index steps by position were moved by one.*
- [ ] **9. Example, exports and gates.**
  - `examples/core/core-leaderboard.ts` (a run that ends every 300 ticks with its score), its golden, and `examples/e2e/core-leaderboard.e2e.ts`:
    - accepted, then the paused panel lists "You";
    - `&offline` under the fake host shows the offline state (L-b, second half).
  - Exports, the API reports, cheatsheet, api index and skill `api.md`; changesets (ui, ship, cli are published; runtime and game are private).
  - Gates: `pnpm format`, `pnpm check`, CI extras, `pnpm test:parity`, `CI=1 pnpm test:e2e`, prepare-ruken; then the 02 row, the execution record and 03.

## Decisions for review (recommended defaults in effect)

- **`scores` in `defineGame` is new design**, as `sounds` was in M5.3: the spec gives the leaderboard no game-lane surface, and a one-file example needs one.
- **The paused screen hosts the panel.** The spec names `LeaderboardPanel` but no screen; paused is the default screen a player can reach mid-run.
- **The board check scans sources, not the bundle.** The spec asks for the call site's board name; a minified bundle has no reliable call sites. A board passed as a variable is not checked statically; `BoardId` typing covers it where the game types its boards.
- **The fake host's offline flag also covers leaderboards** in the examples host (`&offline=1` today sets only saves). One flag for "the network is down" matches what a player sees.

## Verification

- **Focused first:** `pnpm --filter @mcthaydt/automata-runtime exec vitest run --project unit src/leaderboards`; `pnpm --filter @mcthaydt/automata-ship exec vitest run src/prepare/board-names.test.ts`; the panel's DOM test; `CI=1 pnpm exec playwright test examples/e2e/core-leaderboard.e2e.ts`.
- **Full:** step 9's gates, first attempts recorded.

## Owner acceptance (never ticked by an agent)

- The panel's look at the reference sizes.
- A real submit on Ruken once a board is live (needs the Ruken side).

## Execution record

| Step | Commit | Evidence |
|---|---|---|
