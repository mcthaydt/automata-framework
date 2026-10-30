# M7: Online and store (milestone spec)

- **Status:** Draft, approved on recommended defaults by the Owner (2026-10-16 ruling); decisions M7-D1 to M7-D18 (§15) listed for veto. Real money stays mocked. Task **M7.0** in [02 Master delivery plan](../../02-master-delivery-plan.md). The review that merges this draft freezes the contracts in §4; after that they change only additively or through a written change request (01 Decomposition §5, [04 How we build](../../04-how-we-build.md)).
  > **Amendment, 2026-10-30 (the Owner, in the session's chat):** staging evidence (M7.7b's load bots and drills, M7.10's phone pass) comes from a local VM or container, and AF 1.0 ships the `server` package and its deploy target with no production game server.
- **Owner direction:** 2026-10-11, AF is Ruken first and built from proven code; `net`/`server` come from FloorFifty's Colyseus code (master spec §4, §11). 2026-10-16 ([PRODUCT spec](./2026-10-16-product-core-and-plus-design.md) PD-1, PD-3, PD-5): every extension is Automata Plus; `net` and `server` are on the FloorFifty path; CPU players are cut to a bot-seat hook; M7 adds a server deploy target. 2026-10-16 ([QB spec](./2026-10-16-quality-bar-design.md) §5): the M7 server must meet eight hand-off requirements (traced in §13.1). 2026-10-16 ([PUB spec](./2026-10-16-publish-targets-design.md)): a game targets Ruken or itch.io at build time. 2026-10-16 ruling: real money stays mocked.
- **Depends on:** M2 (merged: snapshot/restore, replay recorder and goldens). PRODUCT.1 (merged: `NetworkPort`, `AuthoritativeSnapshot`). PRODUCT.5 (the `mcthaydt/automata-plus` workspace) before any Plus package task (M7-D1). M5.1 (`Save`, draft) before `store`'s grant-once ledger. Ruken's `[store]` manifest section (R-12) before a game with a store can be published to Ruken. PUB.1 (draft) for the web adapter's `store` answer on itch.io.

## 0. Sources

| Source | Revision | Used for |
|---|---|---|
| AF `main` | `e42ca91` | What exists (§2). Every "exists" cell was checked against `packages/*/src` at this commit. |
| FloorFifty, `SNEKPRTY/FloorFifty` | `ac72660` (local clone at `/home/user/floorfifty`, read 2026-10-17) | Every `net`, `server`, deploy and load-test row: `apps/server/src/**`, `apps/client/src/systems/netcode/*`, `managers/network/*`, `ui/store/room-store.svelte.ts`, `packages/shared/src/common/{schemas,constants}.ts`, `deploy/**`, `tests/{server,load,server-perf}/**`, `tests/client/{systems/netcode,managers/network}/*`, `docs/release.md` |
| Ruken, vendored | RukenApp `b30d31b` ([`vendor/ruken/`](../../../vendor/ruken/README.md)), extracted to a scratch directory and read | `@ruken/sdk`: `CAPABILITIES`, `store.purchase`/`store.manage`, `entitlements.changed`, `EntitlementsPayload`, error codes, the standalone session. `@ruken/sdk-host`: `createFakeStore`, `createFakeEntitlement`, the host's purchase flow. `@ruken/manifest`: `[store]` refused (`STORE_NOT_AVAILABLE`), `checkConnectEntry`, `CONNECT_MAX_ENTRIES`, `gameOrigin`, `SLUG_RE` |
| [QB spec](./2026-10-16-quality-bar-design.md) §4.1, §5 | draft | The server requirements handed to M7 and the "not applicable" rows whose trigger is the M7 server |
| [PRODUCT spec](./2026-10-16-product-core-and-plus-design.md) §2 F1, §3, §5, §10 | draft, PD-1 to PD-5 decided | `NetworkPort` in core; `net`/`server` Plus; bot-seat hook; server deploy target; PRODUCT.8 Party Racer depends on M7 |
| [PUB spec](./2026-10-16-publish-targets-design.md) §2, §3.1 | draft | Build-time targets; the web adapter fails `store` with `UNSUPPORTED`; selling on itch.io needs a desktop build (`host-tauri`) |
| [Master spec](./2026-10-11-automata-framework-ruken-first-design.md) §2, §4, §11 and the [2026-10-01 spec](./2026-10-01-automata-framework-overview-design.md) §2, §5, §7, A7, A9 | — | Laws 1–7 (law 2: the authoritative server decides networked truth); entitlements enter the sim as commands; the old A7/A9 acceptance cases |
| [M5 spec](./2026-10-16-m5-saves-audio-design.md) (draft, branch `claude/clever-pasteur-ujmu6e-m5spec`) §4.2–§4.3 | pending review | `SaveDef`, `Save` (the ledger's home); "store entitlements and the grant-once ledger: `store` (M7)" (M5 §1) |
| [M6 spec](./2026-10-16-m6-gameplay-extensions-design.md) (draft, branch `claude/clever-pasteur-ujmu6e-m6spec`) | pending review | Format; the highest Ruken request number in M3–M6 drafts (R-11) |

**Not verified here:** a hosted Colyseus server, a real box, DNS, TLS and the uptime and cost-alert providers; real phones on a real network; Ruken's local stack or TEST environment (not running here); whether Ruken's checkout in its local and TEST stacks charges money (R-15); a Tauri build (no target platform toolchain was exercised); the size of a sim snapshot for any real game (no AF game is networked yet), so every byte and rate budget in §4 is a target to be measured, not a measurement. FloorFifty test counts are top-level `it(`/`test(` calls (appendix A), not runs.

## 1. Goal and boundaries

**Goal.** A game written on AF becomes a four-player online game by adding two Plus extensions and a server entry, without writing netcode. Players create a room, join by code or quick match, ready up, play with their own moves applied at once, and see each other move smoothly. A dropped phone reconnects into its seat. The server is the only authority (law 2), runs the same deterministic sim, and is deployed, rolled back, watched and load-tested the way FloorFifty's is. A game can also sell items and a season pass through Ruken's `store` capability; what a player owns enters the sim as a command, so replays reproduce. **No real money moves in any AF test or acceptance.**

**Plus (paid, PD-1), in `mcthaydt/automata-plus` (M7-D1):**
1. `net`: the client. A Colyseus implementation of core's `NetworkPort`, the room API and room store, local prediction and reconciliation, remote interpolation, render clock, input lead, reconnection, diagnostics, and the deterministic link harness (`net/testing`).
2. `server`: the authority. A Colyseus room running the game's sim, tick scheduler, input queue, seats, lobby, command ledger, bot-seat hook, replay recorder, the gates (validation, size caps, rate limits, origins, session verification), structured logs, health and readiness, drain, and the **server deploy target** (blue/green with rollback, uptime check, cost alert, load test).
3. `store`: the catalog as content, entitlements in the sim, the grant-once ledger in `Save`, the store panel and pass track.
4. `host-tauri`: specified, **deferred** until its trigger (M7-D15).

**Core (free), one additive change:** `Hosting.store` relays Ruken's `store.purchase` and `store.manage` (§4.1), as PRODUCT.1 did for leaderboards. `NetworkPort` and `AuthoritativeSnapshot` (PRODUCT.1) are consumed unchanged.

**Exclusions:**
- **Real money.** No payment provider is integrated, called or tested. Purchases go through Ruken's `store` capability (whose checkout belongs to Ruken) or the fake host's `createFakeStore`/`createFakeEntitlement`. No AF test, fixture or acceptance step makes a real purchase.
- **The Automata Plus store** (selling AF itself: merchant of record, webhooks, registry tokens) is PRODUCT.5, D-7 and QB.5, not this `store`. This `store` sells a game's items to its players through the host.
- CPU players' driving AI (FloorFifty `packages/shared/src/cpu`, 226 lines) is cut (PD-5); only the bot-seat hook ships (§4.4).
- FloorFifty's race rules, race projection, select steps, stages, songs, modes, unlocks and `speculative-contact.ts` stay in FloorFifty (§4.2, §4.3 tables).
- Ops telemetry (`telemetry-endpoint.ts`, `POST /telemetry`) is cut (PD-5); the server's own structured logs remain (§4.5).
- A database, accounts and durable server records (M7-D8). Matchmaking across servers, regions and autoscaling (M7-D6).
- Peer-to-peer, WebRTC and lockstep without an authority (M7-D2).
- `host-tauri` implementation (deferred, M7-D15) and Tauri mobile.

**Prerequisites:** PRODUCT.5 for M7.2 onward; M5.1 for M7.8; R-12 for publishing a store game to Ruken (M7.8 is built and tested under the fake host before then); R-13 for verifying sessions against Ruken (the port and its fake ship before then).

## 2. What already exists (verified at `e42ca91`, not rebuilt)

### 2.1 On `main`

| Capability | Where | M7 does |
|---|---|---|
| `NetworkPort` (`onRemoteCommand`, `sendCommand`, `publishSnapshot`, `onSnapshot`; plain callbacks, no Effect per tick; sends never throw) and `AuthoritativeSnapshot { tick, bytes, hash }` | `packages/runtime/src/net/network-port.ts` (41 lines), test 116 lines with a loopback link; exported from `packages/runtime/src/index.ts`; listed in `tooling/api-report/src/seams.ts` | `net` implements it over Colyseus; `server` is its authority end. Unchanged (M7-D3) |
| `Sim.snapshot()`, `restore(bytes)` (validating, `SnapshotMismatchError` on schema or content hash), `hash()`, `contentHash`, `SimStepError` (refuses `step` until a `restore`) | `packages/sim/src/world/sim.ts` | Reconciliation restores the authority's bytes; join checks schema and content hashes |
| `Command { tick, source, seq, type, payload }` | `packages/sim/src/world/sim.ts` | `source` is the seat, stamped by the server, never trusted from a client |
| `.replay` codec, `createRecorder`, `createReplayStepper`, `packReplay` | `packages/sim/src/replay/` | The server records every room; the two-client golden replays it |
| `replayGolden`, `simGolden`, cross-engine runner | `packages/testing/src/sim/` | Two-client replay golden in Node, Chromium, WebKit, Firefox |
| `Hosting.entitlements: Subscribable<EntitlementsPayload>` (observed from the SDK's `on('entitlements')`) | `packages/host/src/hosting.ts`, `hosting-live.ts` | `store` reads it. There is **no** `store.purchase`/`store.manage` relay yet (§4.1 adds it) |
| `HostError { code, retryable, operation }` relaying Ruken's codes; `toHostError` | `packages/host/src/errors.ts` | Purchase and manage failures |
| `defineExtension({ name, requires, sim, content, layers, ui.slots, manifest })` | `packages/runtime/src/extension/define-extension.ts` | `net` and `store` are one each |
| UI slots `title.actions`, `pause.actions`, `settings.sections`, `hud.overlay`, `debug.panels` | `packages/ui/src/slots/ui-slot.ts` | `store` fills `title.actions` and `pause.actions`; `net` fills `hud.overlay` |
| `ShipConfig.network: Manifest['network']` written as `[network] connect` | `packages/ship/src/config/ship-config.ts`, `manifest/ruken-toml.ts` | The game lists its server origin there; `prepare` checks it with Ruken's `checkConnectEntry` |
| `Files`, `ProcessRunner` Effect services | `packages/node/src/` | The server deploy target runs `ssh` and `scp` through `ProcessRunner` |
| `check-boundaries` over several roots | `tooling/check-boundaries` | `net`'s and `store`'s `src/sim` are added in the Plus workspace |

### 2.2 Pending elsewhere (consumed, not redefined)

- **PRODUCT.5:** the `automata-plus` workspace, registry and release list.
- **M5** (draft): `SaveDef`, `Save`, `save.written`/`save.failed` facts (M5 §4.2–§4.3).
- **PUB.1** (draft): the web adapter, whose `store` fails `UNSUPPORTED` and whose `Hosting.kind` gains `'web'` (PUB §3.1).
- **PRODUCT.6:** the lobby, room-code, ready-room and results screens (Plus kit) that consume `net`'s room store.
- **PRODUCT.7:** the frame-budget probe, which also measures reconciliation cost (§14).

**Not in AF anywhere:** a transport, rooms, a server, prediction, reconciliation, interpolation, rate limits, deploy scripts for a server, a store catalog, entitlement commands.

## 3. Ownership

| State or contract | Owner (lane, package) | Writers | Consumers |
|---|---|---|---|
| Networked gameplay truth | `server` room's sim (law 2) | the room's sim only, from queued commands | clients restore it |
| Predicted local state | `net` reconciler's client sim | local commands; replaced on every authoritative snapshot | the renderer, for the local seat's entities |
| Room info (code, phase, seats, ready, host seat, bots) | `server` room | lobby rules | `net` room store (a read-only mirror), kit screens |
| Wire schemas (`ClientMessage`, `ServerMessage`, `JoinOptions`) | net lane, `automata-plus/packages/net/src/wire` | — | `server` imports them; never copied |
| `NetworkPort`, `AuthoritativeSnapshot` | runtime lane, core (PRODUCT.1) | — | `net`, `server` |
| `Hosting.store` | host lane, core `packages/host` | — | `store` |
| Entitlements | Ruken (host), observed through `Hosting.entitlements` | the host only | `store` turns each change into a sim command |
| Entitlement state in the sim | `store` sim plugin | its systems, from `entitlements.set` commands | game systems, pass track UI |
| Grant-once ledger | `store`, stored through M5 `Save` | `store` only | — |
| Store catalog (`store.toml`) | the game's content, schema owned by `store` | the game | `store`, R-12's `[store]` once it exists |
| Server limits, origins, verifier | `server` config | the operator (environment) | gates |
| Server deploy files (Caddy, systemd, `activate`) | net lane, `automata-plus/packages/server/deploy` | — | the operator |
| Reconnection token | `net`, in `sessionStorage` for one page load (FloorFifty's rule) | `net` | `net` |

Sim versus presentation versus host: the sim never knows it is networked (laws 1, 5). `net` and `server` are outside the sim and may use Effect; their per-tick paths are plain functions (ADR 0003). The host owns identity and entitlements; AF never invents either.

## 4. Contracts

### 4.1 `Hosting.store` (core, `packages/host`, M7.1)

```ts
/** Ruken's store (SDK `RukenSession.store`). Needs the `store` grant; standalone and web fail UNSUPPORTED. */
export interface HostingStore {
  /** Item or subscription SKU. TIMEOUT is not a failure: ownership arrives on `entitlements`. */
  purchase(sku: string): Effect.Effect<StorePurchaseRes, HostError>
  /** Opens the host's subscription management for a subscription SKU. */
  manage(sku: string): Effect.Effect<void, HostError>
}
// Hosting gains: readonly store: HostingStore
```

- Types are `@ruken/sdk`'s (`StorePurchaseRes`), imported as types; the SKU rule is the SDK's (it validates with Ruken's slug rule before sending). AF quotes no store timeout or rate limit (the SDK's catalog has them: 10 minutes, one request per 10 s at `b30d31b`).
- Each failure is the SDK's code through `toHostError`: `DENIED` (unknown SKU), `TIMEOUT` (checkout still pending), `RATE_LIMITED`, `UNSUPPORTED` (no grant, standalone, web, itch). None falls back to a local unlock.
- An additive change to [M1 shared contracts](./2026-10-11-m1-shared-contracts-design.md) §1, owned by the host lane; PUB.1's web adapter answers `UNSUPPORTED` (PUB §3.1 already says so).

### 4.2 `net` (`automata-plus/packages/net`, M7.2, M7.5)

```ts
export type ConnectionState = 'offline' | 'connecting' | 'connected' | 'reconnecting' | 'degraded'
export interface SeatInfo { readonly seat: number; readonly name: string; readonly ready: boolean; readonly connected: boolean; readonly bot: boolean }
export interface RoomInfo {
  readonly code: string                       // six characters, the Colyseus room id (FloorFifty room-code.ts)
  readonly phase: 'lobby' | 'countdown' | 'playing' | 'ended'
  readonly seats: readonly SeatInfo[]
  readonly you: number | undefined            // your seat, from the server's `seated` message only
  readonly hostSeat: number | undefined
}
export interface NetRoom {                     // an Effect service; every call fails with NetError
  create(options: { name: string; private?: boolean }): Effect.Effect<void, NetError>
  join(code: string, options: { name: string }): Effect.Effect<void, NetError>
  quickMatch(options: { name: string }): Effect.Effect<void, NetError>
  setReady(ready: boolean): Effect.Effect<void, NetError>
  addBot(): Effect.Effect<void, NetError>     // host seat only; the server's BotPolicy drives it
  removeBot(seat: number): Effect.Effect<void, NetError>
  leave: Effect.Effect<void>
  resume: Effect.Effect<'resumed' | 'none' | 'expired', NetError>  // reclaim the seat after a reload, once
  readonly info: Subscribable.Subscribable<RoomInfo | undefined>
  readonly connection: Subscribable.Subscribable<ConnectionState>
}
export class NetError extends Data.TaggedError('NetError')<{
  readonly code: 'REFUSED' | 'VERSION_MISMATCH' | 'ROOM_NOT_FOUND' | 'ROOM_FULL' | 'SERVER_BUSY' | 'SERVER_UPDATING' | 'RATE_LIMITED' | 'UNVERIFIED' | 'OFFLINE'
  readonly operation: string
}> {}
export interface NetConfig {                   // content/net.toml (schema `net`); defaults in brackets
  readonly url: string                         // wss origin; must be in ruken.toml [network].connect
  readonly snapshotEvery: number               // ticks between authoritative snapshots [3: 20 Hz at 60 Hz]
  readonly maxLeadTicks: number                // how far a client may predict ahead [tickHz: 1 s]
  readonly interpolationTicks: number          // remote render delay [6]
  readonly reconnectGraceSeconds: number       // seat held after a drop [30]
}
export const netPlugin: PluginDef               // `net-owner` component { seat }, `seat.joined` / `seat.left` commands and events
export const netExtension: ExtensionDef<'net'>
```

Wire (`net/src/wire/*.schema.ts`, Zod, every object `.strict()`, one owner, imported by `server`):

```ts
JoinOptions   = { protocol: number, schemaHash: hex16, contentHash: hex16, name: Name, session?: string }
ClientMessage = { t: 'cmd', seq: uint, tick: uint, type: string, payload: unknown }  // payload re-parsed by the sim's command schema
              | { t: 'ping', id: uint, tick: uint } | { t: 'ready', ready: boolean, req: ReqId }
              | { t: 'bot.add' | 'bot.remove' | 'leave', req: ReqId, seat?: uint }
ServerMessage = { t: 'snap', tick: uint, hash: hex16, acks: Record<seat, uint> } + binary snapshot bytes
              | { t: 'seated', seat: uint } | { t: 'pong', id: uint, slack: int } | { t: 'answer', req: ReqId, error?: NetErrorCode }
              | { t: 'replay' } + binary packed replay
```

**Netcode model (M7-D2, FloorFifty's, generalised).**
- **Authority:** the room steps the sim at `tickHz` and publishes `AuthoritativeSnapshot` every `snapshotEvery` ticks through `NetworkPort.publishSnapshot`. `net` sends `sim.snapshot()` bytes as a binary message beside a `snap` header carrying the per-seat acks (the last `seq` the room applied for each seat). Acks travel on `net`'s wire, not in `AuthoritativeSnapshot`, so the PRODUCT.1 seam is unchanged (M7-D3).
- **Local prediction:** a local command is stamped with the client's predicted tick, applied to the client sim at once, and sent with `NetworkPort.sendCommand`. The predicted tick leads the authority by the measured round trip plus margin (`input-lead.ts`: each pong reports how early the probe's tick arrived).
- **Reconciliation** on each snapshot at tick T: `restore(bytes)`; check `hash()` equals the header's hash (a mismatch is a corrupt frame: request a resync, never step on it); drop pending local commands whose `seq` ≤ the seat's ack; re-step from T to the predicted tick with the rest, each at its own tick or, if that tick is ≤ T and not acked, at T + 1 (the server's late rule). Plain code, no Effect per step.
- **Remote interpolation:** entities whose `net-owner` seat is not yours are drawn from the authoritative states, `interpolationTicks` behind the newest, interpolated between the pair that brackets render time, never extrapolated (`snapshot-buffer.ts`). Render time comes from a clock that runs on rendered time and is steered by snapshot arrivals (`render-clock.ts`), so the picture moves every frame, not every packet.
- **Join check:** `JoinOptions` carries the client's `schemaHash` and `contentHash`; a room with others refuses with `VERSION_MISMATCH` and the client shows Reload (FloorFifty `matchmake-version-gate.ts`). Two builds with different content never share a room.
- **Reconnection:** the Colyseus reconnection token lives in `sessionStorage` (never `localStorage`, never the URL: it is a bearer credential for one seat). A drop retries with backoff 250 ms doubling to 2 s (`reconnectDelay`) inside `reconnectGraceSeconds`; on return the client restores the next snapshot and continues. A reload calls `resume` once. After the grace the seat is given up and the room shows the player left.
- **Degraded:** when the measured round trip or snapshot gap passes the diagnostics' thresholds, `connection` reads `degraded` (FloorFifty: "at 1000 and 2000 ms the indicator reads degraded, and the race never desyncs or freezes").

| From (FloorFifty `apps/client/src/…`) | Lines | Goes to |
|---|---|---|
| `managers/network/network.ts` (FloorFifty's own `NetworkPort`) | 234 | Its room verbs (create, join, quick match, ready, leave, resume, CPU add and remove) become `NetRoom`; its race verbs (laps, modes, picks, colours, stages, songs) stay |
| `managers/network/colyseus-network.ts` | 927 | Connection states, reconnection token in `sessionStorage`, `reconnectDelay`, wire byte count, request ids → `net` transport; `schemaToSnapshot` and race messages stay |
| `systems/netcode/input-lead.ts` | 139 | Input lead from pong slack, unchanged in shape |
| `systems/netcode/render-clock.ts` | 353 | Render clock, unchanged in shape |
| `systems/netcode/snapshot-buffer.ts` | 129 | Remote interpolation over authoritative sim states instead of `RoomSnapshot` |
| `systems/netcode/race-netcode.ts` | 370 | The per-frame loop (clock, buffer, lead, prediction, one input sample per predicted tick) becomes `net`'s `NetSession`, game-agnostic |
| `systems/netcode/local-simulation.ts` | 612 | Its rule ("step the same simulation the server runs, over a state rebuilt from the last snapshot") becomes reconciliation by `restore` + re-step; its Planck race rebuild stays |
| `systems/netcode/net-diagnostics.ts` | 325 | Diagnostics (round trip, snapshot gaps, late commands, corrections) for `degraded` and a `debug` panel (M6) |
| `systems/netcode/snapshot-to-race.ts`, `speculative-contact.ts` | 140, 129 | Stay in FloorFifty (race-specific) |
| `ui/store/room-store.svelte.ts` | 113 | `net` room store: a read-only mirror of `RoomInfo` |
| `packages/shared/src/common/schemas.ts` | 252 | The strict-Zod rule ("an unrecognised field is a rejection") for `net/src/wire` |

### 4.3 `server` (`automata-plus/packages/server`, M7.3, M7.4)

```ts
export interface BotPolicy {                   // the bot-seat hook (PD-5): no AI ships
  readonly name: string
  /** Called once per tick for each bot seat, after inputs are taken. Reads the sim; never writes it. */
  commands(view: SimView, seat: number, rng: Rng): readonly { type: string; payload: unknown }[]
}
export interface ServerGameDef {
  readonly plugins: readonly PluginDef[]       // the game's sim, the same list its client uses
  readonly content: SimContentData              // compiled content; its hash must equal the client's
  readonly seats: { readonly min: number; readonly max: number }
  readonly lobby?: { readonly countdownSeconds: number; readonly startWhen: 'all-ready' | 'host' }
  readonly seat?: (seat: number, name: string) => readonly { type: string; payload: unknown }[] // spawn commands
  readonly bots?: BotPolicy
}
export interface ServerLimits {                 // the environment's; `startServer` refuses without the first two
  readonly maxRooms: number                     // sized by the load test (§4.6)
  readonly allowedOrigins: readonly string[]     // exact origins; from Ruken's `gameOrigin` plus any web/itch origin
  readonly maxMessageBytes: number              // [16384] checked before parsing
  readonly socketsPerIp: number                 // [16]
  readonly perIp: { readonly create: Bucket; readonly join: Bucket; readonly reconnect: Bucket }
  readonly commandsPerSeat: Bucket              // [burst tickHz, refill a little above tickHz]
}
export interface SessionVerifier {             // R-13; the fake verifies test tokens; until R-13 Ruken's is absent
  verify(token: string): Effect.Effect<{ readonly playerId: string }, SessionRejected>
}
export function defineServer(def: ServerGameDef): ServerDef
export function startServer(def: ServerDef, config: ServerConfig): Effect.Effect<never, ServerStartError, Scope.Scope>
```

**Room rules** (each a plain module with its own tests, the Colyseus room only adapts them, as FloorFifty's `race-room.ts` does):
- **Tick scheduler:** schedules each tick at its absolute due time on the injected clock (Effect `Clock` in production, `TestClock` in tests), with no accumulator bursts (`tick-scheduler.ts`: the `setInterval` design "ticked at 59.73 Hz with a 99th-percentile gap of 34 ms"). Late ticks are logged as slow ticks.
- **Input queue:** a command is held until its stamped tick; a late one takes effect on the next tick, never rewound; a command more than `maxLeadTicks` ahead, out of sequence, or past 32 queued is dropped with a reason (`input-queue.ts`). The server sets `source` from the connection's seat and `tick` from the queue; a client's `source` is never read.
- **Validation:** every inbound message is size-checked (`maxMessageBytes`) before parsing, then parsed by its strict Zod schema, then a `cmd` payload is parsed by the sim's own command schema. Any failure drops the message, counts a refusal and never reaches the sim.
- **Seats:** `seat-registry.ts`: one path by which a client learns its seat (`seated` after the next tick), reconnection holds for `reconnectGraceSeconds`, then `seat.left`.
- **Command ledger:** request ids answered exactly once, bounded history per session (`command-ledger.ts`), so a resent "ready" never acts twice.
- **Lobby:** ready, countdown, host seat, start and start over; game-specific rules (laps, modes, picks) are the game's.
- **Bot seats:** the host adds a bot to an open seat; each tick the room calls `BotPolicy.commands` with a read-only view and an RNG from `deriveSeed(roomSeed, seat)`; its commands enter the same input queue with the bot's `source`, so they are recorded in the replay and clients see bots only through snapshots. No policy configured: `bot.add` is refused.
- **Replay:** every room records with `createRecorder` on its sim, fed by exactly what `step` receives (FloorFifty `replay-recorder.ts`' rule); the packed replay is offered to clients at the end.
- **Drain:** on SIGTERM the server opens no rooms and seats nobody new (reconnects pass), tells lobbies to move (`SERVER_UPDATING`), lets playing rooms finish, and exits when none is left or at the cap (`drain.ts`).
- **Process safety:** an uncaught error writes one fatal log line and exits 1; the server refuses to start without `maxRooms` and `allowedOrigins`, or with a test switch (test driver, fixed seed, clock hold) set (`process-safety.ts`).

| From (FloorFifty `apps/server/src/…`) | Lines | Goes to |
|---|---|---|
| `rooms/input-queue.ts`, `tick-scheduler.ts`, `seat-registry.ts`, `command-ledger.ts`, `input-meter.ts`, `room-code.ts`, `live-rooms.ts`, `room-errors.ts` | 138, 92, 151, 102, 58, 66, 19, 35 | As above, generic over `Command` instead of `InputFrame` |
| `rooms/lobby-rules.ts` | 327 | Ready, countdown, host, start over → `server` lobby; laps, modes, survival clock stay |
| `rooms/cpu-rules.ts` | 110 | Seat rules for a client-less seat (always connected and ready, never host) → bot seats; CPU driving stays cut |
| `rooms/replay-recorder.ts`, `replay-compression.ts` | 190, 18 | Replaced by AF `createRecorder` and `packReplay`; its feeding rule is kept |
| `rooms/room-telemetry.ts` | 381 | Slow ticks, step spikes and late inputs → structured log events (§4.5) |
| `rooms/room-driver.ts`, `clock-hold.ts` | 243, 81 | Test driver and clock hold → `server/testing`, refused in production |
| `rooms/race-room.ts` | 1054 | Its Colyseus lifecycle (create, join, leave, reconnect, dispose, messages) → the generic room; race phases stay |
| `rooms/race-projection.ts`, `race-room-commands.ts`, `race-room-state.ts`, `select-rules.ts`, `character-rules.ts`, `race-tuning.ts`, `room-access.ts` | 231, 272, 326, 284, 68, 29, 49 | Stay in FloorFifty (race-specific; AF sends the sim's own snapshot) |
| `gate/client-ip.ts`, `matchmake-gate.ts`, `origins.ts`, `socket-gate.ts`, `token-buckets.ts`; `http-body.ts`; `matchmake-version-gate.ts` | 39, 96, 35, 43, 64; 42; 86 | Gates, unchanged in rules |
| `drain.ts`, `process-safety.ts`, `colyseus-server.ts`, `colyseus-app.ts`, `security-txt.ts` | 78, 38, 363, 41, 18 | Process, `/health`, `/ready`, `/.well-known/security.txt` |
| `telemetry-endpoint.ts`, `telemetry-config.ts`, `build-facts.ts`, `main.ts`, `dev.ts`, `content/*` | 77, 21, 16, 44, 82, 41 | Ops telemetry cut (PD-5); entry points become `startServer` and the game's `server.ts`; content comes from AF `content` |

### 4.4 Determinism rules for networked play

- Client and server run the same `plugins` and the same compiled content; the join check (§4.2) enforces it by hash.
- The sim never imports `net`, `server` or Effect (laws 1, 5; boundaries). `net-owner` and `seat.joined`/`seat.left` are ordinary sim definitions in `net/src/sim`, boundaries-checked.
- Every input the authority applied, including bot and seat commands, is in the room's replay; the replay alone reproduces the room's final hash in four engines.
- Entitlement-dependent state in a networked game is cosmetic only, and its command comes from the client's claim, which the server cannot verify before R-13 (M7-D14).

### 4.5 Server operations contract

```ts
export const serverLogLine = z.object({           // one JSON line per event to stdout (journald)
  ts: z.number().int(), level: z.enum(['info', 'warn', 'fatal']),
  event: z.string().regex(/^[a-z][a-z0-9_.]{1,47}$/),
  room: z.string().optional(),                     // an internal room index, never the room code
  seat: z.number().int().optional(), code: z.string().optional(), ms: z.number().optional(),
  count: z.number().int().optional(),
}).strict()                                        // no address, name, room code, token or payload field exists
```

- **Logs:** the schema has no field that can hold an address, player name, room code or token, and every line is parsed by it before writing; a test fails if a planted token, name, code or IP reaches stdout. Events: `room.created`, `room.disposed`, `seat.joined`, `seat.left`, `refused` (with the gate's code), `tick.slow`, `step.slow`, `input.late`, `drain.started`, `drain.done`, `fatal`. journald keeps 14 days (FloorFifty `MaxRetentionSec=14day`).
- **Health:** `GET /health` answers 200 while the process runs; `GET /ready` answers 200 only when it accepts new rooms (false while draining or before content loads). Both carry no player data.
- **Uptime:** an external monitor checks `/ready` every 5 minutes and alerts the operator after 2 failures (FloorFifty `docs/release.md` "Monitoring"). The provider is chosen by the Owner and recorded in the deploy doc; AF holds no credential for it.
- **Weekly report:** `automata-server report` prints restarts, fatal classes, sockets given up, slow ticks, refusals by limit and peak live rooms from the last 7 days of logs (FloorFifty `deploy/bin/report`).

### 4.6 Server deploy target (`automata-plus/packages/server/deploy`, M7.7)

- **Shape (M7-D6, FloorFifty's proven pattern):** one Linux box; Caddy terminates TLS (`wss://` on 443, which Ruken's `[network].connect` rule allows) and proxies to one of two systemd units (`<game>@blue`, `<game>@green`); a release is a tarball of the bundled server and its content.
- **Commands:** `automata-server build` (bundle + content + build id), `deploy <tarball>` (install, start the idle colour, wait for its `/ready`, switch Caddy, stop the old colour, which drains), `activate <buildId>` and `rollback` (= `activate "$(cat previous)"`), `report`. They run over SSH with a command-locked deploy key through `ProcessRunner`. If the new colour never becomes ready, the live colour is untouched.
- **Releases kept:** the ten newest, never pruning the live one or `previous`.
- **Config:** `/etc/<game>/env` holds `NODE_ENV=production`, `MAX_ROOMS`, `ALLOWED_ORIGINS`; the server refuses to start without them (§4.3).
- **Cost alert:** the box's provider account has a monthly spend alert set by the Owner before the box is announced (FloorFifty: a budget alert on its staging subscription). Recorded in the deploy doc; an Owner gate.
- **Load test** (`server/testing/load-bots.ts`, from FloorFifty `tests/load/bots.ts`, 146 lines): rooms of four headless `net` clients that join a private room, ready, play a seeded random walk of commands at `tickHz` and play again until stopped. It prints rooms created, rounds finished, refusals by code and stuck bots, and exits non-zero if any bot is stuck. **The room count M7 sets: 25 rooms of 4 seats for 10 minutes** on the target box with zero slow ticks in the report. `MAX_ROOMS` is 70% of the first room count, stepping by 10 from 10, that shows slow ticks; under 25, the box is resized (FloorFifty's sizing rule).
- **Ruken manifest:** `ship prepare` checks the game's `[network].connect` entries with Ruken's `checkConnectEntry` and count limit (`CONNECT_MAX_ENTRIES`, imported, never copied) and fails if `net.toml`'s `url` is not listed.

### 4.7 Harnesses (`net/testing`, `server/testing`, M7.2, M7.6)

```ts
export function createLink(options: { seed: number; latencyMs: number; jitterMs: number; loss: number; duplicate: number; reorder: number }): { client: Transport; server: Transport }  // on TestClock
export function createHeadlessClient(def: ClientGameDef, link: Transport): HeadlessClient        // net without a renderer
export function startTestServer(def: ServerDef, options?: TestServerOptions): Effect.Effect<TestServer, never, Scope.Scope>  // @colyseus/testing's boot
export function twoClientReplay(options: TwoClientReplayOptions): Effect.Effect<GoldenReport, GoldenError> // the M7 golden
```

- Deterministic link: every delay, loss, duplicate and reorder is drawn from the seed, on `TestClock`, so a failure replays exactly (FloorFifty's netcode model test is the same idea; its real-time lab stays a tool, `pnpm netlab`).
- **Two-client replay golden:** a server and two headless clients over seeded links play a scripted input stream; the server records the replay. Pass: the server's final hash equals the replay's final hash, each client's reconciled hash at the last authoritative tick equals the server's hash at that tick, and replaying the file gives the same final hash in Node, Chromium, WebKit and Firefox.
- **Bundle check:** a build of a game whose extensions do not include `net` contains no `@colyseus` code and no `net` marker string; a test fails on a planted import (old A7: "single-player bundles contain no netcode").

### 4.8 `store` (`automata-plus/packages/store`, M7.8)

```toml
# content/store.toml (schema `store`); SKUs and season ids follow Ruken's slug rule (`SLUG_RE`, imported)
[[item]]
sku = "skin-ember"
title = "store.skin_ember"          # a locale key (PRODUCT.L), never a literal
reward = { cosmetic = "skin.ember" }

[[season]]
id = "s1"
pass_sku = "pass-s1"                # a subscription SKU with plan "season"
xp = [100, 150, 200]                # XP to each next tier, integers
free = [{ tier = 1, reward = { cosmetic = "trail.dust" } }]
paid = [{ tier = 1, reward = { cosmetic = "skin.ember-gold" } }]
```

```ts
export const storePlugin: PluginDef   // `entitlements` resource { items: sorted SKUs, active: sorted subscription SKUs },
                                      // `entitlements.set` command (source: host), `pass` resource { season, xp, tier },
                                      // `pass.xp` command, `store.granted` and `pass.tier` events
export interface Store {              // an Effect service
  buy(sku: string): Effect.Effect<'owned' | 'not-owned' | 'pending', HostError>
  manage(sku: string): Effect.Effect<void, HostError>
  readonly available: boolean         // the `store` capability is granted
}
export const storeExtension: ExtensionDef<'store'>
```

- **Entitlements enter the sim as commands.** Each `Hosting.entitlements` value (welcome and every change) becomes one `entitlements.set` command at the next tick, carrying the sorted item and active subscription SKUs. The sim never reads the host. The command is in the replay, so a replay with entitlement changes reproduces (old A9 acceptance).
- **Grant on ownership, not on purchase result.** Grants happen when `items` gains a SKU or a subscription becomes `active` (old master spec §7 "Store" row; the SDK: "A TIMEOUT does not mean failure: watch on('entitlements')"). `buy` returning `pending` (TIMEOUT) is shown as "Waiting for the store"; the grant arrives with the entitlement.
- **Grant-once ledger:** each reward granted is recorded once in the game's save (`SaveDef` field `storeLedger: Record<string, number>`, key `<sku>` or `<season>:<tier>:<track>`, value the tick), so a reload, a second device or a replayed entitlement never grants twice.
- **Lapsed subscriptions** lock the paid track's *future* rewards and hide paid cosmetics' use where the game says so; XP and tiers earned are kept (old A9: "a lapsed subscription locks the paid track without losing earned progress").
- **Unavailable store:** standalone, web and itch builds (PUB) and a Ruken session without the `store` grant hide the store's buttons; nothing unlocks locally (host authority). `devBuild` entitlements from the host are honoured as the host sends them (R-15).
- **Catalog to Ruken:** once R-12 lands, `store` contributes the `[store]` table through `defineExtension.manifest`; until then `ship prepare` writes no `[store]` (Ruken's parser refuses it with `STORE_NOT_AVAILABLE` at `b30d31b`), and a store game is tested under the fake host only.
- **Real money stays mocked:** tests drive purchases with `@ruken/sdk-host/testing`'s `createFakeEntitlement({ products })` and `createFakeStore()`, whose checkout result is scripted (`completed`, `cancelled`, `pending`, timeout). AF integrates no payment provider.

### 4.9 `host-tauri` (deferred, M7-D15)

Specified so the trigger has a target: a `desktop` build target (PUB's `--target` model) whose adapter is PUB's web adapter plus Quit (the only adapter that grants `exit` as quitting the app), saves in the app's data directory, and no `store`. **Trigger:** a game ships a desktop or itch.io "Downloadable" build (PUB §2: "selling needs a Downloadable desktop build"). Ruken's own desktop app is a Tauri shell that frames games itself (`https://tauri.localhost` is in `@ruken/manifest`'s host origins), so a Ruken game needs nothing from `host-tauri`.

### 4.10 Fixture game and examples (M7.9)

- **One-file examples** (EX spec rules, `Tier: plus`): `net/net-two-players.ts` (two seats in one room on Emberwick's room), `net/net-bot-seat.ts`, `store/store-item.ts`, `store/store-season-pass.ts`.
- **`games/base-online`** (in `automata-plus`): Emberwick's room with two to four seats, pickups that score, a bot policy that walks to the nearest pickup, a cosmetic skin item and a three-tier season pass, a server entry, a `net.toml` and a deploy config. It is the M7 integration fixture and the base PRODUCT.8's Party Racer starts from.

## 5. Data and lifecycle flows

**Client boot** (master spec §7 order): `no-eval` → host → settings → content (with `net.toml`, `store.toml`) → assets → renderer → ready. `net` opens no socket before the player chooses an online action; `store` sends its first `entitlements.set` on the first tick after ready.

**Create or join:** player picks Create, Join (code) or Quick match → `NetRoom` sends the matchmaking request with `JoinOptions` → server gates (drain, per-IP buckets, body cap, protocol and hashes, origin, session) → room seats the player → next tick: `seated` and `seat.joined` (a sim command) → the room store mirrors `RoomInfo` → lobby screen.

**Ready and start:** all ready (or the host starts) → countdown on the room's clock → `phase: playing` at tick S.

**Per server tick:** take due commands from the input queue (seat-stamped) → bot policies add theirs → `sim.step(commands)` → recorder records → every `snapshotEvery` ticks: `publishSnapshot` with acks → slow-tick check.

**Per client frame:** sample input once per predicted tick → stamp, apply to the client sim, send → on each snapshot: reconcile (§4.2) → render clock picks render time → local seat's entities from the predicted sim, others from the interpolation buffer → present.

**Drop and reconnect:** socket closes → `reconnecting` → backoff retries with the token → the seat is still held → `connected`, next snapshot restores → play continues. Past the grace: `seat.left`, the client shows "Disconnected too long" with Leave.

**Reload mid-room:** `resume` once with the stored token → `resumed`, `none` or `expired` (forgotten, never retried).

**End:** `phase: ended` → the server offers the replay → results (kit) → Play again (back to lobby) or Leave → the room disposes when empty.

**Deploy:** build → `deploy` → idle colour ready → Caddy switched → old colour drains (lobbies told `SERVER_UPDATING`, playing rooms finish) → exits. **Rollback:** `rollback`, which is the same path.

**Purchase:** Buy → `Hosting.store.purchase` → host checkout (Ruken's, or the fake's script) → `owned`, `not-owned` or `pending` → independently, `entitlements` changes → `entitlements.set` at the next tick → `store.granted` → ledger written through `Save` → reward shown.

**Lifecycle:** background pauses the client loop (M1.5), but the room keeps ticking: the seat's held command stays in force, and on return the client restores the next snapshot. `session.exiting` leaves the room (best effort) and flushes the save (M5). Dispose closes sockets, timers and listeners in the scope.

## 6. Failure policy

| Case | Result |
|---|---|
| A client message over `maxMessageBytes` | Dropped before parsing; `refused` log with `code: 'size'`; a matchmaking body past the cap gets 413 and the connection closes |
| A message that fails its schema, or a `cmd` whose payload fails the sim's command schema | Dropped; counted; never reaches the sim; the room and other seats are unaffected |
| A client claims another `source` or a tick far ahead | `source` is ignored (the seat's is used); a tick past `maxLeadTicks` is dropped with reason `lead` |
| A seat exceeds its command bucket | Frames over budget are dropped, never a disconnect (`input-meter.ts`) |
| An address exceeds create, join, reconnect or socket limits | `RATE_LIMITED` (or the socket is refused); other addresses unaffected |
| Origin not in `allowedOrigins` | Refused before Colyseus; logged with `code: 'origin'` |
| Schema or content hash differs from the room's | `VERSION_MISMATCH`; the client shows Reload |
| Session token rejected by the verifier | `UNVERIFIED`; not seated. Before R-13, no Ruken verifier exists: the server runs with the anonymous verifier and grants nothing durable by identity (M7-D7) |
| `maxRooms` reached | `SERVER_BUSY` |
| Server draining | New rooms and seats refused with `SERVER_UPDATING`; reconnects pass; playing rooms finish |
| Snapshot bytes whose `hash()` after restore differs from the header | Not stepped on; the client asks for a resync; a second mismatch in 10 s ends the session with an error naming desync (a bug, investigated, never retried silently) |
| Connection lost | `reconnecting` with backoff inside the grace; then "Disconnected too long", Leave |
| Network too slow (round trip or snapshot gap past threshold) | `degraded` indicator; no freeze; authority is never overridden |
| Process crash | One `fatal` line, exit 1, systemd restarts it; rooms are lost and their clients show the disconnect message |
| New colour never ready on deploy | Deploy stops; the live colour keeps serving; the command exits non-zero |
| `store` not granted, standalone, web or itch | Store buttons hidden; `buy` would fail `UNSUPPORTED`; nothing unlocks locally |
| `purchase` fails `DENIED` (SKU not in the host's catalog) | "This item isn't available"; logged; no grant |
| `purchase` fails `TIMEOUT` | "Waiting for the store"; the grant arrives with the entitlement if the purchase completed |
| `purchase` fails `RATE_LIMITED` or `OFFLINE` | Buy disabled briefly with the message; retry only when the error is retryable |
| Checkout cancelled | `not-owned`; nothing changes |
| Ledger write fails (`HostError`) | The reward stays granted in the sim (entitlements are the truth); the ledger write is retried on the next autosave; a grant is never duplicated because grants are keyed |
| Subscription lapses | Paid track locked for future tiers; earned XP and tiers kept |
| A game publishes a store catalog to Ruken before R-12 | `ship prepare` refuses to write `[store]`, naming R-12 |

## 7. UI inventory and states

| Component | Owner | States | Focus and input | Host-aware |
|---|---|---|---|---|
| Connection badge (`hud.overlay`) | `net` | hidden (offline, single player), connecting, connected (hidden after 2 s), reconnecting (seconds left), degraded | None (not interactive); announced by a polite live region | Inside `geometry.visible`, never under `hostReserved` |
| Reconnect overlay | `net` | reconnecting with countdown; disconnected too long with Leave (48 px) | Leave focused; Back = Leave | Pauses nothing in the room; the local loop keeps drawing |
| Room error copy | `net` | one message per `NetError` code, each naming the cause and the next action (QB, PRODUCT.6) | — | Locale keys |
| Lobby, room code, ready room, results | PRODUCT.6 kit | consume `NetRoom.info` and `connection` | Kit rules | Kit rules |
| Store button (`title.actions`, `pause.actions`) | `store` | hidden (not available), shown | 44 px | Shown only when `store` is granted |
| Store panel | `store` | loading catalog, list (owned, buyable, waiting), buying (checkout open), waiting for the store, not available, error | List in a declared scroll region; first buyable focused; Back closes | Host checkout is Ruken's UI; AF never draws payment UI (QB.2) |
| Pass track | `store` | free and paid tracks; tier reached, claimable, claimed; paid locked (no pass or lapsed); Manage (subscription) | Horizontal list with focus; 44 px tiles; Manage 48 px | Manage only when `store` is granted |

## 8. Responsive behavior

| Situation | Policy |
|---|---|
| Phone landscape and compact (844×390, 780×270) | Badge is one icon with a short label; reconnect overlay is a single row with Leave; store panel is one column, two rows of items visible, the rest scrolls; pass track scrolls horizontally with the current tier in view |
| Portrait phone | Store panel one column; pass track vertical |
| `scale` 1.333 and `xx-long` | Text and targets scale through `--af-scale`; no clipped price, title or Leave; long titles wrap to two lines |
| Keyboard or browser bar appears (join by code) | No remount; the code field stays in `geometry.visible` (M4) |
| Host checkout open | The game is backgrounded by the host; the store panel shows "Buying…" on return until the result |
| Reduced motion | Badge and overlay appear without animation |

## 9. Test allocation

| Layer | Where | What it proves |
|---|---|---|
| Unit (Node, `TestClock`) | `net`, `server`, `store`, `host` | Ported FloorFifty behavior specs: `input-queue` 11, `tick-scheduler` 3, `seat-registry` 13, `command-ledger` 14, `input-meter` 6, `room-code` 4, `cpu-rules` 18 (seat rules only), `race-room-reconnect` 16, `race-room-drain` 5, `replay-recorder` 12 (rule only), `drain` 6, `process-safety` 9, gate suites (`client-ip` 6, `matchmake-gate` 8, `origins` 5, `public-surface` 11, `refusal-log` 5, `socket-gate` 5, `token-buckets` 7), `input-lead` 10, `render-clock` 26, `snapshot-buffer` 9, `race-netcode` 17, `net-diagnostics` 11, `netcode-model` 9, `colyseus-network` 69 and `reconnect` 12 (generic parts). Each unportable test is listed in its task plan with the reason. New: every wire schema rejects unknown fields and oversize input; reconciliation re-steps the right commands; `Hosting.store` relays each SDK code; store ledger, lapse and timeout rules |
| Server integration | `server` with `@colyseus/testing` | Real rooms: join, ready, play, reconnect, drain, refusals, bots, replay offered |
| Deterministic network | `net/testing` links | Latency, jitter, loss, duplicates, reorder, stalls and reconnects on `TestClock`: no desync, hashes agree (N-a, N-b) |
| Golden and parity | `twoClientReplay`; `store` replay | The two-client golden and an entitlement replay in Node, Chromium, WebKit, Firefox |
| Bundle | `games/emberwick` (no `net`), `games/base-online` | No netcode in a single-player bundle; no Ruken SDK code in an itch build of base-online (PUB) |
| DOM behavior | badge, overlay, store panel, pass track | States, focus, Back, hidden when unavailable |
| Layout | the same at every reference size and `xx-long` | No clipped or hidden required action |
| Fake-host E2E | `base-online` client under `@ruken/sdk-host` with `compileHeaders`, against a local test server | Two browser contexts join one room and play; a purchase with `createFakeStore` and `createFakeEntitlement`; zero CSP violations and console errors |
| Load and drills | staging box, by hand (FloorFifty `deploy/drills/*`) | §4.6 load test; kill mid-room, `netem` delay and loss, activate under load, socket cap, soak, stopped process, rebuild from nothing, exploit rows |
| Owner | real phones, real box | §13 |

## 10. Feedback workflow

- Focused first: one Vitest file (`pnpm --filter @mcthaydt/automata-server exec vitest run src/rooms/input-queue.test.ts`), then the package's integration suite, then the deterministic-link suite, then the two-client golden in Node, then its parity project.
- The real-time netcode lab (`pnpm netlab`, FloorFifty's, about 90 s) is a tool, not a gate; its deterministic model is the gate.
- Browser checks wait on `session.ready`, the room store's `phase`, `connection: connected` and a tick count, never a sleep. E2E servers get per-checkout ports (M1.1) and are started and stopped by the run that owns them.
- Load tests and drills run only against staging, never production, and never from CI.
- Full gates before each PR, under the heavy-gates lock: `pnpm check`, `pnpm test:parity`, and `pnpm test:e2e` when UI, an example or a game changes.

## 11. Ruken alignment and requests

| Behavior | Ruken contract (vendored, `b30d31b`) |
|---|---|
| Capabilities | `@ruken/sdk` `CAPABILITIES` includes `entitlements` and `store`; nothing for networking (games talk to their own servers) |
| Purchase and manage | `RukenSession.store.purchase(sku) → { owned }`, `manage(sku)`; host flow in `@ruken/sdk-host` (`DENIED` for an unknown SKU, `owned: true` if already owned, `TIMEOUT` while pending, then an entitlement refresh) |
| Entitlements | `EntitlementsPayload { ads, items, subscriptions[{ sku, plan, active, seasonId?, endsAt? }], devBuild }`, pushed as `entitlements.changed` |
| Standalone | The SDK's standalone store fails `UNSUPPORTED`; entitlements are empty |
| Fake host | `createFakeStore`, `createFakeEntitlement({ products })` with `grant(sku)` and `set(...)` |
| Catalog | `[store]` is refused by `parseManifest` (`STORE_NOT_AVAILABLE`: "[store] is not available yet") |
| Server origins | `[network].connect`: `https`/`wss` origins only, public DNS names, default port or 8443, no localhost or IP literals, no Ruken hosts, at most `CONNECT_MAX_ENTRIES`; checked with `checkConnectEntry` |
| Game origin for the server's allowlist | `gameOrigin(publicId, env, channel)` (`g-<publicId>.rukengames.com` and the dev domain) |
| Identity | `player.id` and `displayName` only; no signed credential a game server can verify |

**Requests to Ruken** (numbered after M6's R-11; the Owner files them):
- **R-12.** The `[store]` manifest section: its schema in `@ruken/manifest` (SKU, kind item or subscription, title, plan, season ids), so `ship` can write the catalog the host's `Entitlement.products` already expects. Today `parseManifest` refuses `[store]`.
- **R-13.** A game-server session credential: a short-lived signed token for the current player and game (for example `session.serverToken()` in the SDK) and a way for a game's server to verify it (a public key set or a verify endpoint), so the server can trust `player.id`. Without it, QB §5's "session tokens verified with Ruken" cannot be met.
- **R-14.** A supported local-development path to a game server: `[network].connect` refuses localhost, IP literals and ports other than 443 and 8443, so a game on Ruken's local stack cannot reach a server on the developer's machine. For example, a `local`-env-only extra connect list, like `compileHeaders`' `extraHostOrigins`.
- **R-15.** Confirm that checkout in Ruken's local and TEST stacks never charges real money, and how a developer grants a SKU to a `devBuild` session without a purchase. AF's acceptance on Ruken depends on it.

## 12. Tasks

| ID | Task | Lane | Depends on | Deliverable and acceptance |
|---|---|---|---|---|
| M7.0 | This spec | integration | — | Merged on recommended defaults; M7-D1 to M7-D18 open for veto |
| M7.1 | `Hosting.store` | host | M7.0 | §4.1; shared contracts §1 amended; HS-a, HS-b |
| M7.2 | `net` wire schemas and the deterministic link harness | net (new) | PRODUCT.5 | §4.2 wire, §4.7 `createLink`; SV-a |
| M7.3 | `server` rooms | net | M7.2 | §4.3 room rules, bot hook, recorder, drain; SV-b, SV-e |
| M7.4 | `server` gates and operations | net | M7.3 | §4.3 gates, §4.5 logs and health, `SessionVerifier` with the anonymous and fake verifiers; SV-c, SV-d, SV-f to SV-h |
| M7.5 | `net` client | net | M7.3 | §4.2 transport, room store, prediction, reconciliation, interpolation, reconnection, diagnostics; N-a to N-d |
| M7.6 | Two-client replay golden, bundle check | net, testing | M7.4, M7.5 | §4.7; X-a, X-b |
| M7.7 | Server deploy target | net, ship | M7.4 | §4.6: build, deploy, activate, rollback, report, Caddy and systemd templates, load bots; D-a to D-c |
| M7.8 | `store` | store (new) | M7.1, M5.1, PRODUCT.5 | §4.8 under the fake host; ST-a to ST-f |
| M7.9 | Examples and `games/base-online` | integration | M7.6, M7.8 | §4.10; X-c |
| M7.10 | M7 exit | integration | M7.1 to M7.9 | §13 cases; Owner gates; external items (R-12, R-13) recorded as open or closed |
| M7.11 | `host-tauri` (deferred) | ship | its trigger, PUB.1 | §4.9; starts only when a desktop or itch "Downloadable" build is requested; M7.10 does not wait for it |

Order: M7.1 and M7.2 in parallel as soon as their dependencies merge (M7.1 needs only this spec). M7.3 → M7.4 and M7.5 (in parallel) → M7.6. M7.7 after M7.4. M7.8 after M7.1 and M5.1. M7.9 and M7.10 last. PRODUCT.8 (Party Racer) starts after M7.6.

New lanes for 04: **net** (`automata-plus/packages/{net,server}`, including `server/deploy`) and **store** (`automata-plus/packages/store`). M7.1 is the host lane's; M7.7 is reviewed by ship.

## 13. Exit criteria and acceptance cases

**Success:**
- **HS-a.** Under the fake host with `store` granted and a product `skin-ember`, `Hosting.store.purchase('skin-ember')` returns the SDK's `{ owned: true }` when the fake checkout completes; `manage` on a subscription SKU resolves.
- **SV-a.** Every `ClientMessage` and `JoinOptions` schema rejects an unknown field, a wrong type and a value past its bound; a 16 KB + 1 byte message is dropped before parsing (size cap).
- **SV-b.** A command stamped for tick 120 that arrives at tick 100 takes effect at 120; one arriving at 125 takes effect at 126 and is logged `input.late`; the server never rewinds.
- **SV-e.** The host adds a bot to a 2-seat room; the bot's commands appear in the replay with its seat as `source`, and replaying gives the room's final hash.
- **N-a.** Over a seeded link (100 ms ± 30 ms, 2% loss, 1% duplicates, reorder), two headless clients and a server play 3,600 ticks with no hash mismatch after any reconcile, and the local seat's command takes effect in the client sim on the tick it was sampled.
- **N-b.** A client whose socket drops for 5 s returns to its seat, restores the next snapshot and its hash matches the server's at that tick; the room never paused.
- **N-c.** A reload mid-room calls `resume` once and is seated again; an expired token reports `expired` and is forgotten.
- **X-a.** **Two-client replay golden:** server final hash = replay final hash = each client's hash at the last authoritative tick, and the replay reproduces it in Node, Chromium, WebKit and Firefox.
- **X-b.** A build of `games/emberwick` (no `net`) contains no `@colyseus` code or `net` marker.
- **ST-a.** A replay that includes two `entitlements.set` commands (grant at tick 50, lapse at tick 400) reproduces the same final hash in four engines.
- **ST-b.** A purchase whose fake checkout ends `pending` returns `pending`; when the fake entitlement later grants the SKU, the reward is granted exactly once and the ledger records it.
- **ST-c.** A lapsed season pass locks paid tiers above the current one; XP and tiers earned are unchanged.
- **D-a.** `deploy` of build B while build A serves 5 bot rooms: B becomes ready, Caddy switches, A's rooms finish and A exits; `rollback` returns to A the same way. Rehearsed once on staging and recorded.
- **D-b.** The load test runs **25 rooms of 4 seats for 10 minutes** on the target box with zero slow ticks, zero stuck bots, and `MAX_ROOMS` recorded from the sizing rule.
- **X-c.** `games/base-online` boots under the fake host with `compileHeaders`' CSP, two browser contexts create and join one room, play to the end and see the same scores; zero CSP violations and console errors.

**Failure cases that must be shown by tests:**
- **HS-b.** Standalone, and hosted without the `store` grant, `purchase` fails `HostError{ code: 'UNSUPPORTED' }`; an unknown SKU fails `DENIED`; nothing is granted.
- **SV-c.** A 17th socket from one address is refused and the other 16 are unaffected; create, join and reconnect buckets refuse with `RATE_LIMITED` per address; a seat sending twice its command budget has the excess dropped and stays connected.
- **SV-d.** A request from an origin not in `allowedOrigins` is refused; the server refuses to start without `maxRooms` or `allowedOrigins`, or with a test switch set, naming it.
- **SV-f.** With the fake verifier, a forged or expired session token is refused `UNVERIFIED` and not seated.
- **SV-g.** A planted token, player name, room code and IP address in a request never appear in stdout (log redaction test over the full join, play, refuse and crash paths).
- **SV-h.** `/ready` is false while draining and before content loads; `/health` stays 200; a client with another content hash is refused `VERSION_MISMATCH`.
- **N-d.** A corrupted snapshot frame (bytes changed) is not stepped on; a resync follows; two in 10 s end the session with a desync error.
- **ST-d.** With `store` not granted (standalone, itch build, or no grant) the store buttons are absent and no reward unlocks.
- **ST-e.** A checkout `cancelled` returns `not-owned` and grants nothing; `RATE_LIMITED` disables Buy with its message.
- **ST-f.** Replaying the same `entitlements.set` twice, or loading the save on a second device, never grants a reward twice.
- **D-c.** A deploy whose new colour never answers `/ready` exits non-zero and leaves the live colour serving.
- **X-d.** A golden hash mismatch between engines in `net`'s or `store`'s sim parts fails parity (never rebaselined).

**Gates reported separately:** implemented; locally verified (`pnpm check`, parity, fake-host E2E); staging verified (load test, drills, rollback rehearsal); deployed (a production box); Owner accepted.

**Owner acceptance (never ticked by an agent):**
- Two real phones on different networks play `base-online` through the deployed server, from Create to results, one of them dropping Wi-Fi mid-room and reconnecting; device, browser, network and date recorded.
- The uptime monitor's provider and the cost alert are set and recorded.
- A store purchase under Ruken's local stack or TEST checkout, with **no real money** (needs R-12 and R-15), or the Owner's decision to accept the fake-host evidence until Ruken ships `[store]`.
- The answers to R-12 to R-15 recorded.

### 13.1 Quality bar traceability (QB §5 and the QB §4.1 rows whose trigger is the M7 server)

| QB item | Where M7 meets it | Acceptance |
|---|---|---|
| §5: Zod validation of every client message, with a size cap | §4.2 wire schemas (strict), §4.3 Validation, §6 rows 1–2 | SV-a |
| §5: Per-connection and per-IP rate limits | §4.3 `ServerLimits` (sockets, create, join, reconnect per IP; commands per seat), §6 | SV-c |
| §5: Session tokens verified with Ruken | §4.3 `SessionVerifier`; R-13 (Ruken has no server credential at `b30d31b`); M7-D7 | SV-f (fake verifier); Ruken verification is an external exit item on R-13 |
| §5: Structured logs without tokens | §4.5 `serverLogLine` (no field can hold a token, address, name or code) | SV-g |
| §5: A health endpoint and an external uptime check | §4.5 `/health`, `/ready`, uptime monitor | SV-h; Owner gate (provider recorded) |
| §5: Deploy with rollback | §4.6 blue/green `deploy`, `activate`, `rollback` | D-a, D-c |
| §5: A load test at the room count the spec sets | §4.6: 25 rooms × 4 seats, 10 minutes; `MAX_ROOMS` sizing | D-b |
| §5: Cost alerts | §4.6 spend alert on the box's account | Owner gate |
| §4.1: Server-side validation ("M7 server: every client message is Zod-validated server-side") | As §5 row 1, plus the sim's own command schema | SV-a |
| §4.1: Database rows (schema, migrations, backups, retention…) | Trigger not met: M7 stores no durable records (M7-D8); rooms are memory, logs are journald 14 days | Stays N/A; reopened by any future server store |
| §4.1: Audit logs without secrets | §4.5 events for refusals, seats and drains | SV-g |
| §4.1: Feature flags, autoscaling, job queues, retries and backoff, dead-letter queue, cron, caching | Retries with backoff: client reconnect (§4.2). Capacity: `MAX_ROOMS` with `SERVER_BUSY`, no autoscaling (M7-D6). No queues, cron, flags or caches exist | N-b; others stay N/A with this trigger: a second server process or region |
| §4.1: Structured logs, uptime, paging, dashboards, runbooks | Logs and uptime as above; the weekly `report`; a runbook section in the deploy doc. Paging and dashboards: N/A for one box (the uptime alert e-mails) | SV-g, SV-h |
| §4.1: Load testing | As §5 row 7 | D-b |
| §4.1: Encryption in transit; CORS and headers | `wss://` only (Ruken's connect rule); CORS from `allowedOrigins`; Caddy's security headers (FloorFifty `security-headers.caddy`) | SV-d |
| §4.1: Idempotency, double-submit dedupe | Command ledger answers each request id once (§4.3); store grants keyed once (§4.8) | ST-f; ledger unit tests |
| §4.1: Secrets out of code | Server secrets only in `/etc/<game>/env`; the client holds none; QB.2's bundle scan applies to `base-online` | QB-b on `base-online` |

## 14. Risks

| Risk | Mitigation |
|---|---|
| Full sim snapshots at 20 Hz cost too many bytes (FloorFifty moved to Colyseus schema patches for this reason) | Measure bytes per second on `base-online` in M7.5 against a budget set from that first run; if over, a delta against the last acked snapshot is an additive `net`-internal change (M7-D2) |
| Re-stepping up to `maxLeadTicks` per snapshot is too slow on phones | Measured by PRODUCT.7's frame budget on the GPU runner; `maxLeadTicks` and `snapshotEvery` are content |
| The sim diverges between server and client | Join hash check; hash after each restore; four-engine goldens; a mismatch is a bug, never rebaselined |
| No Ruken identity for servers (R-13) | Anonymous verifier; nothing durable keyed by unverified identity; cosmetic-only entitlement effects in networked games (M7-D14) |
| `[store]` never ships in Ruken | `store` is tested under the fake host; the Owner can accept that evidence (§13) |
| itch.io games share one origin (PUB §0), so an origin allowlist cannot tell one itch game from another | Rate limits and the content hash check still apply; recorded in the deploy doc |
| Local development cannot reach a local server under Ruken's CSP (R-14) | Develop networked play standalone and under the fake host with a test-only `compileHeaders` target; Ruken-hosted tests use the staging server |
| Extracting from a live FloorFifty | Recorded commit `ac72660`; each task re-reads its files at the commit it extracts from, with the source tests |

## 15. Open decisions (recommended defaults in effect; listed for the Owner's veto)

| ID | Question | Recommended default | Why |
|---|---|---|---|
| M7-D1 | Where M7 code lives | **`mcthaydt/automata-plus`** for `net`, `server`, `store`, `host-tauri`, examples and `base-online`; `Hosting.store` in core | PD-1; leaderboards set the precedent for relaying a Ruken capability in core |
| M7-D2 | Netcode model | **Server authority with full sim snapshots, local prediction by restore and re-step, remote interpolation** (FloorFifty's model) | Proven in FloorFifty; restores the sim's own bytes, so no second state format; lockstep and peer-to-peer would break law 2 |
| M7-D3 | Acks | **On `net`'s wire beside the snapshot**; `NetworkPort` and `AuthoritativeSnapshot` unchanged | Keeps the PRODUCT.1 seam frozen |
| M7-D4 | Transport | **Colyseus 0.18** (FloorFifty's pins) with binary messages for snapshots and a small room-info state; no `@colyseus/schema` for sim state | The sim owns its state (law 3) |
| M7-D5 | Rates | **Snapshots every 3 ticks (20 Hz at 60 Hz), lead ≤ 1 s, interpolation 6 ticks, reconnect grace 30 s**, all in `net.toml` | FloorFifty `constants.ts` (`SNAPSHOT_HZ = 20`, `MAX_INPUT_LEAD_TICKS = TICK_HZ`, `RECONNECT_GRACE_TICKS = 30 * TICK_HZ`) |
| M7-D6 | Server deploy target | **One Linux box, Caddy + systemd blue/green, drain, `activate previous` rollback**; no autoscaling or regions | FloorFifty's rehearsed pattern (`docs/release.md`, rollback rehearsal 2026-09-27); D-4 reuses its static host the same way |
| M7-D7 | Session verification | **`SessionVerifier` port; anonymous until R-13**; nothing durable keyed by identity | Ruken exposes no server credential at `b30d31b` |
| M7-D8 | Server persistence | **None**: no database, rooms in memory, logs 14 days | Nothing in FloorFifty or `base-online` needs one; QB's database rows stay N/A |
| M7-D9 | Bot seats | **Hook only** (`BotPolicy` on the server; commands recorded in the replay) | PD-5 cuts CPU players |
| M7-D10 | Load-test room count | **25 rooms × 4 seats, 10 minutes, zero slow ticks**; `MAX_ROOMS` by FloorFifty's 70% rule | FloorFifty's floor for an announced box |
| M7-D11 | Entitlements in the sim | **`entitlements.set` command at the next tick; grant-once ledger in M5 `Save`** | Old master spec §5; replays reproduce |
| M7-D12 | Real money | **Mocked always**: fake host store and entitlements; no payment provider; Ruken sandbox only for Owner acceptance (R-15) | Owner ruling 2026-10-16 |
| M7-D13 | Store off Ruken | **Hidden and `UNSUPPORTED`** on standalone, web and itch; no local unlock | Host authority (AGENTS.md); PUB §3.1 |
| M7-D14 | Paid effects in networked games | **Cosmetic only**; the client's entitlement claim is accepted for cosmetics until R-13 | Old A9: "rewards should be cosmetic unless server-validated" |
| M7-D15 | `host-tauri` | **Deferred** (specified in §4.9, built only on its trigger) | Neither reference game needs it; Ruken's desktop app already frames games; no speculative work |
| M7-D16 | Effect on the server | **Effect for services, scopes, clock and errors; the per-tick path is plain code; Zod for every wire schema** | ADR 0003 |
| M7-D17 | Fixture game | **`games/base-online`** on Emberwick's room | An AF-owned fixture; PRODUCT.8 builds on it |
| M7-D18 | Server origin allowlist | **Exact origins built from Ruken's `gameOrigin`**, plus listed web and itch origins | Never copies a Ruken origin; FloorFifty `gate/origins.ts` |

## Appendix A. How the counts were produced

On FloorFifty at `ac72660`:

```sh
find apps/server/src -name '*.ts' | xargs wc -l
find apps/client/src/systems/netcode apps/client/src/managers/network -name '*.ts' | xargs wc -l
wc -l apps/client/src/ui/store/room-store.svelte.ts packages/shared/src/common/{schemas,protocol}.ts \
  packages/shared/src/cpu/*.ts tests/load/bots.ts deploy/bin/{deploy,activate} deploy/caddy/Caddyfile
for f in tests/server/rooms/*.test.ts tests/server/gate/*.test.ts tests/server/*.test.ts \
  tests/client/systems/netcode/*.test.ts tests/client/managers/network/*.test.ts; do
  printf '%s %s\n' "$f" "$(grep -cE '^\s*(it|test)(\.each)?\(' "$f")"
done
grep -n 'TICK_HZ =\|SNAPSHOT_HZ =\|MAX_INPUT_LEAD_TICKS =\|RECONNECT_GRACE_TICKS =' packages/shared/src/common/constants.ts
```

On the vendored Ruken tarballs at `b30d31b`, extracted to a scratch directory: `CAPABILITIES`, `RukenSession.store`, `EntitlementsPayload` and the standalone store in `@ruken/sdk` `dist/index.{js,d.ts}`; the `store.purchase` handler and `createFakeStore`/`createFakeEntitlement` in `@ruken/sdk-host` `dist/`; `STORE_NOT_AVAILABLE`, `checkConnectEntry`, `gameOrigin` and the export list in `@ruken/manifest` `dist/index.{js,d.ts}`. On AF at `e42ca91`: `packages/runtime/src/net/network-port.ts`, `packages/host/src/{hosting,hosting-live,errors}.ts`, `packages/sim/src/{world/sim.ts,replay/}`, `packages/ship/src/{config,manifest}/`.
