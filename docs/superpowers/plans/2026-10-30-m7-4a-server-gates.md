# M7.4a: `server` gates (size cap, origins, per-IP buckets, sockets, version gate), TDD plan

- **Spec:** the framework's M7 spec (`docs/superpowers/specs/2026-10-17-m7-online-store-design.md`) §4.3
  (`ServerLimits`, the gates row of the FloorFifty source table: "Gates, unchanged in rules"), §4.2 (the join check),
  §4.5 (the `refused` event and its fields), §5 (create or join: drain, per-IP buckets, body cap, protocol and hashes,
  origin), §6 (the rows on size, rate limits and sockets, origins, version, draining), §13 SV-c and SV-d, §13.1 (QB
  §5 "per-connection and per-IP rate limits", QB §4.1 "CORS and headers").
- **Row:** M7.4a in the framework's `docs/02-master-delivery-plan.md`. Prerequisite M7.3b. Size M.
- **Branch:** `claude/plus-M7.4a-server-gates`, on `main` after M7.3b. M7.4b (logs, `/health`, process safety,
  `SessionVerifier`) runs in parallel in `packages/server`; this row keeps to the gates and the wiring they need.
- **Sources (read-only):** FloorFifty `677d4568b7b2265fda4246d711065b8f417cac26`:
  `apps/server/src/gate/{client-ip,matchmake-gate,origins,socket-gate,token-buckets}.ts`,
  `apps/server/src/{http-body,matchmake-version-gate}.ts`, the gate wiring in `apps/server/src/colyseus-server.ts`,
  and `tests/server/gate/{client-ip,matchmake-gate,origins,public-surface,refusal-log,socket-gate,token-buckets}.test.ts`
  (FloorFifty has no test file of its own for `http-body` or the version gate: they are covered by
  `matchmake-gate.test.ts`' 413 case and `tests/server/rooms/race-room-join-check.test.ts`).
- **Status:** implemented and checked locally; Plus CI pending; not reviewed.

## Scope

In:

- The five gates as plain modules in `packages/server/src/gate/`: the client address (`client-ip`), per-key token
  buckets on an injected clock (`token-buckets`), the socket counts (`socket-gate`), the origin list (`origins`), the
  capped body reader (`http-body`), the version gate (`matchmake-version-gate`) and the matchmaking gate that runs
  them in order (`matchmake-gate`).
- The wiring in front of Colyseus (`server-gates`): every matchmaking request passes the origin list, the drain, the
  per-IP buckets, the body cap and the version gate before Colyseus sees it; every socket upgrade passes the origin
  list and the socket counts; matchmaking's CORS follows the origin list. `createServerRuntime` installs it.
- `ServerLimits.allowedOrigins` enforced: exact origins, an empty list refused at start (SV-d); the seam
  `originsFromGameOrigin(origin)` for Ruken's `gameOrigin` (below).
- `ServerLimits.maxMessageBytes` enforced: a matchmaking body past it gets 413 and the connection closes; a room
  message past it is dropped before parsing and logged `refused` with `code: 'size'`; the WebSocket frame bound is
  pinned from it.
- The version gate: a join whose `protocol`, `schemaHash` or `contentHash` differs from the server's game is refused
  `VERSION_MISMATCH` at matchmaking, and the room's `onAuth` checks the same (M7.3b left the hashes parsed and not
  compared).
- Each refusal logged through `config.log` as `{ event: 'refused', code }` with no address (M7.4b turns events into
  redacted lines).

Out: `/health`, `/ready`, `security.txt`, log lines, process safety (refusing test switches in production) and
`SessionVerifier` (M7.4b; `runtime.origins` is exposed so M7.4b's `/health` can answer with the same CORS);
`startTestServer` and headless clients (M7.6).

## Ruken's `gameOrigin`

The row says `allowedOrigins` is built from Ruken's `gameOrigin` (imported). `gameOrigin(publicId, env, channel)` is
exported by `@ruken/manifest`, which the framework vendors as a tarball (`vendor/ruken/ruken-manifest-0.0.0.tgz`) and
does not publish. No core pack in `.core/packs` re-exports it: `grep -r gameOrigin .core/packs/*/dist` finds only
fields named `gameOrigin` (the SDK's `HostInfo`, the fake host's options), never the function. AGENTS.md forbids
copying a Ruken contract, so:

- `allowedOrigins` stays an explicit list in config, matched exactly; the server refuses to start with an empty list
  or an entry that is not an origin (`scheme://host[:port]`, nothing after it).
- `originsFromGameOrigin(origin: string): readonly string[]` is the seam: it takes an origin `gameOrigin` already
  computed (by the deploy, from the game's `publicId`, env and channel) and returns the one-entry list, refusing
  anything that is not an exact origin. A web or itch.io origin is added beside it in config.
- **Request to core:** export `gameOrigin` from a core pack (for example `@mcthaydt/automata-host` or
  `@mcthaydt/automata-ship`), so `server` imports it and the seam calls it with `(publicId, env, channel)`.

## Files

Create (each with its test, written first):

- `packages/server/src/gate/client-ip.ts`: `clientIp(request)`.
- `packages/server/src/gate/token-buckets.ts`: `TokenBuckets`, `TokenBucketOptions`, `bucketOptions(bucket)`.
- `packages/server/src/gate/socket-gate.ts`: `createSocketGate`, `SocketGate`, `socketTotal`, `SOCKET_HEADROOM`.
- `packages/server/src/gate/origins.ts`: `originPolicy`, `OriginPolicy`, `originsFromGameOrigin`.
- `packages/server/src/gate/http-body.ts`: `readCappedBody`, `refuseTooLarge`.
- `packages/server/src/gate/refusal.ts`: `writeRefusal` (the `{ code, error }` shape with the origin policy's CORS).
- `packages/server/src/gate/matchmake-version-gate.ts`: `GameVersion`, `gameVersionOf(def)`, `versionVerdict`,
  `refuseStaleVersion`.
- `packages/server/src/gate/matchmake-gate.ts`: `createMatchmakeGate`, `MatchmakeGateOptions`.
- `packages/server/src/gate/upgrade-gate.ts`: `createUpgradeGate` (origins and socket counts on an upgrade).
- `packages/server/src/gate/server-gates.ts`: `installGates(http, options)`: wraps the listener's `request` and
  `upgrade` handlers and matchmaking's CORS.
- Tests: the seven ported suites (`client-ip`, `token-buckets`, `socket-gate`, `origins`, `matchmake-gate`,
  `public-surface`, `refusal-log`) and `http-body`, `matchmake-version-gate`, `upgrade-gate`.

Modify (the wiring only):

- `src/game/server-config.ts`: `perIp` gains `quickMatch` (below); comments say what is enforced.
- `src/server/start-server.ts`: `configProblem` checks the origin list and `maxMessageBytes`; `createServerRuntime`
  computes the game's version, installs the gates on the listener, pins the WebSocket frame bound and exposes
  `origins` and `version`.
- `src/room/automata-room.ts`: `RoomContext` gains `version` and `maxMessageBytes`; `onAuth` compares the hashes;
  `receive` drops a message past `maxMessageBytes` before parsing.
- `src/room/room-messages.ts`: net's `too-large` is logged as spec §6's `size`.
- `src/test-support/colyseus-harness.ts`: `TEST_ORIGIN` listed in `TEST_LIMITS` and sent by the SDK on every request
  and socket; join options carry the server's real version (`server.joinOptions(name)`), replacing the fixed `HASH`.
- `src/index.ts`: exports the gates' public names.

## Interfaces

```ts
// client-ip
export function clientIp(request: IncomingMessage): string        // the peer; Caddy's last hop from loopback; IPv6 by /64

// token-buckets (an injected clock: `now` is required, never Date.now)
export interface TokenBucketOptions { readonly burst: number; readonly refillMs: number; readonly maxKeys: number; readonly now: () => number }
export class TokenBuckets { constructor(options: TokenBucketOptions); get size(): number; take(key: string): boolean; sweep(): void }
export function bucketOptions(bucket: Bucket): { burst: number; refillMs: number }   // perSecond → refillMs

// socket-gate
export interface SocketGate { admit(ip: string): boolean; release(ip: string): void; readonly open: number; readonly addresses: number }
export function createSocketGate(limits: { maxPerIp: number; maxTotal: number }): SocketGate
export const SOCKET_HEADROOM = 64
export function socketTotal(maxRooms: number, seatsPerRoom: number): number          // seats × rooms + headroom

// origins
export interface OriginPolicy { allows(origin: string | undefined): boolean; corsHeaders(origin: string | undefined): Record<string, string>; readonly origins: readonly string[] }
export function originPolicy(list: readonly string[]): OriginPolicy                    // throws for an empty list or a non-origin
export function originsFromGameOrigin(origin: string): readonly string[]               // the seam for Ruken's gameOrigin

// http-body
export function readCappedBody(request: IncomingMessage, limit: number): Promise<string | undefined>
export function refuseTooLarge(request: IncomingMessage, response: ServerResponse, headers?: Record<string, string>): void

// matchmake-version-gate
export interface GameVersion { readonly protocol: number; readonly schemaHash: string; readonly contentHash: string }
export function gameVersionOf(def: ServerDef): Promise<GameVersion>                    // from a sim of the game, disposed
export function versionVerdict(options: unknown, version: GameVersion): 'same' | 'mismatch' | 'unread'

// matchmake-gate
export interface MatchmakeGateOptions { isDraining(): boolean; perIp: ServerLimits['perIp']; maxBodyBytes: number;
  version: GameVersion; origins: OriginPolicy; now(): number; onRefused(code: string): void }
export function createMatchmakeGate(options: MatchmakeGateOptions): (request, response) => Promise<boolean>

// server-gates
export function installGates(http: HttpServer, options: GateOptions): void
```

`ServerLimits.perIp` becomes `{ create, join, quickMatch, reconnect }` (see deviations). Refusals:

| Gate | Answer | `refused` code |
|---|---|---|
| Matchmaking from an unlisted origin or none | 403 `REFUSED` | `origin` |
| A socket from an unlisted origin or none | 403, before Colyseus | `origin` |
| A new room or seat while draining (reconnects pass) | 503 `SERVER_UPDATING` | `draining` |
| An address past its bucket | 429 `RATE_LIMITED` | `create`, `join`, `quickMatch` or `reconnect` |
| An address or the server past its sockets | 429, before Colyseus | `sockets` |
| A matchmaking body past `maxMessageBytes` | 413, connection closed | `size` |
| Another protocol, schema hash or content hash | 400 `VERSION_MISMATCH` | `version` |
| A room message past `maxMessageBytes` | dropped before parsing, the socket stays | `size` |

## Tests, written first (FloorFifty's count → this row's)

1. **client-ip (6 → 6):** the TCP peer; X-Forwarded-For ignored from anyone but loopback; Caddy's last hop from
   loopback; the peer when loopback forwards nothing usable; IPv6 keyed by its /64, IPv4 whole; no address named
   `unknown`.
2. **token-buckets (7 → 7):** burst then one per refill; never past the burst; keys apart; never more than `maxKeys`;
   least recently used evicted first; a full bucket forgotten on sweep; a bucket in debt kept on sweep. Plus
   `bucketOptions` inside the first case's file as an eighth case (perSecond to refillMs, 0 never refills).
3. **socket-gate (5 → 5):** sixteen from one address and the seventeenth refused, another address let in (SV-c);
   the next let in once one closes; the total across addresses; empty after every close, the address forgotten;
   never below zero for a release it did not admit. Plus `socketTotal` (a sixth case).
4. **origins (5 → 6):** FloorFifty's "allows everything when no list is set" and "treats an empty list as unset" are
   inverted by spec §4.3 and SV-d: an empty list and a blank entry are refused, and so is an entry that is not an
   origin; only a listed origin, exactly; a listed origin echoed with `Vary: Origin`, none for another; a local Ruken
   origin, port and all. Added: `originsFromGameOrigin` takes an exact origin and refuses a path or a trailing slash.
5. **http-body (0 → 3):** reads a body under the cap; past it resolves `undefined` at once and stops reading;
   `refuseTooLarge` answers 413 and closes the connection.
6. **upgrade-gate (0 → 5):** unit cases on fake sockets: an unlisted origin and none refused 403 and never handed on;
   a listed origin handed on and counted; past an address's cap 429; past the total 429 whoever sends it (FloorFifty
   public-surface's "past the total", here at unit level: an integration test cannot hold 65 bare sockets open past
   Colyseus's one-second close of a socket with no room); a closed socket gives its place back.
7. **matchmake-version-gate (0 → 6):** another protocol, another schema hash and another content hash each refused
   400 `VERSION_MISMATCH` before a room opens; the same version seated; malformed options left to the room
   (`REFUSED`); a reconnect, which carries no version, passes. `versionVerdict` unit cases inside.
8. **matchmake-gate (8 → 8):** an address opens `create.burst` rooms, then 429 `RATE_LIMITED` with CORS; Quick match
   limited on its own bucket; `join.burst` code tries, then 429; four players behind one router all Quick match at
   once; four joins and eight reconnects from one address pass; a test server's wide buckets let one address open six
   rooms (FloorFifty's "no limits with the test driver": Plus has no driver switch, the limits are config); a body
   over the cap gets 413; a reconnection passes while the server drains and a new room is refused 503
   `SERVER_UPDATING`.
9. **public-surface (11 → 11):** origins: matchmaking's preflight answers a listed origin and blanks another (for
   FloorFifty's `/content`, which Plus does not serve); a refusal written by the gate carries the CORS of a listed
   origin only (for FloorFifty's `/health` case: `/health` is M7.4b's, which reads `runtime.origins`); matchmaking
   from an unlisted origin or none is refused 403 and opens no room, a listed one gets its CORS; a socket from an
   unlisted origin or none refused 403 before Colyseus, a listed one handed on; a server with no origin list refuses
   to start, naming `allowedOrigins` (FloorFifty's "allows every origin when none is listed", inverted by SV-d).
   Sockets: an address past its cap is refused 429 and a socket that closes gives its place back (real clients);
   SV-c: the refused socket leaves the address's open sockets playing (for FloorFifty's "no address cap with the test
   driver"); a frame past the cap is dropped, logged `size`, and the client stays connected (for FloorFifty's "past
   the total", moved to `upgrade-gate`). A room that fails to start holds no `maxRooms` slot; the drain still tells
   every other room when one throws; a room past `maxRooms` is refused `SERVER_BUSY`.
10. **refusal-log (5 → 5):** a rate refusal logged by its limit with no address; a room refused at the cap logged
    `busy`; a room refused at the cap torn down without an error (waits on `room.disposed`, not a sleep); a new
    room refused while draining logged `draining`; an origin, size and version refusal each logged by its code (for
    FloorFifty's "live room count on its interval", which is room telemetry: M7.4b).
11. **Wiring (existing suites):** the Colyseus suites run with `TEST_ORIGIN` listed and sent, and join with the
    server's real version; `start-server` refuses an empty origin list and a `maxMessageBytes` outside 1 to net's
    `MAX_MESSAGE_BYTES`.

**SV-c** (spec §13): the seventeenth socket from one address refused and the sixteen unaffected (socket-gate case 1,
public-surface SV-c case on real clients); create, join and reconnect (and Quick match) refused `RATE_LIMITED` per
address (matchmake-gate 1 to 3, refusal-log 1); a seat sending twice its command budget has the excess dropped and
stays connected (M7.3b's `room-engine` "over budget is dropped, never a disconnect" and `input-meter`, cited).

**SV-d:** a matchmaking request and a socket from an origin not in `allowedOrigins` refused (public-surface); the
server refuses to start without `maxRooms` or `allowedOrigins`, naming it (`start-server`, public-surface). "With a
test switch set" is M7.4b's process safety (its row names it) and is cited there.

## Decisions the Owner may veto

- **`perIp.quickMatch`.** Spec §4.3 lists `create`, `join` and `reconnect`. FloorFifty's rules (which §4.3 ports
  "unchanged") give Find a race its own bucket, wide enough for a family behind one router and narrow enough that it
  opens rooms no faster than Create. Charging Quick match to `create` would refuse the fourth of four players behind
  one router (FloorFifty Review Focus 2). So `perIp` gains `quickMatch`; the spec's §4.3 sketch needs the field.
- **Matchmaking from an unlisted origin is refused 403**, not only left without CORS as FloorFifty did: spec §6 says
  "refused before Colyseus", and SV-d "a request … is refused". A request with no `Origin` is refused too: a browser
  always sends one on a cross-origin POST, and a socket without one is refused already.
- **No dev mode that allows every origin**: the server refuses an empty list (SV-d); a dev server lists its dev
  origin.
- **The body cap is `maxMessageBytes`** (16 KB by default), not FloorFifty's separate 4 KB: one size limit.
- **The socket total** is FloorFifty's rule, seats per room × `maxRooms` + 64, derived rather than configured.
- **No "newer client, please wait" verdict:** FloorFifty told a client newer than the server to wait, by build ids.
  Plus has no build ids (M7.3b dropped build facts), so every mismatch is `VERSION_MISMATCH` (Reload).

## Gates

`pnpm format`, `pnpm check` (lint, typecheck, boundaries, root tooling tests, every package's `test:unit`); the server
suite three runs in a row. Pending: Plus CI, review.

## As built (deviations from the plan)

- `writeRefusal` lives in `gate/refusal.ts` (with `REFUSAL_WORDS`); the version gate imports it.
- `runtime.sockets` (open count and addresses) is exposed beside `runtime.origins` and `runtime.version`, so the
  socket tests wait on the server's own count rather than on a timer.
- The buckets are swept on the request path (every 60 s of the server's clock), not by FloorFifty's interval: no
  timer to stop, and no time but the injected clock.
- The room's `onAuth` refuses anything but the same version; the room's message cap is checked in
  `AutomataRoom.receive` before the engine sees the text; net's `too-large` is logged `size`.
- The WebSocket frame bound is `maxMessageBytes` + 1 KB of Colyseus envelope; a frame past it is closed by the
  transport (tested), a message past `maxMessageBytes` within it is dropped and the client stays.
- Malformed join options: Colyseus 0.18 runs the room's check once the socket opens, so the `REFUSED` reaches the SDK
  client and the HTTP request itself succeeds; the case is tested through the SDK.
- Adapted M7.3b tests: the join options carry the server's real version (`server.joinOptions`, `HASH` removed); the
  drain-during-onCreate case's slow plugin holds only the room's sim, since the server builds one sim at start to
  read its version.

## Ported and dropped

- **Ported:** every rule of the five gates, `http-body` and the version gate; FloorFifty's 47 gate cases, adapted
  where Plus differs (counts in Tests above).
- **Dropped or replaced, with reason:** "no limits with the test driver" (Plus has no driver switch; replaced by
  "a test server's wide buckets"); "no address cap with the test driver" (replaced by the SV-c case); "/content to
  a listed origin" and "/health to a listed origin" (no `/content` in Plus; `/health` is M7.4b's: replaced by the
  preflight and refusal-CORS cases); "past the total" through the server (moved to `upgrade-gate`, as Colyseus
  closes a bare socket after one second); "allows every origin when none is listed" (inverted by SV-d); "logs the
  live room count" (room telemetry, M7.4b; replaced by the origin/size/version/socket refusal codes); FloorFifty's
  build-skew and "newer client should wait" join cases (no build ids in Plus).

## Requests to core

- Export Ruken's `gameOrigin` from a core pack, so `originsFromGameOrigin` calls it with `(publicId, env, channel)`.
- The spec's §4.3 `ServerLimits.perIp` sketch needs `quickMatch` (framework spec owner).

## Execution log

| Date | Step | Evidence |
|---|---|---|
| 2026-10-30 | Plan | This file (commit `0516843`) |
| 2026-10-30 | Pure gates | client-ip, token-buckets, socket-gate, origins, http-body: 29 cases red (modules missing), then green |
| 2026-10-30 | Version and upgrade gates | 5 upgrade-gate cases red (module missing), one fixed test bug (a default parameter turned `undefined` into the listed origin), then green; version gate red (module missing), then green; the malformed case rewritten through the SDK (Colyseus answers the HTTP request); the room's own check shown red with the check disabled |
| 2026-10-30 | Integration suites | matchmake-gate 8, public-surface 11, refusal-log 5 and start-server +4 written against the wiring; each gate mutated off in turn (rates, drain, origin, body cap, upgrade gate, room size) and the matching cases failed (5, 2, 3, 2, 4, 1), then restored |
| 2026-10-30 | Counts | client-ip 6 (FF 6), token-buckets 8 (FF 7), socket-gate 6 (FF 5), origins 6 (FF 5), matchmake-gate 8 (FF 8), public-surface 11 (FF 11), refusal-log 5 (FF 5), http-body 3, upgrade-gate 5, matchmake-version-gate 11; start-server 11 (was 7); server 262 in all (was 189) |
| 2026-10-30 | Merge | `origin/main` (M4.11 `packages/dev-tools`) merged cleanly; `pnpm install` left the lockfile unchanged |
| 2026-10-30 | Gates | `pnpm format`; `pnpm check`: lint, typecheck, boundaries, root 163, net 89, pipelines 82, dev-tools 62, physics 71, server 262 (server suite three runs in a row, 262 each) |
| 2026-10-30 | Review fixes (security) | (1) A dot segment (`/x/../matchmake/…`, `/./…`, `/%2e/…`) skipped the matchmaking gate, because Colyseus routes on the WHATWG-normalised path: 4 cases red (200 for 403 from an unlisted origin; 200 for 400 from a listed one), now the gate reads the normalised path (for its prefix, `CALL` and the version gate's `VERSIONED`) and refuses any request whose raw path is not already normal with 400 `REFUSED`, logged `path`. A chunked body with no content-length is capped at `maxMessageBytes` (green on its first run: the gate's reader never relied on content-length). (2) A refused upgrade was only `end`ed and stayed half open, uncounted: a unit case and a half-open-client integration case red, now the socket is destroyed once the refusal is written. `pnpm check`: root 163, net 89, pipelines 82, dev-tools 62, physics 71, server 269 (three runs in a row, 269 each) |
