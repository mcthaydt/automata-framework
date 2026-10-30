# M7.3b: the generic Colyseus room, `defineServer`/`startServer`, bots, replay and drain, TDD plan

- **Spec:** the framework's M7 spec (`docs/superpowers/specs/2026-10-17-m7-online-store-design.md`) §4.2 (the wire,
  `RoomInfo`, the netcode model), §4.3 (`BotPolicy`, `ServerGameDef`, `ServerLimits`, `defineServer`, `startServer`,
  the FloorFifty source table), §4.4 (determinism), §4.5 (the log events, as a seam), §5 (per server tick, ready and
  start, drop and reconnect, reload, end, deploy drain), §6 (failure policy), §13 SV-e.
- **Row:** M7.3b in the framework's `docs/02-master-delivery-plan.md`. Prerequisite M7.3a. Size L.
- **Branch:** `claude/plus-M7.3b-colyseus-room`, on M7.3a.
- **Sources (read-only):** FloorFifty `677d4568b7b2265fda4246d711065b8f417cac26`:
  `apps/server/src/rooms/{race-room,race-room-commands,room-driver,replay-recorder,clock-hold}.ts`,
  `apps/server/src/{colyseus-app,colyseus-server,drain,main}.ts`, `tests/server/{drain,colyseus-server}.test.ts`,
  `tests/server/rooms/race-room-{lifecycle,reconnect,drain,replay,cpus,clock-hold}.test.ts` and
  `tests/server/support/colyseus-harness.ts`.
- **Status:** implemented and checked locally; Plus CI pending; not reviewed.

## Scope

In: `packages/server` gains the room that adapts the M7.3a rules to Colyseus 0.18 and to the sim:

- `ServerGameDef`, `BotPolicy`, `SimView`, `ServerDef` and `defineServer`; `ServerLimits` and `ServerConfig`.
- A plain `RoomEngine` (no Colyseus): the sim, `createRecorder`, the input queue, meter, ledger, seat registry, lobby,
  bot seats, snapshots with acks, the replay offered at the end, drop and reconnect, drain and the clock hold. Every
  rule the room applies is tested here on a fake clock.
- `AutomataRoom`, the Colyseus `Room` that adapts the engine (create, auth, join, drop, reconnect, leave, dispose,
  messages), with a small `@colyseus/schema` room-info state (M7-D4).
- `startServer` (Effect, `Scope`): the HTTP server and Colyseus transport acquired and released in the scope, the
  room defined, the `maxRooms` cap, drain on the first SIGTERM from an injected signal source.
- `server/testing`: a room driver (stop the room's clock, step it, submit commands on the real path unmetered, read
  the room) and a clock hold that refuses when `NODE_ENV` is `production`.
- `@colyseus/testing` integration: join, ready, play, reconnect, drain and bots, on ephemeral ports.

Out (later rows), each left as a named seam: the origin list, the size cap ahead of Colyseus, per-IP buckets, sockets
and the version gate (M7.4a: `ServerLimits.allowedOrigins`, `maxMessageBytes`, `socketsPerIp` and `perIp` are taken
as config and not enforced here; JoinOptions' hashes are parsed and not yet compared); log lines, `/health`, `/ready`,
process safety and `SessionVerifier` (M7.4b: the room reports events through a `log` callback in the §4.5 field
names, and nothing writes them yet); `startTestServer`, headless clients and the two-client golden (M7.6).

Stripped as race-specific: the race state, Planck, projection, select, characters, colours, access, modes, laps,
CPU driving, public-room fill, the telemetry endpoint, `/content`, build facts and the deflate-on-tick replay format
(AF's `createRecorder` and `packReplay` replace FloorFifty's recorder and format; its feeding rule is kept).

## Colyseus pins

FloorFifty's lockfile versions, each published more than 14 days before 2026-10-30, pinned exactly:

| Package | Version | Published | Where |
|---|---|---|---|
| `@colyseus/core` | 0.18.18 | 2026-09-29 | dependency |
| `@colyseus/schema` | 5.0.36 | 2026-10-03 | dependency |
| `@colyseus/ws-transport` | 0.18.4 | 2026-09-25 | dependency |
| `@colyseus/sdk` | 0.18.5 | 2026-10-03 | devDependency |
| `@colyseus/testing` | 0.18.6 | 2026-09-23 | devDependency |
| `@colyseus/tools` | 0.18.7 | 2026-09-30 | devDependency (`@colyseus/testing`'s peer) |

Newer 0.18 releases exist (core 0.18.23, sdk 0.18.8, tools 0.18.11, schema 5.0.43) but are either younger than 14
days or untested by FloorFifty. Transitive packages new to the lockfile were resolved with a 14-day minimum release
age for this install only (msgpackr 2.1.0, dotenv 18.0.8 rather than the 2- and 8-day-old latest); the workspace
setting is unchanged.

## Files

- `packages/server/package.json`: the Colyseus pins, `effect` 3.22.2 (net's), `@types/node`; `exports` gains
  `./testing`. `tsconfig.json`: Node types. `vitest.config.ts`: the integration tests' timeout, as net's.
- `packages/net/src/wire/room.ts` (+ test): `ROOM_NAME` and the two channel names (`NET_CHANNEL` for JSON text,
  `NET_BYTES_CHANNEL` for the binary that follows a `snap` or `replay` header). Net owns the client contract.
- `src/game/sim-view.ts` + test: `SimView`, `ReadonlyEntity`, `simViewOf(sim)`.
- `src/game/server-game.ts` + test: `BotPolicy`, `ServerGameDef`, `ServerDef`, `defineServer`, `ROOM_SOURCE`.
- `src/game/server-config.ts`: `Bucket`, `ServerLimits`, `ServerConfig`, `RoomLogEvent`.
- `src/rooms/clock-hold.ts` + test: `ClockName`, `holdAllowed`, `heldGraceSeconds`, `pushHeldDeadlines`.
- `src/room/room-engine.ts`, `room-types.ts`, `room-messages.ts`, `replay-compression.ts` + tests
  (`room-engine`, `room-engine-seats`, `room-engine-replay`): the plain room.
- `src/room/automata-room.ts`, `room-info.schema.ts`, `presence-code-store.ts` (+ test): the Colyseus adapter, its
  info state and the room-code claim on Colyseus Presence.
- `src/server/drain.ts` + test: `drainRooms` (Effect `Clock`), `drainOnSignal`.
- `src/server/start-server.ts` + test: `startServer`, `createServerRuntime`, `ServerStartError`, `tickClockFrom`.
- `src/testing/index.ts`, `room-driver.ts` + test: the driver.
- `src/room/automata-room.test.ts` and `src/test-support/colyseus-harness.ts`: the `@colyseus/testing` suite;
  `src/test-support/{fixture-game,engine-harness}.ts`: the walking game and the engine's fake clients.

## Interfaces

```ts
// sim-view: a read-only view over a Sim (AF's sim has no SimView export; defined here)
export interface ReadonlyEntity { readonly sid: number; has(c: ComponentDef): boolean; get<S>(c: ComponentDef<S>): Readonly<FieldValues<S>> }
export interface SimView { readonly tick: number; readonly tickHz: number; readonly contentHash: string
  entity(sid: number): ReadonlyEntity | undefined; query(...c: ComponentDef[]): ReadonlyEntity[]
  resource<Z>(def: ResourceDef<Z>): Readonly<z.output<Z>>; hash(): string }        // no step, spawn, restore or set
export function simViewOf(sim: Sim): SimView

// server-game (spec §4.3)
export interface BotPolicy { readonly name: string; commands(view: SimView, seat: number, rng: Rng): readonly { type: string; payload: unknown }[] }
export interface ServerGameDef { plugins; content?: unknown; seats: { min; max }; lobby?: { countdownSeconds; startWhen };
  seat?: (seat, name) => readonly { type; payload }[]; bots?: BotPolicy;
  ended?: (view: SimView, events: readonly SimEvent[]) => boolean }               // added: when play ends
export interface ServerDef { readonly kind: 'server'; readonly game: ServerGameDef; readonly rules: LobbyRules (countdown in seconds → ticks at start) … }
export function defineServer(def: ServerGameDef): ServerDef      // throws for bad seats, a missing netPlugin
export const ROOM_SOURCE = 255                                   // the sim source of the room's own commands

// server-config
export interface Bucket { readonly burst: number; readonly perSecond: number }
export interface ServerLimits { maxRooms; allowedOrigins; maxMessageBytes; socketsPerIp; perIp: { create; join; reconnect }; commandsPerSeat: Bucket }
export interface ServerConfig { port: number; limits: ServerLimits; net: NetConfig; seed?: number; log?: (e: RoomLogEvent) => void;
  signals?: SignalSource; exit?: (code: number) => void; env?: Readonly<Record<string, string | undefined>>; drainCapMs?: number }

// start-server
export class ServerStartError extends Data.TaggedError('ServerStartError')<{ reason: string }>
export function startServer(def: ServerDef, config: ServerConfig): Effect.Effect<never, ServerStartError, Scope.Scope>
export function createServerRuntime(def, config): Effect.Effect<ServerRuntime, ServerStartError, Scope.Scope>  // port, gameServer, drain
// drain
export function drainRooms(rooms: { readonly size: number }, options: { capMs; pollMs? }): Effect.Effect<'empty' | 'cap'>
// testing
export function createRoomDriver(room: DrivableRoom): RoomDriver   // stopClock, step, submit, read, holdClocks (refused in production)
```

## Tests, written first

1. **sim-view (4):** reads tick, hash, query and resources as the sim has them; follows the sim as it steps; has
   no `step`, `spawn`, `restore` or `snapshot`; an entity read through it has no `set`, `add` or `remove`.
2. **server-game (6):** defaults (`countdownSeconds` 3, `all-ready`); refuses seats outside 1 to 16 and min above
   max; refuses a game without `netPlugin`; knows each command's schema and refuses net's seat commands from a
   client; a negative countdown.
3. **clock-hold (4):** refused in production, allowed elsewhere; a held countdown's end moves with the tick; a held
   room pushes dropped seats' deadlines; the grace is ten minutes while anything is held.
4. **room-engine (play):** a join is seated by `seat.join` on the next tick and told `seated`; the lobby drops
   commands; ready starts the countdown and the countdown starts play; a command takes effect on its stamped tick
   with the seat as `source` and is acked in the next snapshot; snapshots every `snapshotEvery` ticks carry the
   sim's hash and bytes; a payload that fails the sim's schema, an unknown type and net's seat commands are dropped
   and never reach the sim; over budget is dropped, never a disconnect; a late command takes effect next tick and is
   logged `input.late`; ping answered with slack; ledger: a resent `ready` acts once.
5. **room-engine (seats):** a drop holds the seat, clears ready and keeps numbering across a transport reconnect; a
   reloaded client (first command after the return numbered 0) has its numbering forgotten (M7.3a obligation); the
   grace on room ticks gives the seat up with `seat.leave`; a leave frees the seat at once; the host is handed on;
   an abandoned room asks to close; a room nobody has reached yet waits the grace.
6. **room-engine (bots, replay, SV-e, determinism):** no policy refuses `bot.add`; **SV-e**: the host adds a bot to a
   2-seat room, the game plays to its end, the replay offered to clients holds the bot's commands with its seat as
   `source` and replaying the file reproduces the room's final hash; **determinism:** a game with people, a bot, a
   drop and a leave records every applied command (seat, spawn, bot and client) and its replay gives the room's final
   hash; play again starts a new recording.
7. **room-engine (drain):** a lobby is closed with `SERVER_UPDATING`; a playing room plays to the end and closes when
   it returns to the lobby; no new seat while draining.
8. **drain (5):** empty at once; polls until the last room closes; stops at the cap, never past it (TestClock); one
   drain however many SIGTERMs, then exit 0; exit 1 when the drain fails.
9. **start-server:** refuses invalid limits with `ServerStartError`; listens on port 0 and answers matchmaking;
   closing the scope shuts the server; leaves SIGTERM to the drain, not Colyseus; `maxRooms` refuses with
   `SERVER_BUSY`; an injected SIGTERM drains (lobby told, playing room kept) and exits.
10. **driver (3):** steps by hand once the clock is stopped; submits on the real path unmetered; reads the room.
11. **Colyseus integration (`@colyseus/testing`):** create and join (a six-character code, `seated` per client, the
    info state); ready and play (commands applied, `snap` header then bytes, hash matches the bytes); reconnect (a
    dropped client returns to its seat, told `seated` again); a consented leave frees the seat; drain (lobby closed
    with 4001 and `SERVER_UPDATING`); bots (`bot.add` answered, the bot seat in the info state, the replay bytes
    received and replayed to the room's hash).

## Gates

`pnpm format`, `pnpm check` (lint, typecheck, boundaries, root tooling tests with the F1 boundary test over
`packages/server`, every package's `test:unit`, the Colyseus suite included under its own timeout). Pending: Plus CI.

## As built (deviations)

- **`ServerGameDef.ended`** is added: `(view, events) => boolean`, asked after each tick of play. §4.3's sketch leaves
  the end to "the game" and gives the room no way to hear it; without it a game plays until its room closes.
- **Play again is `ready: true` in an ended room.** Net's wire has no play-again message; a draining room closes on
  it instead of starting over (FloorFifty closed a draining room when it went back to its lobby).
- **Reload versus reconnect.** Colyseus gives the room no way to tell a reloaded client (`NetRoom.resume`) from a
  transport reconnect. The room's rule: the first command after a return numbered 0 restarts the seat's numbering
  (`InputQueue.forget`, M7.3a's obligation); any other continues it. M7.5a's client must therefore number from 0
  after a reload and, after a transport reconnect, resend only what the next snapshot has not acked.
- **Lobbies are told to move by the close code**, Colyseus's `SERVER_SHUTDOWN` (4001), which the client reads as
  `SERVER_UPDATING`: net's wire has no unsolicited error message. Refused matchmaking (`onAuth`, `onCreate`) carries
  the net code first in its message (`SERVER_BUSY: …`), as FloorFifty's did.
- **The wire travels as JSON text** on `NET_CHANNEL` (so net's parser measures it before parsing), binary on
  `NET_BYTES_CHANNEL` right after its `snap` or `replay` header. Net gains `ROOM_NAME` and the two channels.
- **Room sources and order.** The room's own commands (`seat.join`, `seat.leave`, the game's spawns) use sim source
  255 (`ROOM_SOURCE`) with the room's own sequence; bots and people use their seat. Bots decide on the last tick's
  state and their commands are taken with the people's on the same tick ("after inputs are taken" in effect: one
  `take`, seats in order). Acks cover every seat's taken commands.
- **Recording.** A room records from creation, so its first replay holds every seat it seated; play again starts a
  new recording from where the last game left the sim. Between the end and play again the sim steps unrecorded.
- **Every room is public in its lobby.** Quick match is offered rooms in the lobby only; `NetRoom.create({ private })`
  needs a `JoinOptions` field net does not have (M7.5a). No hash comparison yet: JoinOptions is parsed strictly and
  its hashes wait for M7.4a's version gate.
- **Clocks.** The room's tick clock reads Effect's `Clock` and wakes on a Node timer (`tickClockFrom`); the Colyseus
  tests stop the room's clock and step by hand. The drain polls on Effect's `Clock` (TestClock in its tests).
- **Presence.** Colyseus's single-process `LocalPresence` answers `sadd` with nothing, so the code claim goes through
  `presenceCodeStore`, which reads the set's size on either side of the add (synchronous there).
- **Limits.** `maxRooms` (`SERVER_BUSY`) and `commandsPerSeat` (the input meter) are enforced; the rest are config
  for M7.4a. `startServer` refuses a config without a room cap or an origin list (`ServerStartError`); M7.4b's process
  safety reads them from the environment. `config.log` receives §4.5's events (`room.created`, `room.disposed`,
  `seat.joined`, `seat.left`, `refused`, `tick.slow`, `input.late`, `drain.started`, `drain.done`); nothing writes
  lines yet.
- **Pings** are answered with integer slack (net's schema); a probe at tick -1 is measured against tick 0.

## Ported and dropped

- **Ported (generic):** `race-room.ts`' Colyseus lifecycle (create with the cap and the code, auth before a seat,
  join, drop with the hold taken before the drop shows, reconnect re-announced, leave, dispose that tolerates a
  half-built room, abandonment and the first client's grace, listing, drain), `race-room-commands.ts`' error
  boundary, ledger answers and ping bound, `drain.ts` (wait, cap, one drain per SIGTERM, exit codes),
  `colyseus-server.ts`' listener, `gracefullyShutdown: false` and drain sequence, `room-driver.ts`' real-path
  driving and reading, `clock-hold.ts` (the countdown and dropped seats), `replay-recorder.ts`' feeding rule.
- **Dropped:** the race state, Planck, projection, select, characters, colours, access, modes and laps, CPU driving
  and public fill, the simulation-invariant halt, telemetry and its endpoint, `/content`, `/health`, `/ready`,
  `security.txt` and the gates (M7.4a/b), build facts and the version verdict (M7.4a), the HTTP driver endpoint and
  its token (the driver takes a room), FloorFifty's replay format and deflate (AF's `createRecorder`, `packReplay`).
- **Tests dropped:** FloorFifty's race-specific room cases (select, colours, characters, song step, quick-match fill,
  device class, events order, invariant halt), its telemetry and content-route cases, and the protocol-version cases
  (M7.4a's version gate).

## Execution log

| Date | Step | Evidence |
|---|---|---|
| 2026-10-30 | Plan | This file; Colyseus pins and dates from `npm view <pkg> time --json` |
| 2026-10-30 | Pins | FloorFifty's lockfile versions, all over 14 days old; new transitives resolved with a 14-day minimum age for this install only |
| 2026-10-30 | net room contract | `room.test.ts` red (`ROOM_NAME` undefined), then 3 of 3 |
| 2026-10-30 | sim-view, server-game, clock-hold | 4, 9 and 4 cases red (`… is not a function`), then green |
| 2026-10-30 | room engine (play) | 15 cases red (`RoomEngine is not a constructor`), then green (one off-by-one in a test's stamped tick; the countdown now ends at the end of a step, so play takes the tick it ends on) |
| 2026-10-30 | room engine (seats, replay, SV-e, drain, hold) | 18 cases written after the engine: 4 seat cases failed on the tests' tick counts (the grace is 60 ticks from the drop) and were corrected; 2 replay cases failed and one was a defect: a draining room's Play again started a countdown, and now closes the room |
| 2026-10-30 | drain | 6 cases red (no module), then green on TestClock |
| 2026-10-30 | start-server, Colyseus room | Written ahead of their tests, then held to them: 7 and 8 cases red against stubs (a dying `createServerRuntime`; a room that never seats), then green. One test fixed: at the drain cap the server shuts every room, so "plays on while draining" asserts before the cap |
| 2026-10-30 | presence, driver | 2 and 5 cases red (no function), then green |
| 2026-10-30 | Listing, grace through Colyseus | 2 integration cases added; the listing case first passed for the wrong reason (a full room is locked), rewritten on a 3-seat room, red (`REFUSED: this room is already playing`), then green with `syncListing` |
| 2026-10-30 | Counts | new: server-game 9, sim-view 4, clock-hold 4, room-engine 15, room-engine-seats 9, room-engine-replay 9 (SV-e included), presence-code-store 2, drain 6, start-server 7, automata-room 10, room-driver 5 (80); server 180 in all (M7.3a's 100); net room contract 3 |
| 2026-10-30 | Gates | `pnpm format`; `pnpm check`: lint, typecheck, boundaries 26 files 0 findings, root 157, net 89, physics 71, server 180 (server suite three runs in a row, 180 each, about 5 s) |
