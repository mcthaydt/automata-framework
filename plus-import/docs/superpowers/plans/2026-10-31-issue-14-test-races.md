# Issue #14: two CI failures on code the PRs did not touch (plan and execution log)

> **Issue:** `mcthaydt/automata-plus#14`. **Branch:** `claude/plus-14-test-races`.

## 1. `locks.test.ts`: "release the target lock on SIGINT and exit 130" (run 41024692158)

**Cause, reproduced deterministically.** The child's exit status was `null`: the signal killed it, so no listener
was in place. The issue guessed that `Effect.runFork` starts the fiber asynchronously. It does not: `runFork` runs the
fiber synchronously up to its first async boundary. In `testing/hold-target.ts`, `holdTarget` and the `held` file both
ran inside `runFork`, before `runMain` installed its handlers. The parent saw `held` and sent SIGINT; when the child was
descheduled in that window, the signal met Node's default action.

**Fix.** `runMain` installs the SIGINT and SIGTERM handlers before it forks. A signal is dispatched from the event loop,
so the handler always finds the fiber. The case of no fiber is handled anyway and simply exits with the code.

**Tests, failing first:**
- `main.test.ts`: the listener counts read as a program's first effect are one more than before. This failed: they
  equalled the baseline.
- `main.test.ts`: `testing/signal-first.ts`, a program whose first effect is a SIGINT to its own process, exits 130.
  This failed with `{ status: null, signal: 'SIGINT' }`, which is CI's failure.
- `locks.test.ts` records the child's signal as well as its status, as the issue asked.

## 2. `public-surface.test.ts`: the socket caps test's first create got a 401 (run 41017151167)

**Not reproduced.** The most likely cause fits every fact in the issue. `createServerRuntime` called
`gameServer.listen(0)` with no host, so Node listened on the wildcard (`::`). The SDK connects to `127.0.0.1:<port>`.
On macOS, a wildcard listener can be given a port number that another process already holds on `127.0.0.1`, and the
kernel sends IPv4 loopback connections to the more specific listener. af-mac runs several runners at once. So the
first request can reach another process's server, which explains a 401 that none of our code or Colyseus's room path
produces, and a message that is an object. This container has no IPv6, so it cannot reproduce the macOS behaviour.

**Fix.**
- `ServerConfig.host` (optional): the address to listen on. Unset, it keeps Node's default, which is what a deployed
  server wants. `ServerRuntime.host` reports the bound address. An empty host is refused before listening.
- The test harness listens on `127.0.0.1`. With port 0 the system then picks a port that is free on `127.0.0.1`, and
  no other process can answer the test's requests.
- The harness's `create`, `joinById`, `quickMatch` and `reconnect` rethrow a failed matchmake as
  `matchmake <call> failed: code <code>, message <json>`, with the SDK's error as the cause. So if it happens again,
  the failure says what answered.

**Tests, failing first** (`start-server.test.ts`):
- an empty host is refused;
- the harness's runtime listens on `127.0.0.1` and answers matchmaking;
- with no host the address is the wildcard;
- a refused create through the harness reads `matchmake create failed: code 523, message "SERVER_BUSY…"`.

## Gates

`pnpm format`, then `pnpm check`: root 165, net 252, pipelines 140, dev-tools 62, physics 71, server 426, party-racer
45, all passing (lint, typecheck and boundaries clean).

## Decisions for the Owner's veto

- `ServerConfig.host` and `ServerRuntime.host` are new public fields of `@mcthaydt/automata-server`. The default
  is unset, which is unchanged behaviour. The alternative is a harness-only listen, which is not possible without
  reaching into Colyseus.
