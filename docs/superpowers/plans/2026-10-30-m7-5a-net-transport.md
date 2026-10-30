# M7.5a: `net` transport, NetRoom, reconnection and room store, TDD plan

- **Spec:** the framework's M7 spec (`docs/superpowers/specs/2026-10-17-m7-online-store-design.md`) §3 (ownership: the
  reconnection token, the room store as a read-only mirror), §4.2 (`ConnectionState`, `SeatInfo`, `RoomInfo`,
  `NetRoom`, `NetError`, the reconnection and join-check bullets, the FloorFifty source table), §5 (create or join,
  drop and reconnect, reload mid-room), §6 (connection lost, version, draining), §13 N-c.
- **Row:** M7.5a in the framework's `docs/02-master-delivery-plan.md`. Prerequisite M7.3b (merged). Size L.
- **Branch:** `claude/plus-M7.5a-net-transport`, from `main` with M7.4b (#11) merged in.
- **Sources (read-only):** FloorFifty `677d4568b7b2265fda4246d711065b8f417cac26`:
  `apps/client/src/managers/network/{colyseus-network,network}.ts`, `apps/client/src/ui/store/room-store.svelte.ts`,
  `tests/client/managers/network/{colyseus-network,reconnect}.test.ts`, `tests/client/ui/room-store.test.ts`,
  `tests/client/support/fakes/server.ts` (`fakeColyseusClient`).
- **Status:** implemented and checked locally; Plus CI pending; not reviewed.

## Scope

In:

- `NetError` (a tagged error with net's `NetErrorCode` and the operation), and `refusalCode`, which reads a code from
  whatever refused: the server's `CODE: words` refusals (room and gates alike), Colyseus's own matchmaking errors
  (`room "X" not found` → `ROOM_NOT_FOUND`, `is locked` → `ROOM_FULL`), and a request that never reached a server
  (`OFFLINE`).
- `reconnectDelay(attempt, random)`: 250 ms doubling to 2 s, the climbing steps spread ±25% (FloorFifty's).
- The reconnection token in `sessionStorage` (never `localStorage`, never the URL), read through a Zod schema, with
  storage failures swallowed (private browsing).
- Request ids: a per-load random prefix and a counter, unique across reloads, at most `REQUEST_ID_MAX_LENGTH`.
- The room info projection: the room's Colyseus state → a plain, frozen `RoomInfo` (`hostSeat` −1 → undefined, `you`
  from `seated` only), refused when it does not parse.
- The Colyseus transport (`colyseus-transport.ts`): one SDK room, net's two channels; `seated`, `answer`, `snap` +
  bytes, `pong`, `replay` + bytes; correlated requests answered once; pings and the round trip; bytes counted off
  the socket. A client `NetworkPort` that keeps its listeners across rooms (`net-port.ts`).
- `NetRoom` (`net-room.ts`), the Effect service: `create`, `join`, `quickMatch` (one retry when the offered room filled,
  went or refused), `setReady`, `addBot`, `removeBot`, `leave`, `resume` (once), `info`, `connection`, `ended`, `port`.
  One intent owns its handshakes: a later intent, `leave` or the scope's close retires an earlier one. A drop retries
  with the backoff inside `reconnectGraceSeconds` on Effect's `Clock`, then the seat is given up. A probe a second
  while connected, so the round trip is known before play.
- The room store (`room-store.ts`): a synchronous, read-only mirror of `info` and `connection` for the kit screens,
  with no verbs.

Out (later rows): prediction, reconciliation, input lead (M7.5b); interpolation, render clock, diagnostics and
`degraded`, the connection badge, the reconnect overlay and NetError copy (M7.5c); `createHeadlessClient` and
`startTestServer` in `testing` (M7.6); `netExtension` (needs `@mcthaydt/automata-runtime/extension`, private core).

## Files

Create in `packages/net/src/client/` (each with its test, written first):

- `net-error.ts`: `NetError`, `refusalCode(error)`.
- `reconnect-delay.ts`: `reconnectDelay(attempt, random)`, `RECONNECT_BASE_MS` 250, `RECONNECT_CEILING_MS` 2000.
- `seat-token.ts`: `SEAT_TOKEN_KEY`, `seatTokenKey(url)`, `createSeatTokenStore(storage, owner)`, `SeatOwner`,
  `StoredSeat`, `SeatStorage` (the seat in memory, written through to storage, per server).
- `request-ids.ts`: `createRequestIds(loadToken)`, `newLoadToken(randomBytes?)`.
- `room-info.ts`: `RoomInfo`, `SeatInfo`, `roomInfoOf(state, you)`, `sameRoomInfo(a, b)`.
- `sdk.ts`: the slice of `@colyseus/sdk` the client uses (`NetSdkClient`, `NetSdkRoom`), and `colyseusClient(url)`.
- `colyseus-transport.ts`: `ColyseusTransport` (close codes are read by `endOf` in `net-room.ts`).
- `net-port.ts`: `createClientPort()` → `ClientNetworkPort` (the four `NetworkPort` members, `NetSnapshot` with acks).
- `net-room.ts`: `ConnectionState`, `RoomEnd`, `NetRoom` (tag), `NetRoomOptions`, `makeNetRoom(options)`,
  `netRoomLayer(options)`.
- `room-store.ts`: `RoomStore`, `makeRoomStore(room)`.
- `testing/fake-colyseus.ts` (net `./testing`): `fakeColyseus()` (FloorFifty's `fakeColyseusClient`, generic).

Modify:

- `packages/net/package.json`: `@colyseus/sdk` 0.18.5 a dependency.
- `packages/net/src/index.ts`, `src/testing/index.ts`: exports.
- `packages/server/src/room/net-client.test.ts` (new, in `server` because `server` already depends on `net` and has
  the Colyseus harness): the net client against a real room.

## Interfaces

```ts
export class NetError extends Data.TaggedError('NetError')<{ readonly code: NetErrorCode; readonly operation: string }> {}
export function refusalCode(error: unknown): NetErrorCode
export function reconnectDelay(attempt: number, random: () => number): number

export type ConnectionState = 'offline' | 'connecting' | 'connected' | 'reconnecting' | 'degraded'
export interface SeatInfo { seat; name; ready; connected; bot }
export interface RoomInfo { code; phase: LobbyPhase; seats: readonly SeatInfo[]; you: number | undefined; hostSeat: number | undefined }
/** Why the room went without the player choosing to leave. */
export type RoomEnd = { readonly reason: 'seat-lost' | 'closed' | 'server-updating' | 'failed' }

export interface NetRoom {
  create(options: { name: string }): Effect<void, NetError>
  join(code: string, options: { name: string }): Effect<void, NetError>
  quickMatch(options: { name: string }): Effect<void, NetError>
  setReady(ready: boolean): Effect<void, NetError>
  addBot(): Effect<void, NetError>
  removeBot(seat: number): Effect<void, NetError>
  readonly leave: Effect<void>
  readonly resume: Effect<'resumed' | 'none' | 'expired', NetError>
  readonly info: Subscribable<RoomInfo | undefined>
  readonly connection: Subscribable<ConnectionState>
  readonly ended: Subscribable<RoomEnd | undefined>
  readonly port: ClientNetworkPort            // NetworkPort's four members, plus ping, onPong, roundTripMs, bytesIn
}
export interface NetRoomOptions {
  readonly url: string
  readonly version: { readonly schemaHash: string; readonly contentHash: string }
  readonly reconnectGraceSeconds: number
  readonly session?: () => string | undefined      // the host's session token for the SessionVerifier (M7.4b)
  readonly client?: (url: string) => NetSdkClient  // the SDK by default
  readonly storage?: SeatStorage                   // sessionStorage by default
  readonly random?: () => number                   // the backoff's spread
  readonly loadToken?: string
}
export function makeNetRoom(options: NetRoomOptions): Effect<NetRoom, never, Scope>

export interface RoomStore { readonly info: RoomInfo | undefined; readonly connection: ConnectionState; subscribe(listener: () => void): () => void }
export function makeRoomStore(room: NetRoom): Effect<RoomStore, never, Scope>
```

Close codes (Colyseus 0.18): 4000 (consented) and 1000 end the room (`closed`); 4001 (the server's drain or shutdown)
is `server-updating`; 4002 (the room failed) is `failed`; anything else (1006 above all) is a drop, and a drop is what
the grace is for.

## Steps

- [x] 1. `NetError` and `refusalCode`: red (module missing), green. Cases: every net code read from `CODE: words`;
  `not found` → `ROOM_NOT_FOUND`; `is locked` → `ROOM_FULL`; a fetch failure → `OFFLINE`; anything else `REFUSED`; the
  server's words never become the code.
- [x] 2. `reconnectDelay`: FloorFifty's two cases (doubling to the ceiling; the ±25% spread).
- [x] 3. Seat token store: write and read back; never `localStorage`; a corrupt or foreign value read as nothing and
  removed; a throwing storage costs nothing.
- [x] 4. Request ids: unique across two loads; at most 64 characters; printable (net's `reqIdSchema`).
- [x] 5. Room info: projects the state; `hostSeat` −1 is undefined; `you` only from `seated`; a plain frozen object
  holding no schema reference; a state that does not parse is refused; `sameRoomInfo`.
- [x] 6. `fakeColyseus` in `net/testing` and the transport: correlated requests (resolve on their own answer only,
  reject with the room's code, rejected when the room is replaced or left); `cmd` fire and forget; `snap` + bytes
  delivered as one snapshot with acks, bytes copied; a header with no bytes, or bytes with no header, delivers
  nothing; pongs measured, a stray or repeated pong ignored; bytes counted off the socket; a retired room's queued
  callbacks ignored.
- [x] 7. `NetRoom` joining (the ported colyseus-network cases): create, join, quick match with the join options;
  the SDK's own reconnect loop off; quick match tries once more on `ROOM_FULL`, `ROOM_NOT_FOUND` or `REFUSED`, no
  third time, and never for another code; every refusal read as its `NetError` and `connection` back to offline;
  the session token in the join options when the host has one.
- [x] 8. `NetRoom` requests: `setReady`, `addBot`, `removeBot` as correlated requests; `OFFLINE` with no room.
- [x] 9. `NetRoom` reconnection on `TestClock`: the token in `sessionStorage`, never the URL; a drop is
  `reconnecting`, retried with the backoff, and back to `connected`; still trying seconds in; past the grace the seat
  is lost (`ended: seat-lost`, offline, token forgotten); a rotated token persisted before it is announced; 4000 and
  1000 are `closed`, 4001 `server-updating`, 4002 `failed`, none retried; `leave` never reconnects; a later intent
  cancels a backoff.
- [x] 10. `NetRoom` resume (N-c): resumes a stored seat once; `none` with nothing stored; `expired` forgets the token
  and is not retried; a second `resume` is `none`; `OFFLINE` fails and keeps the token.
- [x] 11. Intent ownership: an old create, join, quick match or resume that settles after a later intent is left (its
  room left consented) and changes nothing; leave detaches synchronously; closing the scope closes the socket
  without giving up the seat (the reload keeps its token).
- [x] 12. Probing: a probe a second while connected; none after leaving; the round trip is the median of the last 7.
- [x] 13. Room store: mirrors info and connection; starts from what the room already holds; keeps the last info while
  reconnecting; has no verbs (FloorFifty's load-bearing case).
- [x] 14. Integration against a real room (`packages/server`): create and join seat two clients and both see the
  room's info and their own seats; a full room and an unknown code are `ROOM_FULL` and `ROOM_NOT_FOUND`; another
  content hash is `VERSION_MISMATCH`; `setReady` answered; a dropped socket reconnects into its seat; **N-c:** a new
  `NetRoom` on the same storage resumes into the seat, and once the grace has passed resume reports `expired` and
  forgets the token.
- [x] 15. Exports, `pnpm format`, `pnpm check`; the execution log below.

## Ported tests (FloorFifty count → this row's)

**colyseus-network (69 top-level cases, 71 counting `it.each` rows).** Ported (generic): the backoff (2); create,
quick match, the SDK loop off, retries and their limits (7); correlated requests and their refusals (2); fire and
forget (1); the token in session storage (1); keeps trying and gives up (1); rotated token (1); refusal codes (2,
one table); consented close and shutdown not a drop (2); leave does not reconnect (1); detach on leave (1); probing
and the round trip (3); resume once, none, expired (3); unique request ids (1); pending rejected on leave, replacement
and dispose (3); intent ownership (4); retired room callbacks (1); dispose keeps the seat (1). Not ported, by reason:
`schemaToSnapshot` and its 11 cases (the race state; net restores the sim's bytes instead); access reports (5),
device class (2), colour (1), build facts (1), content revisions (1) (FloorFifty's join options and select; Plus's join
check is the hashes); pick commands (3), replay request and race events (4) (race verbs); the server-error message
and drain notice (4) (Plus's room sends no `serverError`: a drain closes with 4001, read as `server-updating`); the
browser `offline` event (1) (moved to M7.5c with diagnostics, where the browser's network signal belongs).

**reconnect (12).** Its cases are screen tests (Gameplay, the main menu, `ErrorChannel`). Ported here at the room
store and `NetRoom` level: the last room info stays while reconnecting; connected again hides nothing it did not
change; a failure it can continue through (`RATE_LIMITED` on a request) does not end the room; a room that cannot
continue ends with a reason (`ended`). The indicator, overlay and copy cases (8) are M7.5c's and PRODUCT.6's.

## Decisions for the Owner's veto

- **`NetworkPort` is matched, not imported.** Core's `@mcthaydt/automata-runtime` is private and has no pack, so the
  F1 boundary refuses it. `ClientNetworkPort` has core's four members with core's signatures (plus `ping`, `onPong`,
  `roundTripMs`, `bytesIn`, `onReplay`), and its snapshots are `AuthoritativeSnapshot` plus `acks`. DX.2a
  (AF #227) publishes core's runtime: once it merges and `core.ref` moves, the port imports `NetworkPort` from that
  published entry and the matched type goes. No types-only entry is asked of core.
- **`create` takes no `private` option yet.** Spec §4.2 sketches `create({ name, private? })`, but `JoinOptions` is
  strict and has no such field, and M7.3b's room offers every lobby to Quick match. A private room needs an additive
  `private?: boolean` in `JoinOptions` and the room's listing to honour it; left for a later row rather than sent as a
  field the server refuses.
- **`NetRoom.ended`** is added beside `info` and `connection` (additive to §4.2): `seat-lost` (the grace passed),
  `closed` (4000, 1000), `server-updating` (4001: a drain or a shutdown), `failed` (4002). The reconnect overlay's
  "disconnected too long" and the kit's copy read it; spec §4.2 has no other way for a room ending to reach a screen.
- **Quick match retries once on `ROOM_FULL`, `ROOM_NOT_FOUND` and `REFUSED`.** FloorFifty retried on full and closed;
  Plus's room refuses a seat in a started game with `REFUSED` (net has no `ROOM_CLOSED`), so `REFUSED` is retried too.
  A second refusal is final.
- **`resume`** runs one attempt per `NetRoom`; a later call is `none`. `OFFLINE` and `RATE_LIMITED` fail with
  `NetError` and keep the token (the seat may still be held; the next load tries again); every other refusal is
  `expired`, and the token is forgotten.
- **Names are checked before the network.** Join options that fail the wire's own schema fail `REFUSED` without a
  request and without leaving the current room.
- **The seat is kept per server, in memory first** (review, PR #13). The key is `automata-net.seat:<url>`, holding
  `{ url, schemaHash, contentHash, code, token }` read through a strict schema. A seat stored for another server or
  another build of the game is never presented and never deleted (itch.io serves every game from one origin). The
  current seat lives in memory and is written through, so a client with no working storage still reconnects.
- **Every handshake is bounded.** A reconnect attempt times out at 5 s or the grace left, whichever is sooner, so a
  hung attempt (Wi-Fi to cellular) does not hold back the next, and an abandoned attempt's late room is retired,
  never adopted. `resume` times out at the whole grace and fails `OFFLINE`, keeping the token. A late room is kept
  only when it is a reconnect of the seat this client still holds and nothing replaced it (no room is current, and the
  stored token is exactly the one that handshake presented): the rotated token is stored and the socket closed without
  consent. Every other late room, a fresh create or join above all, is left, consented.
- **What reads `OFFLINE`.** fetch's own failures, however the SDK wraps them; a socket closed with 1005 or 1006
  (including a socket the server's socket gate refused before Colyseus, which the client sees as 1006); and a gateway's
  502, 503 or 504 while the server restarts. The server's own refusals lead with their code and are read by it first.
- **Persistence off is `storage: null`.** Absent, the seat is written through to this page's `sessionStorage`.
- **A superseded intent succeeds quietly.** A create, join, quick match or resume that a later intent replaced
  completes with success (resume with `none`), not a `NetError`: the player chose something else, and the room it
  produced is left. FloorFifty's rule.
- **A request in flight across a drop settles `OFFLINE`, and may have been applied.** The room may have acted on a
  `ready` or `bot.add` whose answer the drop lost; the client does not resend it. The room info that follows shows
  what happened (ready flags, bot seats), so the kit reads that rather than the request's result. Resending the same
  request id after the reconnect, which the room's ledger would answer once, is a later improvement.
- **The browser `offline` event** (FloorFifty closes the socket on it) moves to M7.5c with the diagnostics.

## Execution log

| Date | Step | Evidence |
|---|---|---|
| 2026-10-30 | 1 to 5 | Each module red (module missing), then green: net-error 15, reconnect-delay 2, seat-token 9, request-ids 4, room-info 9. `NetError`'s base is typed first for `isolatedDeclarations` (as `server`'s errors are) |
| 2026-10-30 | 6 | `fakeColyseus` (net `./testing`), the transport and the client port: transport 16 and port 8 red (module missing), then green. `@colyseus/sdk` 0.18.5 is a dependency of net |
| 2026-10-30 | 7 to 13 | `net-room.ts` was drafted before its tests, then moved out of the tree: the join suite ran red (module missing) without it, and the reconnect, intent and store suites were written against it and ran red where the harness or the test was wrong first (TestClock reached only through a `ManagedRuntime` of `TestContext`; a test room code `OLD234` that the seat schema rightly refused, since `O` is not in the code alphabet). Room store red (module missing), then green. join 25, reconnect 18, intents 14, store 6; the net suite three runs in a row, 215 each |
| 2026-10-30 | 14 | `packages/server/src/room/net-client.test.ts`: six cases against a real room over real sockets (create and join, the three refusals, ready answered, a dropped socket reconnected, quick match and a drain read as `server-updating`, and N-c). Green on their first run, three runs in a row; they hold the unit-tested client to the real server's refusals and close codes rather than drive new code |
| 2026-10-30 | 15 | Exports from `net` and `net/testing`; `pnpm format`, `pnpm check`: root 163, net 215, pipelines 82, dev-tools 62, physics 71, server 421 |
| 2026-10-30 | Self-review | (1) `refusalCode` read every `TypeError` as `OFFLINE`, so a bug in the client would tell the player to check their network: a case red ("never reads a bug as offline"), now only `fetch`'s own unreachable wordings (Node, Chromium, Firefox, WebKit) are `OFFLINE`. (2) The integration suite now also holds the byte count off the real SDK socket and an authoritative snapshot through the port (green on the first run). (3) Hand-off to M7.5c: requests and the background probe run while `connection` is `connected`; when diagnostics add `degraded`, both must keep running in it (the room is still there), which M7.5c tests when it can set the state |
| 2026-10-30 | Review fixes (PR #13 review) | (1) The real SDK rethrows fetch's failure as a `MatchMakeError` with fetch's words and no code, and a socket failure as `MatchMakeError('', 1006)`: 6 unit cases and 4 real-`Client` cases with a stubbed `fetch` (each engine's wording) red, now the wording is matched on any Error and 1005/1006 read `OFFLINE`; the closed-port integration case passes on Node's `ECONNREFUSED` code either way, so the stubbed cases are the ones that hold the fix. (2), (3) The seat store keeps the seat in memory and is keyed and recorded per server and build: the store's 12 cases red (API missing), then green; the NetRoom cases with throwing and missing storage, and another server's seat, green with it. (4) Handshakes bounded by the grace, (5) a scope closed mid-reconnect keeps the seat (the intents test that expected a consented leave was the bug, and was changed), (7) resume goes straight to `reconnecting` and gives up its intent when interrupted: 6 cases in `net-room-review.test.ts` red, then green. (6) The integration client's grace is a per-player option, 30 s by default. (8) The room store's close test now changes the room after the close; shown to fail with the store's fibers forked as daemons. Nits declared above. `pnpm check`: root 163, net 240, pipelines 82, dev-tools 62, physics 71, server 422; the net suite and the integration file three runs each, all green |
| 2026-10-30 | Re-review fixes (PR #13, at 062556a) | (1) `retire` kept any late room whose code matched the stored seat: two cases red (a double-tapped Join of one code; a reconnect overtaken by a fresh join of the same room), now a late room is kept only with no room current and the stored token exactly the one its handshake presented. (2) One attempt's timeout was the whole grace: a case red (first attempt hangs, the second succeeds), now each attempt is capped at 5 s and given up, and its late room retired. (3) A gateway's 502, 503 or 504 read `REFUSED`: three real-`Client` cases with a stubbed `fetch` red, now `OFFLINE`; the server's own 503 `SERVER_UPDATING` is still read by its code. (4) The other-server test now makes this server's resume forget an expired seat of its own, and a leave with another build's seat under this server's key; both assert the other record survives. Nit: `storage: null` switches persistence off (the test's `null` failed typecheck first) |
