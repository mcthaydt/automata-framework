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
- **Status:** implemented and checked locally; Plus CI pending; not reviewed.

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

## As built (deviations and decisions for the Owner's veto)

- **The content load does not block the start.** The runtime listens, returns, and builds the throwaway sim beside
  itself; `/ready` flips and `server.started` is logged when it finishes. A blocking load held M7.3b's
  drain-during-create test (a plugin whose engine waits on a gate) forever. Content that cannot build a sim leaves the
  server alive but never ready, with one `start.refused` line (`code: 'content'`), rather than failing the start: a
  deploy waiting on `/ready` then leaves the live colour serving (D-c). Rooms are not refused while starting.
- **Session check in Colyseus's static `onAuth`.** It runs before a room is created or a seat reserved, so a forged
  token opens nothing. It also parses `JoinOptions` there, so a matchmaking request without valid options is now
  refused before it opens a room (523, Colyseus's status for a refusal). `start-server.test.ts`' "stops answering once
  its scope closes" now sends valid join options (same assertion); before, an empty POST opened a room. The token
  verified is `JoinOptions.session` (net's field), not Colyseus's `Authorization` token; a verifier that fails in any
  other way refuses. The anonymous verifier answers `playerId: 'anonymous'`.
- **Schema narrowed.** §4.5's `room` and `code` are `z.string()`; here `room` is digits and `code` an identifier
  (`^[A-Za-z][A-Za-z0-9_.-]{0,47}$`). Redaction is by allowlist of the schema's fields; a line that still fails is
  written as `log.invalid`. Levels: `fatal` for `fatal` and `start.refused`; `warn` for refusals, slow and late
  ticks, room errors, `replay.failed`, `log.invalid` and Colyseus's errors; `info` otherwise.
- **Events added beyond §4.5's list:** `server.started`, `start.refused`, `step.slow`, `log.invalid`,
  `colyseus.warn`, `colyseus.error` (M7.3b already added `room.error`, `replay.failed`, `drain.room`). `seat.left`
  carries `code: 'grace'` for a seat given up after a drop.
- **Colyseus's logger** is replaced by a text-free one (`colyseusLogger`); its info and debug go nowhere. Colyseus's
  logger is process-global, so the last server built in a process owns it.
- **Cooldown:** `tick.slow`, `step.slow` and `input.late` (per seat) are written at most once a room per ten seconds,
  applied in the Colyseus room's log wrapper so the engine's tests and SV-b are unchanged. The report counts lines,
  so its slow ticks are a lower bound (zero stays zero, which D-b reads).
- **Test switches are config fields** (`seed`, `manualClock`, a fake `verifier`), refused when the config's env says
  `NODE_ENV=production`, with an empty origin list. No `AUTOMATA_*` env test switch exists to refuse.
  `serverConfigFromEnv` requires `MAX_ROOMS` and `ALLOWED_ORIGINS` in every environment (spec §4.3 has no
  development exception; FloorFifty had one). `PORT` defaults to 3000.
- **security.txt** is served only when `SECURITY_CONTACT` and `SECURITY_EXPIRES` (or `ServerConfig.securityTxt`) are
  set; AF has no contact of its own. FloorFifty's `release:check` expiry guard is M7.7's if wanted.
- **`/health`** answers `{ ok: true }` only; FloorFifty's build facts there were for its client boot check, which is
  M7.4a's version gate.
- **Report (minimal, spec vague):** `automata-server report <log-file> [--days N] [--json]`; restarts are
  `server.started` lines; fatal classes include refused starts as `start.<cause>`; sockets given up are `seat.left`
  with `grace`; peak live rooms is created less disposed, reset at each `server.started` (with two colours writing
  one journal this is approximate; a periodic room-count event would be exact). The bin imports only Node so Node can
  run it from source.
- **Overlap with M7.4a:** SV-d's "refuses to start ... with a test switch set, naming it" is met here
  (`testSwitchesSet`, the `createServerRuntime` refusal test); M7.4a owns SV-d's origin half. Both rows touch
  `start-server.ts` and `automata-room.ts` (`onAuth`), so the second to merge resolves there.

## Ported and dropped

- **Ported:** `process-safety.ts` (guard naming every switch, crash handlers: one fatal line, exit 1, class only;
  FloorFifty's line also had the stack, dropped because the schema has no field for it and a stack can echo client
  text); `security-txt.ts` (fields, `text/plain`, nosniff); `colyseus-server.ts`' `/health`, `/ready` with
  `PROBE_HEADERS` and its wrapping of Colyseus's request listeners; `room-telemetry.ts`' slow-tick threshold (half a
  tick) and anomaly cooldown; `ops-telemetry.ts`' strict schema with identifier-only free values; `main.ts`' entry
  shape (refuse, crash handlers, start, drain); `report.mjs`' counts and layout.
- **Ported test cases:** process-safety 7 of 9 (production with limits starts, each switch refused, every switch
  named, empty value ignored, outside production allowed, rejection and exception crash lines); server-headers'
  probe headers (2) and security.txt (2); ops-telemetry's "refuses any field" and "refuses a message dressed as a
  class".
- **Dropped:** the telemetry HTTP endpoint and `telemetry-config.ts` (PD-5; spec §4.3's table cuts ops telemetry) and
  all 9 `telemetry-endpoint.test.ts` cases; the verbose-telemetry switch and its case; ops-telemetry's client event
  shapes (boot, asset-failure, socket, phase, rejection) and its load-id case (client telemetry, cut);
  `room-telemetry.ts`' summaries, distributions, physics counters, patch timings, invariant and build-skew lines and
  the debug endpoint; `/content` and its ETag cases (AF content ships in the build); `/health`'s build facts;
  `colyseus-app.ts` (the room is defined in `createServerRuntime`); the FLOOR_FIFTY env names; the MAX_ROOMS-unset
  development opening; the periodic `rooms` count line (peak rooms come from created and disposed).

## Execution log

| Date | Step | Evidence |
|---|---|---|
| 2026-10-30 | Plan | This file (`192c8ce`) |
| 2026-10-30 | serverLogLine, writer | 31 and 18 cases red (no module), then green |
| 2026-10-30 | session verifier, room telemetry, probes, process safety | 8, 6, 13 and 11 cases red (no module), then green |
| 2026-10-30 | Integration (SV-f, SV-g, SV-h, test switch) | 7 of 8 red for the expected reasons (a forged join seated; `/ready` not JSON; no refusal), then green after the wiring. SV-g first failed on the test's own order (a forged join into a full room is "locked"); the forged join now comes while a seat is free. The blocking content load hung M7.3b's drain-during-create test; the load now runs beside the server and SV-h gained "not ready before the content loads" (a gated plugin) and "never ready when it cannot load" |
| 2026-10-30 | server-process, report | 6 and 12 cases red (no module), then green; the bin runs from source under Node 24 |
| 2026-10-30 | Counts | new: schema 31, writer 18, probes 13, process-safety 11, server-process 6, server-operations 9 (SV-f 4, SV-g 1, SV-h 3, switch 1), session-verifier 8, room-telemetry 6, report 12 (114); server 303 in all (M7.3b's 189) |
| 2026-10-30 | Merge | origin/main (M4.11 dev-tools) merged clean; `pnpm install` |
| 2026-10-30 | Gates | `pnpm format`; `pnpm check`: lint, typecheck, boundaries 26 files 0 findings, root 163, net 89, pipelines 82, dev-tools 62, physics 71, server 303; server suite three runs in a row, 303 each (about 8 s) |
| 2026-10-30 | Review fixes | Each red first, then green. (1) A config `env` of `test` on a production process allowed the switches (red: start succeeded); `testSwitchesSet(config, ...envs)` now takes the config's env and `process.env`, production if either says so. (2) `Production`, `production ` and `production\r` skipped the guard and the clock hold (red); `isProduction` trims and lowercases. (3) `DEBUG` naming a Colyseus namespace (its `debug` loggers print stacks and payloads to the console past the writer) is refused in production as `DEBUG (colyseus)`, by the `debug` module's own pattern rule, negations included (red: no refusal). SV-g gained a handler fault (a request whose handler throws, through `debugAndPrintError` to the logger), a drain, and a production process through `runServerProcess` (stdout and stderr); these passed on the existing redaction, and the handler-fault case was checked to fail against a deliberately leaky Colyseus logger. (4) The report counted `constructor` and `toString` into `Object.prototype`'s answers and lost `__proto__` (red); its tables have no prototype. (5) `/ready` answered 200 at `maxRooms` (red); readiness is `full` there, 503, and `ready` again once a room closes. New: process-safety +22, clock-hold +3, probes +1, server-operations +4, report +1 (31). `pnpm format`; `pnpm check`: root 163, net 89, pipelines 82, dev-tools 62, physics 71, server 335; server suite three runs in a row, 335 each. Decision for the Owner: `DEBUG` is refused only in production (it stays a development tool), and an unrecognised `NODE_ENV` value is treated as not production |
| 2026-10-30 | Merge M7.4a | origin/main at 44fbd1d (the gates) merged; both sides of `start-server.ts` kept; M7.4b's tests pass the server's version in their join options (`TestServer.joinOptions`, or `gameVersionOf` for the production process) and the listed origin, and `testSwitchesSet`'s empty-origin case states its empty list (`TEST_LIMITS` now lists one). The two startups disagreed: M7.4a read the version from a sim before listening, which blocked the start on a slow plugin and turned bad content into a start failure. **One startup (decision):** the version read is the content load, run beside the listener; until it lands `version` is undefined, `/ready` is 503 (`starting`), and matchmaking other than reconnects is refused 503 `SERVER_UPDATING`, logged `refused` with `code: 'starting'`, as are a room's `onCreate` and `onAuth`; bad content leaves the server alive, never ready, with `start.refused` `content`. `ServerRuntime.version` is `GameVersion \| undefined`; the harness waits for it unless a test sets `awaitVersion: false`. Red first: the gated-plugin case (now also asserting the 503 `SERVER_UPDATING` refusal, no room, `refused starting`, and a 200 create once ready) timed out on the blocking start; the bad-content case failed with `ServerStartError` (now also asserting matchmaking 503); M7.4a's "holds no maxRooms slot" counted 3 sims, not 2 (one startup sim again). `pnpm format`; `pnpm check`: root 163, net 89, pipelines 82, dev-tools 62, physics 71, server 415; server suite three runs in a row, 415 each |
