# M7.3a: `server` room rules as plain modules, TDD plan

- **Spec:** the framework's M7 spec (`docs/superpowers/specs/2026-10-17-m7-online-store-design.md`) §4.3 (room rules
  and the FloorFifty source table), §4.4 (determinism), §5 (per server tick, ready and start, drop and reconnect),
  §6 (failure policy: `lead`, command bucket), §13 SV-b.
- **Row:** M7.3a in the framework's `docs/02-master-delivery-plan.md`. Prerequisite M7.2. Size L.
- **Branch:** `claude/plus-M7.3a-room-rules`, on M7.2.
- **Sources (read-only):** FloorFifty `677d4568b7b2265fda4246d711065b8f417cac26`:
  `apps/server/src/rooms/{input-queue,tick-scheduler,seat-registry,command-ledger,input-meter,room-code,live-rooms,room-errors,lobby-rules,cpu-rules}.ts`
  and `tests/server/rooms/{input-queue,tick-scheduler,seat-registry,command-ledger,input-meter,room-code,lobby-rules,cpu-rules}.test.ts`.
- **Status:** drafted.

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
  `@mcthaydt/automata-sim` 0.0.3 as peer and dev dependency; `@mcthaydt/automata-net` `workspace:*`; `zod` 4.6.6
  only if a module needs it), `tsconfig.json`, `vitest.config.ts` (the shape of `packages/net`'s).
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
export interface LobbyState { phase; tick; hostSeat: number | undefined; countdownEndsAtTick: number | undefined; seats: LobbySeat[] }
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

## Execution log

| Date | Step | Evidence |
|---|---|---|
