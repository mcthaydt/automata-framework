# S6: Ruken SDK stub (P01 v1.0, as of 2026-10-01)

- **Question:** Can a game-side SDK stub be built against Ruken's P01 protocol spec well enough to be A2's target for the Ruken `Hosting` adapter, and what in P01 is unclear?
- **Method:** `spikes/s6-ruken/*`.
  - The protocol and catalog are transcribed from P01 §5–§7. On 2026-10-01, all 31 catalog rows were re-checked against the live spec: identical, including the `dlc` → `store` change.
  - Node tests use a fake window pair over real `MessageChannel` ports.
  - A real two-origin browser check puts the host on `http://127.0.0.1:<port>` and the game iframe on `http://localhost:<port>`.
- **Run:** 2026-10-01, M1 Mac.
  - Node: `Tests 62 passed (62)`, 6 files.
  - Two-origin check: Chromium, WebKit and Firefox all report `ok: true`, `hellos: 1`, `droppedWrongSource: 0`, `hosted: true`. `waitedMs` was 300, 499 and 304 respectively; the game waited for `session.ready` in each case.

## Covered (asserted)
- **Handshake:**
  - `hello` retry every 250 ms with a 10 s give-up, under fake timers (≥ 40 hellos);
  - the welcome origin allowlist (P01 §4 rules and the §10 item 3 table, 24 cases);
  - an **`event.source` check**: a forged self-welcome is ignored;
  - a second welcome is ignored.
- **Transport:** MessagePort, both Node's and a real DOM port across two origins in three browsers.
- **Session:**
  - `session.ready` gating (R-04): `ready` resolves only after it;
  - standalone mode resolves immediately and uses `localStorage` under `ruken:<gameId>:`.
- **Messages:**
  - `lifecycle.changed`;
  - `menu.open` req/res through `onMenuRequest`;
  - `entitlements.changed` with store `items`.
- **Saves:**
  - `saves.set`, `remove`, `flush`, `status` and `changed`;
  - one Storage behaviour suite run against jsdom `localStorage` and against both stub backends;
  - limits: key regex, 1 MB per key, 10 MB per game, 256 keys;
  - unique `writeId`s;
  - writes DENIED without the `saves` capability.
- **Errors:**
  - error responses become `RukenError { code, retryable }`;
  - catalog timeouts give `TIMEOUT` (e.g. `saves.flush` after 5 s);
  - a late response is dropped;
  - an unknown host→game request gets `UNSUPPORTED`;
  - an unknown event is ignored.
- **Catalog:** tests generated from `CATALOG` check that:
  - every host→game event is consumed without a response;
  - every host→game request gets exactly one matching response;
  - every game→host message in a scripted session has its catalog kind and direction;
  - the game refuses to send a request the catalog doesn't allow.

## Not covered (stub only)
- display, audio and input event handling
- leaderboards
- `store.purchase` / `store.manage` UI flows
- ads, analytics, links UI
- exit / exiting
- `host.summon`
- telemetry
- version negotiation

## P01 gaps and questions to send to Ruken before F1 (2026-10-16)
1. **Forged welcome on local origins.** Rule 3 accepts a `localhost` host for a local game, so a game that posts a `welcome` to itself passes the origin check. Only `event.source === parent` stops it. Should P01 require the source check explicitly in §4, not just in the §10 e2e list?
2. **10 MB per game:** are key bytes counted as well as value bytes? Is the limit UTF-8 bytes or UTF-16 length? (The stub counts key + value in UTF-8.)
3. **Saves without the capability:** if `saves` is not granted, should `storage` throw (`DENIED`, as the stub does), fall back to memory, or fall back to local?
4. **Revisions:** `welcome.saves.snapshot` carries no revisions, yet `saves.set.baseRevision` expects one. Where does the game get it?
5. **Snapshot size:** `welcome.saves.snapshot` can be up to 10 MB in one postMessage. Is that intended, or should it be chunked or lazy?
6. **Timing:** can `menu.open` arrive before `session.ready`, and what should the game answer?
7. **`pauseBehavior`:** can it change at runtime (single-player menu vs online match)? Today it is declared only in `hello`.
8. **`display.metrics.scale` (1 | 1.333):** what does it mean for the game's UI scale (CSS zoom, or a hint)?
9. **`saves.set.writeId`:** what format, and what uniqueness scope (per session, or across reloads)? The stub uses `<gameId>-w<n>`, unique per session only.
10. Nothing else came up while implementing.

## Ruken's answers (received 2026-10-02, before F1)

1. **Forged welcome:** a §4 rule for the game side: the SDK accepts `welcome` only when `event.source === window.parent` **and** the origin passes `HOST_ALLOWLIST`. This applies in production, not only under rule 3.
2. **10 MB per game:** key bytes plus value bytes, in UTF-8 (what the stub does). Standalone mode enforces the same limits, even though `localStorage` measures UTF-16, so hosted and standalone behave the same.
3. **Saves without the capability:** a real P01 gap (§6). Recommendation: saves is granted whenever the game requests it (R-13: cloud saves for everyone). If the game didn't request it, `storage` throws `DENIED` (as the stub does). Never fall back to memory or `localStorage`.
4. **Revisions:** remove `baseRevision` from `saves.set` and `saves.remove`. The host owns revisions (the sync engine gets them from SavesAdapter / P05 `GET /saves` and builds `If-Match`). Games see revisions only through `saves.changed`, informationally.
5. **Snapshot size:** keep `welcome.saves.snapshot` as one message; a synchronous `getItem` needs the whole cache before `init` resolves. The 1.1 MB per-message limit (§9) applies to game→host messages only, not to `welcome`.
6. **`menu.open` before `session.ready`:** the host must not send it (`bridge.openGameMenu()` resolves false or rejects `NOT_READY` unless `bridge.state === "ready"`). If one arrives anyway, the SDK answers `NOT_READY` and never calls `onMenuRequest`.
7. **`pauseBehavior`:** fixed. P04's `sdk_handshake` check requires `hello.pauseBehavior` to match the manifest, and `lifecycle.changed` is information only. A game with an online mode and a single-player menu declares `"continue"` and pauses itself in single-player.
8. **`display.metrics.scale`:** P12's TV scale: 4/3 when the host is fullscreen, at least 1920 px wide and in controller mode; otherwise 1. A hint, not CSS zoom: the SDK applies nothing, and the game may enlarge HUD and text for 10-foot viewing. `safeArea` and `hostReserved` stay in the game frame's CSS pixels.
9. **`writeId`:** remove it. `saves.set` is an event whose envelope id is already a uuid v4; a per-session `<gameId>-w<n>` would collide after a reload in the host's IndexedDB outbox. P05 idempotency uses `deviceId + sha256(value)`. (If the field stays, it is a uuid v4.)

**P01 changes Ruken will make:** remove `baseRevision` and `writeId` (4, 9); add the game-side source rule to §4 (1); place saves in §6 (3); clarify byte counting (2), the game→host-only message limit (5), `NOT_READY` for `menu.open` (6), fixed `pauseBehavior` (7), and the meaning of `scale` (8).

**Consequences for A2 (`automata-host` ruken adapter):**
- Drop `baseRevision` and `writeId` from `saves.set` / `saves.remove`.
- Add a contract test: `menu.open` before `session.ready` → `NOT_READY` response, `onMenuRequest` not called.
- Keep the source check, UTF-8 key+value counting (also in the standalone/web adapter), and `DENIED` without the capability.
- Time manager: `pauseBehavior` is static per game; single-player pausing in a `"continue"` game is the game's job.
- Display manager: treat `scale` as a hint for HUD/text size (A4), never as CSS zoom.
- Re-check all of this against the published P01 after F1 (2026-10-16).

## Verdict
**USABLE.** The stub is A2's target for the Ruken `Hosting` adapter. Contract tests to carry into `automata-host`:
- the allowlist table;
- handshake (retry, give-up, forged and second welcome, ready gating, standalone);
- requests (error, timeout, late response, unsupported);
- saves (limits, status, changed, DENIED);
- the shared Storage suite;
- the catalog-generated tests;
- the two-origin browser check.

When `@ruken/sdk` exists, the adapter swaps the stub for the real SDK and re-runs the same contract tests.
