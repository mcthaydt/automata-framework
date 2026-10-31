# M7.5c: `net`: interpolation, render clock, diagnostics, connection badge and reconnect overlay (TDD plan)

- **Spec:** the framework's M7 spec (`docs/superpowers/specs/2026-10-17-m7-online-store-design.md`): §4.2 (remote interpolation, degraded,
  the FloorFifty table), §7 (badge and reconnect overlay), §8 (responsive), acceptance N-a to N-d already in M7.5b.
- **Row:** M7.5c in the framework's `docs/02-master-delivery-plan.md`. Prerequisite M7.5b (merged, plus PR #16). Size L.
- **Branch:** `claude/plus-M7.5c-net-interpolation`, from main `529144c`; one PR, one commit per part.
- **Source (read-only):** the arcade source's `systems/netcode/{snapshot-buffer,render-clock,net-diagnostics}.ts` and their tests
  (9, 26 and 11). The authority half of `render-clock.ts` is already `session/authority-clock.ts` (M7.5b, 7 tests); this row adds the
  interpolation delay and the drawn moment. Provenance goes in the framework's `docs/provenance/sources.md` only.
- **Status:** plan drafted. Nothing built yet.

## Scope

In (`packages/net`, plus the debug panel in `packages/debug`):
- **`RenderClock`** (`session/render-clock.ts`): wraps `AuthorityClock`; the drawn moment is authority minus an *interpolation delay* that
  starts at `interpolationTicks` and adapts to the link: it covers the late tail of the last 60 arrivals (the spread below their
  median), never below the base, never above 15 ticks, slewed at 5 % of elapsed time, and never moving authority (so the input timeline
  is untouched). Ported render-clock tests for the delay and the drawn moment.
- **`SnapshotBuffer<T>`** (`session/snapshot-buffer.ts`): authoritative states by tick, generic over the game's view of the remote
  entities. `push` ignores a tick at or before the newest; the window is eight delays; `sample(renderTick)` returns the bracketing pair
  blended by a game-supplied `blend(from, to, t)` and never extrapolates (past the newest it holds the newest). Ported tests (9).
- **Session wiring:** `NetSession` takes an optional `remote: { read(sim): T; blend(a, b, t): T }` (the game says which entities are
  remote: those whose `net-owner` seat is not ours). Each snapshot pushes `read(sim)` of the restored state; `NetFrame` gains
  `renderTick` and `remote` (the blended view). No `remote` option, no change from M7.5b.
- **`NetDiagnostics`** (`session/net-diagnostics.ts`): round trip (last, median), snapshot gaps, late and republished snapshots, an
  underrun (a frame past the newest snapshot), late commands resent, corrections (size and count), clock snaps, the wire byte rate,
  and `degraded`: true while the round trip or the snapshot gap is past the thresholds (defaults 1000 ms, hysteresis down at 800).
  Plain counters and a ring of recent values, no Effect per frame. Ported tests (11) minus the race-specific ones (sprite pull,
  respawn adoption), which stay in the arcade source.
- **`ConnectionState` `degraded`:** `NetRoom` reads `degraded` from the diagnostics through `NetRoom.markDegraded(boolean)` (the session
  calls it on change); `reconnecting` and `connecting` win over it.
- **UI** (`packages/net/ui`, Svelte, jsdom behaviour tests and real-browser layout tests): the connection badge in `hud.overlay`
  (hidden offline; connecting; connected, hidden after 2 s; reconnecting with seconds left; degraded; a polite live region, not
  interactive) and the reconnect overlay (reconnecting with a countdown; disconnected too long with Leave at 48 px, focused, Back =
  Leave; pauses nothing). Text through locale keys (`net.badge.*`, `net.reconnect.*`, one `net.error.<CODE>` per `NetError` code).
  Layout at the reference sizes (844x390 and 780x270 one icon with a short label and a single row with Leave) and `xx-long`.
- **Debug panel** (`debug`): the diagnostics as a panel, read through a `net` handle on `DebugHost`.

Out: store (M7.7+), `createHeadlessClient`/`twoClientReplay` (M7.6), game-specific interpolation (the game's `blend`).

## Decisions for the Owner's veto

- **NT-D1:** the buffer is generic; `net` does not know components. The game supplies `read` and `blend` (the arcade source's blend is
  race-specific: a wrap threshold, a facing flag). Default: a position-and-angle helper `blendFields` for the common case, lerp on named
  numeric fields, no wrap rule.
- **NT-D2:** core gives extension components no message catalog, so `net`'s UI reads text through an injected `copy` object built from
  its English catalog (`netCopy(t)`), installed by the game (`installNetUi({ copy })`, as `debug` installs its host). Locale keys are
  the catalog's keys; a locale pass fills the other languages. Default: English catalog in `net`, keys listed in `net.copy.ts`.
- **NT-D3:** `degraded` thresholds are `net.toml` fields (`degradedRoundTripMs` 1000, `degradedGapMs` 1000), not constants.

## Interfaces

- Produces: `RenderClock`, `SnapshotBuffer`, `NetDiagnostics`, `blendFields`, `NetSessionOptions.remote`, `NetFrame.renderTick/remote`,
  `NetRoom.markDegraded`, `netBadge`/`netReconnect` components, `installNetUi`, `netCopy`; `DebugHost.net`.
- Consumes: `AuthorityClock` (M7.5b), `NetRoom` (M7.5a), `hud.overlay` slot, `debug` host (M6.2).

## Steps

Each step: write the test, see it fail for the stated reason, write the minimum, see it pass.

1. `RenderClock`: the delay and the drawn moment (ported tests). Fails: no module.
   - [x] 1
2. `SnapshotBuffer<T>` and `blendFields` (ported tests). Fails: no module.
   - [x] 2
3. `NetDiagnostics` and the thresholds (ported tests). Fails: no module.
   - [x] 3
4. Session wiring: `remote`, `renderTick`, diagnostics feed, `markDegraded`; `net.toml` thresholds. Fails: a frame carries no remote view.
   - [x] 4
5. Copy catalog, badge and reconnect overlay (DOM behaviour). Fails: no components.
   - [x] 5
6. Layout tests at the reference sizes and `xx-long` in Chromium, WebKit and Firefox. Fails: no layout test.
   - [x] 6
7. Debug panel; gates, provenance row, ready line.
   - [ ] 7

## Gates

- `pnpm format`, Plus `pnpm check`; `pnpm --filter @mcthaydt/automata-net test:parity` for the sim entry if touched (it is not: the sim
  side does not change) and the layout project in three engines. No golden moves. No changeset (private).
