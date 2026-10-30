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
- **Status:** planned.

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

- [ ] 1. Input lead: FloorFifty's 10 cases red (module missing), then green.
- [ ] 2. Authority clock: red (module missing), then green. Cases: nothing before the first snapshot; the first
  snapshot sets it; it runs at the nominal rate between snapshots; it eases toward a later anchor by at most 10% of
  elapsed time and never past it; it snaps forward past 12 ticks; one snapshot far behind does not move it back,
  500 ms of them does; `error` is the anchor less the clock; `clear` forgets.
- [ ] 3. Counter game (test support) and prediction: red (module missing), then green. Cases: a command recorded
  for tick P takes effect when P is stepped; a restore re-steps the pending commands to the sampled tick and the
  result equals stepping without the snapshot (a snapshot that agrees changes nothing); acked commands are dropped;
  a command whose tick has passed is applied at T, after the one sent ahead of it, never before; a stale or repeated
  snapshot is ignored; a header hash that differs is a mismatch, the sim is put back on the base and re-stepped (its
  hash unchanged), the ack in that header is not applied; bytes that fail to restore are a mismatch and leave the
  sim as it was; a mismatch before any good snapshot rolls back to the sim's starting state; `clear`.
- [ ] 4. `NetSession` (FloorFifty `race-netcode` cases, adapted): red (module missing), then green. Sends the first
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
- [ ] 5. `makeNetSession` on the M7.5a harness (fake Colyseus, `TestClock`): red (module missing), then green.
  Snapshots reach the session timestamped on the `Clock`; the seat comes from `info.you`; input is taken only in
  `countdown` or `playing` while connected; a drop and return calls `resync` (the unacked commands go out again on
  the new room); `ended` reads the desync; closing the scope stops snapshots and pongs reaching it.
- [ ] 6. Link client (`net/testing`): red (module missing), then green. A room client's header and bytes arrive as one
  snapshot on the client's port; text messages reach the client's transport (seated, pong with its round trip);
  commands and pings reach the room end as wire text; `down` drops both directions; a corrupted frame still arrives
  as one snapshot.
- [ ] 7. N-a, N-b, N-d (`packages/server`, `net-session-link.test.ts`) over seeded links with the room engine:
  **N-a** two clients and the room play 3,600 ticks over 100 ms ± 30 ms, 2% loss, 1% duplicates, 1% reorder: no
  mismatch, every restored hash equal to the room's at that tick, each local command applied in the client sim on the
  tick it was sampled, and the room took nearly all of them on that tick. **N-b** a client whose link is down 5 s
  returns to its seat, restores the next snapshot with the room's hash at that tick, and the room stepped every tick
  meanwhile. **N-d** a frame with changed bytes is not stepped on and the next snapshot restores (resync); a second
  in 10 s ends the session with `desync`; two 11 s apart do not.
- [ ] 8. The netcode model (`netcode-model.test.ts`, FloorFifty's cases on the counter-walk game): exact on a
  perfect link; as if local at a 100 ms round trip (late share ≤ 1%, no misprediction at p99, lead > 6); within
  budget at 200 ms with jitter; recovers within its first probes with no round trip measured beforehand; walks as far
  over the network as locally; a one-off command lands on the same tick on both sides.
- [ ] 9. Exports; `pnpm format`, `pnpm check`; the execution log below.

## Ported tests (FloorFifty count → this row's)

Filled in as the steps land.

## Decisions for the Owner's veto

Filled in as the steps land.

## Execution log

| Date | Step | Evidence |
|---|---|---|
