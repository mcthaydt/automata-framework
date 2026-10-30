# M7.4b: `server` operations (redacting logs, `/health` and `/ready`, process safety, `SessionVerifier`), TDD plan

- **Spec:** the framework's M7 spec (`docs/superpowers/specs/2026-10-17-m7-online-store-design.md`) §4.3
  (`SessionVerifier`, `ServerConfig`, process safety), §4.5 (the server operations contract: `serverLogLine`, the log
  events, `/health`, `/ready`, the weekly `report`), §4.6 (the env file: `NODE_ENV`, `MAX_ROOMS`, `ALLOWED_ORIGINS`),
  §6 (failure policy: `UNVERIFIED`, process crash, draining), §13 SV-f, SV-g, SV-h and §13.1's logging, secrets,
  health and security.txt rows.
- **Row:** M7.4b in the framework's `docs/02-master-delivery-plan.md`. Prerequisite M7.3b. Size M. Runs beside M7.4a
  (the gates), which owns the size cap, origins, per-IP buckets, sockets and the version gate.
- **Branch:** `claude/plus-M7.4b-server-operations`, on `main` after M7.3b.
- **Sources (read-only):** FloorFifty `677d4568b7b2265fda4246d711065b8f417cac26`:
  `apps/server/src/{process-safety,security-txt,telemetry-config,telemetry-endpoint,main,colyseus-app}.ts`,
  `apps/server/src/colyseus-server.ts` (the `/health`, `/ready` and security.txt routes and the probe headers),
  `apps/server/src/rooms/room-telemetry.ts`, `packages/shared/src/common/ops-telemetry.ts`, `deploy/bin/report.mjs`,
  and the tests `tests/server/{process-safety,server-headers,telemetry-endpoint}.test.ts`,
  `tests/shared/common/ops-telemetry.test.ts`.
- **Status:** planned.

## Scope

In:

- **Logs.** The `serverLogLine` Zod schema (§4.5, strict) and a writer that turns each `RoomLogEvent` into one JSON
  line: it keeps only the schema's fields (every other key, a token, session id, authorization header, address,
  name, room code or payload among them, is dropped), stamps `ts` from an injected clock and `level` from the event,
  parses the line with the schema and writes it. A line that fails the schema is never written as it came: the writer
  writes `log.invalid` instead. The schema narrows §4.5's free strings: `room` is digits (the room's serial), `code`
  an identifier, so neither can carry an address, a space-separated name or a bearer header.
- **Colyseus's own logger** goes through the writer as text-free `colyseus.warn` and `colyseus.error` lines (info and
  debug dropped), so Colyseus never prints a room id or a client's text to stdout.
- **Probes** on the server's HTTP listener: `GET /health` 200 `{ ok: true }` while the process runs (draining too);
  `GET /ready` 200 `{ ready: true }` only once the game's content has loaded and while not draining, else 503
  `{ ready: false }`; `GET /.well-known/security.txt` (RFC 9116) when the config names a contact and an expiry, else
  404. All with `cache-control: no-store` and `x-content-type-options: nosniff`, and none carries player data.
- **Readiness:** the runtime listens, then loads the game's content once (a throwaway `createSim` with the game's
  plugins and content), then becomes ready. Content that does not load fails the start with `ServerStartError`.
- **Process safety:** `testSwitchesSet(config, env)` names each test switch set while `NODE_ENV` is `production`
  (`seed`, `manualClock`, a fake session verifier) and an empty origin list there; `createServerRuntime` refuses
  with `ServerStartError` naming them. `serverConfigFromEnv(env, base)` reads `PORT`, `MAX_ROOMS` and
  `ALLOWED_ORIGINS` (and the security.txt contact and expiry) and refuses, naming each, without the first two.
  `installCrashHandlers(target, log, exit)`: an uncaught exception or unhandled rejection writes one `fatal` line
  with the error's class only, then exits 1. `runServerProcess(def, options)` is the production entry that puts them
  together (env refusal logged as `start.refused` lines, crash handlers, stdout writer, `startServer`).
- **`SessionVerifier`** (§4.3): `verify(token)` → `{ playerId }` or `SessionRejected` (`missing`, `forged`,
  `expired`); `anonymousVerifier` (accepts every join; M7-D7, nothing durable is keyed by it); `createFakeVerifier`
  in `server/testing` (issues test tokens with an expiry; refuses a token it did not issue or one past its expiry on
  Effect's `Clock`). The room verifies `JoinOptions.session` in Colyseus's static `onAuth`, before a room is created
  or a seat reserved; a rejection is `UNVERIFIED` and logged `refused` with `code: 'session'`. The Ruken verifier
  waits on R-13.
- **Room telemetry as log events:** `step.slow` (a step past half its tick budget, measured on the room's clock), and
  a per-room cooldown (one line per kind, and per seat for `input.late`, each ten seconds) on `tick.slow`,
  `step.slow` and `input.late` so a slow room or a laggy client cannot flood the journal (FloorFifty's anomaly
  cooldown). `server.started` when the runtime is ready (the report's restarts and the reset of its room count).
  `seat.left` carries `code: 'grace'` when the seat was given up after a drop (the report's sockets given up).
- **`automata-server report`:** a bin that reads a log file and prints §4.5's summary over the last 7 days (or
  `--days N`): restarts, fatal classes, sockets given up, slow ticks (and slow steps), refusals by limit and peak live
  rooms; `--json` prints the counts as JSON.

Out: M7.4a's gates (origins, the size cap ahead of Colyseus, per-IP buckets, sockets, the version gate) and their
`refused` codes; the Ruken verifier (R-13); M7.7's deploy commands, systemd and journald retention; the uptime monitor
(an Owner gate).

## Files

- Create `packages/server/src/server/server-log-line.schema.ts` + test: `serverLogLine`, `ServerLogLine`, `LogLevel`.
- Create `packages/server/src/server/log-writer.ts` + test: `levelOf`, `toLogLine`, `createLogWriter`,
  `colyseusLogger`.
- Create `packages/server/src/server/probes.ts` + test: `Readiness`, `SecurityTxt`, `securityTxtBody`,
  `answerProbe`, `installProbes`, `PROBE_HEADERS`.
- Create `packages/server/src/server/process-safety.ts` + test: `testSwitchesSet`, `installCrashHandlers`,
  `CrashTarget`.
- Create `packages/server/src/server/server-process.ts` + test: `serverConfigFromEnv`, `runServerProcess`,
  `EnvServerBase`, `ServerProcessOptions`.
- Create `packages/server/src/session/session-verifier.ts` + test: `SessionVerifier`, `SessionRejected`,
  `VerifiedSession`, `anonymousVerifier`, `createFakeVerifier`, `FakeVerifier`, `isTestVerifier`.
- Create `packages/server/src/rooms/room-telemetry.ts` + test: `createAnomalyLimiter`, `ANOMALY_COOLDOWN_MS`,
  `slowStepMs`.
- Create `packages/server/src/bin/automata-server.ts` + test: the bin (self-contained: Node runs it from source, so it
  has no relative imports), `summarizeLog`, `formatReport`, `runCli`.
- Create `packages/server/src/server/server-operations.test.ts`: the integration cases SV-f, SV-g and SV-h on
  ephemeral ports.
- Modify `packages/server/src/game/server-config.ts` (`verifier`, `securityTxt`), `server/start-server.ts` (process
  safety, readiness, the content load, probes, `server.started`, Colyseus's logger, the verifier into the room
  context), `room/automata-room.ts` (static `onAuth` with the verifier, `step.slow`, the cooldown, `seat.left`'s
  grace code), `index.ts`, `testing/index.ts`, `package.json` (`bin`).

## Interfaces

```ts
// server-log-line.schema.ts (spec §4.5, narrowed)
export const serverLogLine: z.ZodType<ServerLogLine>   // strict { ts, level, event, room?, seat?, code?, ms?, count? }
// log-writer.ts
export function levelOf(event: string): LogLevel        // fatal | warn (refusals, slow, late, errors) | info
export function toLogLine(event: object, ts: number): ServerLogLine   // keeps only the schema's fields
export function createLogWriter(options: { write(line: string): void; now(): number }): (event: RoomLogEvent) => void
export function colyseusLogger(log: (event: RoomLogEvent) => void): ColyseusLogger
// probes.ts
export type Readiness = 'starting' | 'ready' | 'draining'
export interface SecurityTxt { readonly contact: string; readonly expires: string }
export function answerProbe(request, response, state: { readiness(): Readiness; securityTxt?: SecurityTxt }): boolean
export function installProbes(http: HttpServer, state): void   // our routes first, Colyseus's for the rest
// process-safety.ts
export function testSwitchesSet(config: ServerConfig, env): string[]
export function installCrashHandlers(target: CrashTarget, log, exit): void
// server-process.ts
export function serverConfigFromEnv(env, base: EnvServerBase): { ok: true; config: ServerConfig } | { ok: false; problems: string[] }
export function runServerProcess(def: ServerDef, options: ServerProcessOptions): Effect.Effect<never, ServerStartError, Scope.Scope>
// session-verifier.ts (spec §4.3)
export interface SessionVerifier { verify(token: string): Effect.Effect<VerifiedSession, SessionRejected> }
export const anonymousVerifier: SessionVerifier
export function createFakeVerifier(): FakeVerifier     // issue(playerId, { expiresAtMs }): string
// room-telemetry.ts
export function createAnomalyLimiter(now: () => number, cooldownMs?: number): (event: RoomLogEvent) => boolean
// bin/automata-server.ts
export function summarizeLog(lines: Iterable<string>, options: { nowMs: number; days: number }): ReportCounts
export function formatReport(counts: ReportCounts): string
// ServerConfig gains: verifier?: SessionVerifier; securityTxt?: SecurityTxt
```

## Tests, written first

1. **server-log-line.schema:** accepts each §4.5 event shape; refuses an unknown field (`token`, `name`, `ip`,
   `roomCode`, `payload`, `authorization`, `session`); refuses an event name outside the pattern; refuses a `room`
   that is not digits and a `code` that is not an identifier (an IP, `Bearer …`, a sentence).
2. **log-writer (SV-g unit):** one JSON line per event, parsed by the schema, `ts` from the clock and `level` from the
   event; a planted fake token, session id, authorization header, player name, room code and IP in extra fields never
   reach the line; a `code` holding an address or a bearer header writes `log.invalid` and nothing of it; Colyseus's
   logger writes `colyseus.error`/`colyseus.warn` with none of its text, and nothing for info or debug.
3. **probes (SV-h unit, on a bare listener, port 0):** `/health` 200 while starting, ready and draining; `/ready` 503
   while starting and draining, 200 when ready; both `no-store` and `nosniff` with no player data; security.txt with
   its contact and expiry as `text/plain`, 404 without one; other paths fall through to the next listener.
4. **process-safety (FloorFifty process-safety.test.ts, generic):** a production config with its limits starts;
   refuses `seed`, `manualClock` and a fake verifier, each named; names every one set, not just the first; an empty
   origin list in production; anything goes outside production; crash handlers write one `fatal` line with the class
   and exit 1 on an unhandled rejection, an uncaught exception and a thrown non-error, and the line holds none of the
   error's message.
5. **server-process:** `serverConfigFromEnv` refuses without `MAX_ROOMS`, with a non-number, without
   `ALLOWED_ORIGINS`, naming each; parses the origin list and the port; `runServerProcess` refuses, logging
   `start.refused` per problem and failing `ServerStartError`, before it listens; starts and installs crash handlers
   with a full env.
6. **session-verifier:** anonymous accepts any token and none; the fake accepts what it issued, refuses a forged
   token `forged`, an empty one `missing` and one past its expiry `expired` on TestClock; `isTestVerifier`.
7. **room-telemetry:** the first anomaly of a kind is logged, a second within ten seconds is not, one after is;
   `input.late` is limited per seat; other events always pass; `slowStepMs` is half the tick.
8. **report:** counts each §4.5 summary item from a fixture log; ignores lines older than the window, non-JSON lines
   and lines of other shapes; peak rooms resets at `server.started`; formats every row; `--json`; the bin run by
   Node on a file prints the summary, and a missing file exits 1.
9. **Integration (`server-operations.test.ts`, ephemeral ports):**
   - **SV-f:** with the fake verifier, a forged token and an expired token are refused `UNVERIFIED`, nobody is seated
     and no room opens; an issued token is seated; with the anonymous verifier a join without a token is seated.
   - **SV-g:** a planted fake token (`session` and `Authorization`), player name, room code and IP
     (`x-forwarded-for`) over the join, play, refuse (forged token, bad message) and crash paths never appear in the
     written lines or in anything printed to stdout or stderr; every written line parses with `serverLogLine`.
   - **SV-h:** `/ready` is 200 once started and 503 while draining a playing room, while `/health` stays 200; a server
     whose content does not load never becomes ready (start fails). (`VERSION_MISMATCH` is M7.4a's version gate.)
   - The runtime refuses a test switch in production, naming it.

## Gates

`pnpm format`, `pnpm check` (lint, typecheck, boundaries, root tooling tests, every package's `test:unit`); the server
suite three runs in a row. Pending: Plus CI, review.

## Execution log

| Date | Step | Evidence |
|---|---|---|
| 2026-10-30 | Plan | This file |
