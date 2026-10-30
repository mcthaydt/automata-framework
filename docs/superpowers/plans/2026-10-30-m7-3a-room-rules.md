# M7.3a: `server` room rules as plain modules, TDD plan

- **Spec:** the framework's M7 spec (`docs/superpowers/specs/2026-10-17-m7-online-store-design.md`) §4.3 (room rules
  and the FloorFifty source table), §4.4 (determinism), §5 (per server tick, ready and start, drop and reconnect),
  §6 (failure policy: `lead`, command bucket), §13 SV-b.
- **Row:** M7.3a in the framework's `docs/02-master-delivery-plan.md`. Prerequisite M7.2. Size L.
- **Branch:** `claude/plus-M7.3a-room-rules`, on M7.2.
- **Sources (read-only):** FloorFifty `677d4568b7b2265fda4246d711065b8f417cac26`:
  `apps/server/src/rooms/{input-queue,tick-scheduler,seat-registry,command-ledger,input-meter,room-code,live-rooms,room-errors,lobby-rules,cpu-rules}.ts`
  and `tests/server/rooms/{input-queue,tick-scheduler,seat-registry,command-ledger,input-meter,room-code,lobby-rules,cpu-rules}.test.ts`.
- **Status:** implemented and checked locally; Plus CI pending; not reviewed.

## Scope

In: `packages/server` (`@mcthaydt/automata-server`) with the room rules as plain modules in `src/rooms`, generic over
the sim's `Command`, keyed by seat number (the sim's `source`, 0 to `MAX_SEATS - 1`), each with its own tests. No
Colyseus, no Effect, no I/O, no wall clock: the tick scheduler takes an injected clock, room codes an injected random
source.

Out (later rows): the Colyseus room, `defineServer`/`startServer`, the `BotPolicy` call per tick, the recorder and
drain (M7.3b); the structured log line that writes `input.late` and `tick.slow` (M7.4b: here the queue reports how
late a command is and the scheduler reports dropped time, and the room logs them); gates (M7.4a).

Stripped as race-specific: laps, modes, the Survival clock, stages, songs, picks and select, colours, characters,
personalities, devices, the start floor and Planck; FloorFifty's public-room quick-match clocks and CPU fill.

## Files

- `packages/server/package.json` (`@mcthaydt/automata-server` 0.0.0, `SEE LICENSE IN LICENSE`, no `simEntries`;
  `@mcthaydt/automata-sim` 0.0.3 as peer and dev dependency; `@mcthaydt/automata-net` `workspace:*`; no `zod` or
  `effect`: no module needs them), `tsconfig.json`, `vitest.config.ts` (the shape of `packages/net`'s).
- `src/index.ts`: the package's entry, re-exporting the rules.
- `src/rooms/room-errors.ts` + test: `RoomCommandError(code: NetErrorCode, message)`, `toServerError`.
- `src/rooms/command-ledger.ts` + test: `CommandLedger`, `requestIdOf`, `COMMAND_HISTORY` 64.
- `src/rooms/input-queue.ts` + test: `InputQueue`, `MAX_QUEUED_COMMANDS` 32.
- `src/rooms/input-meter.ts` + test: `InputMeter`.
- `src/rooms/tick-scheduler.ts` + test: `startTickScheduler`, `TickClock`.
- `src/rooms/seat-registry.ts` + test: `SeatRegistry`, `SeatClient`.
- `src/rooms/room-code.ts` + test: `ROOM_CODE_ALPHABET`, `ROOM_CODE_LENGTH`, `generateRoomCode`, `claimRoomCode`,
  `releaseRoomCode`, `RoomCodeStore`.
- `src/rooms/live-rooms.ts` + test: `LiveRooms`.
- `src/rooms/lobby-rules.ts` + test: `LobbyState`, `LobbySeat`, `LobbyRules`, `createLobby` and the rules.
- `src/rooms/bot-seats.ts` + test: `addBot`, `removeBot`, `botCount`, `botSeed` (from `cpu-rules.ts`).

## Interfaces

```ts
import type { Command } from '@mcthaydt/automata-sim'
import type { NetErrorCode, ServerMessage } from '@mcthaydt/automata-net'

// room-errors
export class RoomCommandError extends Error { readonly code: NetErrorCode }
export function toServerError(error: unknown): { code: NetErrorCode; message: string }

// command-ledger
export type CommandResult = { req: string; ok: true } | { req: string; ok: false; error: { code: NetErrorCode; message: string } }
export function requestIdOf(message: unknown): string | undefined       // the own data property `req`, by net's reqIdSchema
export class CommandLedger { constructor(capacity?: number); answer(session, req, run): { result; replayed }; forget(session) }

// input-queue: what a client sends, minus `source` (the server sets it from the seat)
export type QueuedInput = Pick<Command, 'seq' | 'tick' | 'type' | 'payload'>
export type SubmitResult = { ok: true; tick: number; slack: number } | { ok: false; reason: 'sequence' | 'lead' | 'full' }
export class InputQueue {
  constructor(options: { maxLeadTicks: number; maxSequenceGap: number })
  submit(seat: number, input: QueuedInput, nextTick: number): SubmitResult   // nextTick: the tick the room steps next (sim.tick)
  take(tick: number): Command[]   // every command due by `tick`, stamped `tick`, `source` = seat; by seat, then seq
  forget(seat: number): void; reset(): void
}

// input-meter
export class InputMeter { constructor(options: { capacity: number; creditsPerTick: number }); fill; spend; refill; forget }

// tick-scheduler
export interface TickClock { now(): number; setTimer(callback: () => void, delayMs: number): unknown; clearTimer(handle: unknown): void }
export function startTickScheduler(options: { tickMs; onTick; onCallback?; maxCatchUp?; clock: TickClock }): { stop(): void }

// seat-registry
export interface SeatClient { send(message: ServerMessage): void }
export class SeatRegistry { size; everSeated; seatOf; sessionOf; seats(); seated(); seat(session, seat, client); release;
  keepOnly(keep: (seat) => boolean): { session; seat }[]; announce(); hold; endHold; closeHold }

// room-code
export interface RoomCodeStore { sismember(key, code): Promise<boolean | number>; sadd(key, code): Promise<unknown>; srem(key, code): Promise<unknown> }
export function generateRoomCode(randomInt: (max: number) => number): string
export function claimRoomCode(store: RoomCodeStore, randomInt): Promise<string>
export function releaseRoomCode(store: RoomCodeStore, code: string): Promise<void>

// live-rooms
export class LiveRooms<R> { add(room); delete(room); size; [Symbol.iterator] }

// lobby-rules
export type LobbyPhase = 'lobby' | 'countdown' | 'playing' | 'ended'    // net's RoomInfo phases (spec §4.2)
export interface LobbySeat { seat: number; ready: boolean; connected: boolean; bot: boolean }
export interface LobbyState { phase; tick; hostSeat: number | undefined; countdownEndsAtTick: number | undefined;
  startedAtTick: number | undefined; seats: LobbySeat[] }   // seats in seating order
export interface LobbyRules { minSeats: number; maxSeats: number; countdownTicks: number; startWhen: 'all-ready' | 'host' }
export function createLobby(): LobbyState
export function openSeat, seatPlayer, setConnected, removeSeat, isPreGame, acceptsInput, setReady, evaluateReadiness,
  startCountdown (the host's start), countdownElapsed, startGame, endGame, startOver, nextHost

// bot-seats (cpu-rules' seat rules)
export function addBot(lobby, by: number, rules: LobbyRules, botsAllowed: boolean): number
export function removeBot(lobby, by: number, seat: number): void
export function botCount(lobby): number
export function botSeed(roomSeed: number, seat: number): number    // deriveSeed(roomSeed, `bot:${seat}`)
```

## Tests, written first (FloorFifty count → here)

1. **input-queue (11 → 11 + SV-b + source):** held until its stamped tick; delivered once on its tick (FloorFifty's
   "frame in force until a newer one" becomes "each command once": AF commands are edges, the held intent is the
   game's sim state); late on the next tick with negative slack; a burst delivers every command in sequence order
   (FloorFifty's reset-edge case, generalised); sequence must move forward; a sequence jump past the window; lead;
   a later sequence never before an earlier one; 32 queued then `full`; sequence remembered across a reconnect;
   forget and reset. Added: **SV-b** (stamped 120 at next tick 101 → 120; stamped 120 at next tick 126 → 126, slack
   negative, never earlier); `source` is the seat, whatever the client sent; seats in seat order.
2. **tick-scheduler (3 → 3):** sixty ticks a second with one per wake; catch-up after a stall dropping only whole
   ticks; stop for good. On a fake clock and timer; no wall time.
3. **seat-registry (13 → 13):** as FloorFifty, keyed by seat number; `seated` carries `{ t: 'seated', seat }`
   (net's wire), with no room code.
4. **command-ledger (14 → 14):** as FloorFifty; the id is the wire's `req`, checked by net's `reqIdSchema`; refusals
   carry net's codes (`NOT_HOST` and `MALFORMED_MESSAGE` become `REFUSED`).
5. **input-meter (6 → 6):** as FloorFifty with capacity and credits per tick as options.
6. **room-code (4 → 4):** alphabet and length; no repeat of a claimed code; release; give up after 8 collisions. On an
   in-memory store and a seeded random source.
7. **live-rooms, room-errors (0 → 2 each):** new; FloorFifty tested them only through the room.
8. **lobby-rules (40 → 19 ported + new):** phases (2), readiness (7, "opens select" becomes "starts the countdown"),
   countdown (2), start keeps seats' status and readiness (1), start over (4: fresh lobby on the same tick with ready
   cleared, a dropped seat carried over, host kept, refused while playing), next host (3). New: `startWhen: 'host'`,
   `minSeats`, seating and dropping.
9. **bot seats (cpu-rules 18 → 9 ported + new):** adding seats a ready, connected bot; the same seed for the same room
   and seat; host only; lobby only; full; a bot never holds the room up; removing frees the seat; refuses a guest, a
   person and an unknown seat; start over keeps bots ready. New: no policy refuses `bot.add`; a bot never hosts.

Dropped FloorFifty cases are listed with reasons in the execution log.

## Gates

`pnpm format`, `pnpm check` (lint, typecheck, boundaries, root tooling tests with the F1 boundary test over
`packages/server`, every package's `test:unit`). No parity project: no sim code here. Pending: Plus CI.

## As built (deviations)

- **Each command once.** FloorFifty's queue held the newest frame in force on every later tick and collapsed a burst
  to it, carrying a reset press. AF commands are edges, so `take` delivers each command exactly once, on its tick;
  the intent a command sets is the game's sim state. A burst delivers every command in sequence order, so no press
  can be swallowed. Spec §5 "the seat's held command stays in force" therefore holds through the sim's state, not the
  queue.
- **`nextTick`, not the last stepped tick.** `submit` and `take` use the tick the room steps next (the sim's `tick`
  before `step`, which is the tick `step` requires on each command). The bounds are FloorFifty's: a command at
  `nextTick + maxLeadTicks` is refused, one below is accepted. Sequences start at 0 (the wire's `seq` is a uint).
- **`input.late` and `tick.slow` are reported, not logged:** the queue returns a negative `slack` and the scheduler
  reports dropped time; the room writes the log line (the `serverLogLine` schema is M7.4b's).
- **Codes are net's.** `RoomCommandError` carries a `NetErrorCode`; FloorFifty's `NOT_HOST`, `INVALID_ROOM` and
  `MALFORMED_MESSAGE` all answer `REFUSED` with a sentence saying which. The ledger keys by the wire's `req`, read with
  net's `reqIdSchema` (printable ASCII; FloorFifty took any string of 1 to 64).
- **`seated` carries the seat alone** (net's wire); FloorFifty's announcement also carried the room code.
- **Lobby state is the server's.** `LobbyPhase` matches net's `RoomInfo.phase` (spec §4.2), which net does not define
  yet (M7.5a); `ROOM_CODE_LENGTH` and the code alphabet are in `room-code.ts` because net has no room-code contract
  yet. Both should move to net when its client needs them (one owner), with server importing them.
- **The lobby goes straight to the countdown** (FloorFifty's opened select, which is race-specific); `startWhen:
  'host'` and `minSeats` are new rules from spec §4.3's `ServerGameDef`. The host is handed on only when the host's
  seat is freed (FloorFifty's `rehomeHost`), and never to a bot. Rules mutate the lobby; FloorFifty's `startRace` and
  `nextRace` returned copies because they rebuilt race state, which is the game's here.
- **`LiveRooms` is an instance**, not a module-level set, so two servers in one test process do not share one.
- **Room codes:** the random source and the shared set (Presence's `sismember`/`sadd`/`srem`) are injected; the
  channel is `automata:rooms`. FloorFifty's `createCourseSeed` is left to M7.3b (the room seed).
- **Bots:** `botSeed(roomSeed, seat)` is `deriveSeed(roomSeed, "bot:<seat>")`: the sim's `deriveSeed` names a
  stream with a string, where the spec writes `deriveSeed(roomSeed, seat)`. `addBot` takes whether a policy exists.

## Dropped FloorFifty cases

- **lobby-rules (21 of 40):** lap count (3), mode (9), the Survival clock (6): a game's own lobby options; "leaves the
  race it started from untouched" (1): rules mutate, and resetting the world is the game's sim; "keeps the stage,
  drops the song" and "keeps what the roulette landed on" (2): stages, songs and picks are race-specific.
- **cpu-rules (9 of 18):** the random colour and character draw (1): colours and characters are FloorFifty's; a
  public room refusing CPUs (1), the five public-room fill and quick-match clock cases (5) and "drops a public room's
  CPUs on race again" (1): FloorFifty's quick-match CPU fill is not in the AF spec; select giving a CPU no pick (1).
- **input-queue:** none dropped; two cases restated for discrete commands (above).

## Execution log

| Date | Step | Evidence |
|---|---|---|
| 2026-10-30 | Package skeleton | `packages/server` with net's shape; `pnpm install` |
| 2026-10-30 | room-errors, command-ledger | 16 cases red against empty modules (`… is not a constructor` / `is not a function`), then 16 of 16 |
| 2026-10-30 | input-queue | 15 cases red (`InputQueue is not a constructor`), then 15 of 15 |
| 2026-10-30 | input-meter, tick-scheduler | 9 cases red, then green; the scheduler on a fake clock only |
| 2026-10-30 | seat-registry, room-code, live-rooms | 19 cases red, then green (one test fix: the seeded source uses `Rng.int`) |
| 2026-10-30 | lobby-rules, bot-seats | 37 cases red (`createLobby is not a function`), then 37 of 37 |
| 2026-10-30 | Counts | input-queue 15 (FloorFifty 11), tick-scheduler 3 (3), seat-registry 13 (13), command-ledger 14 (14), input-meter 6 (6), room-code 4 (4), room-errors 2 (0), live-rooms 2 (0), lobby-rules 26 (19 of 40 ported, 7 new), bot-seats 11 (9 of cpu-rules' 18 ported, 2 new): 96 |
| 2026-10-30 | Gates | `pnpm format`; `pnpm check`: lint, typecheck, boundaries 26 files 0 findings, root 157 tests (F1 over `packages/server` included), net 86, physics 71, server 96 |

| 2026-10-30 | Integration review | `LobbyPhase` (`LOBBY_PHASES`), `ROOM_CODE_LENGTH` and `ROOM_CODE_ALPHABET` moved into net (`net/src/wire/room.ts`, M7 spec §4.2 `RoomInfo` is net's), test-first (`room.test.ts` red: no module); server imports them. `pnpm check`: net 88, server 96, physics 71, root 157 |
| 2026-10-30 | Independent review | 4 findings, fixed test-first (6 cases red, then 100 of 100): a countdown left short of `minSeats` by a leave, or with nobody connected after drops, now returns to the lobby (`removeSeat` and `setConnected` take the rules); the room-code claim is the store's `sadd` result (1 added, 0 held), not a check then an add; the host who drops keeps the role (test added). Recorded, no code: `forget(seat)` is what the room calls when a reloaded client resumes its seat (its sequence restarts), an obligation on M7.3b; a transport reconnect continues the numbering |
