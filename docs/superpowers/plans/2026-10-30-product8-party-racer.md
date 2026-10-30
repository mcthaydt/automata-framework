# PRODUCT.8: the Party Racer starter, plan and FloorFifty code baseline

- **Spec:** the framework's PRODUCT spec (`docs/superpowers/specs/2026-10-16-product-core-and-plus-design.md`) §3
  (FloorFifty on AF), §6 (starters), §10 (PRODUCT.8, acceptance **P-b**), §11 (PD-2: Rapier 2D; PD-3: order),
  appendix A (how FloorFifty is counted); the M7 spec's 2026-10-30 amendment (staging on a local VM or container).
- **Rows:** PRODUCT.8a (this plan and the baseline) to PRODUCT.8e in the framework's `docs/02-master-delivery-plan.md`.
- **Source:** FloorFifty at `677d4568b7b2265fda4246d711065b8f417cac26` (local clone; the spec read `ac72660`). Read-only.
- **Status:** PRODUCT.8a drafted; 8b to 8e not started.

P-b: "The Party Racer reproduces FloorFifty's loop (create room, join by code, ready, countdown, four-player race,
results, leaderboard) on placeholder content. Its game-specific code is measured against FloorFifty's baseline
(appendix A), and the target is set when the starter's plan is written." This file sets it.

## 1. The baseline (measured 2026-10-30 at `677d456`)

Appendix A's command, unchanged (non-test `.ts` and `.svelte` lines, comments included):

```sh
for d in apps/client/src/* apps/client/src/*/* apps/server/src/* packages/shared/src/* packages/*/; do
  [ -d "$d" ] && echo "$(find "$d" -name '*.ts' -o -name '*.svelte' | grep -v test | xargs cat 2>/dev/null | wc -l) $d"
done | sort -k2
```

| Area | Lines at `677d456` | Spec at `ac72660` |
|---|---|---|
| Client, all of `apps/client/src` | 53,376 | 52,832 |
| of which systems (gameplay 9,031; render 7,536; netcode 2,244) | 20,006 | 19,834 |
| of which UI (components 11,710) | 19,352 | 19,165 |
| of which managers (audio 4,285; network 1,205) | 8,518 | 8,459 |
| of which screens | 3,190 | 3,154 |
| Server, `apps/server/src` (rooms 4,329) | 5,553 | 5,548 |
| Shared, `packages/shared/src` | 6,320 | 6,273 |
| **Client + server + shared** | **65,249** | 64,653 |
| Asset contract (not counted: tooling, PRODUCT.5/M5's asset build) | 8,782 | 8,729 |

### FloorFifty's own game-specific code

"Content excluded" (spec §3): the race rules, course generation, art, songs and characters stay the game's. The lines
below are FloorFifty's race itself: the code a starter must still write, because no core or Plus package should own
it. Each group is counted with `find … | grep -v test | xargs cat | wc -l` at `677d456`.

| Group | Files | Lines |
|---|---|---|
| Race sim | `packages/shared/src/simulation/**` (772 + Planck adapter 902) | 1,674 |
| Course generation | `packages/shared/src/level/**` | 667 |
| Race rooms | `apps/server/src/rooms/{race-room,race-room-commands,race-room-state,race-projection,race-tuning,select-rules,character-rules}.ts` | 2,264 |
| Race client | `apps/client/src/systems/gameplay/*.ts` except `camera`, `touch-controls`, `swipe-controls`, `swipe-tracker` (core input and camera, M4) and `beat-clock` (cut to an example); `juice/` is `feel` | 5,435 |
| Race netcode | `apps/client/src/systems/netcode/{snapshot-to-race,speculative-contact,local-simulation,race-netcode}.ts` | 1,298 |
| **Total** | | **11,338** |

Everything else (about 53,900 of the 65,249 lines) is what core and Plus replace: boot, screens, UI, input, audio,
netcode, rooms, gates, deploy, saves, localization and post-processing.

## 2. The target (agent default, open to the Owner's veto)

Counted the same way over the starter's own code: every non-test `.ts` and `.svelte` file under
`starters/party-racer/src`, excluding `content/` (placeholder content, like FloorFifty's content exclusion).

- **T-1 (P-b's measure):** the starter's game-specific code is **at most 6,000 lines**: about 53% of FloorFifty's
  11,338 race lines and 9% of its 65,249. The starter has one mode (FloorFifty has race, survival and endless), no
  select steps (stage, song, character picks), no tutorial and no unlocks, so half of FloorFifty's race code is the
  honest comparison, and the rest of FloorFifty's lines must come from core and Plus.
- **T-2:** the starter has **no** file that re-implements a core or Plus capability: no room code generator, input
  queue, reconnection, snapshot buffer, filter, settings panel or audio deck. A grep test in 8e names the forbidden
  symbols; the F1 boundary test already refuses deep core imports.
- **T-3:** every line counted in T-1 is listed by group in 8e's acceptance record (sim, rooms, client, glue), with
  the command that produced it, so a reviewer can rerun it.

If 8e lands over T-1, the record says by how much and why; the target is not raised silently.

## 3. Slices

| Row | Needs | What | Acceptance |
|---|---|---|---|
| 8a | — | This plan and the baseline | The counts above rerun to the same numbers at `677d456` |
| 8b | 5f, 8a | Race sim on Rapier 2D (PD-2): players, platforms, collision, the step and one mode, ported from `packages/shared/src/simulation` and `level/course.ts` onto `@mcthaydt/automata-physics/2d` on placeholder content | A golden of a scripted four-player race, identical in Node, Chromium, WebKit and Firefox; the course generator's seeded output pinned |
| 8c | M7.5c, M7.6, 8b | Rooms: create, join by code, ready, countdown, with bot seats, on `net` and `server` | A headless four-client run (M7.6's harness) from create to the start of the race; a bot seat fills an empty one |
| 8d | PRODUCT.6, M3.3b, M6.1c, M5.8b, 8c | Kit screens wired; results and leaderboard (`Hosting.leaderboards`); post-retro 2D, the feel preset and audio-stream music | DOM and layout tests at the reference sizes; the leaderboard against the fake host |
| 8e | 8d, M7.7b | P-b end to end: four players through the loop, the server deployed by M7.7 to a local VM or container (decision 9), T-1 to T-3 measured | The playwright journey and the staging record; Owner: a play-through |

8b is the only slice that can start before M7's client and server land; it needs only physics in Plus (5f).

## 4. Decisions for the Owner's veto

- **PR8-D1:** T-1's 6,000-line ceiling and its scope (one mode, no select steps, tutorial or unlocks).
- **PR8-D2:** the starter lives in `starters/party-racer` in automata-plus (spec §6: "cloneable game repo"; how
  buyers clone it is QB.5 and PRODUCT.5h).
- **PR8-D3:** the course generator (`level/course.ts`) is ported as game code, not offered as a package: it is FloorFifty's
  content rule, so it stays the game's (spec §3).

## Execution log

| Date | Step | Evidence |
|---|---|---|
| 2026-10-30 | 8a baseline | Appendix A's command at `677d456`: 53,376 / 5,553 / 6,320 (client, server, shared); the five game-specific groups 1,674 + 667 + 2,264 + 5,435 + 1,298 = 11,338 |
