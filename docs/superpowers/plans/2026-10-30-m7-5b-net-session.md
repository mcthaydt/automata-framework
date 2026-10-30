# M7.5b: `net` prediction and reconciliation (NetSession), TDD plan

- **Spec:** the framework's M7 spec (`docs/superpowers/specs/2026-10-17-m7-online-store-design.md`) §3 (ownership:
  the predicted local state belongs to `net`'s reconciler), §4.2 (netcode model: local prediction, reconciliation,
  the input lead; the FloorFifty source table rows `input-lead.ts`, `race-netcode.ts`, `local-simulation.ts`), §5
  (per client frame; drop and reconnect), §6 (the snapshot hash mismatch row), §13 N-a, N-b, N-d, §12 test layers.
- **Row:** M7.5b in the framework's `docs/02-master-delivery-plan.md`. Prerequisite M7.5a (merged, `3f4c3c6`). Size L.
- **Branch:** `claude/plus-M7.5b-net-session`, from `main` at `3f4c3c6`.
- **Sources (read-only):** FloorFifty `677d4568b7b2265fda4246d711065b8f417cac26`:
  `apps/client/src/systems/netcode/{input-lead,race-netcode,render-clock,local-simulation}.ts`,
  `tests/client/systems/netcode/{input-lead,race-netcode,netcode-model}.test.ts`.
- **Status:** implemented and checked locally; Plus CI pending; not reviewed.

## Scope

In:

- **Input lead** (`input-lead.ts`): FloorFifty's, unchanged in shape, with the tick length and the cap as options
  instead of FloorFifty's constants (the cap is half the room's `maxLeadTicks`, FloorFifty's ratio).
- **The authority clock** (`authority-clock.ts`): the half of FloorFifty's `RenderClock` that says where authority
  is now (anchors timestamped on arrival, a nominal rate eased by at most 10%, a forward snap past 12 ticks, a
  backward snap only after 500 ms of agreement). The prediction reads authority from it. The drawn moment (the
  interpolation delay and its arrival window) is M7.5c's, which builds the render clock on this one.
- **Prediction** (`prediction.ts`): the client sim, the last good authoritative base, and the local commands not yet
  acked. Each snapshot: drop a stale or repeated one; `restore(bytes)`; `hash()` against the header; on a mismatch
  (or a restore that throws) go back to the base and re-step, never stepping on the frame; drop the commands whose
  `seq` ≤ the seat's ack; re-step from T to the sampled tick, each command at its own tick or, when that has passed,
  at the first tick re-stepped (the room's late rule), never before one sent ahead of it.
- **`NetSession`** (`net-session.ts`, plain code, no Effect per frame): FloorFifty's `RaceNetcode` loop made
  game-agnostic. Per rendered frame: advance the clock and the lead, sample input once for the latest tick the
  frame reaches (re-seated after a gap of more than 12 ticks either way), stamp each command with that tick and the
  next `seq`, apply it to the predicted sim and send it; probe the clock every 250 ms and let reliable answers steer
  the lead. Per snapshot: reconcile, then number on from the seat's ack and resend once any command the snapshot
  shows overdue. Two mismatches within 10 s end the session (`ended: { reason: 'desync' }`). `resync` (the
  connection came back) resends every command not yet acked.
- **`makeNetSession`** (`make-net-session.ts`): the Effect wiring over a `NetRoom` (scoped, Effect's `Clock`): the
  port's snapshots and pongs, the seat from `info.you`, input accepted while `phase` is `countdown` or `playing` and
  `connection` is `connected` or `degraded`, `resync` when `connection` returns to `connected`, `ended` as a
  `Subscribable`, every listener released when the scope closes.
- **The link client** (`net/testing`, `link-client.ts`): `linkClient` and `linkRoomClient`, net's wire over a
  `createLink` pair, so a room and clients run over seeded links on `TestClock`. The client end is the real
  `ColyseusTransport` and client port, over a link-backed SDK room; a snapshot header and its bytes cross the link as
  one frame (a socket delivers both or neither, in order).
- **N-a, N-b, N-d** over seeded links, with the room engine of `server` (`packages/server`, which already depends on
  `net`), and the ported `netcode-model` cases on the same harness.

Out (later rows): the render clock's drawn moment, interpolation, diagnostics, `degraded`, the badge and overlay
(M7.5c); `createHeadlessClient`, `startTestServer` and the two-client replay golden (M7.6); `create({ private })` and
importing core's `NetworkPort` (M7.5a's follow-ups; DX.2a).

## Files

Create in `packages/net/src/session/` (each with its test, written first):

- `input-lead.ts`: `INITIAL_LEAD_TICKS`, `MAX_LEAD_TICKS`, `InputLeadOptions`, `leadForRoundTrip`, `InputLead`.
- `authority-clock.ts`: `AuthorityClock`, `AuthorityClockOptions`.
- `prediction.ts`: `LocalCommand`, `PendingCommand`, `ReconcileOutcome`, `Prediction`.
- `net-session.ts`: `NetSession`, `NetSessionOptions`, `NetFrame`, `Sampler`, `SessionEnd`, `SessionRoomState`,
  `PING_EVERY_MS`, `MAX_CATCH_UP_TICKS`, `DESYNC_WINDOW_MS`.
- `make-net-session.ts`: `makeNetSession`, `NetSessionHandle`, `MakeNetSessionOptions`.

Create elsewhere:

- `packages/net/src/test-support/counter-game.ts`: a tiny sim for net's own tests (a mover per seat, `move` and
  `mover.spawn` commands).
- `packages/net/src/testing/link-client.ts` (+ `link-client.test.ts`): `linkClient`, `linkRoomClient`, `LinkClient`,
  `LinkRoomClient`.
- `packages/server/src/test-support/link-room.ts`: a room engine and N clients over seeded links on `TestClock`,
  stepped on a deterministic schedule.
- `packages/server/src/room/net-session-link.test.ts`: N-a, N-b, N-d.
- `packages/server/src/room/netcode-model.test.ts`: the ported model cases.

Modify: `packages/net/src/index.ts` and `src/testing/index.ts` (exports).

## Interfaces

```ts
export interface LocalCommand { readonly type: string; readonly payload: unknown }
export type Sampler = (tick: number) => readonly LocalCommand[]
export interface NetFrame { readonly authorityTick: number; readonly predictedTick: number }
export interface SessionEnd { readonly reason: 'desync'; readonly tick: number }
export interface SessionRoomState { readonly seat: number | undefined; readonly accepting: boolean }

export interface NetSessionOptions {
  readonly sim: Sim                                // the client's sim: the game's plugins and content
  readonly send?: (command: Command) => void       // ClientNetworkPort.sendCommand
  readonly ping?: (tick: number) => number | undefined
  readonly roundTripMs?: number | undefined        // measured before play; seeds the lead
  readonly maxLeadTicks?: number                   // net.toml's; the lead stays under half of it [60]
  readonly now?: () => number                      // ms; the sum of frame deltas without one
  readonly onEnd?: (end: SessionEnd) => void
}
export class NetSession {
  constructor(options: NetSessionOptions)
  setRoomState(state: SessionRoomState): void
  observe(snapshot: NetSnapshot, receivedAt?: number): void
  frame(sample: Sampler, deltaMs: number): NetFrame | undefined
  pong(pong: { readonly id: number; readonly slack: number }): void
  resync(): void
  clear(): void
  readonly sampledTick: number | undefined; readonly leadTicks: number; authorityTick(): number | undefined
  readonly ended: SessionEnd | undefined; readonly mismatches: number
  readonly authoritative: { readonly tick: number; readonly hash: string } | undefined
  readonly pendingCommands: readonly PendingCommand[]
}

export interface NetSessionHandle {
  readonly session: NetSession
  readonly ended: Subscribable.Subscribable<SessionEnd | undefined>
}
export function makeNetSession(options: {
  readonly room: Pick<NetRoom, 'port' | 'info' | 'connection'>
  readonly sim: Sim
  readonly maxLeadTicks?: number
}): Effect.Effect<NetSessionHandle, never, Scope.Scope>

// net/testing
export function linkClient(transport: Transport, options: { run: (effect: Effect<void>) => void; now: () => number }): LinkClient
export interface LinkClient { readonly port: ClientNetworkPort; seat(): number | undefined; onSeated(l): () => void; detach(): void; attach(transport: Transport): void }
export function linkRoomClient(transport: Transport, run: (effect: Effect<void>) => void): LinkRoomClient
export interface LinkRoomClient { send(message: ServerMessage): void; sendBytes(bytes: Uint8Array): void; close(): void; closed: boolean; down: boolean }
```

Ticks: core's `Sim.tick` is the next tick to step, so a snapshot at T holds the state before tick T is stepped and
its acks cover every command the room took through T − 1. A command not acked whose tick is before T arrived late
(or was lost) and the room takes it at the first tick it steps after it arrives: the client predicts it at T. This
is spec §4.2's "≤ T … at T + 1", restated for core's tick (where §4.2 counts the snapshot as after tick T).

## Steps

- [x] 1. Input lead: FloorFifty's 10 cases red (module missing), then green.
- [x] 2. Authority clock: red (module missing), then green. Cases: nothing before the first snapshot; the first
  snapshot sets it; it runs at the nominal rate between snapshots; it eases toward a later anchor by at most 10% of
  elapsed time and never past it; it snaps forward past 12 ticks; one snapshot far behind does not move it back,
  500 ms of them does; `error` is the anchor less the clock; `clear` forgets.
- [x] 3. Counter game (test support) and prediction: red (module missing), then green. Cases: a command recorded
  for tick P takes effect when P is stepped; a restore re-steps the pending commands to the sampled tick and the
  result equals stepping without the snapshot (a snapshot that agrees changes nothing); acked commands are dropped;
  a command whose tick has passed is applied at T, after the one sent ahead of it, never before; a stale or repeated
  snapshot is ignored; a header hash that differs is a mismatch, the sim is put back on the base and re-stepped (its
  hash unchanged), the ack in that header is not applied; bytes that fail to restore are a mismatch and leave the
  sim as it was; a mismatch before any good snapshot rolls back to the sim's starting state; `clear`.
- [x] 4. `NetSession` (FloorFifty `race-netcode` cases, adapted): red (module missing), then green. Sends the first
  command at once, stamped with the predicted tick; sends exactly what the sampler returns, once, with `seq` climbing
  by one and ticks never going back; a long frame stamps the latest tick it reaches and samples once; sends nothing
  while the room is not taking input or the seat is unknown; re-seats after a long gap; keeps sampling when the clock
  lands far behind; `resync` resends every command not acked; numbers on from the room's ack when it takes over a
  seat; probes every 250 ms and pongs steer the lead; a probe sent while the clock was catching up does not; starts
  with the lead a measured round trip asks for; the predicted sim stands at the sampled tick, ahead of authority; on a
  144 Hz display the prediction steps one tick per tick of authority, never two at once; a snapshot that agrees with
  the prediction leaves the predicted state unchanged; `clear` forgets everything. New: a command the snapshot shows
  overdue is resent once; two mismatches within 10 s end the session (`ended`, `onEnd` once, nothing sampled, sent
  or restored after); two 10 s apart do not; the second mismatch's frame is not stepped on either.
- [x] 5. `makeNetSession` on the M7.5a harness (fake Colyseus, `TestClock`): red (module missing), then green.
  Snapshots reach the session timestamped on the `Clock`; the seat comes from `info.you`; input is taken only in
  `countdown` or `playing` while connected; a drop and return calls `resync` (the unacked commands go out again on
  the new room); `ended` reads the desync; closing the scope stops snapshots and pongs reaching it.
- [x] 6. Link client (`net/testing`): red (module missing), then green. A room client's header and bytes arrive as one
  snapshot on the client's port; text messages reach the client's transport (seated, pong with its round trip);
  commands and pings reach the room end as wire text; a detached client drops everything and keeps its listeners
  on the next link; a closed room end sends nothing. (Done without the planned `down` flag: a drop is `detach` on the
  client and the room end's listener cut, and a return is a fresh link, as a reconnect is a fresh socket.)
- [x] 7. N-a, N-b, N-d (`packages/server`, `net-session-link.test.ts`) over seeded links with the room engine:
  **N-a** two clients and the room play 3,600 ticks over 100 ms ± 30 ms, 2% loss, 1% duplicates, 1% reorder: no
  mismatch, every restored hash equal to the room's at that tick, each local command applied in the client sim on the
  tick it was sampled, and the room took nearly all of them on that tick. **N-b** a client whose link is down 5 s
  returns to its seat, restores the next snapshot with the room's hash at that tick, and the room stepped every tick
  meanwhile. **N-d** a frame with changed bytes is not stepped on and the next snapshot restores (resync); a second
  in 10 s ends the session with `desync`; two 11 s apart do not.
- [x] 8. The netcode model (`netcode-model.test.ts`, FloorFifty's cases on the counter-walk game): exact on a
  perfect link; as if local at a 100 ms round trip (late share ≤ 1%, no misprediction at p99, lead > 6); within
  budget at 200 ms with jitter; recovers within its first probes with no round trip measured beforehand; walks as far
  over the network as locally; a one-off command lands on the same tick on both sides.
- [x] 9. Exports; `pnpm format`, `pnpm check`; the execution log below.

## Ported tests (FloorFifty count → this row's)

**input-lead (10 → 10).** All ten, unchanged but for the constants becoming options (`tickHz`, `maxTicks`); one
more case holds another tick rate and cap.

**race-netcode (17 → 14 ported, 3 not).** Ported (`net-session.test.ts`): sends its first frame at once, stamped
with the predicted tick; sends only when the intent changes, and every press of reset (as: sends exactly what the
sampler returns, once each, `seq` climbing by one, never stamped backward: an AF command is an edge, so there is no
intent to compare); stamps a change on the latest tick a long frame reaches (plus: samples once); sends nothing while
the room is not taking input (plus: or before the seat is known); re-seats after a long gap; keeps sampling if the
clock lands far behind; sends the current intent again after the connection comes back (as: resends every command not
acked); numbers on from the room's count when it takes over a seat; probes on a schedule and lets answers steer the
lead; does not steer from a probe sent while catching up; starts with the lead a measured round trip asks for; draws
moving floors at the predicted tick (as: the predicted sim stands at the sampled tick, ahead of authority); moves the
local racer on every frame of a 144 Hz display by an even step (as: one prediction step per tick on a 144 Hz display,
never two, one sample per tick); draws the local racer where it was when a correction lands (as: a snapshot that
agrees leaves the predicted state unchanged: AF corrects by restore and re-step, so an agreeing snapshot is exact,
and the drawn smoothing of a real correction is M7.5c's render side); forgets everything when left. Not ported:
the two presentation time-scale cases (race-flow spec §5.2's slow motion, a FloorFifty presentation rule with no AF
spec), and the even-step *drawn position* half of the 144 Hz case (the blend between predicted ticks is drawing,
M7.5c). New: an overdue command resent once; two mismatches in 10 s end the session; two 10 s apart do not.

**netcode-model (9 → 6 ported, 3 not).** Ported on the fixture walk game over seeded links with the real room engine
(`packages/server/src/room/netcode-model.test.ts`): exact on a perfect link; as if local at 100 ms (late share
≤ 1%, misprediction p99 0, lead > 6); within budget at 200 ms with jitter (late ≤ 5%, p99 ≤ 1); recovers within its
first probes with no round trip measured (exact after 2 s); walks as far over the network as locally (as: once input
stops, the room's position is the sum of every command sent, locally and remotely); predicts a manual reset on the
very tick the room applies it (as: a one-off command, on the same tick on both sides). FloorFifty's `drawnOffset`
budgets are drawing (M7.5c). Not ported: the endless climb past floor 50 (the race's moving course window), the lapping
racer and the moving floor (race rules); none has a generic counterpart.

## Decisions for the Owner's veto

- **The late rule in core's ticks.** Core's `Sim.tick` is the next tick to step, so a snapshot at T is the state
  before tick T. A command not acked whose tick is before T is predicted at T, the first tick re-stepped; spec §4.2's
  "≤ T … at T + 1" is the same rule counted with the snapshot after tick T. Commands keep `seq` order whatever their
  stamps (the room's queue rule).
- **The resync is the next snapshot; nothing new on the wire.** Every snapshot is the whole state, every
  `snapshotEvery` ticks, so a client that refuses a frame keeps its prediction (back on the last good snapshot,
  re-stepped) and restores the next good one. A `resync` request message would need a wire and room change for a
  frame that arrives 50 ms later anyway.
- **"Mismatch" covers bytes `restore` refuses** as well as a hash that differs after `restore`: both are a frame that
  is not stepped on and both count toward the two in 10 s. A frame older than or equal to the last one restored (a
  duplicate, a reordered one) is ignored, never restored.
- **A desync ends the session, not the room.** `NetSession.ended` (and `NetSessionHandle.ended`) reads
  `{ reason: 'desync', tick }`; the session stops sampling, sending and restoring. It does not leave the room on its
  own: the kit shows the error and the player's Leave (`NetRoom.leave`), so the screen decides, as with `RoomEnd`.
- **An overdue command is resent once.** On each good snapshot, a pending command whose tick is before the snapshot's
  is sent once more with its own `seq` and tick: the room takes it late if it never arrived, and refuses it
  (`refused: sequence`) if it did. `resync` (the connection came back) resends every command not acked. Commands
  sampled while the connection is down are dropped, not queued: input is taken only while `connected` (or
  `degraded`).
- **Another room is another game.** `makeNetSession` clears the session when the room info goes away (a leave, a
  lost seat) or names another room: the snapshots, pending commands and numbering go, so a room whose sim is at an
  earlier tick restores and a fresh seat numbers from 0. A reconnect keeps the room info, and so the game.
- **Numbering goes on from the room's ack** when a session takes over a seat (FloorFifty's rule), rather than
  restarting at 0. The room accepts either after a return (M7.3b's `returned` rule); numbering on means no snapshot
  in flight with the old ack can make the client drop its new commands.
- **The authority clock is ported now, the render clock stays M7.5c's.** The prediction needs "where is authority
  now"; this row ports that half of FloorFifty's `RenderClock` (`authority-clock.ts`, 7 cases of its own). M7.5c adds
  the drawn moment (the interpolation delay and its arrival window) and ports the 26 render-clock cases on top of it,
  without a second clock.
- **The input lead's cap is half the room's `maxLeadTicks`** (30 at the default 60), FloorFifty's ratio, and its
  initial 4 ticks are FloorFifty's, in ticks whatever the rate.
- **One sample per frame that reaches a new tick** (FloorFifty's rule) is how "one input sample per predicted tick"
  is read: never two samples for one tick, and a frame covering several ticks samples once, for the latest.
- **The link harness pairs a header with its bytes in one frame**, and its frames draw on the room's instants (one
  `TestClock` move per tick; a phase per player doubled the run time). `linkClient` and `linkRoomClient` are exported
  from `net/testing` for M7.6 to build `createHeadlessClient` on.

## Execution log

| Date | Step | Evidence |
|---|---|---|
| 2026-10-30 | 1 | `input-lead.test.ts` red (module missing; a first run failed to parse, an apostrophe in a test name), then green: FloorFifty's 10 cases and one for another tick rate and cap (11) |
| 2026-10-30 | 2 | `authority-clock.test.ts` red (module missing), then green (7). The arrival-time case was wrong as first written (its anchor was inside the ease band, so it could not tell arrival from reading); rewritten to land past the snap. The ease case's tolerance is 1e-3: the clock bleeds error off by 5% of it per tick, so it closes exponentially |
| 2026-10-30 | 3 | `prediction.test.ts` red (module missing), then red twice for the fixture: the room's source 1000 was refused `bad-header` (the sim's highest is 255, as the server's `ROOM_SOURCE`), and Koota's 16-world limit until the suite disposed its sims; then green (11) |
| 2026-10-30 | 4 | `net-session.test.ts` red (module missing), then one case red for the test (its snapshot tick preceded every stamped command, so nothing was acked); green (18) |
| 2026-10-30 | 5 | `make-net-session.test.ts` red (module missing), then one case red for the test (it drew a frame without moving the TestClock, and the session's time is the Clock's), then green (5) |
| 2026-10-30 | 6 | `link-client.test.ts` red (module missing), then green (6) |
| 2026-10-30 | 7 | `net-session-link.test.ts` against the session built in steps 1 to 5. First run: N-b red because the harness never handed what reached the room's end of a link to the engine (so no command reached the room; N-a passed vacuously on the client side). Fixed in the harness; N-a now also holds that the room's only refusals are resent seqs. A 20 s diagnostic run over the N-a link: 575 commands, 1 late, 38 `sequence` refusals (resends), the room's positions equal to both clients' predictions. Green (4) |
| 2026-10-30 | 8 | `netcode-model.test.ts` red once for the test (its sample-count guard assumed one sampled tick per frame; frames on whole milliseconds sometimes reach two ticks, and the later is sampled), then green (6). Frames moved onto the room's instants: 5 s of play went from 5.1 s to 2.9 s of wall time |
| 2026-10-30 | 9 | Exports from `net` (`NetSession`, `makeNetSession`, the input lead) and `net/testing` (`linkClient`, `linkRoomClient`); `pnpm format`, `pnpm check`: root 163, net 309, pipelines 138, dev-tools 62, physics 71, server 432 |
| 2026-10-30 | Self-review | `makeNetSession` kept one game across rooms: after a leave and another room (its sim at an earlier tick), every snapshot read as stale and the game froze, and the numbering ran on past the new room's sequence gap. Three cases red (another room's earlier ticks restore and number from 0; `clear` restarts the numbering; a leave forgets the game, shown red with the new branch switched off), plus a reconnect keeping its game; now `clear` resets the numbering and the session clears when the room info goes or changes room. N-b's variable renamed. `pnpm check`: root 163, net 312, pipelines 138, dev-tools 62, physics 71, server 432 |
