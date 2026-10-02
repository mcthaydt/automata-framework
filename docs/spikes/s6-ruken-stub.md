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
